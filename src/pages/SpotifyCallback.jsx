import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { trocarCodigoPorToken } from '../lib/spotifyAuth'

export default function SpotifyCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processando')
  const [erro, setErro] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const erroSpotify = searchParams.get('error')

    if (erroSpotify) {
      setStatus('erro')
      setErro(`Spotify recusou a autorização: ${erroSpotify}`)
      return
    }
    if (!code) {
      setStatus('erro')
      setErro('Nenhum código de autorização recebido.')
      return
    }

    trocarCodigoPorToken(code)
      .then(() => {
        setStatus('sucesso')
        setTimeout(() => navigate('/tv-display'), 2000)
      })
      .catch((err) => {
        setStatus('erro')
        setErro(err.message ?? 'Erro desconhecido ao trocar o código pelo token.')
      })
  }, [searchParams, navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, fontFamily: 'system-ui', textAlign: 'center', padding: 24,
    }}>
      {status === 'processando' && <p>Conectando ao Spotify…</p>}
      {status === 'sucesso' && <p>Conectado! Redirecionando para a TV Display…</p>}
      {status === 'erro' && (
        <>
          <p style={{ color: '#B93A18', fontWeight: 600 }}>Não foi possível conectar ao Spotify.</p>
          <p style={{ fontSize: 13, color: '#888', maxWidth: 480 }}>{erro}</p>
        </>
      )}
    </div>
  )
}
