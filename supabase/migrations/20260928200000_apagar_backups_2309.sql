-- Backups manuais de 23–24/09, feitos antes das correções de duplicados no
-- Meta Ads e das linhas vazias no leads_wpp_gtm. As correções já foram
-- validadas e o Eduardo autorizou apagar (28/09). Nenhuma view, função ou
-- código usa estas tabelas.
drop table if exists public.dashboard_meta_ads_backup_20260923;
drop table if exists public.dashboard_meta_ads_backup_20260924;
drop table if exists public.leads_wpp_gtm_backup_20260923;
