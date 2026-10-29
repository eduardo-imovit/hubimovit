// =============================================================================
// Alerta de leitura que falhou (Supabase Edge Function) — 29/10/2026
// =============================================================================
// Quem chama: o pg_cron "alerta-leituras", todo dia às 7h15 (SP), com o cabeçalho
// x-agendador = secret AGENDADOR_CHAVE (a mesma da carteira-locacao).
// O que faz: lê saude_leituras() no banco e, se alguma leitura está atrasada, manda
// e-mail para eduardo@ pelo Brevo (secret BREVO_API_KEY). Tudo ok: não manda nada.
// Corpo { "teste": true }: manda o e-mail mesmo com tudo ok (para conferir a entrega).
//
// Deploy: pelo painel do Supabase (Edge Functions > Deploy a new function > alerta-leituras).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const DESTINATARIOS = ['eduardo@imovit.com.br']
const REMETENTE = { name: 'Imovit Hub', email: 'relacionamento@imovit.com.br' }

type Checagem = { fonte: string; ultima: string | null; ok: boolean; o_que_fazer: string }

function chamadaDoAgendador(req: Request) {
  const chave = Deno.env.get('AGENDADOR_CHAVE') ?? ''
  const enviada = req.headers.get('x-agendador') ?? ''
  return chave.length >= 32 && enviada === chave
}

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : 'nunca')

const moldura = (titulo: string, corpo: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#F5F0E8;padding:28px;color:#2D2D2D">
  <div style="font-family:Georgia,serif;color:#E8593C;font-size:26px;margin-bottom:4px">imovit</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;margin:12px 0">${titulo}</h2>
  ${corpo}
  <p style="color:#888;font-size:12px;margin-top:24px">Alerta automático do Hub (7h15). Só chega quando alguma leitura falha.</p></div>`

function montarEmail(checagens: Checagem[], teste: boolean) {
  const falhas = checagens.filter((c) => !c.ok)
  const linhas = checagens
    .map((c) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #E5DED2">${c.ok ? '🟢' : '🔴'} ${c.fonte}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #E5DED2;white-space:nowrap">${dataBr(c.ultima)}</td>
    </tr>`)
    .join('')
  const acoes = falhas.map((c) => `<li style="margin:4px 0"><b>${c.fonte}:</b> ${c.o_que_fazer}</li>`).join('')
  const titulo = falhas.length
    ? `${falhas.length} leitura${falhas.length > 1 ? 's' : ''} não chegou hoje`
    : 'Teste: todas as leituras chegaram'
  const corpo = `
    <table style="border-collapse:collapse;width:100%;font-size:14px;background:#fff">
      <tr><th style="text-align:left;padding:6px 8px">Leitura</th><th style="text-align:left;padding:6px 8px">Última</th></tr>
      ${linhas}
    </table>
    ${acoes ? `<p style="margin:16px 0 4px"><b>O que fazer</b></p><ul style="padding-left:18px;margin:0">${acoes}</ul>` : ''}
    <p style="font-size:13px;color:#555;margin-top:16px">Enquanto não for resolvido, os painéis e o e-mail da Diretoria (7h30) mostram o dado da última leitura.</p>`
  const assunto = falhas.length
    ? `⚠️ Hub: ${falhas.map((c) => c.fonte.split(' (')[0]).join(', ')} sem leitura hoje`
    : `${teste ? '[TESTE] ' : ''}Hub: leituras ok`
  return { assunto, html: moldura(titulo, corpo), falhas: falhas.length }
}

async function enviar(assunto: string, html: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) throw new Error('BREVO_API_KEY não configurada')
  const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
    body: JSON.stringify({ sender: REMETENTE, to: DESTINATARIOS.map((email) => ({ email })), subject: assunto, htmlContent: html }),
  })
  if (!resposta.ok) throw new Error(`Brevo ${resposta.status}: ${await resposta.text()}`)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST' }, 405)
  if (!chamadaDoAgendador(req)) return json({ erro: 'Só o agendador chama esta função' }, 403)
  try {
    const corpo = await req.json().catch(() => ({}))
    const teste = corpo?.teste === true
    const { data, error } = await supabase.rpc('saude_leituras')
    if (error) throw error
    const checagens = (data ?? []) as Checagem[]
    const email = montarEmail(checagens, teste)
    const enviado = email.falhas > 0 || teste
    if (enviado) await enviar(email.assunto, email.html)
    console.log(`[alerta-leituras] ${email.falhas} falha(s) · e-mail ${enviado ? 'enviado' : 'não enviado'}${teste ? ' · teste' : ''}`)
    return json({ falhas: email.falhas, enviado, checagens })
  } catch (err) {
    console.error('[alerta-leituras] erro:', err)
    return json({ erro: String((err as Error)?.message ?? err) }, 500)
  }
})
