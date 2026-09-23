-- =============================================================================
-- dashboard_meta_ads sem duplicados.
--
-- Causa: o fluxo n8n "meta_ads" roda todo dia às 3h e busca os últimos 14 dias
-- na Graph API, mas grava com "Create a row" (insert puro). Cada dia acabava
-- gravado até 14 vezes, com os valores daquele momento -- e somar a tabela
-- inflava investimento e conversões (ago/26: R$ 29.176 somado x R$ 2.950 real).
--
-- Correção sem mexer no fluxo:
--   1. backup da tabela como estava;
--   2. fica uma linha por (data, campanha, anuncio): a de maior investimento
--      (a Meta só consolida gasto pra cima, então é a leitura mais recente);
--   3. trigger BEFORE INSERT: se a chave já existe, atualiza a linha existente
--      com os números novos e descarta o insert -- o "Create a row" do n8n
--      passa a funcionar como upsert;
--   4. índice único como rede de segurança.
-- =============================================================================

create table if not exists dashboard_meta_ads_backup_20260923 as
  select * from dashboard_meta_ads;
alter table dashboard_meta_ads_backup_20260923 enable row level security;

delete from dashboard_meta_ads m
 using (
   select ctid,
          row_number() over (
            partition by data, campanha, anuncio
            order by investimento desc, alcance_impressoes desc, cliques desc, leads_conversoes desc
          ) as ordem
     from dashboard_meta_ads
 ) r
 where m.ctid = r.ctid and r.ordem > 1;

create or replace function meta_ads_upsert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update dashboard_meta_ads
     set investimento = new.investimento,
         alcance_impressoes = new.alcance_impressoes,
         cliques = new.cliques,
         leads_conversoes = new.leads_conversoes
   where data = new.data
     and campanha is not distinct from new.campanha
     and anuncio is not distinct from new.anuncio;
  if found then
    return null; -- já existia: atualizado, insert descartado
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meta_ads_upsert on dashboard_meta_ads;
create trigger trg_meta_ads_upsert before insert on dashboard_meta_ads
  for each row execute function meta_ads_upsert();

create unique index if not exists dashboard_meta_ads_dia_campanha_anuncio
  on dashboard_meta_ads (data, campanha, anuncio);

-- Colunas para a ponte de conversões do Google (preenchidas pelo fluxo wpp_gtm
-- quando o GTM passar a enviar os identificadores de clique).
alter table leads_wpp_gtm add column if not exists gclid text;
alter table leads_wpp_gtm add column if not exists gbraid text;
alter table leads_wpp_gtm add column if not exists wbraid text;
alter table leads_wpp_gtm add column if not exists fbclid text;
alter table leads_wpp_gtm add column if not exists origem_registro text;
