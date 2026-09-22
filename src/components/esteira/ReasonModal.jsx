import { useState } from 'react'
import ModalPortal from './ModalPortal'

/**
 * Modal pra pedir um motivo em texto antes de uma ação (rejeitar doc, pedir
 * correção, descartar proposta). Substitui window.prompt/window.alert, que
 * fogem completamente do design system e não dão pra estilizar.
 */
export default function ReasonModal({ title, description, confirmLabel = 'Confirmar', obrigatorio = true, processando, erro, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('')

  function handleConfirmar() {
    if (obrigatorio && !motivo.trim()) return
    onConfirm(motivo.trim() || undefined)
  }

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !processando && onCancel()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" disabled={processando} onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          {description && <p style={{ marginTop: 0 }}>{description}</p>}
          {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}
          <div className="field">
            <label htmlFor="reason-modal-motivo">Motivo{!obrigatorio && ' (opcional)'}</label>
            <textarea
              id="reason-modal-motivo"
              rows={3}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost btn-sm" disabled={processando} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={processando || (obrigatorio && !motivo.trim())}
            onClick={handleConfirmar}
          >
            {processando ? 'Enviando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
