// =============================================================================
// Spotify Hub — autorizacao e renovacao de token (Supabase Edge Function)
//
// App "Hub_Imovit_Display" no Spotify Developer Dashboard, conta da empresa
// (Premium). Web Playback SDK na TV Display toca uma playlist em loop.
//
// Duas acoes (discriminadas pelo campo `action`, mesmo padrao da
// esteira-locacao):
//   'exchange' -- primeira autorizacao: troca o `code` do redirect do
//                 Spotify por access_token + refresh_token, grava em
//                 spotify_auth (linha unica) e devolve o access_token.
//   'token'    -- pedido periodico do player: devolve um access_token
//                 valido, renovando via refresh_token se estiver perto de
//                 expirar. Nunca devolve o refresh_token pro cliente.
//
// Client Secret nunca aparece no frontend -- so aqui, via env.
//
// Deploy: supabase functions deploy spotify-auth
// Env necessarias no projeto (alem de SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY,
// que o Supabase ja injeta): SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const spotifyClientId = Deno.env.get('SPOTIFY_CLIENT_ID')
const spotifyClientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas nas secrets da function')
}
if (!spotifyClientId || !spotifyClientSecret) {
  throw new Error('SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET precisam estar definidas nas secrets da function')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const basicAuthHeader = 'Basic ' + btoa(`${spotifyClientId}:${spotifyClientSecret}`)

// Margem de seguranca antes de considerar o access_token vencido.
const RENOVAR_ANTES_DE_MS = 5 * 60 * 1000

async function trocarCodigoPorToken(code: string, redirectUri: string) {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!resp.ok) {
    throw new Error(`Spotify token exchange falhou: ${resp.status} ${await resp.text()}`)
  }
  return resp.json()
}

async function renovarToken(refreshToken: string) {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!resp.ok) {
    throw new Error(`Spotify token refresh falhou: ${resp.status} ${await resp.text()}`)
  }
  return resp.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  let payload: { action?: string; code?: string; redirect_uri?: string }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'body invalido' }, 400)
  }

  try {
    if (payload.action === 'exchange') {
      if (!payload.code || !payload.redirect_uri) {
        return jsonResponse({ error: 'code e redirect_uri sao obrigatorios' }, 400)
      }
      const tokenData = await trocarCodigoPorToken(payload.code, payload.redirect_uri)
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

      const { error } = await supabase.from('spotify_auth').upsert({
        id: 1,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        atualizado_em: new Date().toISOString(),
      })
      if (error) throw error

      return jsonResponse({ access_token: tokenData.access_token, expires_in: tokenData.expires_in })
    }

    if (payload.action === 'token') {
      const { data: linha, error } = await supabase.from('spotify_auth').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      if (!linha) {
        return jsonResponse({ connected: false })
      }

      const expiraEm = new Date(linha.expires_at).getTime()
      if (expiraEm - Date.now() > RENOVAR_ANTES_DE_MS) {
        return jsonResponse({ connected: true, access_token: linha.access_token, expires_in: Math.floor((expiraEm - Date.now()) / 1000) })
      }

      const tokenData = await renovarToken(linha.refresh_token)
      const novaExpiraEm = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

      const { error: updateError } = await supabase.from('spotify_auth').update({
        access_token: tokenData.access_token,
        // Spotify pode devolver um refresh_token novo; se nao devolver, mantem o antigo.
        refresh_token: tokenData.refresh_token ?? linha.refresh_token,
        expires_at: novaExpiraEm,
        atualizado_em: new Date().toISOString(),
      }).eq('id', 1)
      if (updateError) throw updateError

      return jsonResponse({ connected: true, access_token: tokenData.access_token, expires_in: tokenData.expires_in })
    }

    return jsonResponse({ error: 'action invalida (use "exchange" ou "token")' }, 400)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'erro desconhecido' }, 500)
  }
})
