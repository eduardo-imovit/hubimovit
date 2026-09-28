// =============================================================================
// Captação de imóvel — formulário público do proprietário (RF23, PRD §5.7).
//
// O proprietário abre o link fixo do corretor (/captacao/<token>, código
// aleatório de captacao_links; antes era o id do CRM, sequencial e fácil de
// trocar), sem login, preenche e assina. Esta função é a única porta de escrita
// na tabela `captacoes` (anon não tem grant): valida o payload, confere o
// corretor na lista do CRM, grava com a declaração que foi exibida e avisa o
// corretor por e-mail. Só registro: o corretor é o responsável pelo processo.
//
// Eventos:
//   formulario -- nome do corretor do token e o texto oficial da declaração,
//                 que a página exibe tal como será gravado (sem lista de nomes)
//   enviar     -- grava a captação; honeypot `site` precisa vir vazio
//
// Deploy: supabase functions deploy captacao (verify_jwt: a página pública
// chama com a anon key, que é um JWT válido)
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

// Texto do Tally "Acompanhamento personalizado" (28/09). Mudou aqui, muda o
// que o proprietário lê e o que fica gravado nas próximas captações.
export const DECLARACAO = [
  'Ao assinar, você autoriza nossa equipe de especialistas a iniciar a estratégia de posicionamento e divulgação do seu imóvel em nossa vitrine exclusiva.',
  'Autorizo a Imovit a representar meu imóvel, aplicando os mais altos padrões de marketing e atendimento para garantir uma transação segura e sofisticada.',
  'Ao autorizar a intermediação da Imovit, o proprietário declara ciência e concordância com as seguintes condições comerciais:',
  '- Intermediação de Locação: para a consolidação do novo contrato de aluguel, os honorários de intermediação correspondem ao valor integral do primeiro aluguel.',
  '- Gestão Patrimonial e Administração: pelo acompanhamento contínuo, suporte jurídico e gestão do contrato, será aplicada uma taxa de administração de 8% (oito por cento) sobre o valor bruto mensal do aluguel.',
  'Em caso de conclusão da venda por intermediação da Imovit, será devida a título de honorários a comissão de 6% (seis por cento) sobre o valor total da transação.',
].join('\n')

const texto = (max = 200) => z.string().trim().max(max)
const opcional = (max = 200) => texto(max).optional().transform((v) => (v ? v : null))
const valor = z.number().nonnegative().max(1e10).optional().nullable()

const token = z.string().regex(/^[A-Za-z0-9_-]{10,40}$/)

const enviarSchema = z.object({
  evento: z.literal('enviar'),
  site: z.string().max(0).optional(), // honeypot: robô preenche, gente não vê
  token,
  proprietario_nome: texto(160).min(3),
  proprietario_email: z.string().trim().email().max(160),
  proprietario_telefone: texto(40).min(8),
  proprietario_cpf: z.string().trim().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido'),
  tipo_imovel: texto(60).min(1),
  finalidade: z.enum(['Venda', 'Locação', 'Ambos']),
  exclusividade: z.boolean(),
  exclusividade_periodo: z.enum(['30 dias', '90 dias', '180 dias', '1 ano']).optional().nullable(),
  logradouro: texto(200).min(2),
  numero: texto(20).min(1),
  bairro: texto(120).min(2),
  cep: opcional(12),
  apto_sala: opcional(40),
  bloco: opcional(40),
  quadra: opcional(40),
  valor_locacao: valor,
  valor_venda: valor,
  valor_condominio: valor,
  iptu_mensal: valor,
  area_interna: z.number().positive().max(1e6),
  area_terreno: z.number().positive().max(1e8).optional().nullable(),
  quartos: opcional(20),
  suites: opcional(20),
  banheiros: opcional(20),
  salas: opcional(20),
  vagas: opcional(20),
  tipo_vaga: opcional(20),
  lazer: z.array(texto(60)).max(30).default([]),
  observacoes: opcional(4000),
  assinatura: z.string().startsWith('data:image/png;base64,').max(400000),
})

const eventoSchema = z.discriminatedUnion('evento', [z.object({ evento: z.literal('formulario'), token }), enviarSchema])

/** Corretor ativo dono do token, ou null (link inválido ou corretor inativo). */
async function corretorDoToken(t: string) {
  const { data: link, error } = await supabase.from('captacao_links').select('corretor_crm_id').eq('token', t).maybeSingle()
  if (error) throw error
  if (!link) return null
  const { data: corretor, error: erroCorretor } = await supabase
    .from('colaboradores_raw')
    .select('id_corretor_crm, nome_completo, email_oficial')
    .eq('id_corretor_crm', link.corretor_crm_id)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  if (erroCorretor) throw erroCorretor
  return corretor
}

function appUrl() {
  return (Deno.env.get('APP_URL') || 'https://hub.imovit.com.br').replace(/\/+$/, '')
}

const escapeHtml = (t: unknown) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const moeda = (v: number | null | undefined) =>
  v == null ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function avisarCorretor(email: string, c: Record<string, unknown>) {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    console.error('[captacao] BREVO_API_KEY não configurada -- aviso não enviado')
    return
  }
  const linhas = [
    ['Proprietário', `${c.proprietario_nome} · ${c.proprietario_telefone} · ${c.proprietario_email}`],
    ['Imóvel', `${c.tipo_imovel} · ${c.finalidade}${c.exclusividade ? ` · exclusividade ${c.exclusividade_periodo ?? ''}` : ''}`],
    ['Endereço', `${c.logradouro}, ${c.numero} · ${c.bairro}`],
    ['Venda', moeda(c.valor_venda as number)],
    ['Locação', moeda(c.valor_locacao as number)],
  ].filter(([, v]) => v)
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-top:4px solid #ff5e4d;padding:24px">
    <h2 style="font-weight:400;margin:0 0 12px">Nova captação assinada</h2>
    <p style="color:#444">O proprietário preencheu e assinou a autorização pelo seu link de captação.</p>
    <ul style="padding-left:18px;color:#1a1a1a;line-height:1.7">${linhas.map(([r, v]) => `<li><strong>${r}:</strong> ${escapeHtml(v)}</li>`).join('')}</ul>
    <p><a href="${appUrl()}/captacoes" style="background:#000;color:#ff5e4d;padding:12px 20px;text-decoration:none;display:inline-block">Ver captação e baixar o PDF</a></p>
    <p style="color:#999;font-size:12px">Hub Imovit</p></div>`
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
      body: JSON.stringify({
        sender: { name: 'Hub Imovit', email: 'relacionamento@imovit.com.br' },
        to: [{ email }],
        subject: `Nova captação: ${c.tipo_imovel} em ${c.bairro}`,
        htmlContent: html,
      }),
    })
    if (!resposta.ok) console.error('[captacao] Brevo retornou', resposta.status, await resposta.text())
  } catch (err) {
    console.error('[captacao] erro ao avisar o corretor:', err)
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
    const corretor = await corretorDoToken(evento.token)
    if (!corretor) return json({ erro: 'Este link de captação não é válido. Peça um novo ao seu corretor.' }, 404)

    if (evento.evento === 'formulario') {
      return json({ declaracao: DECLARACAO, corretor: corretor.nome_completo })
    }

    // enviar
    if (evento.exclusividade && !evento.exclusividade_periodo) {
      return json({ erro: 'Informe o período da exclusividade' }, 400)
    }

    const { evento: _e, site: _s, token: _t, ...dados } = evento
    const registro = {
      ...dados,
      exclusividade_periodo: evento.exclusividade ? evento.exclusividade_periodo : null,
      corretor: corretor.nome_completo,
      corretor_crm_id: corretor.id_corretor_crm,
      corretor_email: corretor.email_oficial,
      declaracao: DECLARACAO,
      origem_ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      origem_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
    }
    const { data, error } = await supabase
      .from('captacoes')
      .insert(registro)
      .select('id, criado_em, assinado_em, corretor, declaracao')
      .single()
    if (error) throw error

    if (corretor.email_oficial) await avisarCorretor(corretor.email_oficial, registro)

    return json({ captacao: data })
  } catch (err) {
    console.error('[captacao]', err)
    return json({ erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }, 500)
  }
})
