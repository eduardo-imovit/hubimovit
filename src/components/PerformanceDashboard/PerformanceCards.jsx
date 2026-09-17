import { calculateTrend, formatCurrency, formatNumber } from '../../utils/performanceCalculations'

// Grid de 4 cards do topo do Dashboard de Performance.
// Props: { data } — objeto retornado por usePerformanceDashboard (data.cards, data.campanhasPorFunil).
//
// data.cards traz só os números realizados. Meta semanal e semana anterior são
// agregadas aqui a partir de data.campanhasPorFunil (metaSemanal / realizadoSemanaAnterior).
// Alcance e Conversões CRM não têm meta no hook → o card mostra só o realizado + tendência.

const CANAL_LABEL = { google: 'Google', meta: 'Meta' }
const META_ATINGIDA = 90 // % a partir do qual a meta conta como atingida

function achatarCampanhas(data) {
  const f = data?.campanhasPorFunil ?? {}
  return [...(f.topo ?? []), ...(f.meio ?? []), ...(f.fundo ?? [])]
}

function soma(lista, acessar) {
  return lista.reduce((acc, item) => acc + (Number(acessar(item)) || 0), 0)
}

function corTrend(trendClass) {
  if (trendClass === 'up') return 'text-green-600'
  if (trendClass === 'down') return 'text-red-600'
  return 'text-slate-400'
}

function construirCards(data) {
  const cards = data.cards ?? {}
  const campanhas = achatarCampanhas(data)
  const metaPrefixo = `Meta / ${data.janela?.unidade ?? 'período'}`

  const metaInvestimento = soma(campanhas, (c) => c.metaSemanal?.investimento)
  const metaLeads = soma(campanhas, (c) => c.metaSemanal?.leads)
  const anteriorInvestimento = soma(campanhas, (c) => c.realizadoSemanaAnterior?.investimento)
  const anteriorAlcance = soma(campanhas, (c) => c.realizadoSemanaAnterior?.alcance)
  const anteriorLeads = soma(campanhas, (c) => c.realizadoSemanaAnterior?.leads)

  const canais = [...new Set(campanhas.map((c) => c.canal).filter(Boolean))]
  const canaisLabel = canais.length ? canais.map((c) => CANAL_LABEL[c] ?? c).join(' + ') : 'Google + Meta'

  return [
    {
      chave: 'investimento',
      label: '💰 Investimento Total',
      valor: formatCurrency(cards.investimento ?? 0),
      unidade: 'realizado',
      metaPrefixo,
      metaLabel: metaInvestimento > 0 ? formatCurrency(metaInvestimento) : null,
      atingido: metaInvestimento > 0 ? ((cards.investimento ?? 0) / metaInvestimento) * 100 : null,
      trend: anteriorInvestimento > 0 ? calculateTrend(cards.investimento ?? 0, anteriorInvestimento) : null,
      metadado: canaisLabel,
    },
    {
      chave: 'alcance',
      label: '📣 Alcance Total',
      valor: formatNumber(cards.alcance ?? 0),
      unidade: 'impressões',
      metaPrefixo,
      metaLabel: null,
      atingido: null,
      trend: anteriorAlcance > 0 ? calculateTrend(cards.alcance ?? 0, anteriorAlcance) : null,
      metadado: canaisLabel,
    },
    {
      chave: 'leads',
      label: '🎯 Leads Gerados',
      valor: formatNumber(cards.leads ?? 0),
      unidade: 'leads',
      metaPrefixo,
      metaLabel: metaLeads > 0 ? formatNumber(metaLeads, 1) : null,
      atingido: metaLeads > 0 ? ((cards.leads ?? 0) / metaLeads) * 100 : null,
      trend: anteriorLeads > 0 ? calculateTrend(cards.leads ?? 0, anteriorLeads) : null,
      metadado: canaisLabel,
    },
    {
      chave: 'conversoes',
      label: '🤝 Conversões CRM',
      valor: formatNumber(cards.conversoes ?? 0),
      unidade: 'negócios fechados',
      metaPrefixo,
      metaLabel: null,
      atingido: null,
      trend: null,
      metadado: 'CRM Imoview',
    },
  ]
}

function Card({ card }) {
  const atingiu = card.atingido != null && card.atingido >= META_ATINGIDA
  const corAtingido = atingiu ? 'text-accent-600' : 'text-danger-600'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-600">{card.label}</div>

      <div className="text-2xl font-semibold leading-tight text-slate-900">{card.valor}</div>
      <div className="text-xs text-slate-400">{card.unidade}</div>

      <div className="text-xs text-slate-500">
        {card.metaLabel != null ? (
          <>
            {card.metaPrefixo}: {card.metaLabel} <span className="text-slate-300">|</span>{' '}
            Atingido: <span className={`font-semibold ${corAtingido}`}>{formatNumber(card.atingido, 1)}%</span>
          </>
        ) : (
          <span className="text-slate-400">Sem meta cadastrada</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        {card.trend ? (
          <span className={`font-medium ${corTrend(card.trend.class)}`}>
            {card.trend.arrow} {card.trend.label}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
        <span className="text-slate-400">{card.metadado}</span>
      </div>
    </div>
  )
}

export default function PerformanceCards({ data }) {
  if (!data?.cards) return null

  const cards = construirCards(data)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.chave} card={card} />
      ))}
    </div>
  )
}
