import { useEffect, useState } from 'react'
import { useBanners, urlPublicaBanner } from '../../hooks/useBanners'

const INTERVALO_MS = 6000

export default function BannerCarrossel({ variante = 'home', mostrarControles = true }) {
  const { banners, carregando } = useBanners()
  const [ativo, setAtivo] = useState(0)

  useEffect(() => {
    if (banners.length < 2) return
    const id = setInterval(() => setAtivo((a) => (a + 1) % banners.length), INTERVALO_MS)
    return () => clearInterval(id)
  }, [banners.length])

  useEffect(() => {
    if (ativo >= banners.length) setAtivo(0)
  }, [banners.length, ativo])

  if (carregando || banners.length === 0) return null

  const banner = banners[ativo]
  const conteudo = (
    <>
      {banners.map((b, i) => (
        <div className={`banner-slide${i === ativo ? ' is-active' : ''}`} key={b.id}>
          <img src={urlPublicaBanner(b.imagem_path)} alt={b.titulo} />
          {(b.titulo || b.subtitulo) && (
            <div className="banner-slide-caption">
              {b.titulo && <div className="banner-slide-title">{b.titulo}</div>}
              {b.subtitulo && <div className="banner-slide-sub">{b.subtitulo}</div>}
            </div>
          )}
        </div>
      ))}
    </>
  )

  return (
    <div className={variante === 'tv' ? 'banner-carrossel-tv-bg' : 'banner-carrossel'}>
      {banner.link_url ? (
        <a href={banner.link_url} target="_blank" rel="noreferrer" style={{ display: 'contents' }}>{conteudo}</a>
      ) : conteudo}

      {mostrarControles && banners.length > 1 && (
        <>
          <button type="button" className="banner-arrow prev" onClick={() => setAtivo((a) => (a - 1 + banners.length) % banners.length)}>‹</button>
          <button type="button" className="banner-arrow next" onClick={() => setAtivo((a) => (a + 1) % banners.length)}>›</button>
          <div className="banner-dots">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`banner-dot${i === ativo ? ' is-active' : ''}`}
                onClick={() => setAtivo(i)}
                aria-label={`Ir para o banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
