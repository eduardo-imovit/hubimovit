import { PASSOS_FLUXO, passoAtual } from '../../lib/esteiraLabels'

/** Progresso do fluxo da esteira, como timeline vertical -- pensado pra sidebar do portal do cliente. */
export default function StepProgress({ status }) {
  const atual = passoAtual(status)
  if (atual === null) return null

  return (
    <div className="timeline esteira-progress">
      {PASSOS_FLUXO.map((p, i) => {
        const estado = i < atual ? 'feito' : i === atual ? 'atual' : 'pendente'
        return (
          <div key={p.status} className={`timeline-item is-${estado}`}>
            <span className="timeline-dot" />
            <div className="timeline-title">{p.label}</div>
          </div>
        )
      })}
    </div>
  )
}
