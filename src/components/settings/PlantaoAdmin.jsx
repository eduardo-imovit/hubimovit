import { useState } from 'react'
import { usePlantao } from '../../hooks/usePlantao'
import { useColaboradores } from '../../hooks/useColaboradores'
import ImportarEscalaPlantao from './ImportarEscalaPlantao'
import { diasDaSemana, formatarDiaCurto, hojeISO, inicioDaSemanaISO } from '../../lib/dateUtils'

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', dia_inteiro: 'Dia inteiro' }
const STATUS_LABEL = { agendado: 'Agendado', cancelado: 'Cancelado' }

function semanaMais(dataISO, semanas) {
  const d = new Date(`${dataISO}T12:00:00`)
  d.setDate(d.getDate() + semanas * 7)
  return d.toLocaleDateString('en-CA')
}

export default function PlantaoAdmin() {
  const [semanaBase, setSemanaBase] = useState(inicioDaSemanaISO())
  const dias = diasDaSemana(semanaBase)
  const fimSemana = dias[6]
  const hoje = hojeISO()

  const { plantoes, carregando, erro, recarregar, criarPlantao, atualizarPlantao } = usePlantao(semanaBase, fimSemana)
  const { colaboradores } = useColaboradores()

  const vazio = { corretor_id: '', data: hoje, turno: 'dia_inteiro', observacao: '', status: 'agendado' }
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function abrirNovo() {
    setForm({ ...vazio, data: form.data })
    setEditandoId(null)
    setMostrarForm((v) => !v)
  }

  function abrirEdicao(p) {
    setForm({
      corretor_id: String(p.corretor_id),
      data: p.data,
      turno: p.turno,
      observacao: p.observacao ?? '',
      status: p.status,
    })
    setEditandoId(p.id)
    setMostrarForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const corretor = colaboradores.find((c) => String(c.id_corretor_crm) === form.corretor_id)
    if (!corretor) return
    setSalvando(true)
    try {
      const dados = {
        corretor_id: corretor.id_corretor_crm,
        corretor_nome: corretor.nome_completo,
        data: form.data,
        turno: form.turno,
        observacao: form.observacao || null,
        status: form.status,
      }
      if (editandoId) await atualizarPlantao(editandoId, dados)
      else await criarPlantao(dados)
      setMostrarForm(false)
      setEditandoId(null)
      setForm({ ...vazio, data: form.data })
    } finally {
      setSalvando(false)
    }
  }

  function aposImportar(primeiraData) {
    const semana = inicioDaSemanaISO(0, primeiraData)
    if (semana === semanaBase) recarregar()
    else setSemanaBase(semana)
  }

  return (
    <div>
      <ImportarEscalaPlantao colaboradores={colaboradores} onImportado={aposImportar} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="cal-nav-left">
          <div className="cal-nav-arrows">
            <button type="button" className="btn-icon btn-icon-sm" onClick={() => setSemanaBase((s) => semanaMais(s, -1))}>‹</button>
            <button type="button" className="btn-icon btn-icon-sm" onClick={() => setSemanaBase((s) => semanaMais(s, 1))}>›</button>
          </div>
          <span className="cal-nav-title">{formatarDiaCurto(dias[0])} — {formatarDiaCurto(dias[6])}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSemanaBase(inicioDaSemanaISO())}>Semana atual</button>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={abrirNovo}>
          {mostrarForm ? 'Cancelar' : '+ Escalar corretor'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="plantao-corretor">Corretor</label>
            <select
              id="plantao-corretor"
              required
              value={form.corretor_id}
              onChange={(e) => setForm({ ...form, corretor_id: e.target.value })}
            >
              <option value="" disabled>Selecione…</option>
              {colaboradores.map((c) => (
                <option key={c.id_corretor_crm} value={c.id_corretor_crm}>{c.nome_completo}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="plantao-data">Data</label>
            <input
              id="plantao-data"
              type="date"
              required
              min={semanaBase}
              max={fimSemana}
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="plantao-turno">Turno</label>
            <select id="plantao-turno" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}>
              {Object.entries(TURNO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="plantao-obs">Observação (opcional)</label>
            <input id="plantao-obs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          {editandoId && (
            <div className="field">
              <label htmlFor="plantao-status">Status</label>
              <select id="plantao-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_LABEL).map(([valor, label]) => (
                  <option key={valor} value={valor}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : editandoId ? 'Atualizar' : 'Salvar'}
          </button>
        </form>
      )}

      {erro && <div className="hub-error">Não foi possível carregar o plantão: {erro}</div>}

      <div className="plantao-week">
        {dias.map((dia) => {
          const doDia = plantoes.filter((p) => p.data === dia)
          return (
            <div className={`plantao-day${dia === hoje ? ' is-today' : ''}`} key={dia}>
              <div className="plantao-day-label">{formatarDiaCurto(dia)}</div>
              {carregando && <div className="plantao-empty">…</div>}
              {!carregando && doDia.length === 0 && <div className="plantao-empty">Sem plantão</div>}
              {doDia.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`plantao-slot is-${p.status}`}
                  onClick={() => abrirEdicao(p)}
                  title="Clique para editar"
                >
                  {p.corretor_nome.split(' ')[0]} · {TURNO_LABEL[p.turno]}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
