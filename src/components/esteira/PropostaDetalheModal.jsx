import ModalPortal from './ModalPortal'
import { StatusBadge } from './StatusBadge'
import { valorBR } from '../../lib/esteiraLabels'

const AVISO_POR_STATUS = {
  aguardando_locatario: 'Enviada ao locatário: aguardando ele validar ou pedir correção.',
  correcao_solicitada: 'O locatário pediu correção. Ajuste e reenvie para ele validar de novo.',
  criada: 'Validada: aguardando liberação da esteira.',
  aguardando_docs: 'Validada pelo locatário: está na etapa de cadastro e documentos.',
  docs_em_analise: 'Validada pelo locatário: documentos em análise.',
  docs_aprovados: 'Documentos aprovados, pronta para finalizar em Esteira.',
  sincronizada: 'Processo já concluído.',
  rejeitada: 'Proposta descartada.',
  expirada: 'Prazo da proposta expirou.',
}

/**
 * Detalhe de uma proposta de locação (qualquer estágio). Antes da validação do
 * locatário oferece "Editar e reenviar" (esteira v4: não existe mais aprovação interna).
 */
export default function PropostaDetalheModal({ proposta, onClose, onEditar }) {
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{proposta.nome_cliente || proposta.email}</div>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <StatusBadge status={proposta.status_efetivo} />
            {proposta.status_efetivo === 'correcao_solicitada' && proposta.motivo_correcao && (
              <div className="login-error" style={{ whiteSpace: 'pre-line' }}>
                <strong>O locatário pediu:</strong> {proposta.motivo_correcao}
              </div>
            )}
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
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Valor do anúncio</div>
                <div>{valorBR(proposta.valor)}</div>
              </div>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Valor negociado</div>
                <div>{valorBR(proposta.valor_oferta)}</div>
              </div>
            </div>
            {proposta.observacoes && (
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Observações da proposta</div>
                <div style={{ whiteSpace: 'pre-line' }}>{proposta.observacoes}</div>
              </div>
            )}
            <div className="stat-sub is-muted">{AVISO_POR_STATUS[proposta.status_efetivo] ?? ''}</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Fechar
            </button>
            {onEditar && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onEditar}>
                {proposta.status_efetivo === 'correcao_solicitada' ? 'Corrigir e reenviar' : 'Editar e reenviar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
