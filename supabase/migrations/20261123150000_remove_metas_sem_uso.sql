-- Limpeza das tabelas de metas sem uso (PRD §5.23, pendência 4) — 23/11
-- Decisão do Eduardo: apagar já, com backup.
-- Sem uso em: código do app (main e wip/regua-de-data), views, funções, policies de outras tabelas.
-- ⚠ campanhas_metas tinha 229 leituras de origem não identificada (provável fluxo n8n que o conector não lê).
--   Se algo quebrar: create table public.campanhas_metas as select * from public.bkp_20261123_campanhas_metas; (+ RLS/policies)
-- FICAM: metas_mensais (até ajustar kpis_tv), metas_campanhas, campanha_metas, metas_atividades_tipo.

-- 1. Backups (RLS ligado e sem policy: invisíveis pela API, só SQL)
create table public.bkp_20261123_metas as select * from public.metas;
create table public.bkp_20261123_kpi_baselines as select * from public.kpi_baselines;
create table public.bkp_20261123_campanhas_metas as select * from public.campanhas_metas;
alter table public.bkp_20261123_metas enable row level security;
alter table public.bkp_20261123_kpi_baselines enable row level security;
alter table public.bkp_20261123_campanhas_metas enable row level security;

-- 2. Remoção (sem cascade: se algo ainda depender, a migration falha e nada é apagado)
drop table public.metas;
drop table public.kpi_baselines;
drop table public.campanhas_metas;
