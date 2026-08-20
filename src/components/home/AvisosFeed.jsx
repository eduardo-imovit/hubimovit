import { useState } from 'react'
import { useAvisos } from '../../hooks/useAvisos'
import { usePerfil } from '../../hooks/usePerfil'
import { formatarDiaCurto } from '../../lib/dateUtils'

const TIPO_LABEL = {
  aviso: 'Aviso',
  data_importante: 'Data importante',
  processo: 'Processo',
  link: 'Link',
}

const vazio = { tipo: 'aviso', titulo: '', corpo: '', link_url: '', data_referencia: '' }

export default function AvisosFeed() {
  const { avisos, carregando, erro, criarAviso, atualizarAviso, desativarAviso } = useAvisos()
  const { perfil } = usePerfil()
  const isAdmin = perfil?.role === 'admin'
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function abrirNovo() {
    setForm(vazio)
    setEditandoId(null)
    setMostrarForm((v) => !v)
  }

  function abrirEdicao(aviso) {
    setForm({
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      corpo: aviso.corpo ?? '',
      link_url: aviso.link_url ?? '',
      data_referencia: aviso.data_referencia ?? '',
    })
    setEditandoId(aviso.id)
    setMostrarForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      const dados = {
        tipo: form.tipo,
        titulo: form.titulo,
        corpo: form.corpo || null,
        link_url: form.link_url || null,
        data_referencia: form.data_referencia || null,
      }
      if (editandoId) await atualizarAviso(editandoId, dados)
      else await criarAviso(dados)
      setForm(vazio)
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
          {mostrarForm ? 'Cancelar' : '+ Novo item'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="aviso-tipo">Tipo</label>
            <select id="aviso-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aviso-titulo">Título</label>
            <input
              id="aviso-titulo"
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="aviso-corpo">Descrição</label>
            <textarea
              id="aviso-corpo"
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="aviso-link">Link (opcional)</label>
            <input
              id="aviso-link"
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="field">
            <label htmlFor="aviso-data">Data de referência (opcional)</label>
            <input
              id="aviso-data"
              type="date"
              value={form.data_referencia}
              onChange={(e) => setForm({ ...form, data_referencia: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : editandoId ? 'Atualizar' : 'Salvar'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar avisos: {erro}</div>}

      {!carregando && !erro && avisos.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhum aviso ativo</div>
          <div className="empty-sub">Comunicados, datas importantes, processos e links úteis aparecem aqui.</div>
        </div>
      )}

      <div className="avisos-list">
        {avisos.map((a) => (
          <div className="avisos-item" key={a.id}>
            <div className="avisos-item-body">
              <span className="badge badge-gray" style={{ marginRight: 'var(--space-2)' }}>{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
              <span className="avisos-item-title">{a.titulo}</span>
              {a.corpo && <div className="avisos-item-sub">{a.corpo}</div>}
              <div className="avisos-item-sub">
                {a.data_referencia ? formatarDiaCurto(a.data_referencia) : null}
                {a.link_url && (
                  <a href={a.link_url} target="_blank" rel="noreferrer" style={{ color: 'var(--coral)', marginLeft: a.data_referencia ? 'var(--space-2)' : 0 }}>
                    Abrir link ↗
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {isAdmin && (
                <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Editar" onClick={() => abrirEdicao(a)}>
                  ✎
                </button>
              )}
              <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Arquivar" onClick={() => desativarAviso(a.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
