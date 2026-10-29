// =============================================================================
// E-mail diário da Diretoria, v1 (Supabase Edge Function) — 29/10/2026
// =============================================================================
// PRD §5.19, bloco "E-mail diário". Visual = prévia aprovada (template dos e-mails Imovit).
// Quem chama: o pg_cron "boletim-diretoria", segunda a sexta às 7h30 (SP), com o cabeçalho
// x-agendador = secret AGENDADOR_CHAVE. Números: rpc boletim_diretoria() no banco.
// Corpo { "teste": true }: envia SÓ para eduardo@, com "[TESTE]" no assunto.
// Cada envio fica em boletim_diretoria_fotos (base da variação "vs ontem").
// v1: os links levam para os painéis atuais do Hub; na v2, cada número abre a sua lista.
//
// Deploy: pelo painel do Supabase. Nome "boletim-diretoria", endereço (slug) "rapid-worker":
// para publicar uma versão nova, abra a função existente e edite o código (não crie outra).
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const DESTINATARIOS = ['daniel@imovit.com.br', 'gabriel@imovit.com.br', 'eduardo@imovit.com.br']
const DESTINATARIOS_TESTE = ['eduardo@imovit.com.br']
const REMETENTE = { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' }
const HUB = 'https://hub.imovit.com.br'
const LINK_RELATORIO = `${HUB}/dashboard/gestao`
const LINK_LISTA = `${HUB}/dashboard/gestao`
const LOGO = 'https://drive.google.com/uc?export=view&id=1t6jzLPHVNqLHZr0Z83m3wkyvPT2rpFPl'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

type Placar = { investido: number; leads: number; negocios: number; adm: number; intermediacao: number; intermediacao_contratos: number }
type Leitura = { fonte: string; ultima: string | null; ok: boolean }
type Boletim = {
  hoje: string
  ontem: { ini: string; fim: string }
  mes: { ini: string; fim: string }
  anterior: { ini: string; fim: string }
  placar: { mes: Placar; anterior: Placar }
  em_atendimento: number
  captacoes_ativas: number
  ontem_numeros: { leads_aluguel: number; leads_venda: number; mudancas_etapa: number; propostas_novas: number; negocios: number; avisos_rescisao: number }
  atencao: { esquecidos: number; perto_do_dinheiro: number; perto_proposta: number; perto_visita: number }
  leituras: Leitura[]
}

function chamadaDoAgendador(req: Request) {
  const chave = Deno.env.get('AGENDADOR_CHAVE') ?? ''
  const enviada = req.headers.get('x-agendador') ?? ''
  return chave.length >= 32 && enviada === chave
}

// ---------- formatos ----------
const n = (v: unknown) => Number(v) || 0
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const dia = (iso: string) => iso.slice(8, 10)
const mesNome = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1]
const Mes = (iso: string) => mesNome(iso).charAt(0).toUpperCase() + mesNome(iso).slice(1)
const inteiro = (v: number) => Math.round(v).toLocaleString('pt-BR')
function reais(v: number) {
  if (v >= 100_000) return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`
  if (v >= 1_000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}
const plural = (q: number, um: string, varios: string) => `${inteiro(q)} ${q === 1 ? um : varios}`

/** ▲/▼ x% em relação ao anterior. `neutro` = sem cor (ex.: investimento). */
function variacao(atual: number, anterior: number, neutro = false) {
  if (anterior === 0 && atual === 0) return { texto: '= igual', cor: '#999999', pct: 0 }
  if (anterior === 0) return { texto: 'novo', cor: '#999999', pct: null as number | null }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return { texto: '= igual', cor: '#999999', pct }
  const cor = neutro ? '#444444' : pct > 0 ? '#2E7D4F' : '#C0392B'
  return { texto: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, cor, pct }
}

// ---------- blocos do e-mail ----------
const FONTE = "'DM Sans',Arial,sans-serif"
const SERIFA = "'Noto Serif',Georgia,serif"

function celula(rotulo: string, valor: string, sub: { texto: string; cor: string }, destaque = false) {
  return `<td style="padding:14px 4px;border:1px solid #eeeeee${destaque ? ';background:#fffaf9' : ''}">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${destaque ? '#ff5e4d' : '#999999'};font-weight:700">${rotulo}</div>
    <div style="font-family:${SERIFA};font-size:20px;color:#000000;margin:6px 0 2px">${valor}</div>
    <div style="font-size:12px;color:${sub.cor}">${sub.texto}</div></td>`
}

const bloco = (titulo: string, corTitulo: string, itens: string) => `
  <div style="border-left:3px solid #ff5e4d;padding:25px;margin:30px 0;background-color:#fffaf9">
    <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${corTitulo};font-weight:700">${titulo}</span>
    <ul style="margin:15px 0 0;padding:0;list-style-type:none;color:#1a1a1a;font-size:14px;line-height:1.8">${itens}</ul>
  </div>`

const verLista = `<a href="${LINK_LISTA}" style="color:#ff5e4d;text-decoration:none;font-weight:700">Ver no Hub →</a>`

function montar(b: Boletim, esquecidosOntem: number | null, perto_ontem: number | null) {
  const m = b.placar.mes
  const a = b.placar.anterior
  const receita = n(m.adm) + n(m.intermediacao)
  const receitaAnt = n(a.adm) + n(a.intermediacao)
  const vReceita = variacao(receita, receitaAnt)
  const segunda = b.ontem.ini !== b.ontem.fim
  const rotuloOntem = segunda ? `Fim de semana · ${ddmm(b.ontem.ini)} a ${ddmm(b.ontem.fim)}` : `Ontem · ${ddmm(b.ontem.fim)}`
  const quandoAssunto = segunda ? 'no fim de semana' : 'ontem'

  const mesAtual = mesNome(b.mes.ini)
  const mesAnterior = mesNome(b.anterior.ini)
  const manchete = vReceita.pct === null || receitaAnt === 0
    ? `${Mes(b.mes.ini)}: ${reais(receita)} em receita até ontem`
    : vReceita.pct === 0
      ? `${Mes(b.mes.ini)} está igual a ${mesAnterior} em receita`
      : `${Mes(b.mes.ini)} está ${Math.abs(vReceita.pct)}% ${vReceita.pct > 0 ? 'acima' : 'abaixo'} de ${mesAnterior} em receita`

  const falhas = (b.leituras ?? []).filter((l) => !l.ok)
  const aviso = falhas.length
    ? `<div style="border:1px solid #C0392B;background:#fdf2f0;color:#C0392B;padding:14px 18px;margin:0 0 24px;font-size:14px;line-height:1.6">
        ⚠️ <b>Leitura atrasada:</b> ${falhas.map((f) => `${f.fonte.split(' (')[0]} (última ${ddmm(f.ultima)})`).join(' · ')}.
        Os números abaixo podem estar desatualizados.</div>`
    : ''

  const varEsq = (atual: number, antes: number | null) =>
    antes === null ? '' : atual === antes ? ' (= ontem)' : ` (${atual > antes ? '▲' : '▼'} ${Math.abs(atual - antes)} vs ontem)`

  const o = b.ontem_numeros
  const at = b.atencao
  const itensOntem = [
    `<li>Leads novos: <strong>${inteiro(o.leads_aluguel)}</strong> locação · <strong>${inteiro(o.leads_venda)}</strong> venda</li>`,
    `<li>Mudanças de etapa: <strong>${inteiro(o.mudancas_etapa)}</strong></li>`,
    `<li>Propostas novas: <strong>${inteiro(o.propostas_novas)}</strong></li>`,
    `<li>Negócios: <strong>${inteiro(o.negocios)}</strong></li>`,
  ].join('')
  const pctEsq = b.em_atendimento ? Math.round((at.esquecidos / b.em_atendimento) * 100) : 0
  const itensAtencao = [
    `<li style="margin-bottom:12px"><strong style="color:#000000">🔥 ${plural(at.perto_do_dinheiro, 'cliente perto do fechamento sem ação no prazo', 'clientes perto do fechamento sem ação no prazo')}</strong>${varEsq(at.perto_do_dinheiro, perto_ontem)}: ${inteiro(at.perto_proposta)} em proposta, ${inteiro(at.perto_visita)} em visita. ${verLista}</li>`,
    `<li style="margin-bottom:12px"><strong style="color:#000000">🔴 ${inteiro(at.esquecidos)} de ${inteiro(b.em_atendimento)}</strong> clientes em atendimento sem ação no prazo (${pctEsq}%)${varEsq(at.esquecidos, esquecidosOntem)}. ${verLista}</li>`,
    o.avisos_rescisao > 0
      ? `<li><strong style="color:#000000">${plural(o.avisos_rescisao, 'aviso de rescisão novo', 'avisos de rescisão novos')}</strong> ${segunda ? 'no fim de semana' : 'ontem'}. <a href="${HUB}/dashboard/adm-locacao" style="color:#ff5e4d;text-decoration:none;font-weight:700">Ver no Hub →</a></li>`
      : '',
  ].join('')

  const leitura = (prefixo: string) => b.leituras?.find((l) => l.fonte.startsWith(prefixo))?.ultima ?? null
  const notaMeta = b.anterior.ini < '2026-09-24'
    ? '<br>* O investimento de antes de 23/09 no Meta está inflado por dias duplicados.'
    : ''

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Noto+Serif:ital,wght@1,300&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background-color:#f9f9f9">
<div style="max-width:600px;margin:12px auto 40px;background:#ffffff;border:1px solid #eeeeee">
  <div style="padding:50px 20px;text-align:center;background-color:#000000;border-bottom:4px solid #ff5e4d">
    <img src="${LOGO}" alt="Imovit" width="240" style="max-width:100%;height:auto">
    <div style="margin-top:30px">
      <div style="display:inline-block;padding:6px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;border:1px solid #ff5e4d;color:#ff5e4d;font-family:${FONTE}">Relatório diário · ${ddmm(b.hoje)}</div>
      <h1 style="margin:0;font-size:26px;font-family:${SERIFA};font-style:italic;font-weight:300;color:#ffffff;letter-spacing:1px">${manchete}</h1>
    </div>
  </div>
  <div style="padding:40px 40px 30px;font-family:${FONTE}">
    ${aviso}
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#444444">Mês até ontem (${dia(b.mes.ini)}–${ddmm(b.mes.fim)}) comparado com ${mesAnterior} até o mesmo dia.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:center"><tr>
      ${celula('Investido', reais(n(m.investido)), variacao(n(m.investido), n(a.investido), true))}
      ${celula('Leads', inteiro(n(m.leads)), variacao(n(m.leads), n(a.leads)))}
      ${celula('Em atendimento', inteiro(b.em_atendimento), { texto: 'agora', cor: '#999999' })}
      ${celula('Negócios', inteiro(n(m.negocios)), variacao(n(m.negocios), n(a.negocios)))}
      ${celula('Receita', reais(receita), vReceita, true)}
    </tr></table>
    <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#444444">Administração <strong style="color:#000000">${reais(n(m.adm))}</strong> (${variacao(n(m.adm), n(a.adm)).texto}) + intermediação <strong style="color:#000000">${reais(n(m.intermediacao))}</strong> em ${plural(n(m.intermediacao_contratos), 'contrato', 'contratos')} (${variacao(n(m.intermediacao), n(a.intermediacao)).texto}).</p>
    ${bloco(rotuloOntem, '#999999', itensOntem)}
    ${bloco('Atenção', '#ff5e4d', itensAtencao)}
    <div style="text-align:center">
      <a href="${LINK_RELATORIO}" style="display:inline-block;padding:15px 30px;background-color:#000000;color:#ff5e4d;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;border:1px solid #ff5e4d;margin-top:10px">Abrir o relatório completo</a>
    </div>
    <p style="margin:50px 0 0;font-size:13px;border-top:1px solid #eeeeee;padding-top:20px;color:#444444">
      Atenciosamente,
      <span style="display:block;margin-top:10px;font-family:${SERIFA};font-style:italic;font-weight:300;font-size:20px;color:#ff5e4d">Hub Imovit</span>
      <small style="display:block;margin-top:5px;color:#999999;font-weight:400;text-transform:uppercase;letter-spacing:1px">A marca da exclusividade.</small>
    </p>
    <p style="margin:20px 0 0;font-size:11px;line-height:1.6;color:#999999">
      Leituras: CRM ${ddmm(leitura('CRM'))} · Recebimentos ${ddmm(leitura('Receita'))} · Meta ${ddmm(leitura('Meta'))} · Google ${ddmm(leitura('Google'))}.
      Captações (${inteiro(b.captacoes_ativas)} ativas) ficam fora das contas de atendimento. "Sem ação no prazo" ainda não considera as interações do CRM, só as atividades.${notaMeta}
    </p>
  </div>
</div></body></html>`

  const assunto = `Imovit ${ddmm(b.hoje)} · ${plural(o.negocios, 'negócio', 'negócios')} ${quandoAssunto} · ${inteiro(at.perto_do_dinheiro)} perto do dinheiro esquecidos`
  return { assunto, html, mesAtual }
}

async function enviar(para: string[], assunto: string, html: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) throw new Error('BREVO_API_KEY não configurada')
  const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
    body: JSON.stringify({ sender: REMETENTE, to: para.map((email) => ({ email })), subject: assunto, htmlContent: html }),
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

    const { data, error } = await supabase.rpc('boletim_diretoria')
    if (error) throw error
    const b = data as Boletim

    const { data: antes } = await supabase.from('boletim_diretoria_fotos')
      .select('dados').lt('dia', b.hoje).order('dia', { ascending: false }).limit(1)
    const anterior = antes?.[0]?.dados as Boletim | undefined

    const email = montar(b, anterior?.atencao?.esquecidos ?? null, anterior?.atencao?.perto_do_dinheiro ?? null)
    const para = teste ? DESTINATARIOS_TESTE : DESTINATARIOS
    await enviar(para, `${teste ? '[TESTE] ' : ''}${email.assunto}`, email.html)

    const { error: erroFoto } = await supabase.from('boletim_diretoria_fotos').upsert({ dia: b.hoje, dados: b, enviado_em: new Date().toISOString() })
    if (erroFoto) console.error('[boletim-diretoria] foto não gravada:', erroFoto)

    console.log(`[boletim-diretoria] enviado para ${para.length}${teste ? ' (teste)' : ''}: ${email.assunto}`)
    return json({ enviado: true, para, assunto: email.assunto })
  } catch (err) {
    console.error('[boletim-diretoria] erro:', err)
    return json({ erro: String((err as Error)?.message ?? err) }, 500)
  }
})
