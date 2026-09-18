-- =============================================================================
-- Esteira de locação — etapa de aprovação interna (gestão/adm) entre o
-- locatário confirmar os dados e o proprietário ser acionado.
--
-- Novo status: aguardando_aprovacao_interna, entre aguardando_locatario e
-- criada. Rejeição aqui sempre volta pro locatário corrigir (nunca é
-- definitiva por essa via) -- reaproveita status_historico.motivo, que o
-- trigger log_status_historico já grava a partir de app.motivo, sem coluna
-- nova.
-- =============================================================================

alter table propostas_locacao drop constraint propostas_locacao_status_valido;
alter table propostas_locacao add constraint propostas_locacao_status_valido
  check (status in ('aguardando_locatario','aguardando_aprovacao_interna','criada','aguardando_docs','docs_em_analise','docs_aprovados','sincronizada','rejeitada','expirada'));

-- confirmar_dados_locatario agora termina em aguardando_aprovacao_interna
-- (antes ia direto pra "criada", acionando o proprietário sem revisão).
create or replace function confirmar_dados_locatario(
  p_proposta_id uuid,
  p_nome text,
  p_tel text,
  p_tipo_pessoa text,
  p_tem_conjuge boolean,
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
     set nome_cliente = trim(p_nome), tel = p_tel, tipo_pessoa = p_tipo_pessoa, tem_conjuge = p_tem_conjuge, status = 'aguardando_aprovacao_interna'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

-- Gestão/adm aprova (segue pro proprietário) ou rejeita (volta pro
-- locatário corrigir, com motivo obrigatório).
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
     set status = case when p_decisao = 'aprovado' then 'criada' else 'aguardando_locatario' end
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

revoke execute on function decidir_aprovacao_interna from public;
grant execute on function decidir_aprovacao_interna to service_role;
