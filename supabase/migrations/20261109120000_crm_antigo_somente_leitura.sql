-- Fase 24 E5 (Schema §2.17): dashboard_atendimentos_crm vira arquivo morto, só leitura.
-- O fluxo crm_atendimentos foi desligado em 29/10 e a auditoria de 06/11 não achou
-- ninguém que grave nela. O service_role (n8n) passa por cima da RLS, então a trava
-- é na permissão. SELECT continua: a vw_atendimentos_base ainda lê a tabela.
-- Desfazer: grant insert, update, delete, truncate on public.dashboard_atendimentos_crm to service_role;
revoke insert, update, delete, truncate on public.dashboard_atendimentos_crm
  from anon, authenticated, service_role;
