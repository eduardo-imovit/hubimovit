import { useState } from 'react'
import { useDatasComemorativas } from '../../hooks/useDatasComemorativas'
import { formatarDiaCurto, hojeISO } from '../../lib/dateUtils'

export default function DatasComemorativasAdmin() {
  const { datas, carregando, erro, criarDataComemorativa, atualizarDataComemorativa, desativarDataComemorativa } = useDatasComemorativas()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', data: hojeISO(), recorrenteAnual: true })
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function abrirNovo() {
    setForm({ nome: '', data: hojeISO(), recorrenteAnual: true })
    setEditandoId(null)
    setMostrarForm((v) => !v)
  }

  function abrirEdicao(dc) {
    setForm({ nome: dc.nome, data: dc.data, recorrenteAnual: dc.recorrente_anual ?? true })
    setEditandoId(dc.id)
    setMostrarForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      const dados = { nome: form.nome, data: form.data, recorrente_anual: form.recorrenteAnual }
      if (editandoId) await atualizarDataComemorativa(editandoId, dados)
      else await criarDataComemorativa(dados)
      setForm({ nome: '', data: hojeISO(), recorrenteAnual: true })
      setEditandoId(null)
      setMostrarForm(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={abrirNovo}>
          {mostrarForm ? 'Cancelar' : '+ Data comemorativa'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Nome</label>
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Dia das Mães" />
          </div>
          <div className="field">
            <label>Data</label>
            <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              id="dc-recorrente"
              type="checkbox"
              checked={form.recorrenteAnual}
              onChange={(e) => setForm({ ...form, recorrenteAnual: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <label htmlFor="dc-recorrente" style={{ textTransform: 'none', letterSpacing: 0 }}>Repete todo ano</label>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : editandoId ? 'Atualizar' : 'Salvar'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as datas: {erro}</div>}

      {!carregando && !erro && datas.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhuma data cadastrada</div>
          <div className="empty-sub">Datas comemorativas aparecem na faixa do calendário da Home.</div>
        </div>
      )}

      <div className="avisos-list">
        {datas.map((dc) => (
          <div className="avisos-item" key={dc.id}>
            <div className="avisos-item-body">
              <span className="avisos-item-title">{dc.nome}</span>
              <div className="avisos-item-sub">
                {formatarDiaCurto(dc.data)}{dc.recorrente_anual ? ' · repete todo ano' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Editar" onClick={() => abrirEdicao(dc)}>✎</button>
              <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Remover" onClick={() => desativarDataComemorativa(dc.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
