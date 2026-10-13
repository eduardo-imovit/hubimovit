// =============================================================================
// Cadastro Locador PF — form público de link fixo (RF28, PRD §5.15).
//
// O locador abre /cadastro-locador (sem login, sem token), preenche os 5
// blocos do Google Form e envia. Esta função é a única porta de escrita na
// tabela `cadastros_locador` (anon não tem grant): valida, grava e avisa
// administrativo3@ por e-mail, com cópia ao locador (como o Google fazia).
//
// Eventos:
//   enviar -- grava o cadastro; honeypot `site` precisa vir vazio
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

const DESTINO_EQUIPE = 'administrativo3@imovit.com.br'
const REMETENTE = { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' }

const texto = (max = 200) => z.string().trim().max(max)
const opcional = (max = 200) => texto(max).optional().transform((v) => (v ? v : null))

const enviarSchema = z.object({
  evento: z.literal('enviar'),
  site: z.string().max(0).optional(), // honeypot: robô preenche, gente não vê
  email: z.string().trim().email().max(160),
  locador: z.object({
    nome: texto(160).min(3),
    cpf: z.string().trim().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido'),
    rg: texto(40).min(3),
    nascimento: texto(10).min(8), // YYYY-MM-DD do input date
    estado_civil: z.enum(['Solteiro (a)', 'Casado (a)', 'Divorciado (a)', 'Viúvo (a)', 'União Estável', 'Separado (a)']),
    nacionalidade: texto(80).min(2),
    profissao: texto(120).min(2),
    celular: texto(40).min(8),
    telefone: opcional(40),
    endereco: texto(200).min(2),
    complemento: opcional(120),
    bairro: texto(120).min(2),
    cidade: texto(120).min(2),
    estado: texto(60).min(2),
    cep: texto(12).min(8),
  }),
  conjuge: z.object({
    nome: opcional(160),
    cpf: opcional(20),
    rg: opcional(40),
    profissao: opcional(120),
    nacionalidade: opcional(80),
    email: opcional(160),
    celular: opcional(40),
    telefone: opcional(40),
  }).optional().nullable(),
  banco: z.object({
    favorecido: texto(160).min(3),
    cpf: z.string().trim().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido'),
    banco: texto(120).min(2),
    agencia: texto(40).min(1),
    tipo_conta: z.enum(['Corrente', 'Poupança']),
    numero_conta: texto(40).min(1),
  }),
  imovel: z.object({
    endereco: texto(200).min(2),
    complemento: opcional(120),
    bairro: texto(120).min(2),
    cidade: texto(120).min(2),
    estado: texto(60).min(2),
    cep: texto(12).min(8),
    administradora: opcional(160),
    telefone_administradora: opcional(40),
  }),
})

const eventoSchema = z.discriminatedUnion('evento', [enviarSchema])

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
  const parsed = eventoSchema.safeParse(payload)
  if (!parsed.success) {
    return json({ erro: 'Confira os campos do formulário', detalhes: parsed.error.flatten() }, 400)
  }
  const evento = parsed.data

  try {
    const { evento: _e, site: _s, ...dados } = evento
    const { data, error } = await supabase
      .from('cadastros_locador')
      .insert({ ...dados, conjuge: dados.conjuge ?? null })
      .select('id, created_at')
      .single()
    if (error) throw error

    const l = dados.locador
    const i = dados.imovel
    const linhas: Array<[string, unknown]> = [
      ['Locador', `${l.nome} · ${l.celular} · ${dados.email}`],
      ['CPF / RG', `${l.cpf} / ${l.rg}`],
      ['Imóvel', `${i.endereco} · ${i.bairro}, ${i.cidade}/${i.estado}`],
      ['Banco', `${dados.banco.banco} ag. ${dados.banco.agencia} ${dados.banco.tipo_conta} ${dados.banco.numero_conta} (${dados.banco.favorecido})`],
    ]
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-top:4px solid #ff5e4d;padding:24px">
      <h2 style="font-weight:400;margin:0 0 12px">Novo cadastro de locador</h2>
      <p style="color:#444">O locador preencheu o cadastro pelo link do Hub.</p>
      <ul style="padding-left:18px;color:#1a1a1a;line-height:1.7">${linhas.map(([r, v]) => `<li><strong>${r}:</strong> ${escapeHtml(v)}</li>`).join('')}</ul>
      <p><a href="${appUrl()}/admin/cadastros-locador" style="background:#000;color:#ff5e4d;padding:12px 20px;text-decoration:none;display:inline-block">Ver cadastro no Hub</a></p>
      <p style="color:#999;font-size:12px">Hub Imovit</p></div>`
    const emailOk = await notificar(
      [DESTINO_EQUIPE, dados.email],
      `Cadastro locador: ${l.nome} — ${i.bairro}, ${i.cidade}`,
      html,
    )
    if (emailOk) await supabase.from('cadastros_locador').update({ email_ok: true }).eq('id', data.id)

    return json({ cadastro: data })
  } catch (err) {
    console.error('[cadastro-locador]', err)
    return json({ erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }, 500)
  }
})
