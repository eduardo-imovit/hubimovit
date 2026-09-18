import { useEffect, useRef, useState } from 'react'
import { useBanners, urlPublicaBanner, ehVideoBanner } from '../../hooks/useBanners'

const INTERVALO_MS = 15000

// O atributo `autoplay` as vezes eh avaliado pelo navegador antes do React
// terminar de setar `muted` (que ele aplica como propriedade JS, nao como
// atributo HTML) -- a 1a tentativa de autoplay e rejeitada (so toca sozinho
// se ja estiver mudo) e o video fica parado pra sempre. Forca play() na mao
// assim que o primeiro frame estiver pronto, ja garantindo mudo antes.
function tocarVideo(e) {
  const video = e.currentTarget
  video.muted = true
  video.play().catch(() => {})
}

export default function BannerCarrossel({ variante = 'home', mostrarControles = true }) {
  const { banners, carregando } = useBanners()
  const [ativo, setAtivo] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    if (banners.length < 2) return
    const id = setInterval(() => setAtivo((a) => (a + 1) % banners.length), INTERVALO_MS)
    return () => clearInterval(id)
  }, [banners.length])

  useEffect(() => {
    if (ativo >= banners.length) setAtivo(0)
  }, [banners.length, ativo])

  // O Chrome pausa video autoplay fora de tela por economia de energia --
  // quando o slide vira o ativo, garante que o video dele volte a tocar
  // (senao fica congelado no frame de quando foi pausado em segundo plano).
  useEffect(() => {
    const video = containerRef.current?.querySelector('.banner-slide.is-active video')
    video?.play().catch(() => {})
  }, [ativo])

  if (carregando || banners.length === 0) return null

  const ehTV = variante === 'tv'
  const banner = banners[ativo]
  const conteudo = (
    <>
      {banners.map((b, i) => (
        <div className={`banner-slide${i === ativo ? ' is-active' : ''}`} key={b.id}>
          {ehVideoBanner(b.imagem_path) ? (
            <video src={urlPublicaBanner(b.imagem_path)} autoPlay muted loop playsInline onLoadedData={tocarVideo} />
          ) : (
            <img src={urlPublicaBanner(b.imagem_path)} alt={b.titulo} />
          )}
          {!ehTV && (b.titulo || b.subtitulo) && (
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
    <div ref={containerRef} className={ehTV ? 'banner-carrossel-tv' : 'banner-carrossel'}>
      {!ehTV && banner.link_url ? (
        <a href={banner.link_url} target="_blank" rel="noreferrer" style={{ display: 'contents' }}>{conteudo}</a>
      ) : conteudo}

      {mostrarControles && banners.length > 1 && (
        <>
          <button type="button" className="banner-arrow prev" onClick={() => setAtivo((a) => (a - 1 + banners.length) % banners.length)}>‹</button>
          <button type="button" className="banner-arrow next" onClick={() => setAtivo((a) => (a + 1) % banners.length)}>›</button>
          {!ehTV && (
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
          )}
        </>
      )}
    </div>
  )
}
