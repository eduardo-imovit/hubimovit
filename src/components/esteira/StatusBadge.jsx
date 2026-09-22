import { STATUS_LABEL, STATUS_VARIANT, DOC_STATUS_LABEL, DOC_STATUS_VARIANT } from '../../lib/esteiraLabels'

export function StatusBadge({ status }) {
  return <span className={`badge badge-${STATUS_VARIANT[status] ?? 'gray'}`}>{STATUS_LABEL[status] ?? status}</span>
}

export function DocStatusBadge({ status }) {
  const s = status ?? 'pendente'
  return <span className={`badge badge-${DOC_STATUS_VARIANT[s] ?? 'gray'}`}>{DOC_STATUS_LABEL[s] ?? s}</span>
}
