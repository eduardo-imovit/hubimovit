import { useBibliotecaLinks } from '../../hooks/useBibliotecaLinks'

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
  const { links, carregando, erro } = useBibliotecaLinks()
  const grupos = agruparPorCategoria(links)

  if (carregando) return <div className="hub-loading">Carregando…</div>
  if (erro) return <div className="hub-error">Não foi possível carregar a biblioteca: {erro}</div>

  if (grupos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Nenhum link cadastrado</div>
        <div className="empty-sub">Links do Drive, playbooks, processos e manuais aparecem aqui.</div>
      </div>
    )
  }

  return (
    <>
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
