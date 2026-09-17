-- Hierarquia de acesso admin/usuário + página de Configurações
--
-- Hoje "avisos", "biblioteca_links", "datas_comemorativas", "plantao" e
-- "fotografo_bloqueios" têm uma única policy "hub_read_write" (ALL, qual: true)
-- para o role authenticated — ou seja, qualquer usuário logado grava direto,
-- não só quem a UI trata como admin. Substituímos por: leitura livre para
-- authenticated, escrita (insert/update/delete) só para is_admin().
--
-- agendamentos_fotografo já existe com RLS ligado mas sem nenhuma policy
-- (hoje inacessível via API) — ganha o mesmo padrão leitura/escrita.
--
-- home_banners é nova: carrossel de banners da Home, gerenciado em /configuracoes.

-- === avisos ===
drop policy if exists hub_read_write on public.avisos;
create policy avisos_leitura on public.avisos
  for select to authenticated using (true);
create policy avisos_escrita_admin on public.avisos
  for all to authenticated using (is_admin()) with check (is_admin());

-- === biblioteca_links ===
drop policy if exists hub_read_write on public.biblioteca_links;
create policy biblioteca_links_leitura on public.biblioteca_links
  for select to authenticated using (true);
create policy biblioteca_links_escrita_admin on public.biblioteca_links
  for all to authenticated using (is_admin()) with check (is_admin());

-- === datas_comemorativas ===
drop policy if exists hub_read_write on public.datas_comemorativas;
create policy datas_comemorativas_leitura on public.datas_comemorativas
  for select to authenticated using (true);
create policy datas_comemorativas_escrita_admin on public.datas_comemorativas
  for all to authenticated using (is_admin()) with check (is_admin());

-- === plantao ===
drop policy if exists hub_read_write on public.plantao;
create policy plantao_leitura on public.plantao
  for select to authenticated using (true);
create policy plantao_escrita_admin on public.plantao
  for all to authenticated using (is_admin()) with check (is_admin());

-- === fotografo_bloqueios ===
drop policy if exists hub_read_write on public.fotografo_bloqueios;
create policy fotografo_bloqueios_leitura on public.fotografo_bloqueios
  for select to authenticated using (true);
create policy fotografo_bloqueios_escrita_admin on public.fotografo_bloqueios
  for all to authenticated using (is_admin()) with check (is_admin());

-- === agendamentos_fotografo (RLS já ligado, sem policy) ===
create policy agendamentos_fotografo_leitura on public.agendamentos_fotografo
  for select to authenticated using (true);
create policy agendamentos_fotografo_escrita_admin on public.agendamentos_fotografo
  for all to authenticated using (is_admin()) with check (is_admin());

-- === home_banners (nova) ===
create table public.home_banners (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  imagem_path text not null,
  link_url text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.home_banners enable row level security;

create policy home_banners_leitura on public.home_banners
  for select to authenticated using (true);
create policy home_banners_escrita_admin on public.home_banners
  for all to authenticated using (is_admin()) with check (is_admin());

-- === storage: bucket "banners" (imagens do carrossel da Home) ===
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy banners_leitura_publica on storage.objects
  for select using (bucket_id = 'banners');
create policy banners_escrita_admin on storage.objects
  for insert to authenticated with check (bucket_id = 'banners' and is_admin());
create policy banners_atualiza_admin on storage.objects
  for update to authenticated using (bucket_id = 'banners' and is_admin());
create policy banners_remove_admin on storage.objects
  for delete to authenticated using (bucket_id = 'banners' and is_admin());
