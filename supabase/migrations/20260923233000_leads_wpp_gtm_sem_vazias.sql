-- =============================================================================
-- leads_wpp_gtm sem linhas vazias.
--
-- 3.939 linhas (cerca de 80% da tabela) chegavam sem nenhum dado: nem página,
-- nem UTM, nem contato, nem atendimento. Padrão de máquina, não de pessoa: 24h
-- por dia, em rajadas de 5 (e até 93) chamadas no mesmo segundo. Vêm do
-- webhook público do fluxo n8n "wpp_gtm", que grava o que chegar.
--
--   1. backup da tabela como estava;
--   2. remove as linhas sem nenhum dado;
--   3. trigger BEFORE INSERT descarta linha sem nenhum dado útil daqui em
--      diante (o n8n continua respondendo normalmente, só não grava lixo).
-- =============================================================================

create table if not exists leads_wpp_gtm_backup_20260923 as
  select * from leads_wpp_gtm;
alter table leads_wpp_gtm_backup_20260923 enable row level security;

delete from leads_wpp_gtm
 where tipo_conversao is null and pagina_url is null and utm_source is null
   and utm_medium is null and utm_campaign is null and whatsapp is null
   and interesse is null and nome is null and codigo_atendimento is null
   and imovel_codigo is null;

create or replace function leads_wpp_gtm_descarta_vazia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo_conversao is null and new.pagina_url is null and new.utm_source is null
     and new.utm_medium is null and new.utm_campaign is null and new.whatsapp is null
     and new.interesse is null and new.nome is null and new.codigo_atendimento is null
     and new.imovel_codigo is null and new.gclid is null and new.gbraid is null
     and new.wbraid is null and new.fbclid is null then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_wpp_gtm_descarta_vazia on leads_wpp_gtm;
create trigger trg_leads_wpp_gtm_descarta_vazia before insert on leads_wpp_gtm
  for each row execute function leads_wpp_gtm_descarta_vazia();
