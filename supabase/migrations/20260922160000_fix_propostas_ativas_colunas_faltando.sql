-- =============================================================================
-- Fix: a view propostas_ativas foi criada com "select p.*" em 2026-09-18,
-- antes das colunas valor/valor_oferta/observacoes e todo o bloco financeiro/
-- cônjuge (profissao, cargo, tipo_renda, renda_pessoal, renda_familiar,
-- nome_empresa, conjuge_*) existirem em propostas_locacao. "p.*" é expandido
-- na lista de colunas NO MOMENTO da criação da view -- não acompanha colunas
-- adicionadas depois na tabela. Resultado: a view nunca expôs essas 12
-- colunas, e as telas admin (Propostas/Esteiras, que leem via essa view)
-- sempre mostraram "—" no lugar do valor, mesmo com o dado presente no banco.
-- Recriar a view com "p.*" agora captura o schema atual da tabela.
--
-- "create or replace" não deixa inserir colunas no meio da lista existente
-- (Postgres exige que colunas antigas fiquem na mesma posição) -- precisou
-- dropar e recriar. Sem dependentes (conferido via pg_depend) e sem policy
-- própria na view; grants padrão do schema public cobrem anon/authenticated/
-- service_role automaticamente em objetos novos, então nada precisou ser
-- reconcedido manualmente.
-- =============================================================================

drop view propostas_ativas;

create view propostas_ativas as
  select
    p.*,
    case
      when p.link_expira_em < now() and p.status not in ('sincronizada', 'rejeitada', 'expirada')
        then 'expirada'
      else p.status
    end as status_efetivo
  from propostas_locacao p
  where p.status <> 'sincronizada'
  order by p.timestamp_criacao desc;

comment on view propostas_ativas is 'Propostas em andamento (exclui sincronizada), com status_efetivo calculado. Recriada em 2026-09-22 pra reincluir colunas adicionadas em propostas_locacao depois da criação original da view.';
