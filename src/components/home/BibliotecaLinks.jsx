import { useState } from 'react'
import { useBibliotecaLinks } from '../../hooks/useBibliotecaLinks'

const vazio = { titulo: '', url: '', categoria: '', descricao: '' }

function agruparPorCategoria(links) {
  const mapa = new Map()
  for (const l of links) {
    const chave = l.categoria || 'Geral'
    if (!mapa.has(chave)) mapa.set(chave, [])
    mapa.get(chave).push(l)
  }
  return [...mapa.entries()]
}

export default function BibliotecaLinks() {
  const { links, carregando, erro, criarLink, desativarLink } = useBibliotecaLinks()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await criarLink({
        titulo: form.titulo,
        url: form.url,
        categoria: form.categoria || null,
        descricao: form.descricao || null,
      })
      setForm(vazio)
      setMostrarForm(false)
    } finally {
      setSalvando(false)
    }
  }

  const grupos = agruparPorCategoria(links)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Novo link'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="link-titulo">Título</label>
            <input id="link-titulo" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Contratos de Locação" />
          </div>
          <div className="field">
            <label htmlFor="link-url">Link do Drive</label>
            <input id="link-url" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/…" />
          </div>
          <div className="field">
            <label htmlFor="link-categoria">Categoria</label>
            <input id="link-categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Contratos, Playbooks, Marketing" />
          </div>
          <div className="field">
            <label htmlFor="link-descricao">Descrição (opcional)</label>
            <input id="link-descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar a biblioteca: {erro}</div>}

      {!carregando && !erro && grupos.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhum link cadastrado</div>
          <div className="empty-sub">Links do Drive, playbooks e processos aparecem aqui.</div>
        </div>
      )}

      {grupos.map(([categoria, itens]) => (
        <div key={categoria} style={{ marginBottom: 'var(--space-4)' }}>
          <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>{categoria}</div>
          <div className="avisos-list">
            {itens.map((l) => (
              <div className="avisos-item" key={l.id}>
                <div className="avisos-item-body">
                  <a href={l.url} target="_blank" rel="noreferrer" className="avisos-item-title" style={{ color: 'var(--coral)' }}>
                    {l.titulo} ↗
                  </a>
                  {l.descricao && <div className="avisos-item-sub">{l.descricao}</div>}
                </div>
                <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Remover" onClick={() => desativarLink(l.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
