import ModalPortal from './ModalPortal'
import { StatusBadge } from './StatusBadge'
import { valorBR } from '../../lib/esteiraLabels'

const AVISO_POR_STATUS = {
  aguardando_locatario: 'Aguardando o locatário confirmar os dados dele (nome, telefone, oferta) — ainda não há o que revisar.',
  criada: 'Aguardando liberação da esteira.',
  aguardando_docs: 'Já passou da revisão interna — está na etapa de documentos.',
  docs_em_analise: 'Já passou da revisão interna — documentos em análise.',
  docs_aprovados: 'Já passou da revisão interna — documentos aprovados, pronta pra finalizar em Esteiras.',
  sincronizada: 'Processo já concluído.',
  rejeitada: 'Proposta rejeitada/descartada.',
  expirada: 'Prazo da proposta expirou.',
}

/**
 * Modal de detalhe de uma proposta -- usado tanto na fila de "Aguardando
 * revisão interna" quanto na tabela geral de Propostas (visualizar qualquer
 * uma, em qualquer estágio). Só oferece Aprovar/Pedir correção quando o
 * status realmente permite (a RPC decidir_aprovacao_interna exige
 * "aguardando_aprovacao_interna" -- fora disso ela rejeita).
 */
export default function PropostaDetalheModal({ proposta, processando, erro, onClose, onAprovar, onPedirCorrecao }) {
  const podeDecidir = proposta.status_efetivo === 'aguardando_aprovacao_interna'

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !processando && onClose()}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{proposta.nome_cliente || proposta.email}</div>
            <button type="button" className="modal-close" disabled={processando} onClick={onClose}>×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {erro && <div className="login-error">{erro}</div>}
            <StatusBadge status={proposta.status_efetivo} />
            <div>
              <div className="page-eyebrow" style={{ marginBottom: 2 }}>Locatário</div>
              <div>{proposta.nome_cliente || '—'}</div>
              <div style={{ color: 'var(--grafite-soft)' }}>{proposta.email}{proposta.tel ? ` · ${proposta.tel}` : ''}</div>
            </div>
            <div>
              <div className="page-eyebrow" style={{ marginBottom: 2 }}>Imóvel</div>
              <div>{proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}</div>
              {proposta.imovel_endereco && <div style={{ color: 'var(--grafite-soft)' }}>{proposta.imovel_endereco}</div>}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Valor pedido</div>
                <div>{valorBR(proposta.valor)}</div>
              </div>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Oferta do locatário</div>
                <div>{valorBR(proposta.valor_oferta)}</div>
              </div>
            </div>
            {proposta.observacoes && (
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Observações do locatário</div>
                <div>{proposta.observacoes}</div>
              </div>
            )}
            {!podeDecidir && (
              <div className="stat-sub is-muted">{AVISO_POR_STATUS[proposta.status_efetivo] ?? 'Nenhuma ação de aprovação disponível neste estágio.'}</div>
            )}
          </div>
          <div className="modal-footer">
            {podeDecidir && onPedirCorrecao ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={processando} onClick={onPedirCorrecao}>
                Pedir correção
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={processando} onClick={onClose}>
                Fechar
              </button>
            )}
            {podeDecidir && onAprovar && (
              <button type="button" className="btn btn-primary btn-sm" disabled={processando} onClick={onAprovar}>
                {processando ? 'Aprovando…' : 'Aprovar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
