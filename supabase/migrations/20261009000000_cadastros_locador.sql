-- Cadastro Locador PF no Hub (RF28, PRD §5.15, Schema §2.12) — 09/10.
-- Escrita só pela Edge Function cadastro-locador (service_role, pula o RLS).
-- Leitura direta: só gestão/adm. Anon: nada.

create table if not exists public.cadastros_locador (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locador jsonb not null,
  conjuge jsonb,
  banco jsonb not null,
  imovel jsonb not null,
  email_ok boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.cadastros_locador enable row level security;

revoke all on public.cadastros_locador from anon;

drop policy if exists "gestao e adm leem" on public.cadastros_locador;
create policy "gestao e adm leem" on public.cadastros_locador
  for select to authenticated using ((select is_adm_ou_gestao()));
