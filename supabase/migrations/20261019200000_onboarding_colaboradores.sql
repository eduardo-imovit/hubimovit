-- Onboarding de colaboradores (RF32, PRD §5.18, Schema §2.16) — 19/10.
-- A Gestão gera um link; o colaborador novo passa os dados (nome, telefone,
-- CPF, CRECI, equipe, endereço); o Eduardo cria o e-mail @imovit e o usuário
-- no Imoview; a Gestão informa os dois e aprova → upsert em colaboradores_raw.
-- Escrita só pela Edge Function `onboarding` (service_role, pula o RLS).
-- Leitura direta: só gestão. Anon: nada (o colaborador entra pelo token,
-- via função). CPF e endereço existem só aqui: nunca em colaboradores_raw,
-- que todo usuário logado lê.

create table if not exists public.onboarding_colaboradores (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (length(token) >= 32),
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  expira_em timestamptz not null,
  status text not null default 'link_enviado'
    check (status in ('link_enviado', 'dados_recebidos', 'aprovado', 'concluido', 'cancelado')),

  -- o que o colaborador envia
  nome_completo text,
  telefone text,
  cpf text check (cpf is null or cpf ~ '^\d{11}$'),
  creci_numero text,
  creci_uf text check (creci_uf is null or creci_uf ~ '^[A-Z]{2}$'),
  equipe text check (equipe is null or equipe in ('locacao', 'venda')),
  endereco jsonb, -- {cep, logradouro, numero, complemento, bairro, cidade, uf}
  data_nascimento date, -- só entra no formulário se a P1 do PRD for "sim"
  aceite_lgpd_em timestamptz,
  enviado_em timestamptz,

  -- aprovação (Gestão)
  email_imovit text check (email_imovit is null or lower(email_imovit) like '%@imovit.com.br'),
  id_corretor_crm bigint,
  aprovado_por uuid references public.perfis(id) on delete set null,
  aprovado_em timestamptz,

  -- checklist manual: {crm, repique, plantao, acesso_enviado} -> {em, por}
  marcacoes jsonb not null default '{}'::jsonb,

  email_ok boolean not null default false,
  cancelado_em timestamptz,
  cancelado_por uuid references public.perfis(id) on delete set null,

  constraint onboarding_aprovado_completo check (
    status not in ('aprovado', 'concluido') or (email_imovit is not null and id_corretor_crm is not null and aprovado_em is not null)
  )
);

create index if not exists onboarding_created_idx on public.onboarding_colaboradores (created_at desc);

alter table public.onboarding_colaboradores enable row level security;
revoke all on public.onboarding_colaboradores from anon, authenticated;
grant select on public.onboarding_colaboradores to authenticated;

drop policy if exists "gestao le" on public.onboarding_colaboradores;
create policy "gestao le" on public.onboarding_colaboradores
  for select to authenticated using ((select is_gestao()));
