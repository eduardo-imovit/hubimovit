-- =============================================================================
-- Segurança — fecha o restante do roadmap (Fase 1, S1–S3), 2026-09-28.
-- Autorizado pelo Eduardo. Não afeta login, magic link do portal nem cadastro:
-- nenhum desses fluxos lê tabela como anon, e gatilho não depende de EXECUTE.
-- =============================================================================

-- S1: backup do Meta Ads de 24/09 estava sem RLS (anon lia e gravava 698 linhas).
-- Trancado, não apagado (apagar depende do Eduardo).
alter table public.dashboard_meta_ads_backup_20260924 enable row level security;
revoke all on public.dashboard_meta_ads_backup_20260924 from anon, authenticated;

-- S2: conteúdo da Home só para a equipe (antes: qualquer logado, inclusive
-- cliente do portal). is_team() = tem perfil e não está suspenso; a TV
-- (tvaccess) e "Sem nível" têm perfil, então continuam vendo.
drop policy if exists avisos_leitura on public.avisos;
drop policy if exists "so equipe le" on public.avisos;
create policy "so equipe le" on public.avisos for select to authenticated using (is_team());

drop policy if exists biblioteca_links_leitura on public.biblioteca_links;
drop policy if exists "so equipe le" on public.biblioteca_links;
create policy "so equipe le" on public.biblioteca_links for select to authenticated using (is_team());

drop policy if exists home_banners_leitura on public.home_banners;
drop policy if exists "so equipe le" on public.home_banners;
create policy "so equipe le" on public.home_banners for select to authenticated using (is_team());

-- CRÍTICO (achado em 28/09): qualquer perfil (até "Sem nível") conseguia se
-- promover a Gestão pela API. O gatilho liberava `current_user in (postgres,
-- supabase_admin)`, mas dentro de SECURITY DEFINER o current_user é sempre o
-- dono da função (postgres), então a checagem nunca barrava. Agora a regra é
-- pelo token da requisição: vindo do app (authenticated/anon) e sem ser Gestão,
-- barra. SQL Editor (sem token de app) e Edge Functions com service_role
-- (ex.: gestao-colaboradores) continuam podendo.
create or replace function public.proteger_campos_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.email is distinct from old.email
      or new.id is distinct from old.id
      or new.suspenso_em is distinct from old.suspenso_em
      or new.suspenso_por is distinct from old.suspenso_por)
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not is_gestao() then
    raise exception 'Só a Gestão pode alterar nível de acesso, e-mail ou suspensão de um perfil';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

-- S3a: funções de gatilho SECURITY DEFINER não precisam ser chamáveis pela API
-- (/rest/v1/rpc/...). O gatilho continua disparando: EXECUTE só é checado ao
-- criar o trigger. service_role mantém o grant explícito.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.proteger_campos_perfil() from public, anon, authenticated;
revoke execute on function public.meta_ads_upsert() from public, anon, authenticated;
revoke execute on function public.leads_wpp_gtm_descarta_vazia() from public, anon, authenticated;
-- Ficam executáveis por anon, de propósito: is_gestao, is_adm_ou_gestao,
-- pode_acessar_documento_esteira e is_team. São usadas em policies avaliadas
-- também para anon (perfis, Storage); sem EXECUTE a consulta passaria de
-- "vazio" para erro. Para anon elas devolvem false.

-- S3b: search_path fixo nas funções apontadas pelo Security Advisor.
alter function public.update_updated_at() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.fn_update_atualizado_em() set search_path = public;
alter function public.tocar_updated_at() set search_path = public;
alter function public.log_status_historico() set search_path = public;
alter function public.recalcular_status_proposta() set search_path = public;
alter function public.fn_upsert_atividades() set search_path = public;
alter function public.fn_upsert_atividades_notas() set search_path = public;
alter function public.fn_atualiza_status(uuid, character varying, character varying, text) set search_path = public;
alter function public.match_documents(jsonb, integer, vector) set search_path = public;
