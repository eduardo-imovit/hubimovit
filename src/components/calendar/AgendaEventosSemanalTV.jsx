import { useMemo } from 'react'
import { useEventosCalendario } from '../../hooks/useEventosCalendario'
import { diasDaSemana, inicioDaSemanaISO } from '../../lib/dateUtils'

const NOMES_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/**
 * Agenda de eventos da semana (seg–dom) pra TV Display: reuniões, avisos com
 * data, datas comemorativas e datas da equipe -- as mesmas fontes do
 * calendário da Home. A agenda do fotógrafo fica de fora (tem painel próprio).
 * `hojeISO` vem de fora pra virar a semana sozinho numa TV ligada 24/7.
 */
export default function AgendaEventosSemanalTV({ hojeISO }) {
  const dias = useMemo(() => diasDaSemana(inicioDaSemanaISO(0, hojeISO)), [hojeISO])
  const { eventosPorDia } = useEventosCalendario(dias[0], dias[6])

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">🗓️ Agenda de Eventos — Semana</div>

      <div className="agenda-fotografo-tv-grid agenda-eventos-tv-grid">
        {dias.map((diaISO, i) => {
          const eventos = (eventosPorDia[diaISO] ?? []).filter((e) => e.tipo !== 'fotografo')
          const ehHoje = diaISO === hojeISO
          return (
            <div className={`agenda-fotografo-tv-dia${ehHoje ? ' is-hoje' : ''}`} key={diaISO}>
              <div className="agenda-fotografo-tv-dia-nome">
                {NOMES_DIA[i]} {diaISO.slice(8, 10)}
              </div>
              {eventos.length === 0 && <div className="agenda-fotografo-tv-vazio">—</div>}
              {eventos.slice(0, 3).map((e) => (
                <div className="agenda-eventos-tv-item" key={`${e.tipo}-${e.id}`} style={{ borderLeftColor: e.cor }}>
                  <span className="agenda-eventos-tv-titulo">{e.titulo}</span>
                  {e.tipo === 'reuniao' && <span className="agenda-fotografo-tv-bloco-hora">{e.hora.slice(11, 16)}</span>}
                </div>
              ))}
              {eventos.length > 3 && <div className="agenda-fotografo-tv-vazio">+{eventos.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
