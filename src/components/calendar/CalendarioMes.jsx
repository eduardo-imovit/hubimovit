import { hojeISO } from '../../lib/dateUtils'
import EventoPilula from './EventoPilula'

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const LIMITE_PILULAS = 3

export default function CalendarioMes({ semanas, mesReferenciaISO, eventosPorDia, onSelecionarDia }) {
  const hoje = hojeISO()
  const mesReferencia = mesReferenciaISO.slice(0, 7)

  return (
    <div>
      <div className="cal-month-weekday-header">
        {DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-month-grid">
        {semanas.map((semana) => (
          <div className="cal-month-row" key={semana[0]}>
            {semana.map((dia) => {
              const eventos = eventosPorDia[dia] ?? []
              const visiveis = eventos.slice(0, LIMITE_PILULAS)
              const restantes = eventos.length - visiveis.length
              const foraDoMes = !dia.startsWith(mesReferencia)

              return (
                <button
                  type="button"
                  key={dia}
                  className={`cal-day-cell${dia === hoje ? ' is-today' : ''}${foraDoMes ? ' is-fora-do-mes' : ''}`}
                  onClick={() => onSelecionarDia(dia)}
                >
                  <span className="cal-day-number">{Number(dia.slice(8, 10))}</span>
                  {visiveis.map((e) => (
                    <EventoPilula key={`${e.tipo}-${e.id}`} evento={e} />
                  ))}
                  {restantes > 0 && <span className="cal-day-overflow">+{restantes}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
