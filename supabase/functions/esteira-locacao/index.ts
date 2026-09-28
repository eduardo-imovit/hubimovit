// =============================================================================
// Esteira de locação — orquestrador (Supabase Edge Function)
//
// Reescrita pra trazer a esteira pro Hub com login real (magic link) de
// locatário, em vez do modelo antigo de token_link anônimo. Proprietário
// NÃO é mais ator do sistema (decisão da Parte 1, 2026-09-21) -- o gestor de
// locação faz a ponte com ele fora do Hub. Toda a lógica de estado continua
// morando no banco (ver migrations 20260821140000_esteira_locacao_ajustes.sql,
// 20260918150000_esteira_locacao_hub.sql, 20260918151500_esteira_documento_via_storage.sql
// e 20260921170000_esteira_v2_corretor_cliente.sql). Esta função só:
//   1. valida o formato do payload recebido;
//   2. confere a identidade de quem chamou (JWT) contra a proposta -- nunca
//      confia em nada que o cliente diga sobre quem ele é;
//   3. despacha pro RPC certo, de acordo com o campo `evento`.
//
// Fluxo v4 (2026-09-28, PRD §5.6): o locatário negocia antes; o gestor registra
// a proposta com os termos; o locatário VALIDA (entra na esteira) ou PEDE
// CORREÇÃO (volta ao gestor). Não existe mais aprovação interna.
//
// Modelo de autorização por evento:
//   nova_proposta            -- role gestao/adm/corretor (via perfis); grava criado_por,
//                                que define as propostas que o corretor enxerga
//   editar_proposta          -- dono (corretor) ou gestao/adm; só antes da validação;
//                                reenvia ao locatário
//   validar_proposta         -- e-mail do JWT == propostas_locacao.email; abre a esteira
//   pedir_correcao           -- idem; volta ao gestor com o motivo
//   completar_cadastro       -- Form de Cadastro (tipo de pessoa/renda/cônjuge), liberado
//                                depois da validação -- mesma checagem de e-mail
//   descartar_proposta       -- role gestao/adm (via perfis) -- descarte definitivo
//                                (teste, desistência, duplicada), sem notificação
//   docs_enviados            -- e-mail do JWT precisa bater com propostas_locacao.email
//   decisao_adm              -- role gestao/adm (via perfis) -- sem e-mail: reprovação
//                                aparece pro locatário no aviso ao lado do documento
//   solicitar_ajustes        -- role gestao/adm (via perfis) -- fecha a revisão e manda
//                                UM e-mail com todos os documentos reprovados
//   sincronizar_imoview      -- role gestao/adm (via perfis)
//
// Notificações por e-mail (Brevo) disparam inline em cada handler, sempre
// APÓS a transição de status já ter sido persistida -- falha de envio nunca
// derruba a operação principal (ver helper `notificar`).
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
import {
  emailAjustesDocumentos,
  emailCorrecaoPedida,
  emailDocsAprovados,
  emailDocsEnviados,
  emailEsteiraAberta,
  emailProcessoConcluido,
  emailPropostaParaValidar,
  emailProntoImoview,
} from './emails.ts'

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

// Termos da negociação (modelo do e-mail que o gestor já mandava). A taxa de
// administração vai para propostas_locacao_interno (o locatário não lê).
const termosSchema = {
  tel: z.string().trim().min(1),
  valor: z.number().positive(),
  valor_oferta: z.number().positive(),
  corretor_responsavel: z.string().trim().min(1),
  garantia: z.enum(['Seguro-fiança', 'Fiador', 'Caução', 'Título de capitalização', 'Outra']),
  data_posse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prazo_meses: z.number().int().min(1).max(360),
  dia_vencimento: z.number().int().min(1).max(31),
  clausula_rescisao: z.string().optional(),
  negociacao_especifica: z.string().optional(),
  observacoes: z.string().optional(),
  taxa_administracao: z.number().min(0).max(100).optional(),
}

const CHAVES_TERMOS = Object.keys(termosSchema) as (keyof typeof termosSchema)[]

function termosDoEvento(evento: Record<string, unknown>) {
  return Object.fromEntries(CHAVES_TERMOS.filter((k) => evento[k] !== undefined).map((k) => [k, evento[k]]))
}

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({
    evento: z.literal('nova_proposta'),
    nome_cliente: z.string().min(1),
    email: z.string().email(),
    codigo_imovel: z.number().int().positive(),
    imovel_titulo: z.string().optional(),
    imovel_endereco: z.string().optional(),
    ...termosSchema,
  }),
  z.object({
    evento: z.literal('editar_proposta'),
    proposta_id: z.string().uuid(),
    nome_cliente: z.string().min(1),
    imovel_titulo: z.string().optional(),
    imovel_endereco: z.string().optional(),
    ...termosSchema,
  }),
  z.object({
    evento: z.literal('validar_proposta'),
    proposta_id: z.string().uuid(),
  }),
  z.object({
    evento: z.literal('pedir_correcao'),
    proposta_id: z.string().uuid(),
    motivo: z.string().trim().min(1),
  }),
  z.object({
    evento: z.literal('completar_cadastro'),
    proposta_id: z.string().uuid(),
    tipo_pessoa: z.enum(['Física', 'Jurídica']),
    tem_conjuge: z.boolean(),
    profissao: z.string().optional(),
    cargo: z.string().optional(),
    tipo_renda: z.string().optional(),
    renda_pessoal: z.number().positive().optional(),
    renda_familiar: z.number().positive().optional(),
    nome_empresa: z.string().optional(),
    conjuge_nome: z.string().optional(),
    conjuge_email: z.string().email().optional(),
    conjuge_profissao: z.string().optional(),
    conjuge_renda: z.number().positive().optional(),
  }),
  z.object({
    evento: z.literal('descartar_proposta'),
    proposta_id: z.string().uuid(),
    motivo: z.string().min(1),
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
    evento: z.literal('solicitar_ajustes'),
    proposta_id: z.string().uuid(),
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

const PAPEIS_CRIAM_PROPOSTA = ['gestao', 'adm', 'corretor']

async function exigirCriadorProposta(req: Request): Promise<{ id: string; email: string }> {
  const chamador = await obterChamador(req)
  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('id, role, email')
    .eq('id', chamador.id)
    .single()
  if (error || !perfil || !PAPEIS_CRIAM_PROPOSTA.includes(perfil.role)) {
    throw new HttpError(403, 'Só Gestão, Admin e Corretor criam propostas')
  }
  return { id: perfil.id, email: perfil.email }
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
// Notificações por e-mail (Brevo) -- disparadas inline em cada handler,
// sempre depois da transição de status já ter sido persistida. Falha de
// envio só loga, nunca derruba a operação principal.
// -----------------------------------------------------------------------------

const REMETENTE = { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' }
const DESTINATARIOS_REVISAO_INTERNA = ['gabriel@imovit.com.br', 'daniele@imovit.com.br']
// Esteira aberta (locatário validou a proposta): também o administrativo, que
// acompanha a abertura de cada esteira (pedido do Eduardo, 24/09).
const DESTINATARIOS_NOVA_ESTEIRA = [
  ...DESTINATARIOS_REVISAO_INTERNA,
  'administrativo@imovit.com.br',
  'administrativo3@imovit.com.br',
]

// Lido a cada envio (não no carregamento do módulo): uma instância já quente
// continuaria com o valor antigo depois de alguém trocar a secret APP_URL.
function appUrl() {
  return (Deno.env.get('APP_URL') || 'https://hub.imovit.com.br').replace(/\/+$/, '')
}
const linkPortal = () => `${appUrl()}/portal/entrar`
const linkPropostas = () => `${appUrl()}/admin/propostas`
const linkEsteiras = () => `${appUrl()}/admin/esteiras`

async function notificar(destinatarios: string[], assunto: string, corpoHtml: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[esteira-locacao] BREVO_API_KEY não configurada -- notificação não enviada:', assunto)
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
    if (!resposta.ok) {
      console.error('[esteira-locacao] Brevo retornou', resposta.status, await resposta.text())
    }
  } catch (err) {
    console.error('[esteira-locacao] erro ao notificar via Brevo:', err)
  }
}

// -----------------------------------------------------------------------------
// Handlers — um por evento, espelhando 1:1 os passos da esteira
// -----------------------------------------------------------------------------

async function handleNovaProposta(evento: Extract<Evento, { evento: 'nova_proposta' }>, ator: { id: string; email: string }) {
  const { data, error } = await supabase.rpc('criar_proposta_locacao', {
    p_criado_por: ator.id,
    p_nome_cliente: evento.nome_cliente,
    p_email: evento.email,
    p_codigo_imovel: evento.codigo_imovel,
    p_termos: termosDoEvento(evento),
    p_imovel_titulo: evento.imovel_titulo ?? null,
    p_imovel_endereco: evento.imovel_endereco ?? null,
    p_ator: ator.email,
  })
  if (error) throw error

  const email = emailPropostaParaValidar(data, linkPortal())
  await notificar([data.email], email.assunto, email.html)

  return { proposta: data }
}

async function handleEditarProposta(evento: Extract<Evento, { evento: 'editar_proposta' }>, ator: { id: string; email: string }) {
  const { data, error } = await supabase.rpc('editar_proposta_locacao', {
    p_proposta_id: evento.proposta_id,
    p_ator_id: ator.id,
    p_ator: ator.email,
    p_nome_cliente: evento.nome_cliente,
    p_termos: termosDoEvento(evento),
    p_imovel_titulo: evento.imovel_titulo ?? null,
    p_imovel_endereco: evento.imovel_endereco ?? null,
  })
  if (error) throw error

  const email = emailPropostaParaValidar(data, linkPortal(), true)
  await notificar([data.email], email.assunto, email.html)

  return { proposta: data }
}

async function handleValidarProposta(evento: Extract<Evento, { evento: 'validar_proposta' }>, emailChamador: string) {
  const { data, error } = await supabase.rpc('validar_proposta_locatario', {
    p_proposta_id: evento.proposta_id,
    p_email_chamador: emailChamador,
  })
  if (error) throw error

  const { data: interno } = await supabase
    .from('propostas_locacao_interno').select('taxa_administracao').eq('proposta_id', data.id).maybeSingle()
  const email = emailEsteiraAberta({ ...data, taxa_administracao: interno?.taxa_administracao ?? null }, linkEsteiras())
  await notificar(DESTINATARIOS_NOVA_ESTEIRA, email.assunto, email.html)

  return { proposta: data }
}

async function handlePedirCorrecao(evento: Extract<Evento, { evento: 'pedir_correcao' }>, emailChamador: string) {
  const { data, error } = await supabase.rpc('pedir_correcao_proposta', {
    p_proposta_id: evento.proposta_id,
    p_email_chamador: emailChamador,
    p_motivo: evento.motivo,
  })
  if (error) throw error

  // Volta para quem registrou a proposta; sem dono, para a equipe de locação.
  let destinatarios = DESTINATARIOS_REVISAO_INTERNA
  if (data.criado_por) {
    const { data: dono } = await supabase.from('perfis').select('email').eq('id', data.criado_por).single()
    if (dono?.email) destinatarios = [dono.email]
  }
  const email = emailCorrecaoPedida(data, evento.motivo, linkPropostas())
  await notificar(destinatarios, email.assunto, email.html)

  return { proposta: data }
}

async function handleCompletarCadastro(evento: Extract<Evento, { evento: 'completar_cadastro' }>) {
  const { data, error } = await supabase.rpc('completar_cadastro_locatario', {
    p_proposta_id: evento.proposta_id,
    p_tipo_pessoa: evento.tipo_pessoa,
    p_tem_conjuge: evento.tem_conjuge,
    p_profissao: evento.profissao ?? null,
    p_cargo: evento.cargo ?? null,
    p_tipo_renda: evento.tipo_renda ?? null,
    p_renda_pessoal: evento.renda_pessoal ?? null,
    p_renda_familiar: evento.renda_familiar ?? null,
    p_nome_empresa: evento.nome_empresa ?? null,
    p_conjuge_nome: evento.conjuge_nome ?? null,
    p_conjuge_email: evento.conjuge_email ?? null,
    p_conjuge_profissao: evento.conjuge_profissao ?? null,
    p_conjuge_renda: evento.conjuge_renda ?? null,
    p_ator: 'locatario',
  })
  if (error) throw error

  return { proposta: data }
}

async function handleDescartarProposta(evento: Extract<Evento, { evento: 'descartar_proposta' }>, adminEmail: string) {
  const { data, error } = await supabase.rpc('descartar_proposta_locacao', {
    p_proposta_id: evento.proposta_id,
    p_motivo: evento.motivo,
    p_ator: adminEmail,
  })
  if (error) throw error

  return { proposta: data }
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

  if (proposta.status === 'docs_em_analise') {
    const email = emailDocsEnviados(proposta, linkEsteiras())
    await notificar(DESTINATARIOS_REVISAO_INTERNA, email.assunto, email.html)
  }

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

  const { data: proposta } = await supabase
    .from('propostas_locacao')
    .select('*')
    .eq('id', data.proposta_id)
    .single()

  // Reprovação não dispara e-mail aqui: o locatário vê o aviso ao lado do
  // documento no portal, e o ADM manda um e-mail só com todos os reprovados
  // quando fecha a revisão (ver handleSolicitarAjustes).
  if (proposta && evento.decisao === 'aprovado' && proposta.status === 'docs_aprovados') {
    const paraLocatario = emailDocsAprovados(proposta, linkPortal())
    await notificar([proposta.email], paraLocatario.assunto, paraLocatario.html)
    const paraEquipe = emailProntoImoview(proposta, linkEsteiras())
    await notificar(DESTINATARIOS_REVISAO_INTERNA, paraEquipe.assunto, paraEquipe.html)
  }

  return { documento: data }
}

/**
 * Situação da revisão de documentos de uma proposta, pelas mesmas regras do
 * trigger recalcular_status_proposta: quais obrigatórios faltam enviar, quais
 * ainda esperam decisão do ADM e quais foram reprovados.
 */
async function situacaoDocumentos(proposta: { id: string; tipo_pessoa: string | null; tem_conjuge: boolean | null }) {
  const [{ data: tipos, error: erroTipos }, { data: enviados, error: erroEnviados }] = await Promise.all([
    supabase.from('documentos_tipos_obrigatorios').select('codigo, nome, tipo_pessoa, exige_conjuge'),
    supabase.from('documentos_enviados').select('documento_codigo, status, feedback_adm').eq('proposta_id', proposta.id),
  ])
  if (erroTipos) throw erroTipos
  if (erroEnviados) throw erroEnviados

  const checklist = (tipos ?? [])
    .filter((t) => (t.tipo_pessoa === proposta.tipo_pessoa || t.tipo_pessoa === 'Ambos') && (!t.exige_conjuge || proposta.tem_conjuge))
    .map((t) => ({ ...t, envio: (enviados ?? []).find((e) => e.documento_codigo === t.codigo) ?? null }))

  return {
    faltando: checklist.filter((d) => !d.envio || d.envio.status === 'pendente'),
    aguardandoDecisao: checklist.filter((d) => d.envio?.status === 'enviado'),
    reprovados: checklist.filter((d) => d.envio?.status === 'rejeitado'),
  }
}

async function handleSolicitarAjustes(evento: Extract<Evento, { evento: 'solicitar_ajustes' }>) {
  const { data: proposta, error: erroProposta } = await supabase
    .from('propostas_locacao')
    .select('*')
    .eq('id', evento.proposta_id)
    .single()
  if (erroProposta) throw erroProposta

  const { faltando, aguardandoDecisao, reprovados } = await situacaoDocumentos(proposta)
  if (faltando.length > 0) {
    throw new Error('O locatário ainda não enviou todos os documentos. Os reprovados já aparecem pra ele no portal.')
  }
  if (aguardandoDecisao.length > 0) {
    throw new Error(`Ainda há ${aguardandoDecisao.length} documento(s) sem decisão. Aprove ou reprove todos antes de solicitar ajustes.`)
  }
  if (reprovados.length === 0) {
    throw new Error('Nenhum documento reprovado: não há ajustes a solicitar.')
  }

  const email = emailAjustesDocumentos(
    proposta,
    reprovados.map((d) => ({ nome: d.nome, motivo: d.envio?.feedback_adm ?? null })),
    linkPortal()
  )
  await notificar([proposta.email], email.assunto, email.html)

  return { reprovados: reprovados.length }
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

  // Libera espaço no Storage -- os documentos já foram baixados em .zip pelo
  // admin antes de chegar aqui (ver ChecklistEsteira no front). Falha na
  // limpeza não derruba o fluxo -- a sincronização em si já foi persistida.
  try {
    const { data: arquivos } = await supabase.storage.from('esteira-documentos').list(evento.proposta_id)
    if (arquivos && arquivos.length > 0) {
      const paths = arquivos.map((arquivo) => `${evento.proposta_id}/${arquivo.name}`)
      const { error: erroRemocao } = await supabase.storage.from('esteira-documentos').remove(paths)
      if (erroRemocao) console.error('[esteira-locacao] erro ao limpar Storage:', erroRemocao)
    }
  } catch (err) {
    console.error('[esteira-locacao] erro ao limpar Storage:', err)
  }

  const email = emailProcessoConcluido(data, linkPortal())
  await notificar([data.email], email.assunto, email.html)

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
        const ator = await exigirCriadorProposta(req)
        return jsonResponse(await handleNovaProposta(evento, ator))
      }
      case 'editar_proposta': {
        const ator = await exigirCriadorProposta(req)
        return jsonResponse(await handleEditarProposta(evento, ator))
      }
      case 'validar_proposta': {
        const emailChamador = await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handleValidarProposta(evento, emailChamador))
      }
      case 'pedir_correcao': {
        const emailChamador = await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handlePedirCorrecao(evento, emailChamador))
      }
      case 'completar_cadastro': {
        await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handleCompletarCadastro(evento))
      }
      case 'descartar_proposta': {
        const adminEmail = await exigirAdmin(req)
        return jsonResponse(await handleDescartarProposta(evento, adminEmail))
      }
      case 'docs_enviados': {
        await exigirEmailProposta(req, evento.proposta_id, 'email')
        return jsonResponse(await handleDocsEnviados(evento))
      }
      case 'decisao_adm': {
        const adminEmail = await exigirAdmin(req)
        return jsonResponse(await handleDecisaoAdm(evento, adminEmail))
      }
      case 'solicitar_ajustes': {
        await exigirAdmin(req)
        return jsonResponse(await handleSolicitarAjustes(evento))
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
