-- =============================================================================
-- Fix: criar_proposta_locacao (upsert por email+codigo_imovel) só resetava
-- status/token quando o link antigo tinha EXPIRADO -- não considerava o caso
-- de a proposta ter sido descartada manualmente (status 'rejeitada'). Como o
-- link ainda estava dentro da validade, o upsert mantinha o status
-- 'rejeitada' e reaproveitava o token antigo, então o e-mail da "nova"
-- proposta apontava pra uma proposta rejeitada.
--
-- Fix: tratar status in ('rejeitada','expirada') igual a link expirado --
-- é um recomeço, então também reseta token/status/prazo e limpa os dados que
-- o locatário já tinha preenchido antes (tel, valor_oferta, observações,
-- cadastro), pra não vazar informação de um ciclo descartado pro novo.
-- =============================================================================

create or replace function criar_proposta_locacao(
  p_nome_cliente  text,
  p_email         text,
  p_codigo_imovel integer,
  p_valor         numeric,
  p_imovel_titulo   text default null,
  p_imovel_endereco text default null,
  p_ator          text default 'corretor'
) returns propostas_locacao
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proposta propostas_locacao;
  v_token text;
  v_reinicia boolean;
begin
  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

  select (status in ('rejeitada', 'expirada') or link_expira_em < now())
    into v_reinicia
  from propostas_locacao
  where email = lower(trim(p_email)) and codigo_imovel = p_codigo_imovel;

  insert into propostas_locacao (
    nome_cliente, email, codigo_imovel, valor,
    imovel_titulo, imovel_endereco, token_link, link_expira_em, status
  )
  values (
    trim(p_nome_cliente), lower(trim(p_email)), p_codigo_imovel, p_valor,
    p_imovel_titulo, p_imovel_endereco, v_token, now() + interval '7 days', 'aguardando_locatario'
  )
  on conflict (email, codigo_imovel) do update set
    nome_cliente       = excluded.nome_cliente,
    valor              = excluded.valor,
    imovel_titulo      = coalesce(excluded.imovel_titulo, propostas_locacao.imovel_titulo),
    imovel_endereco    = coalesce(excluded.imovel_endereco, propostas_locacao.imovel_endereco),
    token_link      = case when v_reinicia then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em  = case when v_reinicia then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status          = case when v_reinicia then 'aguardando_locatario' else propostas_locacao.status end,
    tel             = case when v_reinicia then null else propostas_locacao.tel end,
    valor_oferta    = case when v_reinicia then null else propostas_locacao.valor_oferta end,
    observacoes     = case when v_reinicia then null else propostas_locacao.observacoes end,
    tipo_pessoa     = case when v_reinicia then null else propostas_locacao.tipo_pessoa end,
    tem_conjuge     = case when v_reinicia then null else propostas_locacao.tem_conjuge end,
    profissao       = case when v_reinicia then null else propostas_locacao.profissao end,
    cargo           = case when v_reinicia then null else propostas_locacao.cargo end,
    tipo_renda      = case when v_reinicia then null else propostas_locacao.tipo_renda end,
    renda_pessoal   = case when v_reinicia then null else propostas_locacao.renda_pessoal end,
    renda_familiar  = case when v_reinicia then null else propostas_locacao.renda_familiar end,
    nome_empresa    = case when v_reinicia then null else propostas_locacao.nome_empresa end,
    conjuge_nome    = case when v_reinicia then null else propostas_locacao.conjuge_nome end,
    conjuge_email   = case when v_reinicia then null else propostas_locacao.conjuge_email end,
    conjuge_profissao = case when v_reinicia then null else propostas_locacao.conjuge_profissao end,
    conjuge_renda   = case when v_reinicia then null else propostas_locacao.conjuge_renda end
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function criar_proposta_locacao is 'Corretor cria a proposta com nome/email do locatário + imóvel + valor pedido. Se já existir proposta pra esse email+imóvel rejeitada/expirada/com link vencido, reinicia do zero (token novo, status aguardando_locatario, limpa dados do ciclo anterior). Sem proprietário -- gestor de locação faz a ponte fora do sistema.';
