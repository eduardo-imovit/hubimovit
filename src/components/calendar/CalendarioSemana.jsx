import { formatarDiaCurto, hojeISO } from '../../lib/dateUtils'
import EventoPilula from './EventoPilula'

export default function CalendarioSemana({ dias, eventosPorDia, onSelecionarDia }) {
  const hoje = hojeISO()

  return (
    <div className="cal-week-grid">
      {dias.map((dia) => {
        const eventos = eventosPorDia[dia] ?? []
        return (
          <div key={dia}>
            <button
              type="button"
              className={`cal-week-col-header${dia === hoje ? ' is-today' : ''}`}
              style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => onSelecionarDia(dia)}
            >
              {formatarDiaCurto(dia)}
            </button>
            <div className="cal-week-col-body">
              {eventos.length === 0 && <div className="plantao-empty" style={{ textAlign: 'center' }}>—</div>}
              {eventos.map((e) => (
                <EventoPilula key={`${e.tipo}-${e.id}`} evento={e} mostrarHora />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
