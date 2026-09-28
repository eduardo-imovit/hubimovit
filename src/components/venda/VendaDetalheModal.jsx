import ModalPortal from '../esteira/ModalPortal'
import { valorBR } from '../../lib/esteiraLabels'

const LABEL = {
  aguardando_cliente: 'Aguardando proponente',
  confirmada: 'Assinada',
  descartada: 'Descartada',
  expirada: 'Prazo expirado',
}

/**
 * Detalhe interno da proposta de venda (só leitura + ações da equipe).
 * Arquivo próprio — PropostaDetalheModal (locação) não é tocado.
 */
export default function VendaDetalheModal({ proposta, onClose, onDescartar, onBaixarPdf, podeDescartar, processando, erro }) {
  const status = proposta.status_efetivo ?? proposta.status
  return (
    <ModalPortal>
      {/* .modal-overlay é quem posiciona o modal na tela; sem ele o modal ia
          para o fim do <body>, fora da vista, e "Visualizar" parecia não fazer nada. */}
      <div className="modal-overlay" onClick={() => !processando && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="page-eyebrow">Proposta de compra</div>
            <div className="modal-title">{proposta.nome_cliente || proposta.email}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erro && <div className="login-error">{erro}</div>}
          <div><strong>Status:</strong> {LABEL[status] ?? status}</div>
          <div><strong>Proponente:</strong> {proposta.nome_cliente} · {proposta.email}{proposta.telefone ? ` · ${proposta.telefone}` : ''}</div>
          <div><strong>Imóvel:</strong> {proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}{proposta.imovel_endereco ? ` — ${proposta.imovel_endereco}` : ''}</div>
          <div><strong>Valor de referência:</strong> {valorBR(proposta.valor_referencia)}</div>
          {proposta.valor_proposta != null && <div><strong>Valor da proposta:</strong> {valorBR(proposta.valor_proposta)}</div>}
          {proposta.descricao_proposta && (
            <div><strong>Descrição:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{proposta.descricao_proposta}</div></div>
          )}
          {proposta.documento_path && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onBaixarPdf(proposta)}>
              Baixar proposta assinada (PDF)
            </button>
          )}
          {status === 'confirmada' && !proposta.documento_path && (
            <div className="page-sub">Assinada, mas o PDF ainda não foi gerado. O proponente gera pelo portal (botão "Gerar PDF da proposta").</div>
          )}
          {podeDescartar && status === 'aguardando_cliente' && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={processando} onClick={onDescartar}>
              {processando ? 'Descartando…' : 'Descartar'}
            </button>
          )}
        </div>
      </div>
      </div>
    </ModalPortal>
  )
}
