import { useState } from 'react'
import { dataComemorativaOcorreEm } from '../../lib/calendario'
import { hojeISO } from '../../lib/dateUtils'

function diasNoIntervalo(inicioISO, fimISO) {
  const dias = []
  let atual = new Date(`${inicioISO}T12:00:00`)
  const fim = new Date(`${fimISO}T12:00:00`)
  while (atual <= fim) {
    dias.push(atual.toLocaleDateString('en-CA'))
    atual.setDate(atual.getDate() + 1)
  }
  return dias
}

export default function DatasComemorativasFaixa({ datas, inicioISO, fimISO, onCriar, onRemover }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', data: hojeISO(), recorrenteAnual: true })
  const [salvando, setSalvando] = useState(false)

  const dias = diasNoIntervalo(inicioISO, fimISO)
  const ocorrencias = []
  for (const dia of dias) {
    for (const dc of datas) {
      if (dataComemorativaOcorreEm(dc, dia)) {
        ocorrencias.push({ ...dc, ocorrenciaISO: dia })
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await onCriar({ nome: form.nome, data: form.data, recorrente_anual: form.recorrenteAnual })
      setForm({ nome: '', data: hojeISO(), recorrenteAnual: true })
      setMostrarForm(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {ocorrencias.length > 0 && (
          <div className="cal-allday-strip" style={{ marginBottom: 0 }}>
            {ocorrencias.map((o) => (
              <span className="cal-allday-pill" key={`${o.id}-${o.ocorrenciaISO}`}>
                🎉 {o.nome} — {o.ocorrenciaISO.slice(8, 10)}/{o.ocorrenciaISO.slice(5, 7)}
                <button
                  type="button"
                  onClick={() => onRemover(o.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 4, padding: 0 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Data comemorativa'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </form>
      )}
    </div>
  )
}
