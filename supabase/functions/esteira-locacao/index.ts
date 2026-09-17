// =============================================================================
// Esteira de locação — orquestrador (Supabase Edge Function)
//
// Adaptado ao schema real do projeto (tabelas propostas_locacao,
// documentos_tipos_obrigatorios, documentos_enviados, status_historico),
// que já existia antes desta função — ver migration
// 20260821140000_esteira_locacao_ajustes.sql para as colunas/funções/triggers
// adicionadas em cima do que já estava lá.
//
// Toda a lógica de estado mora no banco. Esta função só faz três coisas:
//   1. valida o formato do payload recebido;
//   2. despacha pro RPC certo, de acordo com o campo `evento`;
//   3. no caso de sincronização, chama a API do Imoview e só então confirma
//      no banco (SQL não fala com APIs externas).
//
// Por que `evento` explícito em vez de inferir a ação pelos campos
// presentes: inferir por "quais campos vieram preenchidos" é frágil (um
// campo extra enviado por engano muda o comportamento) e dificulta validar
// o payload com um schema. Um discriminador explícito é a forma correta.
//
// 'nova_proposta'/'docs_enviados'/'proprietario_aceitou' são chamados por
// cliente/proprietário sem sessão Supabase (o cliente chega pelo token_link,
// não por login) — por isso o deploy precisa da flag --no-verify-jwt (senão
// o Supabase bloqueia toda chamada sem JWT antes de chegar aqui). A
// autorização de 'decisao_adm' e 'sincronizar_imoview' (as ações sensíveis)
// é feita à mão dentro da função, via exigirAdmin().
//
// Deploy: supabase functions deploy esteira-locacao --no-verify-jwt
// Env necessárias no projeto: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY, IMOVIEW_API_KEY (header "chave" — ver
// documentação oficial em api.imoview.com.br, seção Lead/IncluirLead).
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

// -----------------------------------------------------------------------------
// Schemas de entrada — um por evento, união discriminada por `evento`
// -----------------------------------------------------------------------------

const clienteDadosSchema = z.object({
  nome_cliente: z.string().min(1),
  email: z.string().email(),
  tel: z.string().optional(),
  codigo_imovel: z.number().int().positive(),
  tipo_pessoa: z.enum(['Física', 'Jurídica']),
  tem_conjuge: z.boolean(),
})

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({
    evento: z.literal('nova_proposta'),
    cliente: clienteDadosSchema,
  }),
  z.object({
    evento: z.literal('proprietario_aceitou'),
    proposta_id: z.string().uuid(),
  }),
  z.object({
    evento: z.literal('docs_enviados'),
    proposta_id: z.string().uuid(),
    documentos: z.array(
      z.object({
        documento_codigo: z.number().int().positive(),
        url_gdrive: z.string().url(),
      })
    ).min(1),
  }),
  z.object({
    evento: z.literal('decisao_adm'),
    documento_id: z.string().uuid(),
    decisao: z.enum(['aprovado', 'rejeitado']),
    feedback: z.string().optional(),
  }),
  z.object({
    evento: z.literal('sincronizar_imoview'),
    proposta_id: z.string().uuid(),
  }),
])

type Evento = z.infer<typeof eventoSchema>

// evento -> exige que quem chamou seja admin (verificado por JWT, não por
// campo enviado no corpo — nunca confiar em "ator" vindo do cliente)
const EVENTOS_ADMIN = new Set<Evento['evento']>(['decisao_adm', 'sincronizar_imoview'])

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function exigirAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'Requisição sem token de autenticação')
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY precisa estar definida nas secrets da function')
  }

  const supabaseComoChamador = createClient(supabaseUrl!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: erroAuth } = await supabaseComoChamador.auth.getUser()
  if (erroAuth || !user) {
    throw new HttpError(401, 'Token inválido ou expirado')
  }

  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis')
    .select('role, email')
    .eq('id', user.id)
    .single()
  if (erroPerfil || perfil?.role !== 'admin') {
    throw new HttpError(403, 'Ação restrita a administradores')
  }

  // status_historico.ator é texto livre — guarda o e-mail (mais legível que
  // o uuid pra quem for auditar depois).
  return perfil.email
}

// -----------------------------------------------------------------------------
// Handlers — um por evento, espelhando 1:1 os passos da esteira
// -----------------------------------------------------------------------------

async function handleNovaProposta(evento: Extract<Evento, { evento: 'nova_proposta' }>) {
  const { data, error } = await supabase.rpc('upsert_proposta_locacao', {
    p_nome_cliente: evento.cliente.nome_cliente,
    p_email: evento.cliente.email,
    p_tel: evento.cliente.tel ?? null,
    p_codigo_imovel: evento.cliente.codigo_imovel,
    p_tipo_pessoa: evento.cliente.tipo_pessoa,
    p_tem_conjuge: evento.cliente.tem_conjuge,
    p_ator: 'cliente',
  })
  if (error) throw error
  // token_link é o link que o cliente usa daqui pra frente — não expor mais
  // do que o necessário pra quem chamou este evento (ex: um formulário público).
  return { proposta_id: data.id, status: data.status, token_link: data.token_link, link_expira_em: data.link_expira_em }
}

async function handleProprietarioAceitou(evento: Extract<Evento, { evento: 'proprietario_aceitou' }>) {
  const { data, error } = await supabase.rpc('aceitar_proprietario', {
    p_proposta_id: evento.proposta_id,
    p_ator: 'proprietario',
  })
  if (error) throw error

  const { data: checklist, error: erroChecklist } = await supabase
    .from('documentos_tipos_obrigatorios')
    .select('codigo, nome, descricao')
    .or(`tipo_pessoa.eq.${data.tipo_pessoa},tipo_pessoa.eq.Ambos`)
    .or(`exige_conjuge.eq.false${data.tem_conjuge ? ',exige_conjuge.eq.true' : ''}`)
  if (erroChecklist) throw erroChecklist

  return { proposta: data, checklist }
}

async function handleDocsEnviados(evento: Extract<Evento, { evento: 'docs_enviados' }>) {
  const resultados = []
  for (const doc of evento.documentos) {
    const { data, error } = await supabase.rpc('registrar_documento_enviado', {
      p_proposta_id: evento.proposta_id,
      p_documento_codigo: doc.documento_codigo,
      p_url_gdrive: doc.url_gdrive,
      p_ator: 'cliente',
    })
    if (error) throw error
    resultados.push(data)
  }

  const { data: proposta, error: erroProposta } = await supabase
    .from('propostas_locacao')
    .select('*')
    .eq('id', evento.proposta_id)
    .single()
  if (erroProposta) throw erroProposta

  return { documentos: resultados, proposta }
}

async function handleDecisaoAdm(evento: Extract<Evento, { evento: 'decisao_adm' }>, adminEmail: string) {
  const { data, error } = await supabase.rpc('decidir_documento', {
    p_documento_id: evento.documento_id,
    p_decisao: evento.decisao,
    p_ator: adminEmail,
    p_feedback: evento.feedback ?? null,
  })
  if (error) throw error
  return { documento: data }
}

async function handleSincronizarImoview(evento: Extract<Evento, { evento: 'sincronizar_imoview' }>, adminEmail: string) {
  const { data: proposta, error: erroProposta } = await supabase
    .from('propostas_locacao')
    .select('*')
    .eq('id', evento.proposta_id)
    .single()
  if (erroProposta) throw erroProposta

  if (proposta.status !== 'docs_aprovados') {
    throw new Error(`Proposta ${evento.proposta_id} está em status "${proposta.status}", esperado "docs_aprovados"`)
  }

  await sincronizarComImoview(proposta)

  const { data, error } = await supabase.rpc('marcar_sincronizado_imoview', {
    p_proposta_id: evento.proposta_id,
    p_ator: adminEmail,
  })
  if (error) throw error

  return { proposta: data }
}

// Integração conforme o OpenAPI oficial do Imoview (POST /Lead/IncluirLead,
// schema LeadIncluir): endpoint de captação externa, autenticado só com o
// header `chave` (sem sessão App_ValidarAcesso). `finalidade: '1'` = aluguel,
// fixo porque esta esteira é só de locação. A resposta do Imoview só traz
// `mensagem` — não existe id de lead pra guardar de volta.
//
// `midia` é obrigatório pro Imoview e a tabela real não tem essa coluna —
// uso um valor fixo identificando a origem. Se isso importar pra atribuição
// de campanha no Imoview, precisa virar uma coluna real em propostas_locacao
// (mesma ressalva que já tinha feito antes: não inventar dado de marketing).
const MIDIA_ORIGEM_PADRAO = 'Hub Imovit - Esteira de Locação'

interface ImoviewLeadResponse {
  mensagem: string
}

async function sincronizarComImoview(proposta: {
  nome_cliente: string
  email: string
  tel: string | null
  codigo_imovel: number
}) {
  const imoviewApiKey = Deno.env.get('IMOVIEW_API_KEY')
  if (!imoviewApiKey) {
    throw new Error('IMOVIEW_API_KEY precisa estar definida nas secrets da function')
  }

  const resposta = await fetch('https://api.imoview.com.br/Lead/IncluirLead', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      chave: imoviewApiKey,
    },
    body: JSON.stringify({
      nome: proposta.nome_cliente,
      telefone: proposta.tel ?? undefined,
      email: proposta.email,
      midia: MIDIA_ORIGEM_PADRAO,
      finalidade: '1', // 1 = aluguel
      codigoimovel: String(proposta.codigo_imovel),
    }),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text()
    throw new Error(`Imoview retornou ${resposta.status}: ${corpo}`)
  }

  const corpo: ImoviewLeadResponse = await resposta.json()
  return corpo
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ erro: 'Use POST' }, 405)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ erro: 'Corpo da requisição precisa ser JSON válido' }, 400)
  }

  const parsed = eventoSchema.safeParse(payload)
  if (!parsed.success) {
    return jsonResponse({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, 400)
  }

  try {
    const evento = parsed.data
    const adminEmail = EVENTOS_ADMIN.has(evento.evento) ? await exigirAdmin(req) : null

    switch (evento.evento) {
      case 'nova_proposta':
        return jsonResponse(await handleNovaProposta(evento))
      case 'proprietario_aceitou':
        return jsonResponse(await handleProprietarioAceitou(evento))
      case 'docs_enviados':
        return jsonResponse(await handleDocsEnviados(evento))
      case 'decisao_adm':
        return jsonResponse(await handleDecisaoAdm(evento, adminEmail!))
      case 'sincronizar_imoview':
        return jsonResponse(await handleSincronizarImoview(evento, adminEmail!))
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ erro: error.message }, error.status)
    }
    console.error('[esteira-locacao] erro ao processar evento:', error)
    return jsonResponse({ erro: error instanceof Error ? error.message : 'Erro desconhecido' }, 400)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
