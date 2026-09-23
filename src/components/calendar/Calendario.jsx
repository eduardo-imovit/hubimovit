import { useMemo, useState } from 'react'
import { useEventosCalendario } from '../../hooks/useEventosCalendario'
import { diasDaSemana, formatarDataLonga, hojeISO, inicioDaSemanaISO } from '../../lib/dateUtils'
import { diaAnterior, diaSeguinte, formatarMesAno, matrizDoMes, mesAnterior, mesSeguinte } from '../../lib/calendario'
import CalendarioMes from './CalendarioMes'
import CalendarioSemana from './CalendarioSemana'
import CalendarioDia from './CalendarioDia'
import AgendaDropdown from './AgendaDropdown'

const VISOES = [
  { valor: 'dia', label: 'Dia' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

export default function Calendario() {
  const [visao, setVisao] = useState('mes')
  const [dataFoco, setDataFoco] = useState(hojeISO())

  const semanas = useMemo(() => (visao === 'mes' ? matrizDoMes(dataFoco) : null), [visao, dataFoco])
  const diasDaSemanaAtual = useMemo(() => diasDaSemana(inicioDaSemanaISO(0, dataFoco)), [dataFoco])

  const { inicioISO, fimISO } = useMemo(() => {
    if (visao === 'dia') return { inicioISO: dataFoco, fimISO: dataFoco }
    if (visao === 'semana') return { inicioISO: diasDaSemanaAtual[0], fimISO: diasDaSemanaAtual[6] }
    const todasAsDatas = semanas.flat()
    return { inicioISO: todasAsDatas[0], fimISO: todasAsDatas[todasAsDatas.length - 1] }
  }, [visao, dataFoco, diasDaSemanaAtual, semanas])

  const { eventosPorDia, datasFaixa, ocorrenciasFotografo } = useEventosCalendario(inicioISO, fimISO)

  function navegar(direcao) {
    if (visao === 'dia') setDataFoco(direcao === -1 ? diaAnterior(dataFoco) : diaSeguinte(dataFoco))
    else if (visao === 'semana') {
      const base = new Date(`${dataFoco}T12:00:00`)
      base.setDate(base.getDate() + direcao * 7)
      setDataFoco(base.toLocaleDateString('en-CA'))
    } else setDataFoco(direcao === -1 ? mesAnterior(dataFoco) : mesSeguinte(dataFoco))
  }

  const titulo = visao === 'mes'
    ? formatarMesAno(dataFoco)
    : visao === 'semana'
      ? `${diasDaSemanaAtual[0].slice(8, 10)}/${diasDaSemanaAtual[0].slice(5, 7)} — ${diasDaSemanaAtual[6].slice(8, 10)}/${diasDaSemanaAtual[6].slice(5, 7)}`
      : formatarDataLonga(new Date(`${dataFoco}T12:00:00`))

  return (
    <div className="cal-shell">
      <div className="cal-nav">
        <div className="cal-nav-left">
          <div className="cal-nav-arrows">
            <button type="button" className="btn-icon btn-icon-sm" onClick={() => navegar(-1)}>‹</button>
            <button type="button" className="btn-icon btn-icon-sm" onClick={() => navegar(1)}>›</button>
          </div>
          <span className="cal-nav-title">{titulo}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDataFoco(hojeISO())}>Hoje</button>
        </div>
        <div className="cal-nav-right">
          <div className="segmented">
            {VISOES.map((v) => (
              <button key={v.valor} type="button" className={visao === v.valor ? 'is-active' : ''} onClick={() => setVisao(v.valor)}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      <AgendaDropdown
        datasComemorativas={datasFaixa}
        blocosFotografo={ocorrenciasFotografo}
        inicioISO={inicioISO}
        fimISO={fimISO}
      />

      {visao === 'mes' && (
        <CalendarioMes
          semanas={semanas}
          mesReferenciaISO={dataFoco}
          eventosPorDia={eventosPorDia}
          onSelecionarDia={(dia) => { setDataFoco(dia); setVisao('dia') }}
        />
      )}
      {visao === 'semana' && (
        <CalendarioSemana
          dias={diasDaSemanaAtual}
          eventosPorDia={eventosPorDia}
          onSelecionarDia={(dia) => { setDataFoco(dia); setVisao('dia') }}
        />
      )}
      {visao === 'dia' && <CalendarioDia eventos={eventosPorDia[dataFoco] ?? []} />}
    </div>
  )
}
