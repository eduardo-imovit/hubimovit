-- =============================================================================
-- Esteira de locação — dados financeiros/profissionais do locatário PF +
-- dados do cônjuge (Parte 2 da revisão de negócio de 2026-09-21, ver nota
-- "Fluxo de proposta - negócio" no Obsidian).
--
-- Gap: o Hub não tinha onde guardar profissão, cargo, tipo de renda, renda
-- pessoal/familiar, nome da empresa (locatário PF) nem nome/e-mail/
-- profissão/renda do cônjuge -- só existia upload de documento, sem dado
-- estruturado. Réplica da lógica real do Tally em produção.
-- =============================================================================

alter table propostas_locacao
  add column if not exists profissao text,
  add column if not exists cargo text,
  add column if not exists tipo_renda text,
  add column if not exists renda_pessoal numeric(12,2),
  add column if not exists renda_familiar numeric(12,2),
  add column if not exists nome_empresa text,
  add column if not exists conjuge_nome text,
  add column if not exists conjuge_email text,
  add column if not exists conjuge_profissao text,
  add column if not exists conjuge_renda numeric(12,2);

-- -----------------------------------------------------------------------------
-- confirmar_dados_locatario: adiciona os campos financeiros/profissionais e
-- de cônjuge. Todos opcionais no RPC -- a obrigatoriedade condicional
-- (PF vs PJ, com/sem cônjuge) é validada no form do portal.
-- -----------------------------------------------------------------------------

create or replace function confirmar_dados_locatario(
  p_proposta_id uuid,
  p_nome text,
  p_tel text,
  p_tipo_pessoa text,
  p_tem_conjuge boolean,
  p_valor_oferta numeric default null,
  p_observacoes text default null,
  p_profissao text default null,
  p_cargo text default null,
  p_tipo_renda text default null,
  p_renda_pessoal numeric default null,
  p_renda_familiar numeric default null,
  p_nome_empresa text default null,
  p_conjuge_nome text default null,
  p_conjuge_email text default null,
  p_conjuge_profissao text default null,
  p_conjuge_renda numeric default null,
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
         valor_oferta = p_valor_oferta, observacoes = p_observacoes,
         profissao = p_profissao, cargo = p_cargo, tipo_renda = p_tipo_renda,
         renda_pessoal = p_renda_pessoal, renda_familiar = p_renda_familiar, nome_empresa = p_nome_empresa,
         conjuge_nome = p_conjuge_nome, conjuge_email = p_conjuge_email,
         conjuge_profissao = p_conjuge_profissao, conjuge_renda = p_conjuge_renda,
         status = 'aguardando_aprovacao_interna'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;
