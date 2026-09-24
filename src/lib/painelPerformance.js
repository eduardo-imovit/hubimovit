// Painel de Performance (docs/01-prd.md §5.0b): a história do dinheiro,
// do investimento em mídia até o negócio. Funções puras.

import { diasEntre, fmtMoeda, fmtNum, fmtPct, limitesMes, mesAnterior, nomeMes, pct, somarDias } from './paineis'
import { resolverPeriodo, rotuloMes } from './painelGestao'

export const CORES_PLATAFORMA = { Meta: '#6A4FB8', Google: '#14907F' }
export const PLATAFORMAS = ['Meta', 'Google']

export const FILTROS_PERF_PADRAO = { periodo: 'mes', plataforma: 'todas', etapa: 'todas', finalidade: 'todas', campanha: 'todas' }

export const ETAPAS_CAMPANHA = { topo: 'Topo (alcance)', mql: 'MQL', lead: 'Lead (conversão)', nao_classificada: 'Não classificada' }
export const FINALIDADES_CAMPANHA = { Venda: 'Venda', Aluguel: 'Locação', Institucional: 'Institucional' }

/** Finalidade pelo nome da campanha (as plataformas não guardam isso). */
export function finalidadeCampanha(nome = '') {
  if (/loca|alug/i.test(nome)) return 'Aluguel'
  if (/venda|casas|compra|entreverdes/i.test(nome)) return 'Venda'
  return 'Institucional'
}

/** Junta Meta e Google num formato só, com etapa (cadastro) e finalidade (nome). */
export function normalizarAnuncios(meta, google, metasCampanhas) {
  const etapaPorNome = new Map()
  for (const m of [...metasCampanhas].sort((a, b) => (a.periodo_inicio ?? '').localeCompare(b.periodo_inicio ?? ''))) {
    if (m.etapa_funil) etapaPorNome.set(m.campanha_nome, m.etapa_funil)
  }
  const conv = (plataforma) => (l) => ({
    plataforma,
    data: l.data,
    campanha: l.campanha ?? 'Sem campanha',
    investimento: Number(l.investimento) || 0,
    impressoes: Number(l.alcance_impressoes) || 0,
    cliques: Number(l.cliques) || 0,
    conversoes: Number(l.leads_conversoes) || 0,
    etapa: etapaPorNome.get(l.campanha) ?? 'nao_classificada',
    finalidade: finalidadeCampanha(l.campanha),
  })
  return [...meta.map(conv('Meta')), ...google.map(conv('Google'))]
}

export function filtrarAnuncios(linhas, f) {
  return linhas.filter(
    (l) =>
      (f.plataforma === 'todas' || l.plataforma === f.plataforma) &&
      (f.etapa === 'todas' || l.etapa === f.etapa) &&
      (f.finalidade === 'todas' || l.finalidade === f.finalidade) &&
      (f.campanha === 'todas' || l.campanha === f.campanha)
  )
}

const noIntervalo = (d, { inicio, fim }) => !!d && d >= inicio && d <= fim

export function somar(linhas) {
  const t = linhas.reduce(
    (s, l) => ({ investimento: s.investimento + l.investimento, impressoes: s.impressoes + l.impressoes, cliques: s.cliques + l.cliques, conversoes: s.conversoes + l.conversoes }),
    { investimento: 0, impressoes: 0, cliques: 0, conversoes: 0 }
  )
  return {
    ...t,
    cpm: t.impressoes > 0 ? (t.investimento / t.impressoes) * 1000 : null,
    ctr: pct(t.cliques, t.impressoes),
    cpc: t.cliques > 0 ? t.investimento / t.cliques : null,
    cpl: t.conversoes > 0 ? t.investimento / t.conversoes : null,
    taxaConversao: pct(t.conversoes, t.cliques),
  }
}

const variacao = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null)

// ---------------------------------------------------------------------------
// Orçamento (metas_campanhas)
// ---------------------------------------------------------------------------

/** Orçamento do mês para as campanhas do recorte; sem cadastro no mês, usa o último mês cadastrado. */
export function orcamentoDoMes(metasCampanhas, mes, filtroCampanha) {
  const doMes = (m) => metasCampanhas.filter((c) => c.periodo_inicio?.slice(0, 7) === m && c.ativo !== false)
  let usado = mes
  let linhas = doMes(mes)
  if (linhas.length === 0) {
    const meses = [...new Set(metasCampanhas.map((c) => c.periodo_inicio?.slice(0, 7)).filter((m) => m && m < mes))].sort()
    usado = meses.at(-1) ?? null
    linhas = usado ? doMes(usado) : []
  }
  const filtradas = linhas.filter((c) => filtroCampanha(c))
  return {
    mesReferencia: usado,
    emprestado: usado != null && usado !== mes,
    total: filtradas.reduce((s, c) => s + Number(c.meta_investimento ?? 0), 0),
    porCampanha: new Map(filtradas.map((c) => [c.campanha_nome, c])),
  }
}

// ---------------------------------------------------------------------------
// 1. Ritmo de gasto
// ---------------------------------------------------------------------------

/**
 * Gasto acumulado dia a dia no mês, a linha do orçamento distribuído por igual
 * e a projeção pelo ritmo dos últimos 30 dias.
 */
export function ritmoGasto(anuncios, orcamento, mes, hoje) {
  const { inicio, fim, dias } = limitesMes(mes)
  const corrente = mes === hoje.slice(0, 7)
  const ultimoDia = corrente ? hoje : fim
  const ult30 = anuncios.filter((l) => noIntervalo(l.data, { inicio: somarDias(hoje, -30), fim: somarDias(hoje, -1) }))
  const porDia = ult30.reduce((s, l) => s + l.investimento, 0) / 30
  const pontos = []
  let acumulado = 0
  let ultimoReal = 0
  for (let d = 0; d < dias; d += 1) {
    const dia = somarDias(inicio, d)
    const noDia = anuncios.filter((l) => l.data === dia).reduce((s, l) => s + l.investimento, 0)
    const temDado = dia <= ultimoDia
    if (temDado) {
      acumulado += noDia
      ultimoReal = acumulado
    }
    pontos.push({
      dia: Number(dia.slice(8, 10)),
      realizado: temDado ? acumulado : null,
      orcamento: orcamento.total > 0 ? (orcamento.total / dias) * (d + 1) : null,
      projecao: corrente && !temDado ? ultimoReal + porDia * (diasEntre(ultimoDia, dia)) : corrente && dia === ultimoDia ? acumulado : null,
    })
  }
  const projecaoFim = corrente ? ultimoReal + porDia * diasEntre(ultimoDia, fim) : ultimoReal
  return { pontos, realizado: ultimoReal, projecaoFim, porDia, corrente, orcamento: orcamento.total, pctOrcamento: pct(projecaoFim, orcamento.total), fimDoMes: fim }
}

// ---------------------------------------------------------------------------
// 2. Atenção: CPM, CTR, CPC por mês e plataforma
// ---------------------------------------------------------------------------

export function serieAtencao(anuncios, hoje, meses = 6) {
  const out = []
  for (let n = meses - 1; n >= 0; n -= 1) {
    const mes = mesAnterior(hoje.slice(0, 7), n)
    const ponto = { mes, rotulo: rotuloMes(mes) }
    for (const p of PLATAFORMAS) {
      const t = somar(anuncios.filter((l) => l.plataforma === p && l.data?.slice(0, 7) === mes))
      ponto[`cpm${p}`] = t.impressoes > 0 ? t.cpm : null
      ponto[`ctr${p}`] = t.impressoes > 0 ? t.ctr : null
      ponto[`cpc${p}`] = t.cliques > 0 ? t.cpc : null
    }
    out.push(ponto)
  }
  return out
}

// ---------------------------------------------------------------------------
// 3. Campanhas
// ---------------------------------------------------------------------------

export function tabelaCampanhas(anuncios, periodo, orcamento) {
  const mapa = new Map()
  for (const l of anuncios.filter((a) => noIntervalo(a.data, periodo))) {
    const k = `${l.plataforma}|${l.campanha}`
    const c = mapa.get(k) ?? { plataforma: l.plataforma, campanha: l.campanha, etapa: l.etapa, finalidade: l.finalidade, linhas: [] }
    c.linhas.push(l)
    mapa.set(k, c)
  }
  return [...mapa.values()]
    .map((c) => {
      const t = somar(c.linhas)
      const meta = orcamento.porCampanha.get(c.campanha)
      const metaCpl = meta?.meta_cpl != null ? Number(meta.meta_cpl) : null
      let status = 'neutro'
      if (metaCpl && t.cpl != null) status = t.cpl <= metaCpl ? 'bom' : t.cpl <= metaCpl * 1.3 ? 'atencao' : 'ruim'
      else if (c.etapa !== 'topo' && t.investimento > 100 && t.conversoes === 0) status = 'ruim'
      return {
        plataforma: c.plataforma,
        campanha: c.campanha,
        etapa: c.etapa,
        finalidade: c.finalidade,
        ...t,
        orcamento: meta ? Number(meta.meta_investimento ?? 0) : null,
        metaCpl,
        metaLeads: meta?.meta_leads ?? null,
        status,
      }
    })
    .filter((c) => c.investimento > 0)
    .sort((a, b) => b.investimento - a.investimento)
}

// ---------------------------------------------------------------------------
// 4. Cascata: do real investido ao negócio
// ---------------------------------------------------------------------------

const chegou = (a, ordem) => (ordem === 7 ? a.fase_ordem >= 7 || a.is_negocio : (a.fase_ordem ?? 0) >= ordem)

export function cascata(totais, basePagos, periodo) {
  const leads = basePagos.filter((a) => noIntervalo(a.data_entrada, periodo))
  const degraus = [
    { chave: 'impressoes', label: 'Impressões', n: totais.impressoes },
    { chave: 'cliques', label: 'Cliques', n: totais.cliques },
    { chave: 'conversoes', label: 'Conversões na plataforma', n: totais.conversoes, nota: 'cliques no WhatsApp e formulários' },
    { chave: 'leads', label: 'Leads pagos no CRM', n: leads.length },
    { chave: 'qualificados', label: 'Qualificados', n: leads.filter((a) => chegou(a, 4)).length },
    { chave: 'visitas', label: 'Visitas', n: leads.filter((a) => chegou(a, 5)).length },
    { chave: 'negocios', label: 'Negócios', n: leads.filter((a) => chegou(a, 7)).length },
  ]
  return degraus.map((d, i) => ({
    ...d,
    taxa: i === 0 ? null : pct(d.n, degraus[i - 1].n),
    anterior: i === 0 ? null : degraus[i - 1].n,
    custo: d.n > 0 ? totais.investimento / d.n : null,
    // impressão custa centavos: mostra por mil (CPM)
    custoTexto: d.chave === 'impressoes' ? (d.n > 0 ? `${fmtMoeda((totais.investimento / d.n) * 1000)} por mil` : null) : null,
  }))
}

// ---------------------------------------------------------------------------
// 5. Onde investir: recomendações
// ---------------------------------------------------------------------------

export function recomendacoes(campanhas, totais) {
  const out = []
  const comMeta = campanhas.filter((c) => c.metaCpl && c.cpl != null && c.investimento >= 100)
  const melhores = comMeta.filter((c) => c.cpl <= c.metaCpl * 0.8).sort((a, b) => a.cpl / a.metaCpl - b.cpl / b.metaCpl)
  const piores = comMeta.filter((c) => c.cpl > c.metaCpl * 1.3).sort((a, b) => b.cpl / b.metaCpl - a.cpl / a.metaCpl)
  for (const c of melhores.slice(0, 2)) {
    out.push({ tipo: 'bom', texto: `Escalar ${c.campanha}: CPL de ${fmtMoeda(c.cpl)}, ${fmtPct((1 - c.cpl / c.metaCpl) * 100, 0)} abaixo da meta (${fmtMoeda(c.metaCpl)}).` })
  }
  for (const c of piores.slice(0, 2)) {
    out.push({ tipo: 'ruim', texto: `Rever ${c.campanha}: CPL de ${fmtMoeda(c.cpl)}, ${fmtPct((c.cpl / c.metaCpl - 1) * 100, 0)} acima da meta (${fmtMoeda(c.metaCpl)}).` })
  }
  const semConversao = campanhas.filter((c) => c.etapa !== 'topo' && c.conversoes === 0 && c.investimento >= 100)
  for (const c of semConversao.slice(0, 2)) out.push({ tipo: 'ruim', texto: `${c.campanha} gastou ${fmtMoeda(c.investimento)} sem nenhuma conversão.` })
  const topo = campanhas.filter((c) => c.etapa === 'topo').reduce((s, c) => s + c.investimento, 0)
  if (totais.investimento > 0 && topo / totais.investimento > 0.3) {
    out.push({ tipo: 'atencao', texto: `${fmtPct((topo / totais.investimento) * 100, 0)} do investimento está em campanhas de topo (alcance), que não geram lead direto. Vale se houver remarketing aproveitando esse público.` })
  }
  const semMeta = campanhas.filter((c) => c.orcamento == null && c.investimento >= 100)
  if (semMeta.length) out.push({ tipo: 'atencao', texto: `${semMeta.length} ${semMeta.length === 1 ? 'campanha gasta' : 'campanhas gastam'} sem orçamento e meta cadastrados: ${semMeta.map((c) => c.campanha).join(', ')}.` })
  return out
}

// ---------------------------------------------------------------------------
// Manchete
// ---------------------------------------------------------------------------

export function manchetePerformance({ ritmo, orcamento, totais, totaisAnt, degraus, periodo }) {
  const frases = []
  if (ritmo.corrente && orcamento.total > 0) {
    const ref = orcamento.emprestado ? ` (referência: orçamento de ${nomeMes(orcamento.mesReferencia)}, o mês atual não tem orçamento cadastrado)` : ''
    frases.push(`No ritmo dos últimos 30 dias (${fmtMoeda(ritmo.porDia)} por dia), o mês fecha com ${fmtMoeda(ritmo.projecaoFim)} investidos, ${fmtPct(ritmo.pctOrcamento, 0)} do orçamento de ${fmtMoeda(orcamento.total)}${ref}.`)
  } else if (orcamento.total > 0) {
    frases.push(`Foram investidos ${fmtMoeda(totais.investimento)} ${periodo.label}, ${fmtPct(pct(totais.investimento, orcamento.total), 0)} do orçamento de ${fmtMoeda(orcamento.total)}.`)
  } else {
    frases.push(`Foram investidos ${fmtMoeda(totais.investimento)} ${periodo.label}.`)
  }
  if (totais.cpl != null) {
    const v = totaisAnt.cpl != null ? variacao(totais.cpl, totaisAnt.cpl) : null
    const lado = v == null || Math.abs(v) < 5 ? 'estável' : v < 0 ? `${fmtPct(Math.abs(v), 0)} mais barato que no período anterior` : `${fmtPct(v, 0)} mais caro que no período anterior`
    frases.push(`Cada conversão na plataforma custou ${fmtMoeda(totais.cpl)} (${lado}).`)
  }
  const conv = degraus.find((d) => d.chave === 'conversoes')
  const leads = degraus.find((d) => d.chave === 'leads')
  if (conv?.n > 0) {
    frases.push(`Mas só ${fmtNum(leads.n)} das ${fmtNum(conv.n)} conversões (${fmtPct(pct(leads.n, conv.n), 0)}) chegaram ao CRM como lead de campanha paga, o que dá ${fmtMoeda(leads.custo)} por lead. Parte dessa perda é atribuição: leads de anúncio que passam pelo bot entram no CRM como “WhatsApp”.`)
  }
  return frases
}

export { resolverPeriodo, variacao }
