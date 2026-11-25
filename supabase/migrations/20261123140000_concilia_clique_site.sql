-- Conciliação GTM × Severino (PRD §5.23, pendência 6) — 23/11
-- Lead do Severino que traz "Atendimento: XXXXXX" (código do clique no site) herda a origem do clique:
--   gclid/gbraid/wbraid ou google+cpc  → site_google_ads
--   fbclid ou facebook/instagram       → site_meta_ads
--   nenhum                             → mantém a mídia do n8n (wpp_pag_imovel / wpp_site_geral = Site orgânico)
-- O n8n lê a mídia já conciliada do retorno do insert e manda ao Imoview.

-- 1. Colunas novas
alter table public.leads_wpp_gtm
  add column if not exists clique_lead_id bigint,        -- linha do clique no site (origem_registro = 'site_gtm') que originou o lead
  add column if not exists imoview_atendimento bigint;   -- nº do atendimento no Imoview, gravado pelo n8n depois do IncluirLead

comment on column public.leads_wpp_gtm.clique_lead_id is 'lead_id do clique no site (site_gtm) com o mesmo codigo_atendimento; preenchido pelo trigger de conciliação';
comment on column public.leads_wpp_gtm.imoview_atendimento is 'código do atendimento no Imoview; gravado pelo n8n wpp_entrada';

-- 2. Regra num só lugar: dado um clique, qual a mídia paga (ou null se orgânico)
create or replace function public.midia_do_clique(c public.leads_wpp_gtm)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(c.gclid, '') is not null or nullif(c.gbraid, '') is not null or nullif(c.wbraid, '') is not null
      or (lower(c.utm_source) = 'google' and lower(c.utm_medium) = 'cpc')
      then 'site_google_ads'
    when nullif(c.fbclid, '') is not null
      or lower(c.utm_source) in ('facebook', 'instagram', 'fb', 'ig', 'meta')
      then 'site_meta_ads'
    else null
  end
$$;

-- 3. Trigger: no insert do Severino, procura o clique e ajusta a mídia
create or replace function public.leads_wpp_gtm_concilia_clique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.leads_wpp_gtm;
  m text;
begin
  if new.origem_registro is distinct from 'bot_severino' or new.codigo_atendimento is null then
    return new;
  end if;

  select * into c
    from public.leads_wpp_gtm s
   where s.origem_registro = 'site_gtm'
     and s.codigo_atendimento = new.codigo_atendimento
   order by s.created_at desc
   limit 1;

  if found then
    new.clique_lead_id := c.lead_id;
    m := public.midia_do_clique(c);
    if m is not null then
      new.utm_campaign := m;
    end if;
  end if;

  return new;
end;
$$;

-- nome começa com "trg_leads_wpp_gtm_e": roda depois do "..._descarta_vazia" (ordem alfabética)
drop trigger if exists trg_leads_wpp_gtm_e_concilia_clique on public.leads_wpp_gtm;
create trigger trg_leads_wpp_gtm_e_concilia_clique
  before insert on public.leads_wpp_gtm
  for each row execute function public.leads_wpp_gtm_concilia_clique();

-- 4. Histórico: aplica a mesma regra às linhas antigas do Severino (só no Supabase; o Imoview não muda)
with par as (
  select distinct on (b.lead_id)
         b.lead_id,
         s.lead_id as clique,
         public.midia_do_clique(s) as midia
    from public.leads_wpp_gtm b
    join public.leads_wpp_gtm s
      on s.origem_registro = 'site_gtm'
     and s.codigo_atendimento = b.codigo_atendimento
   where b.origem_registro = 'bot_severino'
   order by b.lead_id, s.created_at desc
)
update public.leads_wpp_gtm t
   set clique_lead_id = par.clique,
       utm_campaign = coalesce(par.midia, t.utm_campaign)
  from par
 where t.lead_id = par.lead_id;

-- 5. Mapa de canais: as mídias novas contam como "Campanhas pagas"
--    (troca cirúrgica na definição atual da view; falha se o trecho esperado não existir)
do $$
declare
  def text := pg_get_viewdef('public.vw_atendimentos_base'::regclass, true);
  ancora text := '''meta ads''::text,';
begin
  if position(ancora in def) = 0 then
    raise exception 'vw_atendimentos_base: trecho % não encontrado; revisar a migration', ancora;
  end if;
  if position('site_google_ads' in def) = 0 then
    def := replace(def, ancora, ancora || ' ''site_google_ads''::text, ''site_meta_ads''::text,');
    execute 'create or replace view public.vw_atendimentos_base with (security_invoker = true) as ' || def;
  end if;
end;
$$;
