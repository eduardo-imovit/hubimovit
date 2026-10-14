-- Central de Cadastros (RF30, PRD §5.17, Schema §2.14) — Fase 21.
-- Uma tabela para os 6 cadastros (Locador/Locatário/Fiador × PF/PJ) em vez de
-- uma por formulário. Escrita só pela Edge Function cadastro-locador
-- (service_role, pula o RLS). Leitura direta: só gestão/adm. Anon: nada.
-- A tabela antiga cadastros_locador é preservada (sem escrita nova); as linhas
-- dela são copiadas como tipo 'locador-pf'. O bloco DO abaixo funciona tendo
-- a tabela antiga aplicada ou não (Fase 19 pode ainda não ter rodado).

create table if not exists public.cadastros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('locador-pf', 'locador-pj', 'locatario-pf', 'locatario-pj', 'fiador-pf', 'fiadora-pj')),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  pessoa jsonb not null,
  acompanhante jsonb,
  financeiro jsonb,
  imovel jsonb,
  destino text not null,
  origem text not null default 'hub' check (origem in ('hub', 'planilha')),
  email_ok boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.cadastros enable row level security;

revoke all on public.cadastros from anon;

drop policy if exists "gestao e adm leem" on public.cadastros;
create policy "gestao e adm leem" on public.cadastros
  for select to authenticated using ((select is_adm_ou_gestao()));

-- Traz as linhas da Fase 19 (se a tabela existir e ainda não foram trazidas).
do $$
begin
  if to_regclass('public.cadastros_locador') is not null then
    insert into public.cadastros (id, tipo, email, pessoa, acompanhante, financeiro, imovel, destino, origem, email_ok, created_at)
    select id, 'locador-pf', email, locador, conjuge, banco, imovel,
           'administrativo3@imovit.com.br', 'hub', email_ok, created_at
    from public.cadastros_locador
    on conflict (id) do nothing;
  end if;
end
$$;
