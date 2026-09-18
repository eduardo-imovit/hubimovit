-- Faltou na migration anterior: função pra registrar documento enviado via
-- Supabase Storage (registrar_documento_enviado continua existindo, é a
-- versão por link do Drive -- mantida por compatibilidade, não é mais
-- chamada pelo fluxo novo).

create or replace function registrar_documento_enviado_arquivo(
  p_proposta_id uuid, p_documento_codigo integer, p_arquivo_path text, p_ator text default 'cliente'
) returns documentos_enviados
language plpgsql security definer set search_path = public as $$
declare
  v_doc documentos_enviados;
  v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Prazo da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if p_arquivo_path is null or p_arquivo_path = '' then raise exception 'arquivo_path não pode ser vazio'; end if;

  perform set_config('app.ator', p_ator, true);

  insert into documentos_enviados (proposta_id, documento_codigo, arquivo_path, status)
  values (p_proposta_id, p_documento_codigo, p_arquivo_path, 'enviado')
  on conflict (proposta_id, documento_codigo) do update set
    arquivo_path = excluded.arquivo_path,
    status       = 'enviado',
    feedback_adm = null
  returning * into v_doc;

  return v_doc;
end;
$$;

revoke execute on function registrar_documento_enviado_arquivo from anon, authenticated, public;
grant execute on function registrar_documento_enviado_arquivo to service_role;
