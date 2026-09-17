import { useEffect, useRef, useState } from 'react'
import { obterAccessToken } from '../lib/spotifyAuth'

const PLAYLIST_ID = import.meta.env.VITE_SPOTIFY_PLAYLIST_ID

function carregarSdk() {
  return new Promise((resolve) => {
    if (window.Spotify) {
      resolve(window.Spotify)
      return
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify)
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })
}

async function iniciarPlaylist(deviceId, accessToken) {
  if (!PLAYLIST_ID) return
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: `spotify:playlist:${PLAYLIST_ID}` }),
  })
  await fetch(`https://api.spotify.com/v1/me/player/repeat?state=context&device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// Estados possiveis: 'conectando' | 'desconectado' | 'sem-playlist' | 'tocando' | 'erro' | 'erro-conta'
export function useSpotifyPlayer() {
  const [estado, setEstado] = useState({ status: 'conectando', faixa: null })
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelado = false

    async function iniciar() {
      let tokenData
      try {
        tokenData = await obterAccessToken()
      } catch {
        if (!cancelado) setEstado({ status: 'erro', faixa: null })
        return
      }
      if (cancelado) return
      if (!tokenData?.connected) {
        setEstado({ status: 'desconectado', faixa: null })
        return
      }

      const Spotify = await carregarSdk()
      if (cancelado) return

      const player = new Spotify.Player({
        name: 'Hub Imovit — TV Display',
        getOAuthToken: async (callback) => {
          try {
            const data = await obterAccessToken()
            callback(data.access_token)
          } catch {
            callback('')
          }
        },
        volume: 0.6,
      })
      playerRef.current = player

      player.addListener('ready', async ({ device_id }) => {
        if (cancelado) return
        if (!PLAYLIST_ID) {
          setEstado((atual) => (atual.faixa ? atual : { status: 'sem-playlist', faixa: null }))
          return
        }
        try {
          await iniciarPlaylist(device_id, tokenData.access_token)
        } catch {
          // segue mesmo se o autoplay inicial falhar — o player ja esta pronto,
          // player_state_changed atualiza o estado quando algo tocar.
        }
      })

      player.addListener('player_state_changed', (state) => {
        if (cancelado || !state) return
        const item = state.track_window?.current_track
        setEstado({
          status: 'tocando',
          faixa: item
            ? {
                nome: item.name,
                artista: item.artists?.map((a) => a.name).join(', '),
                capa: item.album?.images?.[0]?.url,
                posicaoMs: state.position,
                duracaoMs: state.duration,
                pausado: state.paused,
              }
            : null,
        })
      })

      player.addListener('initialization_error', () => !cancelado && setEstado({ status: 'erro', faixa: null }))
      player.addListener('authentication_error', () => !cancelado && setEstado({ status: 'erro', faixa: null }))
      player.addListener('account_error', () => !cancelado && setEstado({ status: 'erro-conta', faixa: null }))

      await player.connect()
    }

    iniciar()

    return () => {
      cancelado = true
      playerRef.current?.disconnect()
    }
  }, [])

  return estado
}
