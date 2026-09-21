-- =============================================================================
-- Esteira de locação v2 — corretor simplificado, sem proprietário no sistema.
--
-- Decisões da revisão de negócio de 2026-09-21 (ver nota "Fluxo de proposta -
-- negócio" no Obsidian):
--   1. Proprietário deixa de logar no sistema. Depois da revisão interna
--      aprovada, a esteira abre DIRETO pro locatário (pula o "criada" +
--      aprovação do proprietário).
--   2. Corretor cadastra: nome do locatário, e-mail, código do imóvel,
--      valor (pedido), título, endereço. Nome e e-mail do proprietário saem
--      do formulário -- as colunas continuam existindo (dado legado), só
--      não são mais preenchidas.
--   3. Locatário, ao confirmar dados, também informa valor da oferta e
--      observações -- ficam disponíveis pro gestor de locação acompanhar.
-- =============================================================================

alter table propostas_locacao
  add column if not exists valor numeric(12,2),
  add column if not exists valor_oferta numeric(12,2),
  add column if not exists observacoes text;

-- -----------------------------------------------------------------------------
-- criar_proposta_locacao: agora já pede o nome do locatário e o valor
-- pedido do imóvel; proprietário sai da assinatura (colunas ficam, sem uso).
-- -----------------------------------------------------------------------------

create or replace function criar_proposta_locacao(
  p_nome_cliente  text,
  p_email         text,
  p_codigo_imovel integer,
  p_valor         numeric,
  p_imovel_titulo   text default null,
  p_imovel_endereco text default null,
  p_ator          text default 'corretor'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare
  v_proposta propostas_locacao;
  v_token text;
begin
  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

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
    token_link      = case when propostas_locacao.link_expira_em < now() then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em  = case when propostas_locacao.link_expira_em < now() then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status          = case when propostas_locacao.link_expira_em < now() then 'aguardando_locatario' else propostas_locacao.status end
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function criar_proposta_locacao is 'Corretor cria a proposta com nome/email do locatário + imóvel + valor pedido. Sem proprietário -- gestor de locação faz a ponte fora do sistema.';

-- -----------------------------------------------------------------------------
-- confirmar_dados_locatario: locatário confirma/edita o nome, completa
-- tel/tipo de pessoa/cônjuge, e agora também informa valor da oferta e
-- observações. Termina em aguardando_aprovacao_interna, igual antes.
-- -----------------------------------------------------------------------------

create or replace function confirmar_dados_locatario(
  p_proposta_id uuid,
  p_nome text,
  p_tel text,
  p_tipo_pessoa text,
  p_tem_conjuge boolean,
  p_valor_oferta numeric default null,
  p_observacoes text default null,
  p_ator text default 'locatario'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  if p_tipo_pessoa not in ('Física', 'Jurídica') then
    raise exception 'tipo_pessoa inválido: %. Use Física ou Jurídica.', p_tipo_pessoa;
  end if;

  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Prazo da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if v_proposta.status <> 'aguardando_locatario' then
    raise exception 'Proposta % está em status %, esperado "aguardando_locatario"', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  update propostas_locacao
     set nome_cliente = trim(p_nome), tel = p_tel, tipo_pessoa = p_tipo_pessoa, tem_conjuge = p_tem_conjuge,
         valor_oferta = p_valor_oferta, observacoes = p_observacoes, status = 'aguardando_aprovacao_interna'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

-- -----------------------------------------------------------------------------
-- decidir_aprovacao_interna: aprovado agora vai DIRETO pra aguardando_docs
-- (pula "criada" + aprovação do proprietário, que não existe mais).
-- -----------------------------------------------------------------------------

create or replace function decidir_aprovacao_interna(
  p_proposta_id uuid,
  p_decisao text,
  p_ator text,
  p_motivo text default null
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  if p_decisao not in ('aprovado', 'rejeitado') then
    raise exception 'Decisão inválida: %. Use aprovado ou rejeitado.', p_decisao;
  end if;

  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.status <> 'aguardando_aprovacao_interna' then
    raise exception 'Proposta % está em status %, esperado "aguardando_aprovacao_interna"', p_proposta_id, v_proposta.status;
  end if;

  if p_decisao = 'rejeitado' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo é obrigatório ao rejeitar a proposta % na revisão interna', p_proposta_id;
  end if;

  perform set_config('app.ator', p_ator, true);
  perform set_config('app.motivo', coalesce(p_motivo, ''), true);

  update propostas_locacao
     set status = case when p_decisao = 'aprovado' then 'aguardando_docs' else 'aguardando_locatario' end
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;
