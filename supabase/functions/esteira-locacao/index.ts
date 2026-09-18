// =============================================================================
// Esteira de locação — orquestrador (Supabase Edge Function)
//
// Reescrita pra trazer a esteira pro Hub com login real (magic link) de
// locatário e proprietário, em vez do modelo antigo de token_link anônimo.
// Toda a lógica de estado continua morando no banco (ver migrations
// 20260821140000_esteira_locacao_ajustes.sql, 20260918150000_esteira_locacao_hub.sql
// e 20260918151500_esteira_documento_via_storage.sql). Esta função só:
//   1. valida o formato do payload recebido;
//   2. confere a identidade de quem chamou (JWT) contra a proposta -- nunca
//      confia em nada que o cliente diga sobre quem ele é;
//   3. despacha pro RPC certo, de acordo com o campo `evento`.
//
// Modelo de autorização por evento:
//   nova_proposta            -- qualquer usuário interno logado (tem linha em perfis)
//   confirmar_dados_locatario -- e-mail do JWT precisa bater com propostas_locacao.email
//   proprietario_aceitou     -- e-mail do JWT precisa bater com propostas_locacao.proprietario_email
//   docs_enviados            -- e-mail do JWT precisa bater com propostas_locacao.email
//   decisao_adm              -- role gestao/adm (via perfis)
//   sincronizar_imoview      -- role gestao/adm (via perfis)
//
// Como agora TODO chamador precisa estar logado (não existe mais fluxo
// anônimo por token_link), o deploy usa verificação de JWT padrão -- sem
// --no-verify-jwt.
//
// Deploy: supabase functions deploy esteira-locacao
// Env necessárias no projeto: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. IMOVIEW_API_KEY não é usada nesta fase (ver
// nota em handleSincronizarImoview).
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

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({
    evento: z.literal('nova_proposta'),
    email: z.string().email(),
    codigo_imovel: z.number().int().positive(),
    proprietario_nome: z.string().min(1),
    proprietario_email: z.string().email(),
    imovel_titulo: z.string().optional(),
    imovel_endereco: z.string().optional(),
  }),
  z.object({
    evento: z.literal('confirmar_dados_locatario'),
    proposta_id: z.string().uuid(),
    nome: z.string().min(1),
    tel: z.string().min(1),
    tipo_pessoa: z.enum(['Física', 'Jurídica']),
    tem_conjuge: z.boolean(),
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
        arquivo_path: z.string().min(1),
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

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// -----------------------------------------------------------------------------
// Identidade — nunca confiar em nada que venha no corpo da requisição sobre
// "quem é" o chamador; sempre extrair do JWT validado pelo Supabase Auth.
// -----------------------------------------------------------------------------

async function obterChamador(req: Request): Promise<{ id: string; email: string }> {
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

  const { data: { user }, error } = await supabaseComoChamador.auth.getUser()
  if (error || !user?.email) {
    throw new HttpError(401, 'Token inválido ou expirado')
  }

  return { id: user.id, email: user.email }
}

async function exigirAdmin(req: Request): Promise<string> {
  const chamador = await obterChamador(req)
  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('role, email')
    .eq('id', chamador.id)
    .single()
  if (error || !perfil || (perfil.role !== 'gestao' && perfil.role !== 'adm')) {
    throw new HttpError(403, 'Ação restrita à equipe interna (gestão/adm)')
  }
  // status_historico.ator é texto livre — guarda o e-mail (mais legível que
  // o uuid pra quem for auditar depois).
  return perfil.email
}

async function exigirUsuarioInterno(req: Request): Promise<string> {
  const chamador = await obterChamador(req)
  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('email')
    .eq('id', chamador.id)
    .single()
  if (error || !perfil) {
    throw new HttpError(403, 'Ação restrita a usuários internos')
  }
  return perfil.email
}

/** Confere se o e-mail do JWT bate com `email` ou `proprietario_email` da proposta. */
async function exigirEmailProposta(
  req: Request,
  propostaId: string,
  campo: 'email' | 'proprietario_email'
): Promise<string> {
  const chamador = await obterChamador(req)
  const { data: proposta, error } = await supabase
    .from('propostas_locacao')
    .select(campo)
    .eq('id', propostaId)
    .single()
  if (error || !proposta) {
    throw new HttpError(404, `Proposta ${propostaId} não encontrada`)
  }
  const emailEsperado = (proposta as Record<string, string | null>)[campo]
  if (!emailEsperado || emailEsperado.toLowerCase() !== chamador.email.toLowerCase()) {
    throw new HttpError(403, 'Você não tem acesso a esta proposta')
  }
  return chamador.email
}

// -----------------------------------------------------------------------------
// Handlers — um por evento, espelhando 1:1 os passos da esteira
// -----------------------------------------------------------------------------

async function handleNovaProposta(evento: Extract<Evento, { evento: 'nova_proposta' }>, atorEmail: string) {
  const { data, error } = await supabase.rpc('criar_proposta_locacao', {
    p_email: evento.email,
    p_codigo_imovel: evento.codigo_imovel,
    p_proprietario_nome: evento.proprietario_nome,
    p_proprietario_email: evento.proprietario_email,
    p_imovel_titulo: evento.imovel_titulo ?? null,
    p_imovel_endereco: evento.imovel_endereco ?? null,
    p_ator: atorEmail,
  })
  if (error) throw error
  return { proposta: data }
}

async function handleConfirmarDadosLocatario(evento: Extract<Evento, { evento: 'confirmar_dados_locatario' }>) {
  const { data, error } = await supabase.rpc('confirmar_dados_locatario', {
    p_proposta_id: evento.proposta_id,
    p_nome: evento.nome,
    p_tel: evento.tel,
    p_tipo_pessoa: evento.tipo_pessoa,
    p_tem_conjuge: evento.tem_conjuge,
    p_ator: 'locatario',
  })
  if (error) throw error
  return { proposta: data }
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
    const { data, error } = await supabase.rpc('registrar_documento_enviado_arquivo', {
      p_proposta_id: evento.proposta_id,
      p_documento_codigo: doc.documento_codigo,
      p_arquivo_path: doc.arquivo_path,
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

  // Integração real com o Imoview (função sincronizarComImoview, mais abaixo)
  // fica DESLIGADA nesta fase -- o Eduardo pediu explicitamente pra não
  // automatizar esse passo ainda ("Imoview só entra no fim da linha, nossa
  // equipe faz manualmente"). O botão de "marcar como sincronizada" no
  // painel interno só confirma que a equipe já lançou os dados por fora.
  // Quando decidirem automatizar, é só descomentar a linha abaixo.
  // await sincronizarComImoview(proposta)

  const { data, error } = await supabase.rpc('marcar_sincronizado_imoview', {
    p_proposta_id: evento.proposta_id,
    p_ator: adminEmail,
  })
  if (error) throw error

  return { proposta: data }
}

// Integração conforme o OpenAPI oficial do Imoview (POST /Lead/IncluirLead,
// schema LeadIncluir) -- pronta pra quando a equipe decidir automatizar o
// passo final, mas NÃO é chamada hoje (ver handleSincronizarImoview acima).
const MIDIA_ORIGEM_PADRAO = 'Hub Imovit - Esteira de Locação'

interface ImoviewLeadResponse {
  mensagem: string
}

async function sincronizarComImoview(proposta: {
  nome_cliente: string | null
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

    switch (evento.evento) {
      case 'nova_proposta': {
        const atorEmail = await exigirUsuarioInterno(req)
        return jsonResponse(await handleNovaProposta(evento, atorEmail))
      }
      case 'confirmar_dados_locatario': {
        await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handleConfirmarDadosLocatario(evento))
      }
      case 'proprietario_aceitou': {
        await exigirEmailProposta(req, evento.proposta_id, 'proprietario_email')
        return jsonResponse(await handleProprietarioAceitou(evento))
      }
      case 'docs_enviados': {
        await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handleDocsEnviados(evento))
      }
      case 'decisao_adm': {
        const adminEmail = await exigirAdmin(req)
        return jsonResponse(await handleDecisaoAdm(evento, adminEmail))
      }
      case 'sincronizar_imoview': {
        const adminEmail = await exigirAdmin(req)
        return jsonResponse(await handleSincronizarImoview(evento, adminEmail))
      }
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
