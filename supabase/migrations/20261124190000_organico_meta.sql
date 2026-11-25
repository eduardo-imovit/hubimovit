-- Fase 29e · Orgânico — tabelas e RPC para as mídias sociais (Schema §2.23, PRD §5.23 pendência 8)
-- Formato LONGO: 1 linha por data × rede × conta × métrica. A Meta troca nomes de métrica
-- (impressions → views); linha nova no dicionário não exige coluna nova.
-- O n8n não escreve na tabela: chama carregar_organico(), que valida e faz upsert.
-- 24/11: escrita, NÃO aplicada e NÃO testada. Depende de OK do Eduardo e de BEGIN…ROLLBACK.

------------------------------------------------------------------------------------------
-- 1. Dicionário de métricas (escrita só por migration/Gestão; leitura dos painéis)
------------------------------------------------------------------------------------------
create table if not exists public.organico_metricas (
  rede     text not null,
  metrica  text not null,
  rotulo   text not null,
  descricao text,
  ordem    integer not null default 0,
  primary key (rede, metrica)
);

insert into public.organico_metricas (rede, metrica, rotulo, descricao, ordem) values
  ('instagram', 'alcance',          'Alcance',            'Contas únicas que viram o conteúdo (estimado)', 10),
  ('instagram', 'visualizacoes',    'Visualizações',      'Vezes que o conteúdo foi exibido', 20),
  ('instagram', 'interacoes',       'Interações',         'Total de interações com posts, stories e reels', 30),
  ('instagram', 'seguidores',       'Seguidores',         'Total de seguidores no fim do período', 40),
  ('instagram', 'seguidores_novos', 'Seguidores novos',   'Contas que seguiram no período (FOLLOWER)', 50),
  ('instagram', 'visitas_perfil',   'Visitas ao perfil',  'Acessos ao perfil', 60),
  ('instagram', 'cliques_site',     'Cliques no site',    'Toques no link do site', 70),
  ('facebook', 'alcance',           'Alcance',            'Contas únicas alcançadas', 10),
  ('facebook', 'visualizacoes',     'Visualizações',      'Vezes que o conteúdo foi exibido', 20),
  ('facebook', 'interacoes',        'Interações',         'Total de interações', 30),
  ('facebook', 'seguidores_novos',  'Seguidores novos',   'Novos seguidores da página', 40),
  ('facebook', 'cliques_site',      'Cliques no site',    'Toques no link do site', 50),
  ('tiktok', 'visualizacoes',       'Visualizações',      'Vezes que o conteúdo foi exibido', 10),
  ('tiktok', 'interacoes',          'Interações',         'Total de interações', 20),
  ('tiktok', 'seguidores_novos',    'Seguidores novos',   'Novos seguidores', 30),
  ('tiktok', 'visitas_perfil',      'Visitas ao perfil',  'Acessos ao perfil', 40),
  ('search_console', 'cliques',     'Cliques',            'Cliques no site', 10),
  ('search_console', 'impressoes',  'Impressões',         'Impressões na busca', 20),
  ('search_console', 'ctr',         'CTR',                'Taxa de cliques em %', 30),
  ('search_console', 'posicao_media', 'Posição média',    'Posição média na busca', 40),
  ('google_perfil', 'visualizacoes','Visualizações',      'Visualizações do perfil da empresa', 10),
  ('google_perfil', 'ligacoes',     'Ligações',           'Toques em ligar', 20),
  ('google_perfil', 'rotas',        'Rotas',              'Toques em rotas', 30),
  ('google_perfil', 'cliques_site', 'Cliques no site',    'Toques no link do site', 40)
on conflict (rede, metrica) do update
  set rotulo = excluded.rotulo, descricao = excluded.descricao, ordem = excluded.ordem;

------------------------------------------------------------------------------------------
-- 2. Diário longo. Releitura dos últimos 7 dias atualiza (API consolida com atraso).
------------------------------------------------------------------------------------------
create table if not exists public.organico_diario (
  id            bigint generated always as identity primary key,
  data          date not null,
  rede          text not null,
  conta         text not null,
  metrica       text not null,
  valor         numeric not null,
  atualizado_em timestamptz not null default now(),
  constraint organico_diario_chave unique (data, rede, conta, metrica),
  constraint organico_diario_metrica_fk foreign key (rede, metrica)
    references public.organico_metricas (rede, metrica)
);

create index if not exists organico_diario_rede_data_idx on public.organico_diario (rede, data desc);

------------------------------------------------------------------------------------------
-- 3. RPC de carga: só service_role. Valida a chave e faz upsert numa transação.
--    shortcut: p_posts existe para manter a assinatura do Schema §2.23, mas é ignorado
--    enquanto organico_posts não é criado (próxima sprint).
------------------------------------------------------------------------------------------
create or replace function public.carregar_organico(p_diario jsonb, p_posts jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas integer;
begin
  if jsonb_typeof(p_diario) is distinct from 'array' then
    raise exception 'p_diario deve ser um array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_diario) as x
    left join public.organico_metricas m
      on m.rede = x->>'rede' and m.metrica = x->>'metrica'
    where m.rede is null
       or x->>'data' is null
       or x->>'conta' is null
       or x->>'valor' is null
  ) then
    raise exception 'linha inválida: data, rede, conta, métrica ou valor ausentes; ou rede/métrica fora do dicionário'
      using errcode = '22023';
  end if;

  insert into public.organico_diario (data, rede, conta, metrica, valor)
  select (x->>'data')::date, x->>'rede', x->>'conta', x->>'metrica', (x->>'valor')::numeric
  from jsonb_array_elements(p_diario) as x
  on conflict (data, rede, conta, metrica) do update
    set valor = excluded.valor,
        atualizado_em = now();

  get diagnostics v_linhas = row_count;

  return jsonb_build_object('linhas', v_linhas);
end;
$$;

revoke all on function public.carregar_organico(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.carregar_organico(jsonb, jsonb) to service_role;

------------------------------------------------------------------------------------------
-- 4. RLS: Gestão e Marketing leem (pode_ver_dash); escrita só pela RPC; anon fora.
------------------------------------------------------------------------------------------
alter table public.organico_metricas enable row level security;
alter table public.organico_diario enable row level security;

drop policy if exists "organico_metricas leitura dash" on public.organico_metricas;
create policy "organico_metricas leitura dash" on public.organico_metricas
  for select to authenticated using (public.pode_ver_dash());

drop policy if exists "organico_diario leitura dash" on public.organico_diario;
create policy "organico_diario leitura dash" on public.organico_diario
  for select to authenticated using (public.pode_ver_dash());
