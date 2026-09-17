import { calculateTrend, formatCurrency, formatNumber } from '../../utils/performanceCalculations'

// Resumo executivo do Dashboard de Performance: headline + subheadline + 4 insight cards.
// Props: { data, filters } — data vem de usePerformanceDashboard, filters de usePerformanceFilters.
// Tudo é derivado de data.campanhasPorFunil / data.cards — nada hardcoded.

const META_OK = 90 // % da meta a partir do qual a campanha "bateu"
const META_CRITICA = 70 // % abaixo do qual a campanha "precisa de ação"

const BUCKETS = [
  ['topo', 'Topo'],
  ['meio', 'Meio'],
  ['fundo', 'Fundo'],
]

function todasCampanhas(data) {
  const f = data?.campanhasPorFunil ?? {}
  return [...(f.topo ?? []), ...(f.meio ?? []), ...(f.fundo ?? [])]
}

function soma(lista, acessar) {
  return lista.reduce((acc, item) => acc + (Number(acessar(item)) || 0), 0)
}

function plural(n, singular, pluralWord) {
  return n === 1 ? singular : pluralWord
}

function listarCampanhas(campanhas, limite = 3) {
  return campanhas
    .slice(0, limite)
    .map((c) => `${c.campanha} (${formatNumber(c.percentualAtingido, 0)}%)`)
    .join(' · ')
}

function construirResumo(data) {
  const campanhas = todasCampanhas(data)
  const comMeta = campanhas.filter((c) => c.percentualAtingido != null)

  const unidade = data.janela?.unidade ?? 'período'
  const unidadeAnterior = data.janela?.unidadeAnterior ?? 'período anterior'
  const Unidade = unidade.charAt(0).toUpperCase() + unidade.slice(1)

  const bateram = comMeta
    .filter((c) => c.percentualAtingido >= META_OK)
    .sort((a, b) => b.percentualAtingido - a.percentualAtingido)
  const criticas = comMeta
    .filter((c) => c.percentualAtingido < META_CRITICA)
    .sort((a, b) => a.percentualAtingido - b.percentualAtingido)
  const melhor = [...comMeta].sort((a, b) => b.percentualAtingido - a.percentualAtingido)[0] ?? null
  const oportunidade = melhor && melhor.percentualAtingido > 100 ? melhor : null

  const emAlta = campanhas.filter((c) => c.tendencia?.direcao === 'alta').length
  const emQueda = campanhas.filter((c) => c.tendencia?.direcao === 'queda').length

  const leadsUltima = soma(campanhas, (c) => c.realizadoUltimaSemana?.leads)
  const leadsAnterior = soma(campanhas, (c) => c.realizadoSemanaAnterior?.leads)
  const trendLeads = calculateTrend(leadsUltima, leadsAnterior)

  // Crescimento por etapa do funil (por leads da última × semana anterior)
  const etapasComDados = BUCKETS.filter(([k]) => (data.campanhasPorFunil?.[k] ?? []).length > 0)
  const etapasCresceram = etapasComDados.filter(([k]) => {
    const arr = data.campanhasPorFunil[k]
    return (
      soma(arr, (c) => c.realizadoUltimaSemana?.leads) > soma(arr, (c) => c.realizadoSemanaAnterior?.leads)
    )
  })

  const metaGlobalInvestimento = soma(campanhas, (c) => c.metaSemanal?.investimento)
  const realizadoInvestimento = data.cards?.investimento ?? 0

  // ── Headline ──────────────────────────────────────────────────────────────
  let headline
  if (comMeta.length === 0) {
    headline = '📊 Nenhuma meta cadastrada para as campanhas do período'
  } else if (bateram.length === 0) {
    headline = `⚠️ ${Unidade} abaixo da meta — nenhuma campanha bateu o alvo`
  } else {
    const ratio = bateram.length / comMeta.length
    const forca =
      ratio >= 0.6 ? { emoji: '🎯', adj: 'forte' } : ratio >= 0.3 ? { emoji: '📊', adj: 'mista' } : { emoji: '⚠️', adj: 'fraca' }
    headline = `${forca.emoji} ${Unidade} ${forca.adj} com ${bateram.length} ${plural(bateram.length, 'campanha', 'campanhas')} acima da meta`
  }

  // ── Subheadline ───────────────────────────────────────────────────────────
  let etapasTexto
  if (etapasComDados.length === 0) {
    etapasTexto = 'Sem campanhas classificadas por etapa no período.'
  } else if (etapasCresceram.length === etapasComDados.length) {
    etapasTexto = `Todas as etapas do funil cresceram vs. ${unidadeAnterior}.`
  } else if (etapasCresceram.length === 0) {
    etapasTexto = `Todas as etapas do funil recuaram vs. ${unidadeAnterior}.`
  } else {
    etapasTexto = `${etapasCresceram.length} de ${etapasComDados.length} etapas do funil cresceram vs. ${unidadeAnterior}.`
  }
  const subheadline = `${etapasTexto} Meta global: ${formatCurrency(metaGlobalInvestimento)} | Realizado: ${formatCurrency(realizadoInvestimento)}.`

  // ── Insight cards ─────────────────────────────────────────────────────────
  const insights = [
    {
      chave: 'bateram',
      emoji: '✅',
      label: bateram.length
        ? `${bateram.length} ${plural(bateram.length, 'campanha bateu', 'campanhas bateram')} a meta`
        : 'Campanhas que bateram meta',
      texto: bateram.length
        ? listarCampanhas(bateram)
        : 'Nenhuma campanha atingiu 90% da meta no período.',
    },
    {
      chave: 'acao',
      emoji: '⚠️',
      label: criticas.length
        ? `${criticas.length} ${plural(criticas.length, 'campanha precisa', 'campanhas precisam')} de ação`
        : 'Campanhas que precisam de ação',
      texto:
        comMeta.length === 0
          ? 'Sem metas cadastradas para avaliar.'
          : criticas.length
            ? listarCampanhas(criticas)
            : 'Nenhuma campanha abaixo de 70% da meta.',
    },
    {
      chave: 'oportunidade',
      emoji: '💡',
      label: 'Oportunidade identificada',
      texto: oportunidade
        ? `${oportunidade.campanha} está a ${formatNumber(oportunidade.percentualAtingido, 0)}% da meta` +
          `${oportunidade.tendencia?.direcao === 'alta' ? ' e em tendência de alta' : ''} — avalie aumentar o investimento.`
        : 'Nenhuma campanha com folga clara para escalar agora.',
    },
    {
      chave: 'tendencia',
      emoji: '📈',
      label: 'Tendência do período',
      texto: leadsAnterior
        ? `Volume de leads ${trendLeads.arrow} ${trendLeads.label} vs. ${unidadeAnterior} — ` +
          `${emAlta} em alta, ${emQueda} em queda.`
        : `${formatNumber(leadsUltima)} leads no período (sem base do ${unidadeAnterior} para comparar).`,
    },
  ]

  return { headline, subheadline, insights }
}

function contextoFiltros(data, filters) {
  return [
    data.periodo ? `${data.periodo.inicio} a ${data.periodo.fim}` : null,
    filters?.canal && filters.canal !== 'todos' ? `Canal: ${filters.canal}` : null,
    filters?.etapa && filters.etapa !== 'todos' ? `Etapa: ${filters.etapa}` : null,
    filters?.finalidade && filters.finalidade !== 'todos' ? `Finalidade: ${filters.finalidade}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function InsightCard({ insight }) {
  return (
    <div className="flex flex-col gap-1 rounded-r-md border-l-4 border-accent-600 bg-surface-1 p-3">
      <div className="text-sm font-medium text-slate-700">
        {insight.emoji} {insight.label}
      </div>
      <div className="text-xs leading-relaxed text-slate-500">{insight.texto}</div>
    </div>
  )
}

export default function ExecutiveSummary({ data, filters }) {
  if (!data) return null

  const { headline, subheadline, insights } = construirResumo(data)
  const contexto = contextoFiltros(data, filters)

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{headline}</h2>
        <p className="mt-1 text-sm text-slate-600">{subheadline}</p>
        {contexto && <p className="mt-1 text-xs text-slate-400">{contexto}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight) => (
          <InsightCard key={insight.chave} insight={insight} />
        ))}
      </div>
    </section>
  )
}
