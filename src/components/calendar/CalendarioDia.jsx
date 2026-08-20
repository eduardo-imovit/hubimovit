import { formatarHora } from '../../lib/dateUtils'

export default function CalendarioDia({ eventos }) {
  if (eventos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Nada agendado</div>
        <div className="empty-sub">Compromissos deste dia aparecem aqui.</div>
      </div>
    )
  }

  return (
    <div className="agenda-list">
      {eventos.map((e) => (
        <div className="agenda-item" key={`${e.tipo}-${e.id}`}>
          <span className="agenda-time">{formatarHora(e.hora)}</span>
          <span className="agenda-dot" style={{ background: e.cor || 'var(--champagne)' }} />
          <div className="agenda-info">
            <div className="agenda-title">{e.titulo}</div>
            {e.sub && <div className="agenda-sub">{e.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
