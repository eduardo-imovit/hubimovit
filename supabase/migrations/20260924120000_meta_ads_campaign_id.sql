-- =============================================================================
-- dashboard_meta_ads identificada pelo ID da campanha, não pelo nome.
--
-- Causa: a chave (data, campanha, anuncio) usa o NOME da campanha. Quando uma
-- campanha é renomeada, o fluxo n8n "meta_ads" regrava os últimos 14 dias com o
-- nome novo e as linhas com o nome antigo ficam: o mesmo gasto conta duas vezes
-- (jul/26: R$ 10.178 na tabela x R$ 9.016 na API). E duas campanhas diferentes
-- com o mesmo nome no mesmo dia colidem (a segunda sobrescrevia a primeira).
--
-- Correção:
--   1. coluna campaign_id (ID da Meta, texto);
--   2. trigger meta_ads_upsert passa a casar pelo campaign_id quando ele vem
--      preenchido -- e atualiza o nome junto, então renomear só troca o rótulo;
--      linha antiga do mesmo dia sem id e com o mesmo nome adota o id;
--      sem campaign_id, segue o comportamento de hoje (por nome);
--   3. índices únicos: por id quando há id, por nome só nas linhas sem id.
--
-- Ordem de deploy: esta migration ANTES de o fluxo n8n começar a mandar
-- campaign_id (o nó do Supabase falha se a coluna não existir).
-- =============================================================================

alter table dashboard_meta_ads add column if not exists campaign_id text;

create or replace function meta_ads_upsert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.campaign_id is not null then
    update dashboard_meta_ads
       set campanha = new.campanha,
           investimento = new.investimento,
           alcance_impressoes = new.alcance_impressoes,
           cliques = new.cliques,
           leads_conversoes = new.leads_conversoes
     where data = new.data
       and campaign_id = new.campaign_id
       and anuncio is not distinct from new.anuncio;
    if found then
      return null;
    end if;

    -- linha gravada antes do campaign_id existir: adota o id
    update dashboard_meta_ads
       set campaign_id = new.campaign_id,
           investimento = new.investimento,
           alcance_impressoes = new.alcance_impressoes,
           cliques = new.cliques,
           leads_conversoes = new.leads_conversoes
     where data = new.data
       and campaign_id is null
       and campanha is not distinct from new.campanha
       and anuncio is not distinct from new.anuncio;
    if found then
      return null;
    end if;

    return new;
  end if;

  -- sem campaign_id (fluxo antigo): por nome, como antes
  update dashboard_meta_ads
     set investimento = new.investimento,
         alcance_impressoes = new.alcance_impressoes,
         cliques = new.cliques,
         leads_conversoes = new.leads_conversoes
   where data = new.data
     and campaign_id is null
     and campanha is not distinct from new.campanha
     and anuncio is not distinct from new.anuncio;
  if found then
    return null;
  end if;
  return new;
end;
$$;

drop index if exists dashboard_meta_ads_dia_campanha_anuncio;

create unique index if not exists dashboard_meta_ads_dia_campaign_id_anuncio
  on dashboard_meta_ads (data, campaign_id, anuncio)
  where campaign_id is not null;

create unique index if not exists dashboard_meta_ads_dia_campanha_anuncio_sem_id
  on dashboard_meta_ads (data, campanha, anuncio)
  where campaign_id is null;
