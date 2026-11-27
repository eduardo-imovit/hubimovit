// =============================================================================
// Carteira de locação -- leitura do Imoview (Supabase Edge Function)
// PRD §5.13, Schema §2.10 e §2.24, Plano Fase 17 e Fase 30.
//
// Lê no Imoview, com a chave de Integração + o login de integração (usuário 111):
//   contratos  GET /ContratoAluguel/RetornarContratos              (todos; máx. 50/pág)
//   em aberto  GET /Movimento/RetornarMovimentos situacaoConta=1  (vencidas até ontem; máx. 1.000/pág, usamos 200)
//   pagas      GET /Movimento/RetornarMovimentos situacaoConta=2  (vencimento do mês anterior até hoje;
//              13 meses na 1ª carga, aos domingos ou com { completo: true })
// e grava tudo pela RPC carregar_carteira_locacao (converte, mascara CPF/CNPJ, foto do dia).
//
// 27/11 (Fase 30): dava 401 desde 26/11 porque só mandava a chave. Agora a sessão vem da
// tabela imoview_sessao (RPCs imoview_sessao_obter/gravar/liberar), a MESMA que o n8n usa:
// a Edge nunca faz login por conta própria, senão derruba a sessão do n8n (uma por usuário).
// Detalhes em ./imoview.ts. Trava de volume antes de gravar em ./volume.ts.
//
// Quem chama:
//   - pg_cron `carteira-locacao-receita`, 6h45 (09:45 UTC), com x-agendador = AGENDADOR_CHAVE;
//   - o painel Dash ▸ Adm locação (Gestão e ADM), ao abrir (se a última leitura tem > 12 h) ou "Atualizar".
// Corpo (opcional): { forcar?: bool, completo?: bool, seco?: bool }
//   seco = lê tudo e aplica a trava, mas NÃO grava (teste depois do deploy).
//
// Secrets: IMOVIEW_CHAVE, IMOVIEW_EMAIL, IMOVIEW_SENHA (+ AGENDADOR_CHAVE e as do Supabase).
// Deploy: supabase functions deploy carteira-locacao   (sobe index.ts, imoview.ts e volume.ts)
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { criarClienteImoview, ImoviewErro } from './imoview.ts'
import { conferirVolume } from './volume.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CONTRATOS_POR_PAGINA = 50 // máximo do Swagger
const MOVIMENTOS_POR_PAGINA = 200 // Swagger: máx. 1.000; 200 = poucas páginas sem resposta gigante
const VALIDADE_HORAS = 12

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Agendador diário (pg_cron no banco, 29/10): chama com o cabeçalho x-agendador = secret
// AGENDADOR_CHAVE. Sem isso a receita (pagas) só era lida quando alguém abria o painel e
// clicava em "Atualizar" (a regra das 12 h olha a foto que o n8n grava às 6h30).
function chamadaDoAgendador(req: Request) {
  const chave = Deno.env.get('AGENDADOR_CHAVE') ?? ''
  const enviada = req.headers.get('x-agendador') ?? ''
  return chave.length >= 32 && enviada === chave
}

async function exigirGestao(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Requisição sem token de autenticação')
  const comoChamador = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await comoChamador.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Token inválido ou expirado')
  const { data: perfil } = await supabase.from('perfis').select('role, suspenso_em').eq('id', user.id).single()
  // Gestão e ADM (liberado para o ADM em 15/10; a RLS das tabelas usa is_adm_ou_gestao()).
  if (!perfil || !['gestao', 'adm'].includes(perfil.role) || perfil.suspenso_em) {
    throw new HttpError(403, 'Só a Gestão e o ADM atualizam a carteira de locação')
  }
}

function lerSecrets() {
  const chave = Deno.env.get('IMOVIEW_CHAVE') ?? ''
  const email = Deno.env.get('IMOVIEW_EMAIL') ?? ''
  const senha = Deno.env.get('IMOVIEW_SENHA') ?? ''
  const faltando = [!chave && 'IMOVIEW_CHAVE', !email && 'IMOVIEW_EMAIL', !senha && 'IMOVIEW_SENHA'].filter(Boolean)
  if (faltando.length) throw new Error(`Secrets da function faltando: ${faltando.join(', ')} (Edge Functions ▸ Secrets).`)
  return { chave, email, senha }
}

// RPC com a service_role; erro do banco vira exceção (nunca engolido)
async function rpc(funcao: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(funcao, args)
  if (error) throw new Error(`RPC ${funcao}: ${error.message}`)
  return (data ?? {}) as Record<string, unknown>
}

// 'dd/MM/yyyy' no fuso de São Paulo
function dataBr(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function hojeSp() {
  const [d, m, y] = dataBr(new Date()).split('/').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const ehLocacao = (m: Record<string, unknown>) => Number(m.modulo) === 2 && Number(m.codigocontratoaluguel) > 0

type Detalhe = { codigocontabilplanoconta?: string; valor?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ erro: 'Use POST' }, 405)

  let etapa = 'início'
  try {
    const doAgendador = chamadaDoAgendador(req)
    if (!doAgendador) await exigirGestao(req)
    const secrets = lerSecrets()
    const corpo = await req.json().catch(() => ({}))
    // o agendador sempre lê de novo (é ele que garante a receita do dia)
    const forcar = doAgendador || corpo?.forcar === true || corpo?.seco === true
    const seco = corpo?.seco === true

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
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    // Base da trava das pagas: o que já está no banco na mesma janela de vencimento (só SELECT)
    const { count: pagasNoBanco, error: erroBase } = await supabase.from('contratos_locacao_recebimentos')
      .select('codigo', { count: 'exact', head: true })
      .gte('data_vencimento', iso(inicioPagas)).lte('data_vencimento', iso(hoje))
    if (erroBase) throw new Error(`Base da trava de volume: ${erroBase.message}`)

    const imoview = criarClienteImoview({ ...secrets, rpc, log: (m) => console.log(m) })

    // Em sequência (não 3 leituras em paralelo): menos chance de 429 e um erro claro por etapa.
    etapa = 'contratos'
    const contratos = await imoview.lerTudo('ContratoAluguel/RetornarContratos', {}, CONTRATOS_POR_PAGINA)
    etapa = 'cobranças em aberto'
    const abertas = await imoview.lerTudo('Movimento/RetornarMovimentos',
      { situacaoConta: '1', dataVencimentoInicial: '01/01/2010', dataVencimentoFinal: fmt(ontem) }, MOVIMENTOS_POR_PAGINA)
    etapa = 'pagas'
    const pagas = await imoview.lerTudo('Movimento/RetornarMovimentos',
      { situacaoConta: '2', dataVencimentoInicial: fmt(inicioPagas), dataVencimentoFinal: fmt(hoje) }, MOVIMENTOS_POR_PAGINA)

    // Só os campos que o banco usa (sem nomes de clientes e sem os repasses de outros).
    const cobrancas = abertas.filter(ehLocacao).map((m) => ({
      codigo: m.codigo, modulo: m.modulo, codigocontratoaluguel: m.codigocontratoaluguel, codigoimovel: m.codigoimovel,
      historico: m.historico, datavencimento: m.datavencimento, datapagamento: m.datapagamento, saldo: m.saldo,
    }))
    const enxugar = (lista: unknown) =>
      ((lista as Detalhe[] | undefined) ?? []).map((d) => ({ codigocontabilplanoconta: d.codigocontabilplanoconta, valor: d.valor }))
    const pagasEnxutas = pagas.filter((m) => ehLocacao(m) && m.datapagamento).map((m) => ({
      codigo: m.codigo, modulo: m.modulo, codigocontratoaluguel: m.codigocontratoaluguel, codigoimovel: m.codigoimovel,
      datavencimento: m.datavencimento, datapagamento: m.datapagamento,
      detalhes: enxugar(m.detalhes),
      repasses: ((m.repasses as Record<string, unknown>[] | undefined) ?? []).map((r) => ({ tipocliente: r.tipocliente, detalhes: enxugar(r.detalhes) })),
    }))

    etapa = 'trava de volume'
    const volume = {
      contratos: contratos.length,
      ativos: contratos.filter((c) => c.situacao === 'Ativo').length,
      cobrancas: cobrancas.length,
      pagas: pagasEnxutas.length,
      pagasNoBanco: pagasNoBanco ?? 0,
    }
    const janela = `${fmt(inicioPagas)} a ${fmt(hoje)} (${completo ? '13 meses' : 'mês anterior'})`
    const problemas = conferirVolume(volume)
    if (problemas.length) {
      throw new Error(`Trava de volume: ${problemas.join('; ')}. Janela das pagas: ${janela}. Nada foi gravado.`)
    }
    if (seco) {
      console.log(`[carteira-locacao] SECO ${JSON.stringify(volume)} · ${janela} · ${JSON.stringify(imoview.stats)}`)
      return jsonResponse({ atualizado: false, seco: true, completo, janela, volume, imoview: imoview.stats })
    }

    etapa = 'gravar'
    const { data, error } = await supabase.rpc('carregar_carteira_locacao', { contratos, cobrancas, pagas: pagasEnxutas })
    if (error) throw new Error(`RPC carregar_carteira_locacao: ${error.message}`)

    console.log(`[carteira-locacao] ${volume.contratos} contratos, ${volume.cobrancas} em aberto, ${volume.pagas} pagas (${janela})${doAgendador ? ' · agendador' : ''} · ${JSON.stringify(imoview.stats)}`)
    return jsonResponse({ atualizado: true, completo, janela, volume, imoview: imoview.stats, resultado: data })
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ erro: error.message }, error.status)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[carteira-locacao] erro em "${etapa}":`, msg)
    // 502 quando a culpa é do Imoview, 500 para o resto; a mensagem sempre volta na resposta
    return jsonResponse({ erro: msg, etapa }, error instanceof ImoviewErro ? 502 : 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}
