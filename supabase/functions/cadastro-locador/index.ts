// =============================================================================
// Central de Cadastros — form público de link fixo (RF28 + RF30, PRD §5.17).
//
// Quem preenche abre /cadastros (seletor) ou /cadastro/<tipo> direto (sem
// login, sem token). Esta função é a única porta de escrita na tabela
// `cadastros` (anon não tem grant): valida por tipo, grava e avisa o e-mail
// da equipe do tipo, com cópia a quem preencheu (como o Google fazia).
//
// Eventos:
//   enviar -- grava o cadastro; `tipo` opcional (sem ele = locador-pf,
//             compatível com o front da Fase 19); honeypot `site` vazio
//
// Tipos habilitados: locador-pf, locador-pj. Os demais (locatário PF/PJ,
// fiador PF/PJ) entram estendendo TIPOS + o schema do tipo, sem migração.
//
// Deploy: supabase functions deploy cadastro-locador
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, APP_URL
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

const REMETENTE = { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' }

// Destino da equipe por tipo (decisão do Eduardo, 14/10: um e-mail por tipo).
const TIPOS = {
  'locador-pf': { titulo: 'Cadastro locador PF', destino: 'administrativo3@imovit.com.br' },
  'locador-pj': { titulo: 'Cadastro locador PJ', destino: 'administrativo3@imovit.com.br' },
} as const

const texto = (max = 200) => z.string().trim().max(max)
const opcional = (max = 200) => texto(max).optional().transform((v) => (v ? v : null))
const cpf = z.string().trim().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido')
const cpfCnpj = z.string().trim().regex(/^(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})$/, 'CPF/CNPJ inválido')
const cnpj = z.string().trim().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, 'CNPJ inválido')
const estadoCivil = z.enum(['Solteiro (a)', 'Casado (a)', 'Divorciado (a)', 'Viúvo (a)', 'União Estável', 'Separado (a)'])
const enderecoSchema = z.object({
  endereco: texto(200).min(2),
  complemento: opcional(120),
  bairro: texto(120).min(2),
  cidade: texto(120).min(2),
  estado: texto(60).min(2),
  cep: texto(12).min(8),
})
const bancoSchema = (doc: z.ZodTypeAny) => z.object({
  favorecido: texto(160).min(3),
  cpf: doc,
  banco: texto(120).min(2),
  agencia: texto(40).min(1),
  tipo_conta: z.enum(['Corrente', 'Poupança']),
  numero_conta: texto(40).min(1),
})

const pessoaPF = z.object({
  nome: texto(160).min(3),
  cpf,
  rg: texto(40).min(3),
  nascimento: texto(10).min(8), // YYYY-MM-DD do input date
  estado_civil: estadoCivil,
  nacionalidade: texto(80).min(2),
  profissao: texto(120).min(2),
  celular: texto(40).min(8),
  telefone: opcional(40),
  ...enderecoSchema.shape,
})

const conjugeSchema = z.object({
  nome: opcional(160),
  cpf: opcional(20),
  rg: opcional(40),
  profissao: opcional(120),
  nacionalidade: opcional(80),
  email: opcional(160),
  celular: opcional(40),
  telefone: opcional(40),
}).optional().nullable()

const imovelPF = z.object({
  ...enderecoSchema.shape,
  administradora: opcional(160),
  telefone_administradora: opcional(40),
})

const empresaPJ = z.object({
  razao_social: texto(200).min(3),
  cnpj,
  inscricao_municipal: opcional(60),
  inscricao_estadual: opcional(60),
  telefone: texto(40).min(8),
  ...enderecoSchema.shape,
})

const socioPJ = z.object({
  nome: texto(160).min(3),
  cpf,
  rg: texto(40).min(3),
  profissao: texto(120).min(2),
  estado_civil: estadoCivil,
  nacionalidade: texto(80).min(2),
  telefone: texto(40).min(8),
  ...enderecoSchema.shape,
})

const imovelPJ = z.object({
  ...enderecoSchema.shape,
  iptu: opcional(200),
  cpfl: opcional(60),
  sanasa: opcional(60),
  gas: opcional(60),
  administradora: opcional(160),
  telefone_administradora: opcional(40),
})

const baseEnviar = z.object({
  evento: z.literal('enviar'),
  tipo: z.enum(['locador-pf', 'locador-pj']).optional().default('locador-pf'),
  site: z.string().max(0).optional(), // honeypot: robô preenche, gente não vê
  email: z.string().trim().email().max(160),
})

// Validação em 2 passos: o base define o `tipo` (sem ele = locador-pf,
// compatível com o front da Fase 19) e o schema do tipo valida o resto.
const pfSchema = baseEnviar.extend({
  locador: pessoaPF,
  conjuge: conjugeSchema,
  banco: bancoSchema(cpf),
  imovel: imovelPF,
})
const pjSchema = baseEnviar.extend({
  empresa: empresaPJ,
  socio: socioPJ,
  banco: bancoSchema(cpfCnpj),
  imovel: imovelPJ,
})
const schemaPorTipo = { 'locador-pf': pfSchema, 'locador-pj': pjSchema } as const

const escapeHtml = (t: unknown) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function appUrl() {
  return (Deno.env.get('APP_URL') || 'https://hub.imovit.com.br').replace(/\/+$/, '')
}

async function notificar(destinatarios: string[], assunto: string, html: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[cadastro-locador] BREVO_API_KEY não configurada -- aviso não enviado:', assunto)
    return false
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({ sender: REMETENTE, to: destinatarios.map((email) => ({ email })), subject: assunto, htmlContent: html }),
    })
    if (!resposta.ok) {
      console.error('[cadastro-locador] Brevo retornou', resposta.status, await resposta.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[cadastro-locador] erro ao notificar:', err)
    return false
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ erro: 'Use POST' }, 405)

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json({ erro: 'Corpo da requisição precisa ser JSON válido' }, 400)
  }
  const base = baseEnviar.safeParse(payload)
  if (!base.success) {
    return json({ erro: 'Confira os campos do formulário', detalhes: base.error.flatten() }, 400)
  }
  const tipo = base.data.tipo as keyof typeof TIPOS
  const parsed = schemaPorTipo[tipo].safeParse(payload)
  if (!parsed.success) {
    return json({ erro: 'Confira os campos do formulário', detalhes: parsed.error.flatten() }, 400)
  }
  const evento = parsed.data
  const destino = TIPOS[tipo].destino

  try {
    // Normaliza para as colunas genéricas de `cadastros` (compatível com o
    // payload da Fase 19, que manda locador/conjuge sem `tipo`).
    const linha =
      evento.tipo === 'locador-pj'
        ? {
            tipo, email: evento.email, pessoa: evento.empresa, acompanhante: evento.socio,
            financeiro: evento.banco, imovel: evento.imovel, destino, origem: 'hub',
          }
        : {
            tipo, email: evento.email, pessoa: evento.locador, acompanhante: evento.conjuge ?? null,
            financeiro: evento.banco, imovel: evento.imovel, destino, origem: 'hub',
          }
    const { data, error } = await supabase.from('cadastros').insert(linha).select('id, created_at').single()
    if (error) throw error

    const p = linha.pessoa as Record<string, string>
    const f = linha.financeiro as Record<string, string>
    const im = linha.imovel as Record<string, string>
    const quem = p.nome ?? p.razao_social ?? ''
    const doc = p.cpf ?? p.cnpj ?? ''
    const contato = `${quem} · ${p.celular ?? p.telefone ?? ''} · ${evento.email}`
    const linhas: Array<[string, unknown]> = [
      [tipo === 'locador-pj' ? 'Empresa' : 'Locador', contato],
      [tipo === 'locador-pj' ? 'CNPJ' : 'CPF / RG', tipo === 'locador-pj' ? doc : `${doc} / ${p.rg ?? ''}`],
      ['Imóvel', `${im.endereco} · ${im.bairro}, ${im.cidade}/${im.estado}`],
      ['Banco', `${f.banco} ag. ${f.agencia} ${f.tipo_conta} ${f.numero_conta} (${f.favorecido})`],
    ]
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-top:4px solid #ff5e4d;padding:24px">
      <h2 style="font-weight:400;margin:0 0 12px">Novo ${TIPOS[tipo].titulo.toLowerCase()}</h2>
      <p style="color:#444">Preenchido pelo link do Hub.</p>
      <ul style="padding-left:18px;color:#1a1a1a;line-height:1.7">${linhas.map(([r, v]) => `<li><strong>${r}:</strong> ${escapeHtml(v)}</li>`).join('')}</ul>
      <p><a href="${appUrl()}/admin/cadastros" style="background:#000;color:#ff5e4d;padding:12px 20px;text-decoration:none;display:inline-block">Ver cadastro no Hub</a></p>
      <p style="color:#999;font-size:12px">Hub Imovit</p></div>`
    const emailOk = await notificar(
      [destino, evento.email],
      `${TIPOS[tipo].titulo}: ${quem} — ${im.bairro}, ${im.cidade}`,
      html,
    )
    if (emailOk) await supabase.from('cadastros').update({ email_ok: true }).eq('id', data.id)

    return json({ cadastro: data })
  } catch (err) {
    console.error('[cadastro-locador]', err)
    return json({ erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }, 500)
  }
})
