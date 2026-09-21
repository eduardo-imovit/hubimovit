-- =============================================================================
-- Esteira de locação v3 — separa "form de proposta" (perfil simples) de
-- "form de cadastro" (dados completos), corrigindo o desenho da sessão
-- anterior que tinha misturado tudo num só form.
--
-- Fluxo real (ver nota "Fluxo de proposta - negócio" no Obsidian, lógica
-- do Tally): perfil (nome/e-mail/fone) -> aprovação interna -> CPF/CNPJ +
-- estado civil + renda -> lista de documentos (PF/PJ/cônjuge/fiador).
--
--   1. Form de Proposta (status aguardando_locatario): nome, telefone,
--      valor da oferta, observações. Sem tipo de pessoa, sem cônjuge, sem
--      dado financeiro -- isso tudo sai daqui.
--   2. Form de Cadastro (status aguardando_docs/docs_em_analise, antes do
--      checklist de documentos aparecer): tipo de pessoa + (se Física)
--      profissão/cargo/tipo de renda/empresa/renda pessoal/renda familiar +
--      cônjuge. Não muda status -- o checklist (useDocumentosEsteira) já
--      filtra dinamicamente por tipo_pessoa/tem_conjuge, então populá-los
--      é suficiente pra liberar a lista certa de documentos.
--
-- Limpeza: a sessão anterior deu "create or replace" em confirmar_dados_locatario
-- trocando a assinatura várias vezes sem dropar a antiga -- isso deixou
-- overloads sobrando no banco (confirmado via pg_proc). Dropamos os dois
-- antes de criar a versão nova e simplificada.
-- =============================================================================

drop function if exists confirmar_dados_locatario(uuid, text, text, text, boolean, numeric, text, text);
drop function if exists confirmar_dados_locatario(uuid, text, text, text, boolean, numeric, text, text, text, text, numeric, numeric, text, text, text, text, numeric, text);

-- -----------------------------------------------------------------------------
-- confirmar_dados_locatario: só o perfil (Form de Proposta). Termina em
-- aguardando_aprovacao_interna, igual antes.
-- -----------------------------------------------------------------------------

create function confirmar_dados_locatario(
  p_proposta_id uuid,
  p_nome text,
  p_tel text,
  p_valor_oferta numeric default null,
  p_observacoes text default null,
  p_ator text default 'locatario'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Prazo da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if v_proposta.status <> 'aguardando_locatario' then
    raise exception 'Proposta % está em status %, esperado "aguardando_locatario"', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  update propostas_locacao
     set nome_cliente = trim(p_nome), tel = p_tel, valor_oferta = p_valor_oferta, observacoes = p_observacoes,
         status = 'aguardando_aprovacao_interna'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function confirmar_dados_locatario is 'Form de Proposta: locatário confirma perfil (nome/tel) + valor da oferta/observações. Sem tipo de pessoa nem cônjuge -- isso é o Form de Cadastro, depois da aprovação interna.';

-- -----------------------------------------------------------------------------
-- completar_cadastro_locatario: Form de Cadastro, liberado depois que a
-- gestão aprova (status aguardando_docs/docs_em_analise). Não muda status --
-- só preenche os dados que o checklist de documentos precisa pra filtrar.
-- -----------------------------------------------------------------------------

create function completar_cadastro_locatario(
  p_proposta_id uuid,
  p_tipo_pessoa text,
  p_tem_conjuge boolean,
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
  if v_proposta.status not in ('aguardando_docs', 'docs_em_analise') then
    raise exception 'Proposta % está em status %, esperado "aguardando_docs" ou "docs_em_analise"', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  update propostas_locacao
     set tipo_pessoa = p_tipo_pessoa, tem_conjuge = p_tem_conjuge,
         profissao = p_profissao, cargo = p_cargo, tipo_renda = p_tipo_renda,
         renda_pessoal = p_renda_pessoal, renda_familiar = p_renda_familiar, nome_empresa = p_nome_empresa,
         conjuge_nome = p_conjuge_nome, conjuge_email = p_conjuge_email,
         conjuge_profissao = p_conjuge_profissao, conjuge_renda = p_conjuge_renda
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function completar_cadastro_locatario is 'Form de Cadastro: locatário informa CPF/CNPJ (tipo_pessoa), estado civil (tem_conjuge) e, se PF, dados de profissão/renda/cônjuge. Libera o checklist certo de documentos.';
