-- Editar e excluir dados bancários pelo Hub (PRD §5.18b, B7–B8, Schema §2.21) — 04/11.
-- Gestão e ADM editam e excluem (só o bancário; o onboarding fica). A escrita
-- continua só pela Edge Function `onboarding` (eventos editar_bancarios e
-- excluir_bancarios), que confere o papel e as regras (PIX CPF = CPF dele).
-- Quem editou fica registrado: troca de PIX é o golpe clássico de desvio de
-- comissão, e a lista mostra "editado por X em data".

alter table public.onboarding_dados_bancarios
  add column if not exists atualizado_em timestamptz,
  add column if not exists atualizado_por uuid references public.perfis(id) on delete set null;

-- O retorno muda (2 colunas novas): precisa recriar.
drop function if exists public.dados_bancarios_colaboradores();
create function public.dados_bancarios_colaboradores()
returns table (
  onboarding_id uuid, nome_completo text, equipe text, status text, email_imovit text,
  banco text, agencia text, conta text, tipo_conta text, pix_tipo text, pix_chave text, informado_em timestamptz,
  atualizado_em timestamptz, atualizado_por_nome text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(is_adm_ou_gestao(), false) then
    raise exception 'sem acesso aos dados bancários' using errcode = '42501';
  end if;
  return query
    select o.id, o.nome_completo, o.equipe, o.status, o.email_imovit,
           b.banco, b.agencia, b.conta, b.tipo_conta, b.pix_tipo, b.pix_chave, b.informado_em,
           b.atualizado_em, coalesce(p.nome, p.email)
    from onboarding_dados_bancarios b
    join onboarding_colaboradores o on o.id = b.onboarding_id
    left join perfis p on p.id = b.atualizado_por
    where o.status <> 'cancelado'
    order by o.nome_completo;
end;
$$;

revoke all on function public.dados_bancarios_colaboradores() from public, anon;
grant execute on function public.dados_bancarios_colaboradores() to authenticated;
