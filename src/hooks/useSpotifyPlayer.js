import { useEffect, useRef, useState } from 'react'
import { obterAccessToken } from '../lib/spotifyAuth'

const PLAYLIST_ID = import.meta.env.VITE_SPOTIFY_PLAYLIST_ID
const WATCHDOG_INTERVALO_MS = 20 * 1000

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

// Forca a TV a virar o dispositivo ativo e tocando de novo -- usado quando
// outro cliente logado na mesma conta (ex: celular de alguem) manda um
// pause remoto via Spotify Connect, ou assume o dispositivo ativo.
async function reativarDispositivo(deviceId, accessToken) {
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })
}

// Estados possiveis: 'conectando' | 'desconectado' | 'sem-playlist' | 'tocando' | 'erro' | 'erro-conta'
export function useSpotifyPlayer() {
  const [estado, setEstado] = useState({ status: 'conectando', faixa: null })
  const playerRef = useRef(null)
  const deviceIdRef = useRef(null)
  // true enquanto o pause atual foi pedido por voce mesmo (botao da TV) --
  // o watchdog so tenta retomar sozinho quando isso for false.
  const pausaManualRef = useRef(false)

  useEffect(() => {
    let cancelado = false
    let watchdogId

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
        deviceIdRef.current = device_id
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

        if (!state.paused) {
          // algo tocando de novo (nosso botao ou um play externo) -- sai do modo "pausado manualmente"
          pausaManualRef.current = false
        } else if (!pausaManualRef.current) {
          // pausou sem ter sido voce -- provavelmente outro cliente logado na
          // mesma conta mandou um pause remoto via Spotify Connect. Tenta retomar.
          setTimeout(async () => {
            if (cancelado || pausaManualRef.current || !deviceIdRef.current) return
            try {
              const data = await obterAccessToken()
              await reativarDispositivo(deviceIdRef.current, data.access_token)
            } catch {
              // tentativa seguinte fica por conta do watchdog periodico
            }
          }, 3000)
        }
      })

      player.addListener('initialization_error', () => !cancelado && setEstado({ status: 'erro', faixa: null }))
      player.addListener('authentication_error', () => !cancelado && setEstado({ status: 'erro', faixa: null }))
      player.addListener('account_error', () => !cancelado && setEstado({ status: 'erro-conta', faixa: null }))

      await player.connect()

      // Confere periodicamente se a TV continua sendo o dispositivo ativo e
      // tocando -- cobre o caso de outro cliente assumir o dispositivo ativo
      // sem o SDK emitir player_state_changed pra gente.
      watchdogId = setInterval(async () => {
        if (cancelado || !deviceIdRef.current || pausaManualRef.current) return
        try {
          const data = await obterAccessToken()
          const resp = await fetch('https://api.spotify.com/v1/me/player', {
            headers: { Authorization: `Bearer ${data.access_token}` },
          })
          if (resp.status !== 200) return
          const playbackState = await resp.json()
          const dispositivoTrocado = playbackState.device?.id && playbackState.device.id !== deviceIdRef.current
          const pausadoSemMotivo = playbackState.device?.id === deviceIdRef.current && playbackState.is_playing === false
          if (dispositivoTrocado || pausadoSemMotivo) {
            await reativarDispositivo(deviceIdRef.current, data.access_token)
          }
        } catch {
          // se a checagem falhar (ex: token instavel), so tenta de novo no proximo ciclo
        }
      }, WATCHDOG_INTERVALO_MS)
    }

    iniciar()

    return () => {
      cancelado = true
      clearInterval(watchdogId)
      playerRef.current?.disconnect()
    }
  }, [])

  const controles = {
    alternarPlayPause: () => {
      // se ainda nao esta pausada, esse clique vai pausar -- entra no modo
      // "pausado manualmente" pra o watchdog nao brigar com voce
      pausaManualRef.current = !(estado.faixa?.pausado ?? false)
      playerRef.current?.togglePlay()
    },
    proximaFaixa: () => playerRef.current?.nextTrack(),
    faixaAnterior: () => playerRef.current?.previousTrack(),
  }

  return { ...estado, controles }
}
