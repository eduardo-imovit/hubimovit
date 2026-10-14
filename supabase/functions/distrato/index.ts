// =============================================================================
// Distratos (RF29, PRD §5.16, Schema §2.13).
//
// O ADM gera um link por contrato; o locatário abre /distrato/<token> (sem
// login), lê o procedimento, envia o aviso de desocupação (o envio é o aviso
// oficial, com a data do servidor), o motivo e a pesquisa de satisfação.
// Esta função é a única porta de escrita na tabela `distratos`.
//
// Eventos:
//   criar        (gestão) -- copia o contrato da carteira e gera o token
//   enviar_link  (gestão) -- manda o link por e-mail ao locatário
//   cancelar     (gestão) -- locatário desistiu
//   abrir        (token)      -- dados do link ou o comprovante
//   enviar       (token)      -- grava o aviso; e-mail a administrativo@ + comprovante
//
// Deploy: supabase functions deploy distrato
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

// Só o administrativo recebe o aviso (decisão do Eduardo, 14/10); o proprietário não.
const DESTINO_EQUIPE = 'administrativo@imovit.com.br'
const REMETENTE = { name: 'Imovit', email: 'relacionamento@imovit.com.br' }
const VALIDADE_DIAS = 15
const AVISO_PREVIO_DIAS = 30

const MOTIVOS = [
  'Mudou de cidade', 'Foi transferido', 'Comprou outro imóvel', 'Alugou outro imóvel',
  'Valor do aluguel', 'Dificuldade financeira', 'Fechou empresa',
  'O proprietário solicitou o imóvel de volta', 'Vencimento do contrato', 'Outro',
] as const
const PEDE_COM_QUEM = ['Alugou outro imóvel', 'Comprou outro imóvel']
const PEDE_FATOR = ['Alugou outro imóvel', 'Valor do aluguel']
const COM_QUEM_LABEL: Record<string, string> = {
  imovit: 'com a Imovit', outra_imobiliaria: 'com outra imobiliária', proprietario_direto: 'direto com o proprietário',
}
const FATOR_LABEL: Record<string, string> = {
  preco: 'preço', tamanho: 'tamanho', localizacao: 'localização', estado_imovel: 'estado do imóvel', outro: 'outro',
}
const AREAS: Record<string, string> = {
  atendimento: 'Atendimento da equipe', manutencao: 'Manutenção e reparos', financeiro: 'Financeiro',
  comunicacao: 'Comunicação', estado_entrada: 'Estado do imóvel na entrada',
}

const token = z.string().trim().min(32).max(80)
const nota = z.number().int().min(1).max(5).nullable().optional()

const eventoSchema = z.discriminatedUnion('evento', [
  z.object({ evento: z.literal('criar'), contrato_codigo: z.number().int().positive() }),
  z.object({ evento: z.literal('enviar_link'), id: z.string().uuid() }),
  z.object({ evento: z.literal('cancelar'), id: z.string().uuid() }),
  z.object({ evento: z.literal('abrir'), token }),
  z.object({
    evento: z.literal('enviar'),
    token,
    ciente: z.literal(true),
    data_prevista_saida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    confirma_multa: z.boolean().optional(),
    contato_telefone: z.string().trim().max(40).optional().nullable(),
    contato_email: z.string().trim().email().max(160).optional().nullable().or(z.literal('')),
    motivo: z.enum(MOTIVOS),
    motivo_detalhe: z.string().trim().max(1000).optional().nullable(),
    motivo_com_quem: z.enum(['imovit', 'outra_imobiliaria', 'proprietario_direto']).optional().nullable(),
    motivo_fator: z.enum(['preco', 'tamanho', 'localizacao', 'estado_imovel', 'outro']).optional().nullable(),
    nps: z.number().int().min(0).max(10).nullable().optional(),
    notas: z.object({ atendimento: nota, manutencao: nota, financeiro: nota, comunicacao: nota, estado_entrada: nota }).optional().nullable(),
    alugaria_de_novo: z.enum(['sim', 'talvez', 'nao']).nullable().optional(),
    comentario: z.string().trim().max(2000).optional().nullable(),
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

// 'YYYY-MM-DD' de hoje no fuso de São Paulo
function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function somaDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const dataHoraBr = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts))

function gerarToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function exigirEquipe(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')
  const comoChamador = createClient(supabaseUrl!, anonKey!, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Faça login de novo')
  const { data: perfil } = await supabase.from('perfis').select('id, role, suspenso_em').eq('id', user.id).single()
  // Só a Gestão por enquanto (decisão do Eduardo, 14/10; a RLS usa is_gestao()).
  if (!perfil || perfil.role !== 'gestao' || perfil.suspenso_em) {
    throw new HttpError(403, 'Só a Gestão trata distratos por enquanto')
  }
  return perfil.id as string
}

async function notificar(destinatarios: string[], assunto: string, html: string) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[distrato] BREVO_API_KEY não configurada -- e-mail não enviado:', assunto)
    return false
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({ sender: REMETENTE, to: destinatarios.map((email) => ({ email })), subject: assunto, htmlContent: html }),
    })
    if (!resposta.ok) {
      console.error('[distrato] Brevo retornou', resposta.status, await resposta.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[distrato] erro ao notificar:', err)
    return false
  }
}

const moldura = (titulo: string, corpo: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#F5F0E8;padding:28px;color:#2D2D2D">
  <div style="font-family:Georgia,serif;color:#E8593C;font-size:26px;margin-bottom:4px">imovit</div>
  <h2 style="font-family:Georgia,serif;font-weight:400;margin:12px 0">${titulo}</h2>
  ${corpo}
  <p style="color:#888;font-size:12px;margin-top:24px">Imovit · Av. José Bonifácio, 2326 · Campinas-SP · (19) 2512-7700</p></div>`

const lista = (linhas: Array<[string, unknown]>) =>
  `<ul style="padding-left:18px;line-height:1.7">${linhas.map(([r, v]) => `<li><strong>${r}:</strong> ${escapeHtml(v)}</li>`).join('')}</ul>`

const linkDe = (t: string) => `${appUrl()}/distrato/${t}`

// Campos que o locatário vê pelo token (nada de dado interno).
const CAMPOS_PUBLICOS =
  'id, status, expira_em, imovel_resumo, imovel_endereco, locatario_nome, locatario_email, locatario_telefone, contrato_fim, aviso_em, data_prevista_saida, fim_aviso_previo, dentro_prazo, motivo'

async function porToken(t: string) {
  const { data, error } = await supabase.from('distratos').select(CAMPOS_PUBLICOS).eq('token', t).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Link não encontrado. Fale com o administrativo da Imovit.')
  return data
}

function situacaoPublica(d: { status: string; expira_em: string }) {
  if (d.status === 'aviso_recebido') return 'enviado'
  if (d.status === 'cancelado') return 'cancelado'
  if (new Date(d.expira_em) < new Date()) return 'expirado'
  return 'aberto'
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
      const quem = await exigirEquipe(req)
      const { data: c, error } = await supabase.from('contratos_locacao')
        .select('codigo, codigo_imovel, imovel_resumo, imovel_endereco, locatario_nome, locatario_email, locatario_telefone, data_inicio, data_fim, valor_aluguel, situacao')
        .eq('codigo', ev.contrato_codigo).maybeSingle()
      if (error) throw error
      if (!c || c.situacao !== 'Ativo') throw new HttpError(404, 'Contrato ativo não encontrado na carteira')
      const expira = new Date(Date.now() + VALIDADE_DIAS * 864e5).toISOString()
      const { data, error: e2 } = await supabase.from('distratos').insert({
        origem: 'hub', token: gerarToken(), expira_em: expira, criado_por: quem,
        contrato_codigo: c.codigo, imovel_codigo: c.codigo_imovel, imovel_resumo: c.imovel_resumo,
        imovel_endereco: c.imovel_endereco, locatario_nome: c.locatario_nome, locatario_email: c.locatario_email,
        locatario_telefone: c.locatario_telefone, contrato_inicio: c.data_inicio, contrato_fim: c.data_fim,
        aluguel: c.valor_aluguel,
      }).select('id, token, expira_em').single()
      if (e2) throw e2
      return json({ distrato: { ...data, link: linkDe(data.token) } })
    }

    if (ev.evento === 'enviar_link') {
      await exigirEquipe(req)
      const { data: d } = await supabase.from('distratos').select('token, status, expira_em, locatario_nome, locatario_email, imovel_endereco').eq('id', ev.id).single()
      if (!d || d.status !== 'link_enviado') throw new HttpError(409, 'Este distrato não está aguardando o locatário')
      if (!d.locatario_email) throw new HttpError(400, 'O contrato não tem e-mail do locatário. Copie o link e envie pelo WhatsApp.')
      const primeiro = (d.locatario_nome ?? '').split(' ')[0]
      const ok = await notificar([d.locatario_email], 'Aviso de desocupação — Imovit', moldura(
        `Olá, ${escapeHtml(primeiro)}`,
        `<p>Conforme combinado, segue o link para o aviso de desocupação do imóvel <strong>${escapeHtml(d.imovel_endereco)}</strong>. Nele estão o procedimento de entrega, o formulário do aviso e uma pesquisa rápida sobre a sua experiência com a Imovit.</p>
         <p><a href="${linkDe(d.token)}" style="background:#E8593C;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block;border-radius:999px">Abrir o aviso de desocupação</a></p>
         <p style="color:#444">O link vale até ${dataHoraBr(d.expira_em)}.</p>`,
      ))
      if (!ok) throw new HttpError(502, 'Não foi possível enviar o e-mail agora')
      return json({ ok: true })
    }

    if (ev.evento === 'cancelar') {
      const quem = await exigirEquipe(req)
      const { data, error } = await supabase.from('distratos')
        .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), cancelado_por: quem })
        .eq('id', ev.id).neq('status', 'cancelado').select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new HttpError(404, 'Distrato não encontrado ou já cancelado')
      return json({ ok: true })
    }

    if (ev.evento === 'abrir') {
      const d = await porToken(ev.token)
      return json({ distrato: { ...d, id: undefined, situacao: situacaoPublica(d), hoje: hojeSP(), aviso_previo_dias: AVISO_PREVIO_DIAS } })
    }

    // enviar
    const d = await porToken(ev.token)
    const sit = situacaoPublica(d)
    if (sit !== 'aberto') {
      throw new HttpError(409, sit === 'enviado' ? 'Este aviso já foi enviado.' : 'Este link não está mais ativo. Fale com o administrativo da Imovit.')
    }
    if (ev.motivo === 'Outro' && !ev.motivo_detalhe) throw new HttpError(400, 'Conte o motivo em poucas palavras.')
    if (PEDE_COM_QUEM.includes(ev.motivo) && !ev.motivo_com_quem) throw new HttpError(400, 'Informe com quem você fechou o novo imóvel.')
    const hoje = hojeSP()
    if (ev.data_prevista_saida < hoje) throw new HttpError(400, 'A data prevista não pode ser no passado.')
    const fimAviso = somaDias(hoje, AVISO_PREVIO_DIAS)
    const dentroPrazo = ev.data_prevista_saida >= fimAviso
    if (!dentroPrazo && !ev.confirma_multa) throw new HttpError(400, 'Confirme que está ciente da cobrança do aviso prévio.')

    const agora = new Date().toISOString()
    const notas = ev.notas ? Object.fromEntries(Object.entries(ev.notas).filter(([, v]) => v != null)) : null
    const { data: gravado, error } = await supabase.from('distratos').update({
      status: 'aviso_recebido', ciente_procedimento_em: agora, aviso_em: agora,
      data_prevista_saida: ev.data_prevista_saida, fim_aviso_previo: fimAviso, dentro_prazo: dentroPrazo,
      contato_telefone: ev.contato_telefone || null, contato_email: ev.contato_email || null,
      motivo: ev.motivo, motivo_detalhe: ev.motivo_detalhe || null,
      motivo_com_quem: PEDE_COM_QUEM.includes(ev.motivo) ? ev.motivo_com_quem : null,
      motivo_fator: PEDE_FATOR.includes(ev.motivo) ? (ev.motivo_fator ?? null) : null,
      nps: ev.nps ?? null, notas: notas && Object.keys(notas).length ? notas : null,
      alugaria_de_novo: ev.alugaria_de_novo ?? null, comentario: ev.comentario || null,
    }).eq('token', ev.token).eq('status', 'link_enviado').select('id').maybeSingle()
    if (error) throw error
    if (!gravado) throw new HttpError(409, 'Este aviso já foi enviado.')

    const motivoTxt = [
      ev.motivo,
      PEDE_COM_QUEM.includes(ev.motivo) && ev.motivo_com_quem ? COM_QUEM_LABEL[ev.motivo_com_quem] : null,
      PEDE_FATOR.includes(ev.motivo) && ev.motivo_fator ? `pesou: ${FATOR_LABEL[ev.motivo_fator]}` : null,
    ].filter(Boolean).join(' · ')
    const linhasEquipe: Array<[string, unknown]> = [
      ['Locatário', d.locatario_nome],
      ['Imóvel', `${d.imovel_resumo ?? ''} — ${d.imovel_endereco ?? ''}`],
      ['Aviso em', dataHoraBr(agora)],
      ['Data prevista de saída', `${dataBr(ev.data_prevista_saida)}${dentroPrazo ? '' : ' (antes dos 30 dias: ciente da multa)'}`],
      ['Fim do aviso prévio', dataBr(fimAviso)],
      ['Motivo', motivoTxt],
      ['Detalhe', ev.motivo_detalhe || '—'],
      ['Contato', [ev.contato_telefone, ev.contato_email].filter(Boolean).join(' · ') || '—'],
      ['NPS', ev.nps ?? 'não respondeu'],
      ...Object.entries(notas ?? {}).map(([k, v]) => [AREAS[k] ?? k, `${v}/5`] as [string, unknown]),
      ['Alugaria de novo', ev.alugaria_de_novo ?? '—'],
      ['Comentário', ev.comentario || '—'],
    ]
    const okEquipe = await notificar([DESTINO_EQUIPE], `Aviso de desocupação: ${d.locatario_nome} — ${d.imovel_endereco ?? ''}`, moldura(
      'Aviso de desocupação recebido',
      `<p>O locatário enviou o aviso pelo link do Hub.</p>${lista(linhasEquipe)}
       <p><a href="${appUrl()}/admin/distratos" style="background:#2D2D2D;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">Ver no Hub</a></p>`,
    ))

    const destinoLocatario = ev.contato_email || d.locatario_email
    if (destinoLocatario) {
      await notificar([destinoLocatario], 'Comprovante do aviso de desocupação — Imovit', moldura(
        'Recebemos o seu aviso de desocupação',
        `${lista([
          ['Imóvel', d.imovel_endereco],
          ['Aviso registrado em', dataHoraBr(agora)],
          ['Data prevista de entrega das chaves', dataBr(ev.data_prevista_saida)],
          ['Fim do aviso prévio de 30 dias', dataBr(fimAviso)],
        ])}
        <p><strong>Próximos passos</strong></p>
        <ol style="line-height:1.6;padding-left:18px">
          <li>Entregue o imóvel livre de objetos, limpo e com os equipamentos funcionando. Se for preciso pintar, pinte antes da entrega das chaves.</li>
          <li>Deixe as chaves internas nas respectivas portas.</li>
          <li>Com o imóvel desocupado, agende a vistoria final (segunda a sexta). Se houver reparos, a nova vistoria custa R$ 150,00.</li>
          <li>Com a vistoria aprovada pelo proprietário, traga as chaves e os documentos: 3 últimas contas pagas de CPFL, Sanasa e gás; 3 últimos boletos pagos do condomínio e a carta de quitação (CND); controles, tags e cartões de acesso.</li>
        </ol>
        ${dentroPrazo ? '' : '<p style="color:#B93A18">A data informada é anterior ao fim do aviso prévio: será cobrado 1 (um) mês de aluguel e encargos, de forma integral.</p>'}
        <p>Dúvidas: administrativo@imovit.com.br · (19) 2512-7700.</p>`,
      ))
    }
    if (okEquipe) await supabase.from('distratos').update({ email_ok: true }).eq('id', gravado.id)

    return json({ ok: true, aviso_em: agora, fim_aviso_previo: fimAviso, dentro_prazo: dentroPrazo })
  } catch (err) {
    if (err instanceof HttpError) return json({ erro: err.message }, err.status)
    console.error('[distrato]', err)
    return json({ erro: 'Não foi possível concluir agora. Tente de novo em instantes.' }, 500)
  }
})
