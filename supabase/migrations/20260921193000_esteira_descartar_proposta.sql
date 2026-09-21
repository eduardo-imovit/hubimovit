-- =============================================================================
-- descartar_proposta_locacao: ação administrativa pra descartar uma proposta
-- travada (teste, desistência, duplicada etc.) em QUALQUER estágio anterior
-- à sincronização -- diferente de decidir_aprovacao_interna(rejeitado), que
-- só existe a partir de aguardando_aprovacao_interna e pede pro locatário
-- corrigir e reenviar. Descartar é definitivo, não notifica ninguém.
-- =============================================================================

create function descartar_proposta_locacao(
  p_proposta_id uuid,
  p_motivo text,
  p_ator text default 'gestao'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Motivo é obrigatório pra descartar a proposta %', p_proposta_id;
  end if;

  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.status in ('sincronizada', 'rejeitada', 'expirada') then
    raise exception 'Proposta % já está em status %, não há o que descartar', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  perform set_config('app.motivo', p_motivo, true);

  update propostas_locacao set status = 'rejeitada' where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function descartar_proposta_locacao is 'Descarta uma proposta (teste, desistência, duplicada) em qualquer estágio anterior à sincronização. Ação definitiva, sem notificação.';
