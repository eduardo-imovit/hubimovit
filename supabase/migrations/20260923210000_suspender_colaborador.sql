-- =============================================================================
-- Suspender / reativar colaborador (Gestão).
--
-- Suspender = bloqueio no Supabase Auth (feito pela Edge Function
-- gestao-colaboradores, que não deixa mais logar nem renovar a sessão) + esta
-- marca no perfil. A marca é o que corta o acesso NA HORA: os helpers de nível
-- passam a ignorar perfis suspensos, então uma sessão que ainda esteja aberta
-- não lê nem grava mais nada.
-- Excluir apaga o usuário do Auth (perfis cai em cascata; ver a função).
-- =============================================================================

alter table perfis add column if not exists suspenso_em timestamptz;
alter table perfis add column if not exists suspenso_por uuid references perfis(id) on delete set null;

create or replace function is_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and role = 'gestao' and suspenso_em is null);
$$;

create or replace function is_adm_ou_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and role in ('gestao', 'adm') and suspenso_em is null);
$$;

create or replace function papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select role from perfis where id = auth.uid() and suspenso_em is null;
$$;

-- Suspensão, assim como nível e e-mail, só muda pela Gestão ou pelo servidor.
create or replace function proteger_campos_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.email is distinct from old.email
      or new.id is distinct from old.id
      or new.suspenso_em is distinct from old.suspenso_em
      or new.suspenso_por is distinct from old.suspenso_por)
     and not is_gestao()
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só a Gestão pode alterar nível de acesso, e-mail ou suspensão de um perfil';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
