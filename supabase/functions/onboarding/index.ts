// =============================================================================
// Onboarding de colaboradores (RF32, PRD §5.18, Schema §2.16).
//
// A Gestão gera um link; o colaborador novo abre /onboarding/<token> (sem
// login) e passa nome, telefone, CPF, CRECI, equipe e endereço. Com isso o
// Eduardo cria o e-mail @imovit e o usuário no Imoview; a Gestão informa os
// dois e aprova, e o colaborador entra em `colaboradores_raw`.
// Esta função é a única porta de escrita em `onboarding_colaboradores`.
//
// Eventos:
//   criar    (gestão) -- gera o token
//   aprovar  (gestão) -- e-mail @imovit + código do Imoview -> colaboradores_raw
//   marcar   (gestão) -- etapa manual do checklist
//   cancelar (gestão)
//   abrir    (token)  -- se o link ainda vale (não devolve dados)
//   enviar   (token)  -- grava os dados; e-mail para a Gestão (sem CPF)
//
// Deploy: supabase functions deploy onboarding --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, BREVO_API_KEY, APP_URL
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY precisam estar definidas')
}
const supabase = createClient(supabaseUrl, serviceRoleKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Quem cria o e-mail e o usuário do Imoview recebe o aviso (PRD §5.18, D2).
const DESTINO_GESTAO = 'eduardo@imovit.com.br'
const REMETENTE = { name: 'Imovit', email: 'relacionamento@imovit.com.br' }
const VALIDADE_DIAS = 15
const ETAPAS_MANUAIS = ['crm', 'repique', 'plantao', 'acesso_enviado'] as const
const CARGO: Record<string, string> = { locacao: 'locação', venda: 'vendas' }
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const

const token = z.string().trim().min(32).max(80)
const soDigitos = (t: string) => t.replace(/\D/g, '')

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({ evento: z.literal('criar'), nome: z.string().trim().max(160).optional().nullable() }),
  z.object({
    evento: z.literal('aprovar'),
    id: z.string().uuid(),
    email_imovit: z.string().trim().toLowerCase().email().max(160),
    id_corretor_crm: z.number().int().positive(),
    nome_crm: z.string().trim().min(3).max(160),
  }),
  z.object({ evento: z.literal('marcar'), id: z.string().uuid(), etapa: z.enum(ETAPAS_MANUAIS), feito: z.boolean() }),
  z.object({ evento: z.literal('cancelar'), id: z.string().uuid() }),
  z.object({ evento: z.literal('abrir'), token }),
  z.object({
    evento: z.literal('enviar'),
    token,
    nome_completo: z.string().trim().min(5).max(160),
    telefone: z.string().trim().max(40),
    cpf: z.string().trim().max(20),
    creci_numero: z.string().trim().min(1).max(20),
    creci_uf: z.enum(UFS),
    equipe: z.enum(['locacao', 'venda']),
    endereco: z.object({
      cep: z.string().trim().max(10),
      logradouro: z.string().trim().min(2).max(160),
      numero: z.string().trim().min(1).max(20),
      complemento: z.string().trim().max(80).optional().nullable(),
      bairro: z.string().trim().min(2).max(80),
      cidade: z.string().trim().min(2).max(80),
      uf: z.enum(UFS),
    }),
    aceite: z.literal(true),
  }),
])

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

const escapeHtml = (t: unknown) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const appUrl = () => (Deno.env.get('APP_URL') || 'https://hub.imovit.com.br').replace(/\/+$/, '')

function gerarToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}

// Mesmo formato do resto de colaboradores_raw: (19) 99999-9999
function formatarTelefone(t: string) {
  let d = soDigitos(t)
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return null
}

async function exigirGestao(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')
  const comoChamador = createClient(supabaseUrl!, anonKey!, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Faça login de novo')
  const { data: perfil } = await supabase.from('perfis').select('id, role, suspenso_em').eq('id', user.id).single()
  if (!perfil || perfil.role !== 'gestao' || perfil.suspenso_em) {
    throw new HttpError(403, 'Só a Gestão trata o onboarding de colaboradores')
  }
  return perfil.id as string
}

async function notificar(destinatarios: string[], assunto: string, html: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[onboarding] BREVO_API_KEY não configurada -- e-mail não enviado:', assunto)
    return false
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({ sender: REMETENTE, to: destinatarios.map((email) => ({ email })), subject: assunto, htmlContent: html }),
    })
    if (!resposta.ok) {
      console.error('[onboarding] Brevo retornou', resposta.status, await resposta.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[onboarding] erro ao notificar:', err)
    return false
  }
}

const moldura = (titulo: string, corpo: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#F5F0E8;padding:28px;color:#2D2D2D">
  <div style="font-family:Georgia,serif;color:#E8593C;font-size:26px;margin-bottom:4px">imovit</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;margin:12px 0">${titulo}</h2>
  ${corpo}
  <p style="color:#888;font-size:12px;margin-top:24px">Imovit · Av. José Bonifácio, 2326 · Campinas-SP · (19) 2512-7700</p></div>`

const linkDe = (t: string) => `${appUrl()}/onboarding/${t}`

function situacaoPublica(o: { status: string; expira_em: string }) {
  if (o.status === 'cancelado') return 'cancelado'
  if (o.status !== 'link_enviado') return 'enviado'
  if (new Date(o.expira_em) < new Date()) return 'expirado'
  return 'aberto'
}

async function porToken(t: string) {
  const { data, error } = await supabase.from('onboarding_colaboradores').select('id, status, expira_em').eq('token', t).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Link não encontrado. Fale com a Gestão da Imovit.')
  return data
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
  if (!parsed.success) return json({ erro: 'Confira os campos do formulário', detalhes: parsed.error.flatten() }, 400)
  const ev = parsed.data

  try {
    if (ev.evento === 'criar') {
      const quem = await exigirGestao(req)
      const expira = new Date(Date.now() + VALIDADE_DIAS * 864e5).toISOString()
      const { data, error } = await supabase.from('onboarding_colaboradores')
        .insert({ token: gerarToken(), expira_em: expira, criado_por: quem, nome_completo: ev.nome || null })
        .select('id, token, expira_em').single()
      if (error) throw error
      return json({ onboarding: { ...data, link: linkDe(data.token) } })
    }

    if (ev.evento === 'aprovar') {
      const quem = await exigirGestao(req)
      if (!ev.email_imovit.endsWith('@imovit.com.br')) throw new HttpError(400, 'O e-mail precisa ser @imovit.com.br')
      const { data: o } = await supabase.from('onboarding_colaboradores')
        .select('id, status, telefone, equipe, data_nascimento').eq('id', ev.id).maybeSingle()
      if (!o) throw new HttpError(404, 'Onboarding não encontrado')
      if (o.status !== 'dados_recebidos') throw new HttpError(409, 'Só dá para aprovar quem já enviou os dados e ainda não foi aprovado')

      // O código e o e-mail não podem ser de outra pessoa.
      const { data: porCodigo } = await supabase.from('colaboradores_raw')
        .select('id_corretor_crm, nome_completo, email_oficial, data_admissao').eq('id_corretor_crm', ev.id_corretor_crm).maybeSingle()
      if (porCodigo && (porCodigo.email_oficial ?? '').toLowerCase() !== ev.email_imovit) {
        throw new HttpError(409, `O código ${ev.id_corretor_crm} já é de ${porCodigo.nome_completo} (${porCodigo.email_oficial ?? 'sem e-mail'})`)
      }
      const { data: porEmail } = await supabase.from('colaboradores_raw')
        .select('id_corretor_crm, nome_completo').ilike('email_oficial', ev.email_imovit).neq('id_corretor_crm', ev.id_corretor_crm).limit(1)
      if (porEmail?.length) {
        throw new HttpError(409, `O e-mail ${ev.email_imovit} já é de ${porEmail[0].nome_completo} (código ${porEmail[0].id_corretor_crm})`)
      }

      const agora = new Date().toISOString()
      const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      const { error: e1 } = await supabase.from('colaboradores_raw').upsert({
        id_corretor_crm: ev.id_corretor_crm,
        nome_completo: ev.nome_crm,
        email_oficial: ev.email_imovit,
        telefone_whats: o.telefone,
        equipe: 'comercial',
        cargo: CARGO[o.equipe],
        ...(o.data_nascimento ? { data_nascimento: o.data_nascimento } : {}),
        data_admissao: porCodigo?.data_admissao ?? hoje,
        ativo: true,
        atualizado_em: agora,
      }, { onConflict: 'id_corretor_crm' })
      if (e1) throw e1

      const { error: e2 } = await supabase.from('onboarding_colaboradores').update({
        status: 'aprovado', email_imovit: ev.email_imovit, id_corretor_crm: ev.id_corretor_crm,
        nome_completo: ev.nome_crm, aprovado_por: quem, aprovado_em: agora,
      }).eq('id', ev.id).eq('status', 'dados_recebidos')
      if (e2) throw e2
      return json({ ok: true })
    }

    if (ev.evento === 'marcar') {
      const quem = await exigirGestao(req)
      const { data: o } = await supabase.from('onboarding_colaboradores').select('status, marcacoes').eq('id', ev.id).maybeSingle()
      if (!o) throw new HttpError(404, 'Onboarding não encontrado')
      if (!['aprovado', 'concluido'].includes(o.status)) throw new HttpError(409, 'Aprove o colaborador antes de marcar o checklist')
      const marcacoes = { ...(o.marcacoes ?? {}) }
      if (ev.feito) marcacoes[ev.etapa] = { em: new Date().toISOString(), por: quem }
      else delete marcacoes[ev.etapa]
      const { error } = await supabase.from('onboarding_colaboradores').update({ marcacoes }).eq('id', ev.id)
      if (error) throw error
      return json({ ok: true, marcacoes })
    }

    if (ev.evento === 'cancelar') {
      const quem = await exigirGestao(req)
      const { data, error } = await supabase.from('onboarding_colaboradores')
        .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), cancelado_por: quem })
        .eq('id', ev.id).in('status', ['link_enviado', 'dados_recebidos']).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new HttpError(409, 'Só dá para cancelar antes da aprovação')
      return json({ ok: true })
    }

    if (ev.evento === 'abrir') {
      const o = await porToken(ev.token)
      return json({ onboarding: { situacao: situacaoPublica(o) } })
    }

    // enviar
    const o = await porToken(ev.token)
    const sit = situacaoPublica(o)
    if (sit !== 'aberto') {
      throw new HttpError(409, sit === 'enviado' ? 'Seus dados já foram enviados.' : 'Este link não está mais ativo. Fale com a Gestão da Imovit.')
    }
    const cpf = soDigitos(ev.cpf)
    if (!cpfValido(cpf)) throw new HttpError(400, 'Confira o CPF.')
    const telefone = formatarTelefone(ev.telefone)
    if (!telefone) throw new HttpError(400, 'Confira o telefone, com DDD.')
    const cep = soDigitos(ev.endereco.cep)
    if (cep.length !== 8) throw new HttpError(400, 'Confira o CEP.')

    const agora = new Date().toISOString()
    const { data: gravado, error } = await supabase.from('onboarding_colaboradores').update({
      status: 'dados_recebidos', nome_completo: ev.nome_completo, telefone, cpf,
      creci_numero: ev.creci_numero, creci_uf: ev.creci_uf, equipe: ev.equipe,
      endereco: { ...ev.endereco, cep: `${cep.slice(0, 5)}-${cep.slice(5)}`, complemento: ev.endereco.complemento || null },
      aceite_lgpd_em: agora, enviado_em: agora,
    }).eq('token', ev.token).eq('status', 'link_enviado').select('id').maybeSingle()
    if (error) throw error
    if (!gravado) throw new HttpError(409, 'Seus dados já foram enviados.')

    // Sem CPF nem endereço no e-mail: só o aviso e o link da ficha.
    const ok = await notificar([DESTINO_GESTAO], `Onboarding: ${ev.nome_completo} enviou os dados`, moldura(
      'Dados de colaborador recebidos',
      `<p><strong>${escapeHtml(ev.nome_completo)}</strong> (${ev.equipe === 'locacao' ? 'locação' : 'venda'}) enviou os dados pelo link de onboarding.</p>
       <p>Próximo passo: criar o e-mail @imovit e o usuário no Imoview, e aprovar no Hub.</p>
       <p><a href="${appUrl()}/configuracoes?aba=onboarding" style="background:#2D2D2D;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">Abrir no Hub</a></p>`,
    ))
    if (ok) await supabase.from('onboarding_colaboradores').update({ email_ok: true }).eq('id', gravado.id)

    return json({ ok: true })
  } catch (err) {
    if (err instanceof HttpError) return json({ erro: err.message }, err.status)
    console.error('[onboarding]', err)
    return json({ erro: 'Não foi possível concluir agora. Tente de novo em instantes.' }, 500)
  }
})
