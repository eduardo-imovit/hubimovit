// Funções puras do Dashboard de Performance. Sem React, sem I/O.

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const LIMIAR_TENDENCIA = 0.1 // ±10%
const FATOR_META = 1.05

// Empreendimentos conhecidos — nome no criativo já indica campanha de venda.
const EMPREENDIMENTOS = ['entreverdes']

// ── 1. Tendência ─────────────────────────────────────────────────────────────

/**
 * Compara dois valores (ex.: última semana × semana anterior).
 * Retorna { arrow, label, class, variacao } com class 'up' | 'down' | 'stable'.
 */
export function calculateTrend(current, previous) {
  const atual = Number(current) || 0
  const anterior = Number(previous) || 0

  if (!anterior) {
    return atual > 0
      ? { arrow: '↑', label: 'novo', class: 'up', variacao: null }
      : { arrow: '→', label: 'estável', class: 'stable', variacao: 0 }
  }

  const variacao = (atual - anterior) / anterior
  const pct = formatNumber(Math.abs(variacao) * 100, 1)

  if (variacao > LIMIAR_TENDENCIA) {
    return { arrow: '↑', label: `+${pct}%`, class: 'up', variacao }
  }
  if (variacao < -LIMIAR_TENDENCIA) {
    return { arrow: '↓', label: `-${pct}%`, class: 'down', variacao }
  }
  return { arrow: '→', label: 'estável', class: 'stable', variacao }
}

// ── 2. Meta dinâmica ─────────────────────────────────────────────────────────

/** Média dos últimos 4 valores × 1.05. Ignora entradas não numéricas. */
export function calculateDynamicMeta(historico4Semanas) {
  const valores = (Array.isArray(historico4Semanas) ? historico4Semanas : [])
    .slice(-4)
    .map(Number)
    .filter((n) => Number.isFinite(n))

  if (valores.length === 0) return 0
  const media = valores.reduce((a, n) => a + n, 0) / valores.length
  return media * FATOR_META
}

// ── 3. Finalidade a partir do nome da campanha ───────────────────────────────

/** Infere 'venda' | 'locacao' | 'institucional' pelo nome da campanha. */
export function inferFinalidade(campanhaNome) {
  const nome = String(campanhaNome || '')
  const lower = nome.toLowerCase()

  if (/loca[çc][aã]o|\bloc\b|\balug/i.test(nome)) return 'locacao'

  if (
    /\bvenda\b|\bvend\b|[àa]\s*venda|a-venda|\blotes?\b|apartament|empreendiment/i.test(nome) ||
    EMPREENDIMENTOS.some((e) => lower.includes(e))
  ) {
    return 'venda'
  }

  return 'institucional'
}

// ── 4. Aplicação de filtros ──────────────────────────────────────────────────

/**
 * Filtra campanhas por canal / etapa / finalidade.
 * `filters` usa o sentinel 'todos' (formato de usePerformanceFilters).
 * Campos aceitos na campanha: canal, bucket|etapa, campanha|campanhaNome|nome.
 */
export function applyFilters(campaigns, filters = {}) {
  const { canal, etapa, finalidade } = filters
  const lista = Array.isArray(campaigns) ? campaigns : []

  return lista.filter((c) => {
    if (canal && canal !== 'todos' && c.canal !== canal) return false

    if (etapa && etapa !== 'todos' && (c.bucket ?? c.etapa) !== etapa) return false

    if (finalidade && finalidade !== 'todos') {
      const nome = c.campanha ?? c.campanhaNome ?? c.nome
      if (inferFinalidade(nome) !== finalidade) return false
    }

    return true
  })
}

// ── 5 e 6. Formatação ────────────────────────────────────────────────────────

/** "R$ 1.234,50" */
export function formatCurrency(value) {
  const n = Number(value)
  return moedaBR.format(Number.isFinite(n) ? n : 0)
}

/** Número com separador de milhar e casas decimais fixas. */
export function formatNumber(value, decimals = 0) {
  const n = Number(value)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)
}
