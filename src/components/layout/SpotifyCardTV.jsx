import { useSpotifyPlayer } from '../../hooks/useSpotifyPlayer'
import { iniciarAutorizacaoSpotify } from '../../lib/spotifyAuth'

function formatarTempo(ms) {
  const totalSegundos = Math.floor((ms ?? 0) / 1000)
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

function IconeAnterior({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zM20 6L10 12l10 6z" />
    </svg>
  )
}

function IconePlay({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconePause({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  )
}

function IconeProxima({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6h2v12h-2zM4 6l10 6L4 18z" />
    </svg>
  )
}

export default function SpotifyCardTV() {
  const { status, faixa, controles } = useSpotifyPlayer()

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
        <span className="sky-card-tv-desc">{faixa.nome}</span>
        <span className="sky-card-tv-sub">{faixa.artista}</span>
        <div className="spotify-card-tv-progress">
          <div className="spotify-card-tv-progress-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div className="spotify-card-tv-tempos">
          <span>{formatarTempo(faixa.posicaoMs)}</span>
          <span>{formatarTempo(faixa.duracaoMs)}</span>
        </div>

        <div className="spotify-card-tv-controles">
          <button type="button" aria-label="Faixa anterior" onClick={controles.faixaAnterior}>
            <IconeAnterior className="spotify-card-tv-controle-icon" />
          </button>
          <button type="button" aria-label={faixa.pausado ? 'Tocar' : 'Pausar'} className="spotify-card-tv-controle-principal" onClick={controles.alternarPlayPause}>
            {faixa.pausado ? <IconePlay className="spotify-card-tv-controle-icon" /> : <IconePause className="spotify-card-tv-controle-icon" />}
          </button>
          <button type="button" aria-label="Próxima faixa" onClick={controles.proximaFaixa}>
            <IconeProxima className="spotify-card-tv-controle-icon" />
          </button>
        </div>
      </div>
    </div>
  )
}
