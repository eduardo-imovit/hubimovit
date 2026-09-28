// =============================================================================
// Proposta de VENDA (compra) — orquestrador (Supabase Edge Function)
//
// Fluxo paralelo ao esteira-locacao, sem tocá-lo: corretor cria, proponente
// (cliente) valida e assina via portal /venda. Sem cadastro, sem documentos,
// sem esteira. A lógica de estado mora no banco (migration
// 20260925130000_propostas_venda.sql); aqui só validação, identidade (JWT) e
// e-mails Brevo (falha de envio nunca derruba a operação).
// Os RPCs de estado só aceitam a service_role e recebem a identidade do
// chamador como parâmetro (com a service role, auth.uid()/auth.jwt() no banco
// não são do usuário).
//
// Eventos:
//   nova_proposta      -- role gestao/adm/corretor; grava criado_por; e-mail ao proponente
//   confirmar_proposta -- e-mail do JWT == propostas_venda.email; e-mail à equipe
//   descartar_proposta -- role gestao/adm; sem notificação
//
// Deploy: supabase functions deploy proposta-venda
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//          BREVO_API_KEY, APP_URL (https://hub.imovit.com.br)
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'
import { emailPropostaCompraConfirmada, emailPropostaCompraCriada } from './emails.ts'

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

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({
    evento: z.literal('nova_proposta'),
    nome_cliente: z.string().min(1),
    email: z.string().email(),
    codigo_imovel: z.number().int().positive(),
    valor: z.number().positive(),
    imovel_titulo: z.string().optional(),
    imovel_endereco: z.string().optional(),
  }),
  z.object({
    evento: z.literal('confirmar_proposta'),
    proposta_id: z.string().uuid(),
    telefone: z.string().min(1),
    valor_proposta: z.number().positive(),
    descricao_proposta: z.string().min(1),
    // Ignorado: o banco usa sempre {proposta_id}/assinatura.png.
    assinatura_path: z.string().optional(),
  }),
  z.object({
    evento: z.literal('descartar_proposta'),
    proposta_id: z.string().uuid(),
    motivo: z.string().min(1),
  }),
])

type Evento = z.infer<typeof eventoSchema>

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function obterChamador(req: Request): Promise<{ id: string; email: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY precisa estar definida nas secrets da function')
  const comoChamador = createClient(supabaseUrl!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user?.email) throw new HttpError(401, 'Token inválido ou expirado')
  return { id: user.id, email: user.email }
}

async function exigirCriadorProposta(req: Request): Promise<{ id: string; email: string }> {
  const chamador = await obterChamador(req)
  const { data: perfil, error } = await supabase
    .from('perfis').select('id, role, email').eq('id', chamador.id).single()
  if (error || !perfil || !['gestao', 'adm', 'corretor'].includes(perfil.role)) {
    throw new HttpError(403, 'Só Gestão, Admin e Corretor criam propostas de venda')
  }
  return { id: perfil.id, email: perfil.email }
}

async function exigirAdmin(req: Request): Promise<string> {
  const chamador = await obterChamador(req)
  const { data: perfil, error } = await supabase
    .from('perfis').select('role, email').eq('id', chamador.id).single()
  if (error || !perfil || (perfil.role !== 'gestao' && perfil.role !== 'adm')) {
    throw new HttpError(403, 'Ação restrita à equipe interna (gestão/adm)')
  }
  return perfil.email
}

const REMETENTE = { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' }
const DESTINATARIOS_VENDA = ['daniel@imovit.com.br', 'gabriela@imovit.com.br']

function appUrl() {
  return (Deno.env.get('APP_URL') || 'https://hub.imovit.com.br').replace(/\/+$/, '')
}
const linkPortalVenda = () => `${appUrl()}/venda/entrar`
const linkVendas = () => `${appUrl()}/admin/vendas`

async function notificar(destinatarios: string[], assunto: string, corpoHtml: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[proposta-venda] BREVO_API_KEY não configurada -- notificação não enviada:', assunto)
    return
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({
        sender: REMETENTE,
        to: destinatarios.map((email) => ({ email })),
        subject: assunto,
        htmlContent: corpoHtml,
      }),
    })
    if (!resposta.ok) console.error('[proposta-venda] Brevo retornou', resposta.status, await resposta.text())
  } catch (err) {
    console.error('[proposta-venda] erro ao notificar via Brevo:', err)
  }
}

async function handleNovaProposta(evento: Extract<Evento, { evento: 'nova_proposta' }>, ator: { id: string; email: string }) {
  const { data, error } = await supabase.rpc('criar_proposta_venda', {
    p_criado_por: ator.id,
    p_nome_cliente: evento.nome_cliente,
    p_email: evento.email,
    p_codigo_imovel: evento.codigo_imovel,
    p_valor: evento.valor,
    p_imovel_titulo: evento.imovel_titulo ?? null,
    p_imovel_endereco: evento.imovel_endereco ?? null,
    p_ator: ator.email,
  })
  if (error) throw error

  const email = emailPropostaCompraCriada(data, linkPortalVenda())
  await notificar([data.email], email.assunto, email.html)

  return { proposta: data }
}

async function handleConfirmarProposta(evento: Extract<Evento, { evento: 'confirmar_proposta' }>, emailChamador: string) {
  const { data, error } = await supabase.rpc('confirmar_proposta_venda', {
    p_proposta_id: evento.proposta_id,
    p_email_chamador: emailChamador,
    p_telefone: evento.telefone,
    p_valor_proposta: evento.valor_proposta,
    p_descricao: evento.descricao_proposta,
  })
  if (error) throw error

  const email = emailPropostaCompraConfirmada(data, linkVendas())
  await notificar(DESTINATARIOS_VENDA, email.assunto, email.html)

  return { proposta: data }
}

async function handleDescartarProposta(evento: Extract<Evento, { evento: 'descartar_proposta' }>, adminEmail: string) {
  const { data, error } = await supabase.rpc('descartar_proposta_venda', {
    p_proposta_id: evento.proposta_id,
    p_motivo: evento.motivo,
    p_ator: adminEmail,
  })
  if (error) throw error
  return { proposta: data }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const corpo = await req.json()
    const evento = eventoSchema.parse(corpo) as Evento
    let resultado
    if (evento.evento === 'nova_proposta') {
      resultado = await handleNovaProposta(evento, await exigirCriadorProposta(req))
    } else if (evento.evento === 'confirmar_proposta') {
      // e-mail do JWT validado aqui; o RPC confere que é o e-mail da proposta
      const chamador = await obterChamador(req)
      resultado = await handleConfirmarProposta(evento, chamador.email)
    } else if (evento.evento === 'descartar_proposta') {
      resultado = await handleDescartarProposta(evento, await exigirAdmin(req))
    } else {
      throw new HttpError(400, 'Evento desconhecido')
    }
    return new Response(JSON.stringify(resultado), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ erro: 'Payload inválido', detalhes: err.errors }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const status = err instanceof HttpError ? err.status : 500
    console.error('[proposta-venda]', err)
    return new Response(JSON.stringify({ erro: err instanceof Error ? err.message : 'Erro interno' }), {
      status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
