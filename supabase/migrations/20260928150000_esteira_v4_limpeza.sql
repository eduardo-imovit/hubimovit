-- =============================================================================
-- Esteira de locação v4 — ETAPA B (limpeza), aplicada junto com a publicação
-- (função esteira-locacao v4 + push do frontend), depois do teste no localhost.
-- Tira do banco o que só o fluxo antigo usava.
-- =============================================================================

-- Proposta presa na aprovação interna volta para a validação do locatário.
select set_config('app.ator', 'migracao_esteira_v4', true);
select set_config('app.motivo', 'Aprovação interna saiu do fluxo (esteira v4): volta para a validação do locatário', true);
update propostas_locacao set status = 'aguardando_locatario' where status = 'aguardando_aprovacao_interna';
select set_config('app.motivo', '', true);

alter table propostas_locacao drop constraint if exists propostas_locacao_status_valido;
alter table propostas_locacao add constraint propostas_locacao_status_valido check (status in (
  'aguardando_locatario', 'correcao_solicitada', 'criada', 'aguardando_docs', 'docs_em_analise',
  'docs_aprovados', 'sincronizada', 'rejeitada', 'expirada'
));

drop function if exists criar_proposta_locacao(text, text, integer, numeric, text, text, text);
drop function if exists confirmar_dados_locatario(uuid, text, text, numeric, text, text);
drop function if exists decidir_aprovacao_interna(uuid, text, text, text);
