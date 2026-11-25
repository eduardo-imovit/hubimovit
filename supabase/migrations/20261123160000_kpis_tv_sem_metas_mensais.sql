-- kpis_tv() sem metas_mensais + remoção da metas_mensais (PRD §5.23, pendência 4) — 23/11
-- A kpis_tv() só usava metas_mensais para o campo 'meta_leads' (TV antiga, 23/09). A TV lê 'meta_leads_90d'
-- desde 25/09 (KpisTV.jsx) e 'meta_leads' já saía null (sem meta cadastrada para o mês). Nenhuma tela lê o campo.
-- Foto da saída antes da mudança: bkp_20261123_kpis_tv_saida.

-- 0. Backup do código atual da função (para voltar: execute a coluna def)
create table public.bkp_20261123_kpis_tv_def as select pg_get_functiondef('public.kpis_tv'::regproc) as def, now() as em;
alter table public.bkp_20261123_kpis_tv_def enable row level security;

-- 1. kpis_tv(): tira o select na metas_mensais, a variável e o campo 'meta_leads' (troca cirúrgica, com checagem)
do $$
declare
  def text := pg_get_functiondef('public.kpis_tv'::regproc);
  novo text;
begin
  novo := regexp_replace(def, '\s*select max\(leads_meta\) into v_meta_leads.*?= ''Todos'';', '', '');
  novo := regexp_replace(novo, '\s*''meta_leads'', v_meta_leads,', '', '');
  novo := regexp_replace(novo, '\s*v_meta_leads integer;', '', '');
  if position('metas_mensais' in novo) > 0 or position('v_meta_leads' in novo) > 0 then
    raise exception 'kpis_tv: trecho da metas_mensais não foi removido; revisar a migration';
  end if;
  if position('meta_leads_90d' in novo) = 0 then
    raise exception 'kpis_tv: meta_leads_90d sumiu; revisar a migration';
  end if;
  execute novo;
end;
$$;

-- 2. Backup e remoção da metas_mensais (sem cascade)
create table public.bkp_20261123_metas_mensais as select * from public.metas_mensais;
alter table public.bkp_20261123_metas_mensais enable row level security;
drop table public.metas_mensais;
