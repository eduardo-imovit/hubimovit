import { useState } from 'react'
import { useAgendamentosFotografo } from '../../hooks/useAgendamentosFotografo'
import { useColaboradores } from '../../hooks/useColaboradores'

const DIA_SEMANA_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const vazio = { corretor_id: '', dia_semana: '1', hora_inicio: '12:00', hora_fim: '14:00', observacao: '' }

export default function FotografoAdmin() {
  const { blocos, carregando, erro, criarBloco, removerBloco } = useAgendamentosFotografo()
  const { colaboradores } = useColaboradores()

  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const corretor = colaboradores.find((c) => String(c.id_corretor_crm) === form.corretor_id)
    if (!corretor) return
    if (form.hora_fim <= form.hora_inicio) {
      setErroForm('O horário final precisa ser depois do inicial.')
      return
    }
    setErroForm('')
    setSalvando(true)
    try {
      await criarBloco({
        corretor_id: corretor.id_corretor_crm,
        corretor_nome: corretor.nome_completo,
        corretor_email: corretor.email_oficial ?? '',
        dia_semana: Number(form.dia_semana),
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        observacao: form.observacao || null,
      })
      setForm(vazio)
      setMostrarForm(false)
    } catch (err) {
      setErroForm(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Novo bloco fixo'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="foto-corretor">Corretor</label>
            <select id="foto-corretor" required value={form.corretor_id} onChange={(e) => setForm({ ...form, corretor_id: e.target.value })}>
              <option value="" disabled>Selecione…</option>
              {colaboradores.map((c) => (
                <option key={c.id_corretor_crm} value={c.id_corretor_crm}>{c.nome_completo}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="foto-dia">Dia da semana</label>
            <select id="foto-dia" value={form.dia_semana} onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}>
              {DIA_SEMANA_LABEL.map((label, i) => (
                <option key={label} value={i}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="foto-inicio">Hora início</label>
              <input id="foto-inicio" type="time" required value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="foto-fim">Hora fim</label>
              <input id="foto-fim" type="time" required value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="foto-obs">Observação (opcional)</label>
            <input id="foto-obs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar a agenda: {erro}</div>}

      {!carregando && !erro && blocos.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhum bloco cadastrado</div>
          <div className="empty-sub">Cada bloco fixo (corretor · dia da semana · horário) se repete todo mês no calendário do fotógrafo.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {blocos.map((b) => (
          <div className="agenda-item" key={b.id}>
            <span className="agenda-time">{DIA_SEMANA_LABEL[b.dia_semana].slice(0, 3)}</span>
            <span className="agenda-dot" style={{ background: 'var(--info)' }} />
            <div className="agenda-info">
              <div className="agenda-title">{b.corretor_nome} · toda {DIA_SEMANA_LABEL[b.dia_semana].toLowerCase()}</div>
              <div className="agenda-sub">
                {b.hora_inicio.slice(0, 5)}–{b.hora_fim.slice(0, 5)}
                {b.observacao ? ` · ${b.observacao}` : ''}
              </div>
            </div>
            <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Remover" onClick={() => removerBloco(b.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
