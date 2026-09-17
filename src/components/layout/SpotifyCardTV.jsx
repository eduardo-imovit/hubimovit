import { useSpotifyPlayer } from '../../hooks/useSpotifyPlayer'
import { iniciarAutorizacaoSpotify } from '../../lib/spotifyAuth'

function formatarTempo(ms) {
  const totalSegundos = Math.floor((ms ?? 0) / 1000)
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

export default function SpotifyCardTV() {
  const { status, faixa } = useSpotifyPlayer()

  if (status === 'conectando') {
    return <div className="sky-card-tv sky-card-tv--weather sky-card-tv--carregando" aria-hidden="true" />
  }

  if (status === 'desconectado') {
    return (
      <button type="button" className="sky-card-tv sky-card-tv--weather sky-neutro spotify-card-tv-connect" onClick={iniciarAutorizacaoSpotify}>
        <div className="sky-card-tv-content">
          <span className="sky-card-tv-desc">🎵 Conectar Spotify</span>
        </div>
      </button>
    )
  }

  if (status === 'erro-conta') {
    return (
      <div className="sky-card-tv sky-card-tv--weather sky-neutro">
        <div className="sky-card-tv-content">
          <span className="sky-card-tv-desc">Conta Spotify sem Premium ativo</span>
        </div>
      </div>
    )
  }

  if (status === 'erro') {
    return (
      <div className="sky-card-tv sky-card-tv--weather sky-neutro">
        <div className="sky-card-tv-content">
          <span className="sky-card-tv-desc">Spotify indisponível</span>
        </div>
      </div>
    )
  }

  if (status === 'sem-playlist' || !faixa) {
    return (
      <div className="sky-card-tv sky-card-tv--weather sky-neutro">
        <div className="sky-card-tv-content">
          <span className="sky-card-tv-desc">Nenhuma playlist configurada</span>
        </div>
      </div>
    )
  }

  const progresso = faixa.duracaoMs ? Math.min(100, (faixa.posicaoMs / faixa.duracaoMs) * 100) : 0

  return (
    <div
      className="sky-card-tv sky-card-tv--weather"
      style={faixa.capa ? { backgroundImage: `url(${faixa.capa})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div className="sky-card-tv-content">
        <span className="sky-card-tv-desc">{faixa.pausado ? '⏸' : '♪'} {faixa.nome}</span>
        <span className="sky-card-tv-sub">{faixa.artista}</span>
        <div className="spotify-card-tv-progress">
          <div className="spotify-card-tv-progress-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div className="spotify-card-tv-tempos">
          <span>{formatarTempo(faixa.posicaoMs)}</span>
          <span>{formatarTempo(faixa.duracaoMs)}</span>
        </div>
      </div>
    </div>
  )
}
