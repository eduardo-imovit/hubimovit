import { useEffect, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'
import { hojeISO } from '../lib/dateUtils'
import { inferFinalidade } from '../utils/performanceCalculations'

/**
 * Dados agregados do Dashboard de Performance.
 *
 * Params: { startDate, endDate, canal, etapa, finalidade, janelaDias }
 *   - startDate / endDate  ISO (YYYY-MM-DD). endDate é a data de referência (fim da janela);
 *                          default = hoje (America/Sao_Paulo). startDate só é usado no modo
 *                          personalizado / rótulo — para os presets a janela é derivada de janelaDias.
 *   - canal                'google' | 'meta' | undefined  (filtra ads e metas)
 *   - etapa                'topo' | 'mql'/'meio' | 'lead'/'fundo' | undefined
 *   - finalidade           'venda' | 'locacao' | 'institucional' | undefined
 *                          Campanhas são classificadas pelo nome (inferFinalidade); o CRM usa
 *                          Venda/Aluguel (institucional não tem correspondente → funil zera).
 *   - janelaDias           7 (semana) | 30 (mês) | 90 (trimestre) | span do intervalo custom. Default 7.
 *
 * "Período atual" = últimos `janelaDias` até endDate. "Período anterior" = os `janelaDias`
 * imediatamente antes. Meta por campanha = média das últimas N janelas com veiculação × 1,05
 * (N = 4 p/ semana, 3 p/ mês, 2 p/ trimestre).
 *
 * Retorno: { loading, error, data: {
 *   periodo: { inicio, fim }, janela: { dias, unidade, unidadeAnterior },
 *   cards: { investimento, alcance, leads, conversoes },
 *   campanhasPorFunil: { topo: [], meio: [], fundo: [] },
 *   funilCRM: { emAtendimento, negocioFechado, descartado },
 *   ultimaAtualizacao
 * } }
 *
 * Cada item de campanhasPorFunil traz: campanha, canal, bucket, realizadoUltimaSemana,
 * realizadoSemanaAnterior, metaSemanal, percentualAtingido, tendencia, metaCadastrada.
 * (nomes "…Semana" mantidos por compatibilidade — representam a janela selecionada)
 */

// ── Constantes ───────────────────────────────────────────────────────────────

const SITUACOES_CRM = ['Em atendimento', 'Negócio realizado', 'Descartado']

const ETAPA_PARA_BUCKET = { topo: 'topo', mql: 'meio', lead: 'fundo' }
const FILTRO_ETAPA_PARA_BUCKET = { topo: 'topo', mql: 'meio', meio: 'meio', lead: 'fundo', fundo: 'fundo' }
const FINALIDADE_CRM = { venda: 'Venda', locacao: 'Aluguel' }

const LIMIAR_TENDENCIA = 5 // % de variação a partir do qual deixa de ser "estável"
const FATOR_META = 1.05
const MAX_DIAS_HISTORICO = 400

const UNIDADE_JANELA = { 7: 'semana', 30: 'mês', 90: 'trimestre' }
const UNIDADE_ANTERIOR = { semana: 'semana anterior', mês: 'mês anterior', trimestre: 'trimestre anterior', período: 'período anterior' }

/** Quantas janelas anteriores entram na média da meta. */
function janelasBaseline(janelaDias) {
  if (janelaDias <= 7) return 4
  if (janelaDias <= 31) return 3
  return 2
}

// ── Helpers de data ──────────────────────────────────────────────────────────

function isoMenosDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - dias)
  return d.toLocaleDateString('en-CA')
}

function dentroDoIntervalo(dataISO, iniISO, fimISO) {
  return dataISO >= iniISO && dataISO <= fimISO
}

/**
 * `quantidade` janelas de `janelaDias` terminando em fimISO, sem sobreposição:
 * i=0 → [fim-(j-1) .. fim] ; i=1 → [fim-(2j-1) .. fim-j] ; ...
 */
function janelasPeriodo(fimISO, janelaDias, quantidade) {
  const janelas = []
  for (let i = 0; i < quantidade; i++) {
    janelas.push({
      inicio: isoMenosDias(fimISO, janelaDias * (i + 1) - 1),
      fim: isoMenosDias(fimISO, janelaDias * i),
    })
  }
  return janelas
}

// ── Helpers de agregação de ads ──────────────────────────────────────────────

/**
 * Uma linha por (campanha, data). Os workflows n8n reinserem o mesmo dia a cada
 * execução, então em duplicatas vence a de MAX(investimento).
 */
function dedupPorCampanhaData(linhas) {
  const porChave = new Map()
  for (const l of linhas) {
    const chave = `${l.campanha}|${l.data}`
    const atual = porChave.get(chave)
    if (!atual || (l.investimento ?? 0) > (atual.investimento ?? 0)) porChave.set(chave, l)
  }
  return [...porChave.values()]
}

function somar(linhas) {
  return linhas.reduce(
    (acc, l) => ({
      investimento: acc.investimento + (l.investimento ?? 0),
      alcance: acc.alcance + (l.alcance_impressoes ?? 0),
      cliques: acc.cliques + (l.cliques ?? 0),
      leads: acc.leads + (l.leads_conversoes ?? 0),
    }),
    { investimento: 0, alcance: 0, cliques: 0, leads: 0 },
  )
}

function somarNoIntervalo(linhas, iniISO, fimISO) {
  return somar(linhas.filter((l) => dentroDoIntervalo(l.data, iniISO, fimISO)))
}

function classificarTendencia(atual, anterior) {
  let variacao
  if (anterior === 0) variacao = atual > 0 ? 100 : 0
  else variacao = ((atual - anterior) / anterior) * 100

  let direcao = 'estavel'
  if (variacao > LIMIAR_TENDENCIA) direcao = 'alta'
  else if (variacao < -LIMIAR_TENDENCIA) direcao = 'queda'

  return { direcao, variacaoPercentual: Number(variacao.toFixed(1)) }
}

/** Realizado nas 2 últimas janelas, meta (média das janelas baseline × 1.05) e tendência. */
function resumoCampanha(nome, linhasDaCampanha, fimISO, janelaDias, nBaseline, metaCadastrada, bucket) {
  const [atual, anterior] = janelasPeriodo(fimISO, janelaDias, 2)
  const realizadoUltimaSemana = somarNoIntervalo(linhasDaCampanha, atual.inicio, atual.fim)
  const realizadoSemanaAnterior = somarNoIntervalo(linhasDaCampanha, anterior.inicio, anterior.fim)

  // Média só das janelas que tiveram veiculação
  const historico = janelasPeriodo(fimISO, janelaDias, nBaseline)
    .map((j) => somarNoIntervalo(linhasDaCampanha, j.inicio, j.fim))
    .filter((s) => s.investimento > 0 || s.leads > 0)

  const totalHistorico = historico.reduce(
    (a, s) => ({ investimento: a.investimento + s.investimento, leads: a.leads + s.leads }),
    { investimento: 0, leads: 0 },
  )
  const metaSemanal = {
    investimento: historico.length ? (totalHistorico.investimento / historico.length) * FATOR_META : 0,
    leads: historico.length ? (totalHistorico.leads / historico.length) * FATOR_META : 0,
  }

  const percentualAtingido =
    metaSemanal.leads > 0
      ? Number(((realizadoUltimaSemana.leads / metaSemanal.leads) * 100).toFixed(1))
      : null

  return {
    campanha: nome,
    canal: linhasDaCampanha[0]?.canal ?? null,
    bucket,
    realizadoUltimaSemana,
    realizadoSemanaAnterior,
    metaSemanal,
    percentualAtingido,
    tendencia: classificarTendencia(realizadoUltimaSemana.leads, realizadoSemanaAnterior.leads),
    metaCadastrada: metaCadastrada ?? null,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePerformanceDashboard({ startDate, endDate, canal, etapa, finalidade, janelaDias } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    const janela = Number(janelaDias) > 0 ? Math.round(Number(janelaDias)) : 7
    const nBaseline = janelasBaseline(janela)
    const diasHistorico = Math.min(janela * (nBaseline + 1), MAX_DIAS_HISTORICO)

    const fim = endDate || hojeISO()
    const inicio = startDate || isoMenosDias(fim, janela - 1)
    const inicioHistorico = isoMenosDias(fim, diasHistorico - 1)

    const querGoogle = !canal || canal === 'google'
    const querMeta = !canal || canal === 'meta'
    const finalidadeCRM = finalidade ? FINALIDADE_CRM[finalidade] : undefined

    const buscarAds = (tabela) =>
      fetchTodasLinhas(() =>
        supabase
          .from(tabela)
          .select('data, campanha, investimento, alcance_impressoes, cliques, leads_conversoes')
          .gte('data', inicioHistorico)
          .lte('data', fim),
      )

    let metasQuery = supabase.from('metas_campanhas').select('*').eq('status', 'ativa')
    if (canal) metasQuery = metasQuery.eq('canal', canal)

    Promise.all([
      querGoogle ? buscarAds('dashboard_google_ads') : Promise.resolve([]),
      querMeta ? buscarAds('dashboard_meta_ads') : Promise.resolve([]),
      metasQuery,
      fetchTodasLinhas(() =>
        supabase
          .from('dashboard_atendimentos_crm')
          .select('situacao, finalidade, data_de_entrada, data_fechamento, campanha, funil')
          .in('situacao', SITUACOES_CRM),
      ),
    ])
      .then(([googleRaw, metaRaw, metasRes, crmRaw]) => {
        if (!ativo) return
        if (metasRes.error) throw metasRes.error

        // 1. Dedup + origem
        const google = dedupPorCampanhaData(googleRaw).map((l) => ({ ...l, canal: 'google' }))
        const meta = dedupPorCampanhaData(metaRaw).map((l) => ({ ...l, canal: 'meta' }))
        let ads = [...google, ...meta]

        // 2. Filtro de finalidade (classificada pelo nome da campanha)
        if (finalidade) ads = ads.filter((l) => inferFinalidade(l.campanha) === finalidade)

        // 3. Classificação por etapa (metas ativas, match por nome)
        const metaPorCampanha = new Map()
        const bucketPorCampanha = new Map()
        for (const m of metasRes.data ?? []) {
          metaPorCampanha.set(m.campanha_nome, m)
          const bucket = ETAPA_PARA_BUCKET[m.etapa_funil]
          if (bucket) bucketPorCampanha.set(m.campanha_nome, bucket)
        }

        const bucketAlvo = etapa ? FILTRO_ETAPA_PARA_BUCKET[etapa] ?? null : null

        // 4. Cards — soma do período atual nas campanhas visíveis
        const [janelaAtual] = janelasPeriodo(fim, janela, 1)
        let adsPeriodoAtual = ads.filter((l) => dentroDoIntervalo(l.data, janelaAtual.inicio, janelaAtual.fim))
        if (bucketAlvo) {
          adsPeriodoAtual = adsPeriodoAtual.filter((l) => bucketPorCampanha.get(l.campanha) === bucketAlvo)
        }
        const somaCards = somar(adsPeriodoAtual)

        // 5. Campanhas por bucket (ignora as sem atividade nas janelas analisadas)
        const campanhasPorFunil = { topo: [], meio: [], fundo: [] }
        for (const nome of new Set(ads.map((l) => l.campanha))) {
          const bucket = bucketPorCampanha.get(nome)
          if (!bucket) continue
          if (bucketAlvo && bucket !== bucketAlvo) continue
          const linhasDaCampanha = ads.filter((l) => l.campanha === nome)
          const resumo = resumoCampanha(nome, linhasDaCampanha, fim, janela, nBaseline, metaPorCampanha.get(nome), bucket)
          const semAtividade =
            resumo.realizadoUltimaSemana.investimento === 0 &&
            resumo.realizadoUltimaSemana.leads === 0 &&
            resumo.realizadoSemanaAnterior.investimento === 0 &&
            resumo.realizadoSemanaAnterior.leads === 0 &&
            resumo.metaSemanal.leads === 0 &&
            resumo.metaSemanal.investimento === 0
          if (semAtividade) continue
          campanhasPorFunil[bucket].push(resumo)
        }
        for (const bucket of Object.keys(campanhasPorFunil)) {
          campanhasPorFunil[bucket].sort(
            (a, b) => b.realizadoUltimaSemana.investimento - a.realizadoUltimaSemana.investimento,
          )
        }

        // 6. Funil do CRM — por data de entrada no período (filtra finalidade)
        const crmNoPeriodo = (crmRaw ?? []).filter((a) => {
          if (finalidade && a.finalidade !== finalidadeCRM) return false
          const ref = a.data_de_entrada ? a.data_de_entrada.slice(0, 10) : null
          return ref && dentroDoIntervalo(ref, inicio, fim)
        })
        const funilCRM = {
          emAtendimento: crmNoPeriodo.filter((a) => a.situacao === 'Em atendimento').length,
          negocioFechado: crmNoPeriodo.filter((a) => a.situacao === 'Negócio realizado').length,
          descartado: crmNoPeriodo.filter((a) => a.situacao === 'Descartado').length,
        }

        // Conversões do card: negócios fechados (por data_fechamento) no período atual
        const conversoesPeriodo = (crmRaw ?? []).filter((a) => {
          if (finalidade && a.finalidade !== finalidadeCRM) return false
          if (a.situacao !== 'Negócio realizado') return false
          const ref = a.data_fechamento ? a.data_fechamento.slice(0, 10) : null
          return ref && dentroDoIntervalo(ref, janelaAtual.inicio, janelaAtual.fim)
        }).length

        const unidade = UNIDADE_JANELA[janela] ?? 'período'

        setData({
          periodo: { inicio, fim },
          janela: { dias: janela, unidade, unidadeAnterior: UNIDADE_ANTERIOR[unidade] },
          cards: {
            investimento: Number(somaCards.investimento.toFixed(2)),
            alcance: somaCards.alcance,
            leads: somaCards.leads,
            conversoes: conversoesPeriodo,
          },
          campanhasPorFunil,
          funilCRM,
          ultimaAtualizacao: new Date().toISOString(),
        })
      })
      .catch((e) => {
        if (ativo) setError(e?.message ?? String(e))
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [startDate, endDate, canal, etapa, finalidade, janelaDias])

  return { loading, error, data }
}
