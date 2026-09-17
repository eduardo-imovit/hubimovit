import { useState } from 'react'
import { useBanners, urlPublicaBanner } from '../../hooks/useBanners'

const vazio = { titulo: '', subtitulo: '', link_url: '', ordem: 0 }

export default function BannersAdmin() {
  const { banners, carregando, erro, enviarImagem, criarBanner, removerBanner } = useBanners()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [arquivo, setArquivo] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  function abrirNovo() {
    setForm(vazio)
    setArquivo(null)
    setErroForm('')
    setMostrarForm((v) => !v)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!arquivo) {
      setErroForm('Selecione uma imagem para o banner.')
      return
    }
    setErroForm('')
    setSalvando(true)
    try {
      const path = await enviarImagem(arquivo)
      await criarBanner({
        titulo: form.titulo,
        subtitulo: form.subtitulo || null,
        link_url: form.link_url || null,
        ordem: Number(form.ordem) || 0,
        imagem_path: path,
      })
      setForm(vazio)
      setArquivo(null)
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={abrirNovo}>
          {mostrarForm ? 'Cancelar' : '+ Novo banner'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="banner-titulo">Título</label>
            <input id="banner-titulo" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="banner-subtitulo">Subtítulo (opcional)</label>
            <input id="banner-subtitulo" value={form.subtitulo} onChange={(e) => setForm({ ...form, subtitulo: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="banner-link">Link ao clicar (opcional)</label>
            <input id="banner-link" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="field">
            <label htmlFor="banner-ordem">Ordem (menor aparece primeiro)</label>
            <input id="banner-ordem" type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="banner-imagem">Imagem</label>
            <input id="banner-imagem" type="file" accept="image/*" required onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Enviando…' : 'Salvar'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os banners: {erro}</div>}

      {!carregando && !erro && banners.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhum banner cadastrado</div>
          <div className="empty-sub">Os banners aparecem no carrossel no topo da Home.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        {banners.map((b) => (
          <div className="card" key={b.id}>
            <img src={urlPublicaBanner(b.imagem_path)} alt={b.titulo} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
            <div className="card-body">
              <div className="avisos-item-title">{b.titulo}</div>
              {b.subtitulo && <div className="avisos-item-sub">{b.subtitulo}</div>}
              <div className="avisos-item-sub">Ordem {b.ordem}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn-icon btn-icon-sm tt" data-tt="Remover" onClick={() => removerBanner(b.id, b.imagem_path)}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
