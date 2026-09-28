-- =============================================================================
-- REGISTRO (não muda nada no banco de 28/09): segurança aplicada pelo Eduardo
-- com o OpenCode pelo SQL Editor em 28/09, fora do histórico de migrations.
-- Lido do banco e escrito aqui para o repo voltar a refletir o que existe
-- (roadmap de segurança, Fase 1 S1/S2). Idempotente.
--   * is_team(): é da equipe quem tem perfil (só e-mails @imovit ganham) e não
--     está suspenso. Cliente do portal (magic link, sem perfil) não é equipe.
--   * 12 tabelas: leitura só para a equipe (antes: qualquer logado, inclusive
--     cliente do portal).
--   * 9 views vw_*: security_invoker (respeitam a RLS de quem consulta) e sem
--     grant para anon (antes: legíveis sem login).
-- =============================================================================

create or replace function public.is_team() returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from perfis
     where id = auth.uid()
       and suspenso_em is null
  );
$$;

drop policy if exists hub_read on public.agendamentos_fotografo;
drop policy if exists "so equipe le" on public.agendamentos_fotografo;
create policy "so equipe le" on public.agendamentos_fotografo as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.atividades;
drop policy if exists "so equipe le" on public.atividades;
create policy "so equipe le" on public.atividades as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.atividades_notas;
drop policy if exists "so equipe le" on public.atividades_notas;
create policy "so equipe le" on public.atividades_notas as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.campanhas_metas;
drop policy if exists "so equipe le" on public.campanhas_metas;
create policy "so equipe le" on public.campanhas_metas as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.colaboradores_raw;
drop policy if exists "so equipe le" on public.colaboradores_raw;
create policy "so equipe le" on public.colaboradores_raw as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.dashboard_atendimentos_crm;
drop policy if exists "so equipe le" on public.dashboard_atendimentos_crm;
create policy "so equipe le" on public.dashboard_atendimentos_crm as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.datas_comemorativas;
drop policy if exists "so equipe le" on public.datas_comemorativas;
create policy "so equipe le" on public.datas_comemorativas as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.fotografo_bloqueios;
drop policy if exists "so equipe le" on public.fotografo_bloqueios;
create policy "so equipe le" on public.fotografo_bloqueios as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.leads_wpp_gtm;
drop policy if exists "so equipe le" on public.leads_wpp_gtm;
create policy "so equipe le" on public.leads_wpp_gtm as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.metas;
drop policy if exists "so equipe le" on public.metas;
create policy "so equipe le" on public.metas as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.metas_atividades_tipo;
drop policy if exists "so equipe le" on public.metas_atividades_tipo;
create policy "so equipe le" on public.metas_atividades_tipo as permissive for select to authenticated using (is_team());

drop policy if exists hub_read on public.plantao;
drop policy if exists "so equipe le" on public.plantao;
create policy "so equipe le" on public.plantao as permissive for select to authenticated using (is_team());


alter view public.vw_aging_ativos set (security_invoker = true);
revoke select on public.vw_aging_ativos from anon;
alter view public.vw_atendimentos_base set (security_invoker = true);
revoke select on public.vw_atendimentos_base from anon;
alter view public.vw_cobertura_atividades set (security_invoker = true);
revoke select on public.vw_cobertura_atividades from anon;
alter view public.vw_corretores set (security_invoker = true);
revoke select on public.vw_corretores from anon;
alter view public.vw_descartes set (security_invoker = true);
revoke select on public.vw_descartes from anon;
alter view public.vw_funil_acumulado set (security_invoker = true);
revoke select on public.vw_funil_acumulado from anon;
alter view public.vw_kpis_mensais set (security_invoker = true);
revoke select on public.vw_kpis_mensais from anon;
alter view public.vw_origem_performance set (security_invoker = true);
revoke select on public.vw_origem_performance from anon;
alter view public.vw_tempo_resposta set (security_invoker = true);
revoke select on public.vw_tempo_resposta from anon;
