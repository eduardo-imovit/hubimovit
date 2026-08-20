import { useMemo, useState } from 'react'
import { useAvisos } from '../../hooks/useAvisos'
import { useDatasComemorativas } from '../../hooks/useDatasComemorativas'
import { useColaboradores } from '../../hooks/useColaboradores'
import { diasDaSemana, formatarDataLonga, hojeISO, inicioDaSemanaISO } from '../../lib/dateUtils'
import { dataComemorativaOcorreEm, diaAnterior, diaSeguinte, formatarMesAno, matrizDoMes, mesAnterior, mesSeguinte, reunioesRecorrentesNoIntervalo } from '../../lib/calendario'
import CalendarioMes from './CalendarioMes'
import CalendarioSemana from './CalendarioSemana'
import CalendarioDia from './CalendarioDia'
import DatasComemorativasFaixa from './DatasComemorativasFaixa'

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

  const { avisos } = useAvisos()
  const { datas: datasComemorativas, criarDataComemorativa, atualizarDataComemorativa, desativarDataComemorativa } = useDatasComemorativas()
  const { colaboradores } = useColaboradores()

  const datasEquipe = useMemo(() => {
    const datas = []
    for (const c of colaboradores) {
      if (c.data_nascimento) {
        datas.push({ id: `aniv-${c.id_corretor_crm}`, nome: `Aniversário — ${c.nome_completo}`, data: c.data_nascimento, recorrente_anual: true, emoji: '🎂', removivel: false })
      }
      if (c.data_admissao) {
        datas.push({ id: `admissao-${c.id_corretor_crm}`, nome: `Empresa — ${c.nome_completo}`, data: c.data_admissao, recorrente_anual: true, emoji: '🏢', removivel: false })
      }
    }
    return datas
  }, [colaboradores])

  const datasFaixa = useMemo(() => [...datasComemorativas, ...datasEquipe], [datasComemorativas, datasEquipe])

  const reunioesRecorrentes = useMemo(
    () => reunioesRecorrentesNoIntervalo(inicioISO, fimISO),
    [inicioISO, fimISO],
  )

  const eventosPorDia = useMemo(() => {
    const mapa = {}
    for (const r of reunioesRecorrentes) {
      const item = { id: r.id, hora: r.hora, titulo: r.titulo, sub: null, cor: 'var(--info)', tipo: 'reuniao' }
      mapa[r.dataISO] = mapa[r.dataISO] ? [...mapa[r.dataISO], item] : [item]
    }
    for (const a of avisos) {
      if (!a.data_referencia) continue
      const item = { id: a.id, hora: `${a.data_referencia}T08:00:00`, titulo: a.titulo, sub: null, cor: 'var(--champagne)', tipo: 'aviso' }
      mapa[a.data_referencia] = mapa[a.data_referencia] ? [...mapa[a.data_referencia], item] : [item]
    }
    let dia = new Date(`${inicioISO}T12:00:00`)
    const fim = new Date(`${fimISO}T12:00:00`)
    while (dia <= fim) {
      const diaISO = dia.toLocaleDateString('en-CA')
      for (const dc of datasFaixa) {
        if (dataComemorativaOcorreEm(dc, diaISO)) {
          const item = { id: dc.id, hora: `${diaISO}T00:00:00`, titulo: `${dc.emoji ?? '🎉'} ${dc.nome}`, sub: null, cor: 'var(--coral)', tipo: 'data-comemorativa' }
          mapa[diaISO] = mapa[diaISO] ? [...mapa[diaISO], item] : [item]
        }
      }
      dia.setDate(dia.getDate() + 1)
    }
    for (const chave of Object.keys(mapa)) {
      mapa[chave].sort((a, b) => a.hora.localeCompare(b.hora))
    }
    return mapa
  }, [reunioesRecorrentes, avisos, datasFaixa, inicioISO, fimISO])

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

      <DatasComemorativasFaixa
        datas={datasFaixa}
        inicioISO={inicioISO}
        fimISO={fimISO}
        onCriar={criarDataComemorativa}
        onAtualizar={atualizarDataComemorativa}
        onRemover={desativarDataComemorativa}
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
