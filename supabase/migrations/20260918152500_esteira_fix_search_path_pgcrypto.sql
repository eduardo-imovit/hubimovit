-- pgcrypto esta instalado no schema "extensions", nao em "public" -- as
-- funcoes que chamam gen_random_bytes() precisam desse schema no search_path,
-- senao a chamada falha com "function does not exist". Mesmo bug ja existia
-- em upsert_proposta_locacao (nunca tinha sido exercitada de verdade ate
-- testar a esteira nova).

create or replace function criar_proposta_locacao(
  p_email             text,
  p_codigo_imovel     integer,
  p_proprietario_nome text,
  p_proprietario_email text,
  p_imovel_titulo     text default null,
  p_imovel_endereco   text default null,
  p_ator              text default 'corretor'
) returns propostas_locacao
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proposta propostas_locacao;
  v_token text;
begin
  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into propostas_locacao (
    email, codigo_imovel, proprietario_nome, proprietario_email,
    imovel_titulo, imovel_endereco, token_link, link_expira_em, status
  )
  values (
    lower(trim(p_email)), p_codigo_imovel, trim(p_proprietario_nome), lower(trim(p_proprietario_email)),
    p_imovel_titulo, p_imovel_endereco, v_token, now() + interval '7 days', 'aguardando_locatario'
  )
  on conflict (email, codigo_imovel) do update set
    proprietario_nome  = excluded.proprietario_nome,
    proprietario_email = excluded.proprietario_email,
    imovel_titulo      = coalesce(excluded.imovel_titulo, propostas_locacao.imovel_titulo),
    imovel_endereco    = coalesce(excluded.imovel_endereco, propostas_locacao.imovel_endereco),
    token_link      = case when propostas_locacao.link_expira_em < now() then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em  = case when propostas_locacao.link_expira_em < now() then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status          = case when propostas_locacao.link_expira_em < now() then 'aguardando_locatario' else propostas_locacao.status end
  returning * into v_proposta;

  return v_proposta;
end;
$$;

create or replace function upsert_proposta_locacao(
  p_nome_cliente   text,
  p_email          text,
  p_tel            text,
  p_codigo_imovel  integer,
  p_tipo_pessoa    text,
  p_tem_conjuge    boolean,
  p_ator           text default 'cliente'
) returns propostas_locacao
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proposta propostas_locacao;
  v_token text;
begin
  if p_tipo_pessoa not in ('Física', 'Jurídica') then
    raise exception 'tipo_pessoa inválido: %. Use Física ou Jurídica.', p_tipo_pessoa;
  end if;

  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into propostas_locacao (nome_cliente, email, tel, codigo_imovel, tipo_pessoa, tem_conjuge, token_link, link_expira_em)
  values (trim(p_nome_cliente), lower(trim(p_email)), p_tel, p_codigo_imovel, p_tipo_pessoa, p_tem_conjuge, v_token, now() + interval '7 days')
  on conflict (email, codigo_imovel) do update set
    nome_cliente   = excluded.nome_cliente,
    tel            = excluded.tel,
    tipo_pessoa    = excluded.tipo_pessoa,
    tem_conjuge    = excluded.tem_conjuge,
    token_link     = case when propostas_locacao.link_expira_em < now() then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em = case when propostas_locacao.link_expira_em < now() then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status         = case when propostas_locacao.link_expira_em < now() then 'criada' else propostas_locacao.status end
  returning * into v_proposta;

  return v_proposta;
end;
$$;
