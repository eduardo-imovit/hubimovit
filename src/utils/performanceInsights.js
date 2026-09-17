import { formatCurrency, formatNumber } from './performanceCalculations'

// Derivações do Dashboard de Performance sobre o objeto `data` de usePerformanceDashboard.
// Fica separado de performanceCalculations.js (funções sobre valores soltos) e dos
// componentes (para não quebrar o fast-refresh com export misto).

/** Achata data.campanhasPorFunil ({topo,meio,fundo}) numa lista só. */
export function todasCampanhas(data) {
  const f = data?.campanhasPorFunil ?? {}
  return [...(f.topo ?? []), ...(f.meio ?? []), ...(f.fundo ?? [])]
}

export function soma(lista, acessar) {
  return lista.reduce((acc, item) => acc + (Number(acessar(item)) || 0), 0)
}

/** num / den, ou null se den não for positivo. */
export function razao(num, den) {
  return Number(den) > 0 ? Number(num) / Number(den) : null
}

/** Variação percentual atual × anterior, ou null sem base. */
export function variacaoPct(atual, anterior) {
  return Number(anterior) > 0 ? ((Number(atual) - anterior) / anterior) * 100 : null
}

function juntar(partes) {
  return partes.filter(Boolean).join(' ')
}

// ── Regra 1 — Queda crítica ─────────────────────────────────────────────────

function regraQuedaCritica(campanhas) {
  const alertas = []
  for (const c of campanhas) {
    const meta = c.metaSemanal?.leads ?? 0
    if (meta <= 0) continue

    const pctAtual = c.percentualAtingido ?? ((c.realizadoUltimaSemana?.leads ?? 0) / meta) * 100
    const pctAnterior = ((c.realizadoSemanaAnterior?.leads ?? 0) / meta) * 100
    if (pctAtual >= 50 || pctAnterior >= 50) continue

    const cpcVar = variacaoPct(
      razao(c.realizadoUltimaSemana?.investimento, c.realizadoUltimaSemana?.cliques),
      razao(c.realizadoSemanaAnterior?.investimento, c.realizadoSemanaAnterior?.cliques),
    )
    const convAtual = razao(c.realizadoUltimaSemana?.leads, c.realizadoUltimaSemana?.cliques)
    const convAnterior = razao(c.realizadoSemanaAnterior?.leads, c.realizadoSemanaAnterior?.cliques)

    alertas.push({
      chave: `queda-${c.campanha}`,
      tom: 'danger',
      emoji: '❌',
      titulo: `${c.campanha} em queda — investimento alto sem ROI`,
      descricao: juntar([
        cpcVar != null && cpcVar > 0 ? `CPC subiu ${formatNumber(cpcVar, 0)}%.` : null,
        convAtual != null && convAnterior != null
          ? `Taxa de conversão caiu de ${formatNumber(convAnterior * 100, 1)}% para ${formatNumber(convAtual * 100, 1)}%.`
          : null,
        `Investimento de ${formatCurrency(c.realizadoUltimaSemana?.investimento ?? 0)} no período entregando só ${formatNumber(pctAtual, 0)}% da meta (período anterior: ${formatNumber(pctAnterior, 0)}%).`,
      ]),
      acao: 'Pausar ou revisar segmentação e criativos; realocar a verba para campanhas acima da meta.',
    })
  }
  return alertas
}

// ── Regra 2 — Over-performer ────────────────────────────────────────────────

function regraOverPerformer(campanhas) {
  const cpls = campanhas
    .map((c) => razao(c.realizadoUltimaSemana?.investimento, c.realizadoUltimaSemana?.leads))
    .filter((v) => v != null)
  const cplMedio = cpls.length ? cpls.reduce((a, v) => a + v, 0) / cpls.length : null
  const invMedio = campanhas.length
    ? soma(campanhas, (c) => c.realizadoUltimaSemana?.investimento) / campanhas.length
    : 0

  const alertas = []
  for (const c of campanhas) {
    if ((c.percentualAtingido ?? 0) <= 200) continue

    const leads = c.realizadoUltimaSemana?.leads ?? 0
    const inv = c.realizadoUltimaSemana?.investimento ?? 0
    const cpl = razao(inv, leads)
    const cplDelta = cplMedio != null && cpl != null && cplMedio > 0 ? ((cplMedio - cpl) / cplMedio) * 100 : null

    alertas.push({
      chave: `over-${c.campanha}`,
      tom: 'oportunidade',
      emoji: '💡',
      titulo: `${c.campanha} over-performing`,
      descricao: juntar([
        `${inv < invMedio ? 'Com orçamento abaixo da média, a campanha' : 'A campanha'} gerou ${formatNumber(leads)} leads — ${formatNumber(c.percentualAtingido, 0)}% da meta.`,
        cplDelta != null && cplDelta > 0
          ? `CPL ${formatNumber(cplDelta, 0)}% abaixo da média (${formatCurrency(cpl)} vs ${formatCurrency(cplMedio)}).`
          : cpl != null
            ? `CPL de ${formatCurrency(cpl)}.`
            : null,
      ]),
      acao: 'Aumentar o orçamento enquanto o CPL se mantém baixo e testar públicos semelhantes.',
    })
  }
  return alertas
}

// ── Regra 3 — Conversão acelerada ──────────────────────────────────────────

function regraConversaoAcelerada(data, campanhas) {
  const crm = data.funilCRM ?? {}
  const totalCRM = (crm.emAtendimento ?? 0) + (crm.negocioFechado ?? 0) + (crm.descartado ?? 0)
  const taxaConv = totalCRM > 0 ? ((crm.negocioFechado ?? 0) / totalCRM) * 100 : 0

  const crescLeads = variacaoPct(
    soma(campanhas, (c) => c.realizadoUltimaSemana?.leads),
    soma(campanhas, (c) => c.realizadoSemanaAnterior?.leads),
  )

  const taxaAlta = taxaConv > 12
  const cresceuRapido = crescLeads != null && crescLeads > 15
  if (!taxaAlta && !cresceuRapido) return []

  return [
    {
      chave: 'conversao-crm',
      tom: 'positivo',
      emoji: '🔄',
      titulo: 'Conversão no CRM acelerou',
      descricao: juntar([
        taxaAlta
          ? `Taxa de conversão em negócio em ${formatNumber(taxaConv, 1)}% (${formatNumber(crm.negocioFechado ?? 0)} de ${formatNumber(totalCRM)} atendimentos).`
          : null,
        cresceuRapido ? `Volume de leads ${formatNumber(crescLeads, 0)}% acima do período anterior.` : null,
      ]),
      acao: 'Reforçar verba no fundo de funil e garantir o SLA de primeiro atendimento para aproveitar o pico.',
    },
  ]
}

/** Lista de alertas ({ chave, tom, emoji, titulo, descricao, acao }) a partir de `data`. */
export function detectarAnomalias(data) {
  const campanhas = todasCampanhas(data)
  return [
    ...regraQuedaCritica(campanhas),
    ...regraOverPerformer(campanhas),
    ...regraConversaoAcelerada(data, campanhas),
  ]
}
