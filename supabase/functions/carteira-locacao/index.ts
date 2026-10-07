// =============================================================================
// Carteira de locação -- leitura do Imoview (Supabase Edge Function)
// PRD §5.13, Schema §2.10, Plano Fase 17.
//
// Lê no Imoview, só com a `chave` (IMOVIEW_API_KEY):
//   contratos  GET /ContratoAluguel/RetornarContratos              (todos)
//   em aberto  GET /Movimento/RetornarMovimentos situacaoConta=1  (vencidas até ontem)
//   pagas      GET /Movimento/RetornarMovimentos situacaoConta=2  (mês anterior até hoje;
//              13 meses na 1ª carga, aos domingos ou com { completo: true })
// e grava tudo pela RPC carregar_carteira_locacao (converte, mascara CPF/CNPJ, foto do dia).
//
// Quem chama: o painel Dash ▸ Adm locação, ao abrir (se a última leitura tem mais de
// 12 h) ou pelo botão "Atualizar". Só a Gestão. A API devolve no máximo 50 por
// página; a leitura só é gravada se vier inteira (as cobranças em aberto são
// substituídas a cada carga). O filtro de vencimento da API é solto: o banco filtra.
//
// Deploy: supabase functions deploy carteira-locacao
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const imoviewKey = Deno.env.get('IMOVIEW_API_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const POR_PAGINA = 50
const EM_PARALELO = 6
const VALIDADE_HORAS = 12

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function exigirGestao(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')
  const comoChamador = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Token inválido ou expirado')
  const { data: perfil } = await supabase.from('perfis').select('role, suspenso_em').eq('id', user.id).single()
  // Só a Gestão por enquanto (decisão de 07/10; a RLS das tabelas usa is_gestao()).
  if (!perfil || perfil.role !== 'gestao' || perfil.suspenso_em) {
    throw new HttpError(403, 'Só a Gestão atualiza a carteira de locação')
  }
}

// 'dd/MM/yyyy' no fuso de São Paulo
function dataBr(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function hojeSp() {
  const [d, m, y] = dataBr(new Date()).split('/').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

async function pagina(caminho: string, params: Record<string, string>, numero: number) {
  const url = new URL(`https://api.imoview.com.br/${caminho}`)
  for (const [k, v] of Object.entries({ ...params, numeroPagina: String(numero), numeroRegistros: String(POR_PAGINA) })) {
    url.searchParams.set(k, v)
  }
  for (let tentativa = 1; ; tentativa++) {
    const resp = await fetch(url, { headers: { chave: imoviewKey! } })
    if (resp.ok) return await resp.json()
    if (tentativa >= 3) throw new Error(`Imoview ${caminho} página ${numero}: HTTP ${resp.status}`)
    await new Promise((r) => setTimeout(r, 800 * tentativa))
  }
}

/** Lê todas as páginas (a 1ª diz a quantidade; o resto vai em paralelo) e confere o total. */
async function lerTudo(caminho: string, params: Record<string, string>) {
  const primeira = await pagina(caminho, params, 1)
  const quantidade = Number(primeira.quantidade ?? 0)
  const paginas = Math.ceil(quantidade / POR_PAGINA)
  const porCodigo = new Map<number, Record<string, unknown>>()
  for (const item of primeira.lista ?? []) porCodigo.set(item.codigo, item)
  for (let inicio = 2; inicio <= paginas; inicio += EM_PARALELO) {
    const numeros = Array.from({ length: Math.min(EM_PARALELO, paginas - inicio + 1) }, (_, i) => inicio + i)
    const lotes = await Promise.all(numeros.map((n) => pagina(caminho, params, n)))
    for (const lote of lotes) for (const item of lote.lista ?? []) porCodigo.set(item.codigo, item)
  }
  if (porCodigo.size !== quantidade) {
    throw new Error(`Leitura incompleta de ${caminho}: ${porCodigo.size} de ${quantidade}. Nada foi gravado.`)
  }
  return [...porCodigo.values()]
}

const ehLocacao = (m: Record<string, unknown>) => Number(m.modulo) === 2 && Number(m.codigocontratoaluguel) > 0

type Detalhe = { codigocontabilplanoconta?: string; valor?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ erro: 'Use POST' }, 405)

  try {
    await exigirGestao(req)
    if (!imoviewKey) throw new Error('IMOVIEW_API_KEY precisa estar definida nas secrets da function')
    const corpo = await req.json().catch(() => ({}))
    const forcar = corpo?.forcar === true

    const { data: ultima } = await supabase.from('contratos_locacao_fotos').select('lido_em').order('lido_em', { ascending: false }).limit(1)
    const lidoEm = ultima?.[0]?.lido_em ?? null
    if (!forcar && lidoEm && Date.now() - new Date(lidoEm).getTime() < VALIDADE_HORAS * 3600_000) {
      return jsonResponse({ atualizado: false, lido_em: lidoEm })
    }

    const hoje = hojeSp()
    const ontem = new Date(hoje.getTime() - 86400_000)
    const { count: jaRecebidos } = await supabase.from('contratos_locacao_recebimentos').select('codigo', { count: 'exact', head: true })
    const completo = corpo?.completo === true || !jaRecebidos || hoje.getUTCDay() === 0
    const inicioPagas = completo
      ? new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 12, 1))
      : new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1))
    const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

    const [contratos, abertas, pagas] = await Promise.all([
      lerTudo('ContratoAluguel/RetornarContratos', {}),
      lerTudo('Movimento/RetornarMovimentos', { situacaoConta: '1', dataVencimentoInicial: '01/01/2010', dataVencimentoFinal: fmt(ontem) }),
      lerTudo('Movimento/RetornarMovimentos', { situacaoConta: '2', dataVencimentoInicial: fmt(inicioPagas), dataVencimentoFinal: fmt(hoje) }),
    ])
    if (contratos.length === 0) throw new Error('Nenhum contrato lido do Imoview. Nada foi gravado.')

    // Só os campos que o banco usa (sem nomes de clientes e sem os repasses de outros).
    const cobrancas = abertas.filter(ehLocacao).map((m) => ({
      codigo: m.codigo, modulo: m.modulo, codigocontratoaluguel: m.codigocontratoaluguel, codigoimovel: m.codigoimovel,
      historico: m.historico, datavencimento: m.datavencimento, datapagamento: m.datapagamento, saldo: m.saldo,
    }))
    const enxugar = (lista: unknown) =>
      ((lista as Detalhe[] | undefined) ?? []).map((d) => ({ codigocontabilplanoconta: d.codigocontabilplanoconta, valor: d.valor }))
    const pagasEnxutas = pagas.filter(ehLocacao).map((m) => ({
      codigo: m.codigo, modulo: m.modulo, codigocontratoaluguel: m.codigocontratoaluguel, codigoimovel: m.codigoimovel,
      datavencimento: m.datavencimento, datapagamento: m.datapagamento,
      detalhes: enxugar(m.detalhes),
      repasses: ((m.repasses as Record<string, unknown>[] | undefined) ?? []).map((r) => ({ tipocliente: r.tipocliente, detalhes: enxugar(r.detalhes) })),
    }))

    const { data, error } = await supabase.rpc('carregar_carteira_locacao', { contratos, cobrancas, pagas: pagasEnxutas })
    if (error) throw error

    console.log(`[carteira-locacao] ${contratos.length} contratos, ${cobrancas.length} em aberto, ${pagasEnxutas.length} pagas (${completo ? '13 meses' : 'mês anterior'})`)
    return jsonResponse({ atualizado: true, completo, resultado: data })
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ erro: error.message }, error.status)
    console.error('[carteira-locacao] erro:', error)
    return jsonResponse({ erro: error instanceof Error ? error.message : 'Erro desconhecido' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}
