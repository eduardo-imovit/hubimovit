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
export default function VendaDetalheModal({ proposta, onClose, onDescartar, podeDescartar, processando, erro, documentoUrl }) {
  const status = proposta.status_efetivo ?? proposta.status
  return (
    <ModalPortal>
      <div className="modal">
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
          {documentoUrl && (
            <a className="btn btn-ghost btn-sm" href={documentoUrl}>Baixar proposta assinada (PDF)</a>
          )}
          {podeDescartar && status === 'aguardando_cliente' && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={processando} onClick={onDescartar}>
              {processando ? 'Descartando…' : 'Descartar'}
            </button>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
