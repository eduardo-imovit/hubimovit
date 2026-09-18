-- Nova hierarquia de acesso: gestao > adm > user (substitui admin/editor/corretor).
--
--   gestao -- tudo: Dashboard/metas de campanha, Usuarios & Acessos, alem de
--             tudo que adm ja tinha.
--   adm    -- operacao do dia a dia: Kanban, Banners, Configuracoes (Avisos,
--             Plantao, Agenda do Fotografo, Datas Comemorativas) -- exceto
--             Usuarios & Acessos e Dashboard, que sao so de gestao.
--   user   -- so a Home (era "corretor").
--
-- Mapeamento de dados existentes: admin->gestao, editor->adm, corretor->user.

alter table perfis drop constraint perfis_role_check;

update perfis set role = 'gestao' where role = 'admin';
update perfis set role = 'adm' where role = 'editor';
update perfis set role = 'user' where role = 'corretor';

alter table perfis add constraint perfis_role_check check (role = any (array['gestao','adm','user']));

-- Trigger de signup (handle_new_user) gravava role='corretor' pra conta nova.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.email !~* '@imovit\.com\.br$' then
    raise exception 'Cadastro permitido apenas para e-mails @imovit.com.br';
  end if;

  insert into public.perfis (id, email, role)
  values (new.id, new.email, 'user');

  return new;
end;
$$;

-- === funcoes de checagem de nivel ===
create or replace function is_gestao() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and role = 'gestao');
$$;

create or replace function is_adm_ou_gestao() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and role in ('gestao','adm'));
$$;

-- === perfis: so gestao gerencia todos os perfis (troca de role etc.) ===
drop policy if exists admin_ve_todos_perfis on perfis;
create policy admin_ve_todos_perfis on perfis for select using (is_gestao());

drop policy if exists admin_atualiza_qualquer_perfil on perfis;
create policy admin_atualiza_qualquer_perfil on perfis for update using (is_gestao());

-- === dashboards / metas: so gestao ===
drop policy if exists admin_le_meta_ads on dashboard_meta_ads;
create policy admin_le_meta_ads on dashboard_meta_ads for select to authenticated using (is_gestao());

drop policy if exists admin_le_google_ads on dashboard_google_ads;
create policy admin_le_google_ads on dashboard_google_ads for select to authenticated using (is_gestao());

drop policy if exists admin_le_metas_campanhas on metas_campanhas;
create policy admin_le_metas_campanhas on metas_campanhas for select to authenticated using (is_gestao());

drop policy if exists admin_le_metas_mensais on metas_mensais;
create policy admin_le_metas_mensais on metas_mensais for select to authenticated using (is_gestao());

-- === operacao do dia a dia: adm ou gestao ===
drop policy if exists avisos_escrita_admin on avisos;
create policy avisos_escrita_admin on avisos for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists biblioteca_links_escrita_admin on biblioteca_links;
create policy biblioteca_links_escrita_admin on biblioteca_links for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists datas_comemorativas_escrita_admin on datas_comemorativas;
create policy datas_comemorativas_escrita_admin on datas_comemorativas for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists plantao_escrita_admin on plantao;
create policy plantao_escrita_admin on plantao for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists fotografo_bloqueios_escrita_admin on fotografo_bloqueios;
create policy fotografo_bloqueios_escrita_admin on fotografo_bloqueios for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists agendamentos_fotografo_escrita_admin on agendamentos_fotografo;
create policy agendamentos_fotografo_escrita_admin on agendamentos_fotografo for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists home_banners_escrita_editor on home_banners;
drop policy if exists home_banners_escrita_admin on home_banners;
create policy home_banners_escrita_admin on home_banners for all to authenticated using (is_adm_ou_gestao()) with check (is_adm_ou_gestao());

drop policy if exists banners_atualiza_editor on storage.objects;
drop policy if exists banners_atualiza_admin on storage.objects;
create policy banners_atualiza_admin on storage.objects for update to authenticated using (bucket_id = 'banners' and is_adm_ou_gestao());

drop policy if exists banners_escrita_editor on storage.objects;
drop policy if exists banners_escrita_admin on storage.objects;
create policy banners_escrita_admin on storage.objects for insert to authenticated with check (bucket_id = 'banners' and is_adm_ou_gestao());

drop policy if exists banners_remove_editor on storage.objects;
drop policy if exists banners_remove_admin on storage.objects;
create policy banners_remove_admin on storage.objects for delete to authenticated using (bucket_id = 'banners' and is_adm_ou_gestao());

-- is_admin() / pode_gerenciar_banners() nao sao mais usadas por nenhuma policy.
drop function if exists is_admin();
drop function if exists pode_gerenciar_banners();
