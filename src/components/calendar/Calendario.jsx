import { useMemo, useState } from 'react'
import { useAtividadesPeriodo } from '../../hooks/useAtividadesPeriodo'
import { useFotografoAgenda } from '../../hooks/useFotografoAgenda'
import { useDatasComemorativas } from '../../hooks/useDatasComemorativas'
import { useColaboradores } from '../../hooks/useColaboradores'
import { diasDaSemana, formatarDataLonga, hojeISO, inicioDaSemanaISO, paraDataLocalISO } from '../../lib/dateUtils'
import { diaAnterior, diaSeguinte, formatarMesAno, matrizDoMes, mesAnterior, mesSeguinte, reunioesRecorrentesNoIntervalo, semanaISO } from '../../lib/calendario'
import CalendarioMes from './CalendarioMes'
import CalendarioSemana from './CalendarioSemana'
import CalendarioDia from './CalendarioDia'
import DatasComemorativasFaixa from './DatasComemorativasFaixa'

const VISOES = [
  { valor: 'dia', label: 'Dia' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

function agruparPorDia(itens, obterDataISO) {
  const mapa = {}
  for (const item of itens) {
    const dia = obterDataISO(item)
    if (!mapa[dia]) mapa[dia] = []
    mapa[dia].push(item)
  }
  return mapa
}

function opcoesPorFrequencia(valores) {
  const contagem = new Map()
  for (const v of valores) {
    if (!v) continue
    contagem.set(v, (contagem.get(v) ?? 0) + 1)
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([valor]) => valor)
}

export default function Calendario() {
  const [visao, setVisao] = useState('mes')
  const [fonte, setFonte] = useState('equipe')
  const [dataFoco, setDataFoco] = useState(hojeISO())
  const [mostrarAgendar, setMostrarAgendar] = useState(false)
  const [mostrarBloquear, setMostrarBloquear] = useState(false)
  const [filtroColaborador, setFiltroColaborador] = useState('')

  const semanas = useMemo(() => (visao === 'mes' ? matrizDoMes(dataFoco) : null), [visao, dataFoco])
  const diasDaSemanaAtual = useMemo(() => diasDaSemana(inicioDaSemanaISO(0, dataFoco)), [dataFoco])

  const { inicioISO, fimISO } = useMemo(() => {
    if (visao === 'dia') return { inicioISO: dataFoco, fimISO: dataFoco }
    if (visao === 'semana') return { inicioISO: diasDaSemanaAtual[0], fimISO: diasDaSemanaAtual[6] }
    const todasAsDatas = semanas.flat()
    return { inicioISO: todasAsDatas[0], fimISO: todasAsDatas[todasAsDatas.length - 1] }
  }, [visao, dataFoco, diasDaSemanaAtual, semanas])

  const { atividades } = useAtividadesPeriodo(inicioISO, fimISO)
  const { ocupacoes, bloqueios, criarAgendamento, criarBloqueio } = useFotografoAgenda(inicioISO, fimISO)
  const { datas: datasComemorativas, criarDataComemorativa, desativarDataComemorativa } = useDatasComemorativas()
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

  const colaboradoresDaAgenda = useMemo(() => opcoesPorFrequencia(atividades.map((a) => a.nomeusuario)), [atividades])

  const reunioesRecorrentes = useMemo(
    () => reunioesRecorrentesNoIntervalo(inicioISO, fimISO),
    [inicioISO, fimISO],
  )

  const eventosPorDia = useMemo(() => {
    if (fonte === 'equipe') {
      const atividadesFiltradas = filtroColaborador
        ? atividades.filter((a) => a.nomeusuario === filtroColaborador)
        : atividades
      const porDia = agruparPorDia(atividadesFiltradas, (a) => a.datahorainicio.slice(0, 10))
      const agora = new Date()
      const mapa = Object.fromEntries(
        Object.entries(porDia).map(([dia, itens]) => [
          dia,
          itens.map((a) => ({
            id: a.codigo,
            hora: a.datahorainicio,
            titulo: a.titulo || a.nometipo,
            sub: a.nomeusuario,
            cor: a.cortipo,
            tipo: 'atividade',
            realizada: a.realizada,
            pendente: !a.realizada && new Date(a.datahorainicio) < agora,
          })),
        ]),
      )
      for (const r of reunioesRecorrentes) {
        const item = { id: r.id, hora: r.hora, titulo: r.titulo, sub: null, cor: 'var(--info)', tipo: 'reuniao' }
        mapa[r.dataISO] = mapa[r.dataISO] ? [item, ...mapa[r.dataISO]] : [item]
      }
      for (const dia of Object.keys(mapa)) {
        mapa[dia].sort((a, b) => a.hora.localeCompare(b.hora))
      }
      return mapa
    }
    const ocupPorDia = agruparPorDia(ocupacoes, (o) => paraDataLocalISO(o.data_hora_inicio))
    const bloqPorDia = agruparPorDia(bloqueios, (b) => paraDataLocalISO(b.data_hora_inicio))
    const mapa = {}
    for (const [dia, itens] of Object.entries(ocupPorDia)) {
      mapa[dia] = (mapa[dia] ?? []).concat(itens.map((o) => ({ id: o.id, hora: o.data_hora_inicio, titulo: `${o.corretor_nome} · ${o.tipo_imovel}`, sub: o.endereco, tipo: 'ocupado' })))
    }
    for (const [dia, itens] of Object.entries(bloqPorDia)) {
      mapa[dia] = (mapa[dia] ?? []).concat(itens.map((b) => ({ id: b.id, hora: b.data_hora_inicio, titulo: b.motivo || 'Bloqueado', sub: null, tipo: 'bloqueado' })))
    }
    for (const dia of Object.keys(mapa)) {
      mapa[dia].sort((a, b) => a.hora.localeCompare(b.hora))
    }
    return mapa
  }, [fonte, atividades, ocupacoes, bloqueios, filtroColaborador])

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
          <div className="cal-source-toggle">
            <button type="button" className={fonte === 'equipe' ? 'is-active' : ''} onClick={() => setFonte('equipe')}>Equipe</button>
            <button type="button" className={fonte === 'fotografo' ? 'is-active' : ''} onClick={() => setFonte('fotografo')}>Fotógrafo</button>
          </div>
          {fonte === 'equipe' && (
            <select value={filtroColaborador} onChange={(e) => setFiltroColaborador(e.target.value)}>
              <option value="">Colaborador: todos</option>
              {colaboradoresDaAgenda.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          )}
          <div className="segmented">
            {VISOES.map((v) => (
              <button key={v.valor} type="button" className={visao === v.valor ? 'is-active' : ''} onClick={() => setVisao(v.valor)}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      {fonte === 'fotografo' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMostrarAgendar((v) => !v); setMostrarBloquear(false) }}>
            {mostrarAgendar ? 'Cancelar' : '+ Agendar sessão'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMostrarBloquear((v) => !v); setMostrarAgendar(false) }}>
            {mostrarBloquear ? 'Cancelar' : '+ Bloquear horário'}
          </button>
        </div>
      )}

      {mostrarAgendar && (
        <FormularioAgendarSessao
          colaboradores={colaboradores}
          dataPadrao={dataFoco}
          onSalvar={async (dados) => { await criarAgendamento(dados); setMostrarAgendar(false) }}
        />
      )}
      {mostrarBloquear && (
        <FormularioBloquearHorario
          dataPadrao={dataFoco}
          onSalvar={async (dados) => { await criarBloqueio(dados); setMostrarBloquear(false) }}
        />
      )}

      <DatasComemorativasFaixa
        datas={datasFaixa}
        inicioISO={inicioISO}
        fimISO={fimISO}
        onCriar={criarDataComemorativa}
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

function FormularioAgendarSessao({ colaboradores, dataPadrao, onSalvar }) {
  const [form, setForm] = useState({ corretorId: '', tipoImovel: 'casa', data: dataPadrao, horaInicio: '10:00', duracaoHoras: '1.5', endereco: '' })
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const corretor = colaboradores.find((c) => String(c.id_corretor_crm) === form.corretorId)
    if (!corretor) return
    setSalvando(true)
    const inicio = new Date(`${form.data}T${form.horaInicio}:00`)
    const fim = new Date(inicio.getTime() + Number(form.duracaoHoras) * 60 * 60 * 1000)
    try {
      await onSalvar({
        corretor_id: corretor.id_corretor_crm,
        corretor_nome: corretor.nome_completo,
        corretor_email: corretor.email_oficial,
        tipo_imovel: form.tipoImovel,
        duracao_horas: Number(form.duracaoHoras),
        endereco: form.endereco || null,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        semana_iso: semanaISO(form.data),
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      <div className="field">
        <label>Corretor</label>
        <select required value={form.corretorId} onChange={(e) => setForm({ ...form, corretorId: e.target.value })}>
          <option value="" disabled>Selecione…</option>
          {colaboradores.map((c) => <option key={c.id_corretor_crm} value={c.id_corretor_crm}>{c.nome_completo}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Tipo de imóvel</label>
        <select value={form.tipoImovel} onChange={(e) => setForm({ ...form, tipoImovel: e.target.value })}>
          <option value="casa">Casa</option>
          <option value="apartamento">Apartamento</option>
        </select>
      </div>
      <div className="field">
        <label>Data</label>
        <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
      </div>
      <div className="field">
        <label>Hora de início</label>
        <input type="time" required value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
      </div>
      <div className="field">
        <label>Duração (horas)</label>
        <input type="number" step="0.5" min="0.5" required value={form.duracaoHoras} onChange={(e) => setForm({ ...form, duracaoHoras: e.target.value })} />
      </div>
      <div className="field">
        <label>Endereço</label>
        <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}

function FormularioBloquearHorario({ dataPadrao, onSalvar }) {
  const [form, setForm] = useState({ data: dataPadrao, horaInicio: '08:00', horaFim: '18:00', motivo: '' })
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await onSalvar({
        data_hora_inicio: new Date(`${form.data}T${form.horaInicio}:00`).toISOString(),
        data_hora_fim: new Date(`${form.data}T${form.horaFim}:00`).toISOString(),
        motivo: form.motivo || null,
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      <div className="field">
        <label>Data</label>
        <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
      </div>
      <div className="field">
        <label>Motivo</label>
        <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Folga, viagem…" />
      </div>
      <div className="field">
        <label>De</label>
        <input type="time" required value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
      </div>
      <div className="field">
        <label>Até</label>
        <input type="time" required value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  )
}
