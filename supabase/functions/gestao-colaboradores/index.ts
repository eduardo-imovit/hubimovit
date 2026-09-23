// =============================================================================
// Gestão de colaboradores -- suspender, reativar e excluir (Supabase Edge Function)
//
// Precisa da service role porque mexe no Supabase Auth (bloquear login e
// apagar usuário), o que o navegador não pode fazer. Só a Gestão chama.
//
//   suspender -- bloqueia o login no Auth e marca perfis.suspenso_em (a marca
//                corta o acesso na hora, ver migration 20260923210000)
//   reativar  -- desfaz as duas coisas
//   excluir   -- apaga a foto e o usuário do Auth; perfis e pedidos de nível
//                caem em cascata, propostas criadas ficam sem dono (criado_por null)
//
// Travas: ninguém age sobre si mesmo, e a última pessoa da Gestão ativa não
// pode ser suspensa nem excluída (o Hub ficaria sem quem administre acessos).
//
// Deploy: supabase functions deploy gestao-colaboradores
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas nas secrets da function')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Bloqueio "sem prazo" no Auth: ~100 anos.
const BANIMENTO_INDEFINIDO = '876000h'

const pedidoSchema = z.object({
  acao: z.enum(['suspender', 'reativar', 'excluir']),
  perfil_id: z.string().uuid(),
})

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function exigirGestao(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY precisa estar definida nas secrets da function')

  const comoChamador = createClient(supabaseUrl!, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Token inválido ou expirado')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role, suspenso_em')
    .eq('id', user.id)
    .single()
  if (!perfil || perfil.role !== 'gestao' || perfil.suspenso_em) {
    throw new HttpError(403, 'Só a Gestão pode suspender ou excluir colaboradores')
  }
  return user.id
}

async function garantirOutraGestaoAtiva(alvoId: string) {
  const { count, error } = await supabase
    .from('perfis')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'gestao')
    .is('suspenso_em', null)
    .neq('id', alvoId)
  if (error) throw error
  if (!count) {
    throw new HttpError(409, 'Esta é a última pessoa da Gestão ativa. Promova outra pessoa à Gestão antes.')
  }
}

async function suspender(alvo: { id: string; role: string; suspenso_em: string | null }, gestorId: string) {
  if (alvo.suspenso_em) throw new HttpError(409, 'Colaborador já está suspenso')
  if (alvo.role === 'gestao') await garantirOutraGestaoAtiva(alvo.id)

  const { error: erroAuth } = await supabase.auth.admin.updateUserById(alvo.id, { ban_duration: BANIMENTO_INDEFINIDO })
  if (erroAuth) throw erroAuth

  const { error } = await supabase
    .from('perfis')
    .update({ suspenso_em: new Date().toISOString(), suspenso_por: gestorId })
    .eq('id', alvo.id)
  if (error) throw error

  // Pedido de nível em aberto de quem foi suspenso não faz mais sentido.
  await supabase.from('solicitacoes_acesso').update({ status: 'cancelada' }).eq('perfil_id', alvo.id).eq('status', 'pendente')
}

async function reativar(alvo: { id: string; suspenso_em: string | null }) {
  if (!alvo.suspenso_em) throw new HttpError(409, 'Colaborador não está suspenso')

  const { error: erroAuth } = await supabase.auth.admin.updateUserById(alvo.id, { ban_duration: 'none' })
  if (erroAuth) throw erroAuth

  const { error } = await supabase.from('perfis').update({ suspenso_em: null, suspenso_por: null }).eq('id', alvo.id)
  if (error) throw error
}

async function excluir(alvo: { id: string; role: string; suspenso_em: string | null }) {
  if (alvo.role === 'gestao' && !alvo.suspenso_em) await garantirOutraGestaoAtiva(alvo.id)

  // Foto de perfil: falha aqui não impede a exclusão.
  try {
    const { data: fotos } = await supabase.storage.from('avatares').list(alvo.id)
    if (fotos?.length) await supabase.storage.from('avatares').remove(fotos.map((f) => `${alvo.id}/${f.name}`))
  } catch (err) {
    console.error('[gestao-colaboradores] erro ao apagar fotos:', err)
  }

  const { error } = await supabase.auth.admin.deleteUser(alvo.id)
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ erro: 'Use POST' }, 405)

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ erro: 'Corpo da requisição precisa ser JSON válido' }, 400)
  }

  const parsed = pedidoSchema.safeParse(payload)
  if (!parsed.success) return jsonResponse({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, 400)

  try {
    const gestorId = await exigirGestao(req)
    const { acao, perfil_id } = parsed.data
    if (perfil_id === gestorId) throw new HttpError(400, 'Você não pode suspender nem excluir a si mesmo')

    const { data: alvo, error } = await supabase
      .from('perfis')
      .select('id, role, suspenso_em')
      .eq('id', perfil_id)
      .single()
    if (error || !alvo) throw new HttpError(404, 'Colaborador não encontrado')

    if (acao === 'suspender') await suspender(alvo, gestorId)
    if (acao === 'reativar') await reativar(alvo)
    if (acao === 'excluir') await excluir(alvo)

    console.log(`[gestao-colaboradores] ${acao} ${perfil_id} por ${gestorId}`)
    return jsonResponse({ ok: true })
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ erro: error.message }, error.status)
    console.error('[gestao-colaboradores] erro:', error)
    return jsonResponse({ erro: error instanceof Error ? error.message : 'Erro desconhecido' }, 400)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
