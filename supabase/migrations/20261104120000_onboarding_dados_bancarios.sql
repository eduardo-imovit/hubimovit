-- Dados bancários do onboarding (RF32.7–10, PRD §5.18b, Schema §2.21) — 04/11.
-- Pedido do Financeiro: conta + PIX do colaborador, para pagar comissões.
-- Tabela à parte de onboarding_colaboradores porque a RLS vale para a linha
-- inteira: o ADM (financeiro) lê os dados bancários, mas não o CPF e o endereço.
-- Escrita só pela Edge Function `onboarding` (service_role). Leitura:
-- is_adm_ou_gestao(). Anon: nada.

create table if not exists public.onboarding_dados_bancarios (
  onboarding_id uuid primary key references public.onboarding_colaboradores(id) on delete cascade,

  -- conta: os 4 juntos ou nenhum
  banco text check (banco is null or length(banco) between 3 and 80),
  agencia text check (agencia is null or agencia ~ '^\d{1,5}(-[0-9Xx])?$'),
  conta text check (conta is null or conta ~ '^\d{1,13}-[0-9Xx]$'),
  tipo_conta text check (tipo_conta is null or tipo_conta in ('corrente', 'poupanca')),

  -- PIX: os 2 juntos ou nenhum
  pix_tipo text check (pix_tipo is null or pix_tipo in ('cpf', 'celular', 'email', 'aleatoria')),
  pix_chave text check (pix_chave is null or length(pix_chave) between 5 and 120),

  informado_em timestamptz not null default now(),

  constraint bancario_conta_completa check (
    (banco is null and agencia is null and conta is null and tipo_conta is null)
    or (banco is not null and agencia is not null and conta is not null and tipo_conta is not null)
  ),
  constraint bancario_pix_completo check ((pix_tipo is null) = (pix_chave is null)),
  constraint bancario_algum check (banco is not null or pix_tipo is not null)
);

alter table public.onboarding_dados_bancarios enable row level security;
revoke all on public.onboarding_dados_bancarios from anon, authenticated;
grant select on public.onboarding_dados_bancarios to authenticated;

drop policy if exists "adm ou gestao le" on public.onboarding_dados_bancarios;
create policy "adm ou gestao le" on public.onboarding_dados_bancarios
  for select to authenticated using ((select is_adm_ou_gestao()));

-- Lista do financeiro (Configurações ▸ Usuários): só nome, equipe e os dados
-- bancários. Sem CPF e sem endereço.
create or replace function public.dados_bancarios_colaboradores()
returns table (
  onboarding_id uuid, nome_completo text, equipe text, status text, email_imovit text,
  banco text, agencia text, conta text, tipo_conta text, pix_tipo text, pix_chave text, informado_em timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(is_adm_ou_gestao(), false) then
    raise exception 'sem acesso aos dados bancários' using errcode = '42501';
  end if;
  return query
    select o.id, o.nome_completo, o.equipe, o.status, o.email_imovit,
           b.banco, b.agencia, b.conta, b.tipo_conta, b.pix_tipo, b.pix_chave, b.informado_em
    from onboarding_dados_bancarios b
    join onboarding_colaboradores o on o.id = b.onboarding_id
    where o.status <> 'cancelado'
    order by o.nome_completo;
end;
$$;

revoke all on function public.dados_bancarios_colaboradores() from public, anon;
grant execute on function public.dados_bancarios_colaboradores() to authenticated;
