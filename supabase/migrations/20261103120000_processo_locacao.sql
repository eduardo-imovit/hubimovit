-- Fase 25 / S1 — Processo de Locação (RF33, PRD §5.20, Schema §2.20)
-- REGULARIZA as 3 tabelas criadas em 30/10 pela página HTML da Direção (fora do repo).
-- Nunca faz drop de tabela nem de dado: só registra a estrutura e ajusta as permissões.
-- Dados em 03/11: 9 papéis, 42 etapas, 0 casos.

-- 1. Estrutura (no banco atual já existe, então "if not exists" não faz nada;
--    serve para o repo conseguir reconstruir o banco do zero).
--    FKs/checks/índices ainda não foram inventariados: ficam para uma migration à parte.
create table if not exists public.locacao_papeis (
  id            text primary key default gen_random_uuid()::text,
  nome          text not null,
  cor           text not null default '#7a8a99',
  externo       boolean not null default false,
  responsaveis  text not null default '',
  ordem         numeric not null default 0,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.locacao_etapas (
  id            text primary key default gen_random_uuid()::text,
  processo      text not null,                -- contrato | adm
  grupo         text not null default 'Sem fase',
  titulo        text not null,
  papel         text,                         -- → locacao_papeis.id
  canal         text not null default '',
  prazo         integer,                      -- dias úteis
  detalhes      text not null default '',
  checklist     jsonb not null default '[]'::jsonb,
  decisao       text not null default '',
  melhoria      text not null default '',
  ordem         numeric not null default 0,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.locacao_casos (
  id            uuid primary key default gen_random_uuid(),
  processo      text not null,
  fluxo         text,
  imovel        text not null,
  partes        text not null default '',
  esteira       text not null default '',
  etapa_id      text,                         -- → locacao_etapas.id
  status        text not null default 'andamento',  -- andamento | concluido | cancelado
  inicio        timestamptz not null default now(),
  desde         timestamptz not null default now(),
  fim           timestamptz,
  motivo        text,
  feitos        jsonb not null default '{}'::jsonb,
  historico     jsonb not null default '[]'::jsonb,
  criado_por    uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);

alter table public.locacao_papeis enable row level security;
alter table public.locacao_etapas enable row level security;
alter table public.locacao_casos  enable row level security;

-- 2. Quem pode LER o guia: o time com nível (espelha ACESSO.processoLocacao no front).
--    Diferente de is_team(), que aceita qualquer perfil (inclusive "Sem nível" e a TV).
create or replace function public.pode_ler_processo_locacao()
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
      and role in ('gestao', 'adm', 'corretor', 'marketing')
  );
$$;

revoke execute on function public.pode_ler_processo_locacao() from public, anon;
grant  execute on function public.pode_ler_processo_locacao() to authenticated;

-- 3. Policies. Remove as da página da Direção e recria com a regra decidida em 30/10.
--    (drop policy apaga só a REGRA, não os dados.)
drop policy if exists "equipe le papeis"            on public.locacao_papeis;
drop policy if exists "adm e gestao editam papeis"  on public.locacao_papeis;
drop policy if exists "equipe le etapas"            on public.locacao_etapas;
drop policy if exists "adm e gestao editam etapas"  on public.locacao_etapas;
drop policy if exists "equipe le casos"             on public.locacao_casos;
drop policy if exists "equipe cria casos"           on public.locacao_casos;
drop policy if exists "equipe atualiza casos"       on public.locacao_casos;
drop policy if exists "adm e gestao excluem casos"  on public.locacao_casos;
-- (nomes novos também, para a migration poder rodar duas vezes sem erro)
drop policy if exists "time le papeis"              on public.locacao_papeis;
drop policy if exists "time le etapas"              on public.locacao_etapas;
drop policy if exists "adm e gestao gerem casos"    on public.locacao_casos;

-- Guia: o time lê; só gestão/adm escrevem.
create policy "time le papeis" on public.locacao_papeis
  for select to authenticated using ((select pode_ler_processo_locacao()));
create policy "adm e gestao editam papeis" on public.locacao_papeis
  for all to authenticated
  using ((select is_adm_ou_gestao())) with check ((select is_adm_ou_gestao()));

create policy "time le etapas" on public.locacao_etapas
  for select to authenticated using ((select pode_ler_processo_locacao()));
create policy "adm e gestao editam etapas" on public.locacao_etapas
  for all to authenticated
  using ((select is_adm_ou_gestao())) with check ((select is_adm_ou_gestao()));

-- Casos: só gestão/adm (sem tela na v1; na v2 nascem da aprovação na Esteira). Decisão 03/11.
create policy "adm e gestao gerem casos" on public.locacao_casos
  for all to authenticated
  using ((select is_adm_ou_gestao())) with check ((select is_adm_ou_gestao()));

-- 4. Grants: só o necessário. TRUNCATE ignora RLS, então sai.
revoke all on public.locacao_papeis, public.locacao_etapas, public.locacao_casos from anon;
revoke truncate, trigger, references
  on public.locacao_papeis, public.locacao_etapas, public.locacao_casos from authenticated;
grant select, insert, update, delete
  on public.locacao_papeis, public.locacao_etapas, public.locacao_casos to authenticated;

-- 5. Realtime (já ligado em 03/11; garante para reconstrução).
do $$
declare t text;
begin
  foreach t in array array['locacao_papeis', 'locacao_etapas', 'locacao_casos'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
