-- "Sem nível" não lê dados comerciais (decisão do Eduardo, 01/10: "só lê quem tem permissão").
--
-- Antes: 7 tabelas comerciais liam com is_team(), que vale para qualquer perfil
-- ativo, inclusive role 'user' (quem criou conta @imovit e ainda não recebeu
-- nível). Agora exigem um nível de verdade.
--
-- Ficam com is_team() (a Home é de todos os perfis, PAPEL_DESCRICAO.user):
-- avisos, biblioteca_links, home_banners, plantao, agendamentos_fotografo,
-- fotografo_bloqueios, datas_comemorativas e colaboradores_raw (aniversários na agenda).
-- A TV não muda: kpis_tv() é security definer.

create or replace function public.pode_ler_comercial()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfis
    where id = auth.uid()
      and suspenso_em is null
      and role in ('gestao', 'adm', 'marketing', 'corretor', 'tvaccess')
  );
$$;

revoke execute on function public.pode_ler_comercial() from public, anon;
grant execute on function public.pode_ler_comercial() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'dashboard_atendimentos_crm', 'atividades', 'atividades_notas', 'leads_wpp_gtm',
    'metas', 'metas_atividades_tipo', 'campanhas_metas'
  ] loop
    execute format('drop policy if exists "so equipe le" on public.%I', t);
    execute format('create policy "so quem tem nivel le" on public.%I for select to authenticated using (pode_ler_comercial())', t);
  end loop;
end
$$;
