import { supabase } from './supabaseClient'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

export function redirectUriAtual() {
  return `${window.location.origin}/spotify-callback`
}

export function iniciarAutorizacaoSpotify() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUriAtual(),
    scope: SCOPES,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function trocarCodigoPorToken(code) {
  const { data, error } = await supabase.functions.invoke('spotify-auth', {
    body: { action: 'exchange', code, redirect_uri: redirectUriAtual() },
  })
  if (error) throw error
  return data
}

export async function obterAccessToken() {
  const { data, error } = await supabase.functions.invoke('spotify-auth', {
    body: { action: 'token' },
  })
  if (error) throw error
  return data
}
