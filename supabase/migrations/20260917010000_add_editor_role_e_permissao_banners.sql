-- Novo nivel de acesso "editor": so gerencia banners da Home/TV Display,
-- nao tem o resto do que admin ve em Configuracoes.
alter table perfis drop constraint perfis_role_check;
alter table perfis add constraint perfis_role_check check (role = any (array['admin','corretor','editor']));

create or replace function pode_gerenciar_banners() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and role in ('admin','editor'));
$$;

-- Tabela home_banners: escrita passa de admin-only para admin-ou-editor.
drop policy if exists home_banners_escrita_admin on home_banners;
create policy home_banners_escrita_editor on home_banners
  for all using (pode_gerenciar_banners()) with check (pode_gerenciar_banners());

-- Bucket de storage "banners": mesma troca.
drop policy if exists banners_atualiza_admin on storage.objects;
drop policy if exists banners_escrita_admin on storage.objects;
drop policy if exists banners_remove_admin on storage.objects;

create policy banners_atualiza_editor on storage.objects
  for update using (bucket_id = 'banners' and pode_gerenciar_banners());
create policy banners_escrita_editor on storage.objects
  for insert with check (bucket_id = 'banners' and pode_gerenciar_banners());
create policy banners_remove_editor on storage.objects
  for delete using (bucket_id = 'banners' and pode_gerenciar_banners());
