// Painel da Gestão (docs/01-prd.md §5.0): a história em cascata.
// Funções puras sobre as linhas já carregadas; cada capítulo devolve os números
// e a frase de conclusão que vira o título.

import {
  diasEntre,
  ETAPAS,
  fmtNum,
  fmtPct,
  INICIO_HISTORICO_CONFIAVEL,
  isoLocal,
  limitesMes,
  mediana,
  mesAnterior,
  nomeMes,
  pct,
  safraMadura,
  somarDias,
  STATUS_PROPOSTA_CONCLUIDA,
} from './paineis'

export const CORES = { Venda: '#E8593C', Aluguel: '#2F6DB5', contexto: '#B8B5B0', projecao: '#E4DFD4' }
/** Número com exatamente uma casa decimal (3,9). */
export const fmtDecimal = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

/** A view grava alguns canais sem acento; nome para exibir. */
const NOMES_CANAL = { Indicacao: 'Indicação', 'Nao identificado': 'Não identificado', 'Captacao (interno)': 'Captação (interno)' }
export const nomeCanal = (c) => NOMES_CANAL[c] ?? c

export const LABEL_FINALIDADE = { Venda: 'Venda', Aluguel: 'Locação' }

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export const FILTROS_PADRAO = { periodo: 'mes', finalidade: 'todas', canal: 'todos', corretor: 'todos' }
/** Painel da Gestão: + um corretor para comparar (o seletor só aparece para a Gestão). */
export const FILTROS_PADRAO_GESTAO = { ...FILTROS_PADRAO, comparar: 'nenhum' }

export const OPCOES_PERIODO = [
  { valor: 'mes', label: 'Mês atual' },
  { valor: '30d', label: 'Últimos 30 dias' },
  { valor: '90d', label: 'Últimos 90 dias' },
  { valor: 'mes-anterior', label: 'Mês passado' },
]

/** Resolve o período escolhido em datas, com a janela anterior equivalente para comparação. */
export function resolverPeriodo(periodo, hoje) {
  if (periodo === '30d' || periodo === '90d') {
    const n = periodo === '30d' ? 30 : 90
    return {
      inicio: somarDias(hoje, -(n - 1)),
      fim: hoje,
      label: `nos últimos ${n} dias`,
      anterior: { inicio: somarDias(hoje, -(2 * n - 1)), fim: somarDias(hoje, -n) },
    }
  }
  const mes = periodo === 'mes-anterior' ? mesAnterior(hoje.slice(0, 7)) : /^\d{4}-\d{2}$/.test(periodo) ? periodo : hoje.slice(0, 7)
  const { inicio, fim } = limitesMes(mes)
  const ant = limitesMes(mesAnterior(mes))
  const corrente = mes === hoje.slice(0, 7)
  return {
    inicio,
    fim: corrente ? hoje : fim,
    mes,
    corrente,
    label: corrente ? `em ${nomeMes(mes).split(' ')[0]} até hoje` : `em ${nomeMes(mes)}`,
    // mês corrente compara com o mesmo número de dias do mês anterior
    anterior: corrente ? { inicio: ant.inicio, fim: somarDias(ant.inicio, diasEntre(inicio, hoje)) } : { inicio: ant.inicio, fim: ant.fim },
  }
}

const dentro = (data, { inicio, fim }) => !!data && data.slice(0, 10) >= inicio && data.slice(0, 10) <= fim

/** Aplica finalidade, canal e corretor às linhas do CRM (sem ruído nem captação interna). */
export function filtrarBase(base, filtros) {
  return base.filter(
    (a) =>
      !a.is_ruido &&
      !a.is_interno &&
      (filtros.finalidade === 'todas' || a.finalidade === filtros.finalidade) &&
      (filtros.canal === 'todos' || a.canal === filtros.canal) &&
      (filtros.corretor === 'todos' || a.corretor === filtros.corretor)
  )
}

export const listaDistinta = (linhas, campo) => [...new Set(linhas.map((l) => l[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** '2026-09' → 'set/26' */
export const rotuloMes = (mes) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`

const variacao = (atual, anterior) => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null)

const chegou = (a, ordem) => (ordem === 7 ? a.fase_ordem >= 7 || a.is_negocio : (a.fase_ordem ?? 0) >= ordem)

// ---------------------------------------------------------------------------
// 0 + 1. Resultado e ritmo
// ---------------------------------------------------------------------------

/** Ritmo = média diária de leads nos últimos 30 dias (decisão do Eduardo, 24/09). */
export function ritmo(base, hoje) {
  const ult30 = base.filter((a) => dentro(a.data_entrada, { inicio: somarDias(hoje, -29), fim: hoje })).length
  const ant30 = base.filter((a) => dentro(a.data_entrada, { inicio: somarDias(hoje, -59), fim: somarDias(hoje, -30) })).length
  const mes = hoje.slice(0, 7)
  const { dias, inicio } = limitesMes(mes)
  const realizadoMes = base.filter((a) => a.data_entrada?.slice(0, 7) === mes).length
  const diasRestantes = dias - (diasEntre(inicio, hoje) + 1)
  const porDia = ult30 / 30
  const media3m = [1, 2, 3].map((n) => base.filter((a) => a.data_entrada?.slice(0, 7) === mesAnterior(mes, n)).length).reduce((s, x) => s + x, 0) / 3
  return {
    porDia,
    porDiaAnterior: ant30 / 30,
    variacao: variacao(ult30, ant30),
    realizadoMes,
    projecaoMes: Math.round(realizadoMes + diasRestantes * porDia),
    media3m,
  }
}

export function resultadoPeriodo(base, propostas, periodo) {
  const leads = base.filter((a) => dentro(a.data_entrada, periodo))
  const leadsAnt = base.filter((a) => dentro(a.data_entrada, periodo.anterior))
  const neg = base.filter((a) => a.is_negocio && dentro(a.data_encerramento, periodo))
  const negAnt = base.filter((a) => a.is_negocio && dentro(a.data_encerramento, periodo.anterior))
  const locadas = propostas.filter((p) => STATUS_PROPOSTA_CONCLUIDA.includes(p.status) && dentro(p.updated_at, periodo))
  const por = (linhas) => ({ Venda: linhas.filter((a) => a.finalidade === 'Venda').length, Aluguel: linhas.filter((a) => a.finalidade === 'Aluguel').length })
  return {
    leads: leads.length,
    leadsAnterior: leadsAnt.length,
    leadsVar: variacao(leads.length, leadsAnt.length),
    leadsPor: por(leads),
    negocios: neg.length,
    negociosAnterior: negAnt.length,
    negociosPor: por(neg),
    valorLocado: locadas.reduce((s, p) => s + Number(p.valor_oferta ?? p.valor ?? 0), 0),
    contratos: locadas.length,
  }
}

/** Série mensal (12 meses) de leads e negócios, com a projeção do mês corrente pelo ritmo de 30 dias. */
export function serieMensal(base, hoje, rit) {
  const mesAtual = hoje.slice(0, 7)
  const pontos = []
  for (let n = 11; n >= 0; n -= 1) {
    const mes = mesAnterior(mesAtual, n)
    const l = base.filter((a) => a.data_entrada?.slice(0, 7) === mes)
    const g = base.filter((a) => a.is_negocio && a.data_encerramento?.slice(0, 7) === mes)
    const ponto = {
      mes,
      rotulo: rotuloMes(mes),
      leadsVenda: l.filter((a) => a.finalidade === 'Venda').length,
      leadsAluguel: l.filter((a) => a.finalidade === 'Aluguel').length,
      negVenda: g.filter((a) => a.finalidade === 'Venda').length,
      negAluguel: g.filter((a) => a.finalidade === 'Aluguel').length,
      leadsProjecao: 0,
      corrente: mes === mesAtual,
    }
    if (ponto.corrente) ponto.leadsProjecao = Math.max(0, rit.projecaoMes - l.length)
    pontos.push(ponto)
  }
  return pontos
}

/** Contagem mensal para os mini-gráficos dos índices. */
export const sparkLeads = (serie) => serie.map((p) => p.leadsVenda + p.leadsAluguel)
export const sparkNegocios = (serie) => serie.map((p) => p.negVenda + p.negAluguel)

// ---------------------------------------------------------------------------
// 2. Funil
// ---------------------------------------------------------------------------

function funilDe(linhas) {
  const qtd = ETAPAS.map((e) => ({ ...e, n: e.ordem === 1 ? linhas.length : linhas.filter((a) => chegou(a, e.ordem)).length }))
  return qtd.map((e, i) => ({ ...e, passagem: i === 0 ? null : pct(e.n, qtd[i - 1].n) }))
}

/**
 * Funil da safra madura (60–242 dias) comparado com o semestre anterior, por
 * finalidade. A maior queda é a passagem com a menor taxa (a partir de
 * Qualificado; Lead→Qualificado é triagem e fica fora da disputa).
 */
export function capituloFunil(base, hoje, finalidades) {
  const atual = safraMadura(base, hoje, { de: 242, ate: 60 })
  const anterior = safraMadura(base, hoje, { de: 425, ate: 243 })
  const grupos = finalidades.map((f) => {
    const etapas = funilDe(atual.linhas.filter((a) => a.finalidade === f))
    const etapasAnt = funilDe(anterior.linhas.filter((a) => a.finalidade === f))
    const comDelta = etapas.map((e, i) => ({
      ...e,
      delta: e.passagem != null && etapasAnt[i].passagem != null ? e.passagem - etapasAnt[i].passagem : null,
    }))
    const candidatas = comDelta.filter((e) => e.passagem != null && e.ordem >= 5 && comDelta[comDelta.indexOf(e) - 1].n >= 10)
    const gargalo = candidatas.reduce((min, e) => (min == null || e.passagem < min.passagem ? e : min), null)
    return { finalidade: f, etapas: comDelta, gargalo, conversao: pct(etapas[4].n, etapas[0].n) }
  })
  const pior = grupos.filter((g) => g.gargalo).reduce((min, g) => (min == null || g.gargalo.passagem < min.gargalo.passagem ? g : min), null)
  return { grupos, pior, janela: { inicio: atual.inicio, fim: atual.fim }, anterior: { inicio: anterior.inicio, fim: anterior.fim } }
}

// ---------------------------------------------------------------------------
// 3. Quanto custa: descartes e simulação
// ---------------------------------------------------------------------------

export function descartesPorEtapa(base, hoje) {
  const { linhas } = safraMadura(base, hoje)
  const descartados = linhas.filter((a) => a.is_descartado)
  const ROTULOS_DESCARTE = ['Antes de qualificar', 'Qualificado, sem visita', 'Depois da visita', 'Na proposta']
  const porEtapa = ETAPAS.slice(0, 4).map((e, i) => {
    const proxima = ETAPAS[i + 1]?.ordem ?? 99
    const n = descartados.filter((a) => (a.fase_ordem ?? 0) >= (i === 0 ? 0 : e.ordem) && (a.fase_ordem ?? 0) < proxima).length
    return { etapa: ROTULOS_DESCARTE[i], n }
  })
  return { total: descartados.length, porEtapa, leads: linhas.length }
}

/**
 * Simulação: quantos negócios a mais por mês se a passagem do gargalo subir
 * `pontos` p.p., mantendo o volume (média de leads dos últimos 3 meses) e as
 * outras passagens.
 */
export function simularGanho(grupo, leadsPorMes, pontos) {
  if (!grupo?.gargalo) return null
  const taxas = grupo.etapas.slice(1).map((e) => (e.passagem ?? 0) / 100)
  const idx = grupo.etapas.findIndex((e) => e.ordem === grupo.gargalo.ordem) - 1
  const base = taxas.reduce((p, t) => p * t, leadsPorMes)
  const nova = taxas.map((t, i) => (i === idx ? Math.min(1, t + pontos / 100) : t)).reduce((p, t) => p * t, leadsPorMes)
  return { base, nova, ganho: nova - base }
}

// ---------------------------------------------------------------------------
// 4. Canais e mídia
// ---------------------------------------------------------------------------

export function capituloCanais(base, hoje) {
  const { linhas, inicio, fim } = safraMadura(base, hoje)
  const mapa = new Map()
  for (const a of linhas) {
    const c = mapa.get(a.canal) ?? { canal: a.canal, leads: 0, visitas: 0, negocios: 0 }
    c.leads += 1
    if (chegou(a, 5)) c.visitas += 1
    if (chegou(a, 7)) c.negocios += 1
    mapa.set(a.canal, c)
  }
  const canais = [...mapa.values()]
    .map((c) => ({ ...c, conversao: pct(c.negocios, c.leads), pctVisita: pct(c.visitas, c.leads) }))
    .sort((a, b) => b.leads - a.leads)
  const relevantes = canais.filter((c) => c.leads >= 30)
  const melhor = relevantes.reduce((m, c) => (m == null || c.conversao > m.conversao ? c : m), null)
  const maiorVolume = relevantes[0] ?? null
  return { canais, melhor, maiorVolume, inicio, fim }
}

export function custoMidia(base, meta, google, hoje, meses = 6) {
  const pagos = base.filter((a) => a.canal === 'Campanhas pagas')
  const out = []
  for (let n = meses - 1; n >= 0; n -= 1) {
    const mes = mesAnterior(hoje.slice(0, 7), n)
    const linhasAds = [...meta, ...google].filter((l) => l.data?.slice(0, 7) === mes)
    const investimento = linhasAds.reduce((s, l) => s + (l.investimento ?? 0), 0)
    const conversoes = linhasAds.reduce((s, l) => s + (l.leads_conversoes ?? 0), 0)
    const leads = pagos.filter((a) => a.data_entrada?.slice(0, 7) === mes).length
    out.push({
      mes,
      rotulo: rotuloMes(mes),
      investimento,
      conversoes,
      leads,
      custoLead: leads > 0 ? investimento / leads : null,
      aproveitamento: pct(leads, conversoes),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// 5. Pessoas
// ---------------------------------------------------------------------------

export function capituloPessoas({ base, tempoResposta, aging, atividades }, hoje) {
  const limite30 = somarDias(hoje, -30)
  const desde12m = somarDias(hoje, -365)
  const ativos = base.filter((a) => a.is_ativo)
  const codAtivos = new Set(ativos.map((a) => a.codigo))
  const pessoas = new Map()
  const pegar = (nome) => {
    const k = nome || 'Sem corretor'
    if (!pessoas.has(k)) {
      pessoas.set(k, { corretor: k, carteira: 0, semContato: 0, abertos30: 0, vencidas30: 0, esquecidas: 0, leads30: 0, contato1d: 0, negocios12m: 0 })
    }
    return pessoas.get(k)
  }
  for (const a of ativos) pegar(a.corretor).carteira += 1
  for (const a of base) if (a.is_negocio && a.data_encerramento >= desde12m) pegar(a.corretor).negocios12m += 1
  for (const t of tempoResposta) {
    if (!t.periodo_confiavel) continue
    if (!t.tem_atividade && codAtivos.has(t.codigo)) pegar(t.corretor).semContato += 1
    if (t.data_entrada > limite30) {
      const p = pegar(t.corretor)
      p.leads30 += 1
      if (t.tem_atividade && t.dias_ate_resposta_confiavel <= 1) p.contato1d += 1
    }
  }
  for (const a of aging) if (a.faixa_aging === '31+' && codAtivos.has(a.codigo)) pegar(a.corretor).abertos30 += 1
  for (const at of atividades) {
    const dia = at.datahorainicio.slice(0, 10)
    if (dia >= hoje) continue
    const p = pegar(at.nomeusuario)
    if (dia >= limite30) p.vencidas30 += 1
    else p.esquecidas += 1
  }
  const linhas = [...pessoas.values()]
    .map((p) => ({ ...p, pctContato1d: pct(p.contato1d, p.leads30), pendencias: p.semContato + p.abertos30 + p.vencidas30 }))
    .filter((p) => p.carteira > 0 || p.vencidas30 > 0 || p.negocios12m > 0)
    .sort((a, b) => b.pendencias - a.pendencias)
  const totais = linhas.reduce(
    (t, p) => ({ semContato: t.semContato + p.semContato, abertos30: t.abertos30 + p.abertos30, vencidas30: t.vencidas30 + p.vencidas30, esquecidas: t.esquecidas + p.esquecidas }),
    { semContato: 0, abertos30: 0, vencidas30: 0, esquecidas: 0 }
  )
  return { linhas, totais }
}

// ---------------------------------------------------------------------------
// v2 (PRD §5.0c, 15/10): foco no atendimento
// ---------------------------------------------------------------------------

/** Campo `funil` do CRM. Cores fora do par venda/locação (Sálvia e Gold do design system). */
export const FUNIS = [
  { chave: 'Inbound (passivo)', label: 'Inbound', cor: '#5C8A6B' },
  { chave: 'Outbound (ativo)', label: 'Outbound', cor: '#C9A96E' },
]
/** "Na média" da equipe = ±10% (decisão do Eduardo, 15/10). */
export const FAIXA_MEDIA = 0.1
export const LABEL_EQUIPE = { vendas: 'Venda', 'locação': 'Locação' }
const EQUIPE_DA_FINALIDADE = { Venda: 'vendas', Aluguel: 'locação' }

const ETAPAS_ATIVAS = [
  { label: 'Lead', de: 0, ate: 3 },
  { label: 'Qualificado', de: 4, ate: 4 },
  { label: 'Visita', de: 5, ate: 5 },
  { label: 'Proposta', de: 6, ate: 6 },
]

const chaveNome = (n) => (n ?? '').trim().toLowerCase()

/** Equipe de cada corretor: `colaboradores_raw.cargo` da equipe comercial ativa (15/10). Mapa nome normalizado → { nome, equipe }. */
export function equipesComerciais(colaboradores) {
  const mapa = new Map()
  for (const c of colaboradores) {
    if (c.equipe !== 'comercial' || !c.ativo || !LABEL_EQUIPE[c.cargo]) continue
    mapa.set(chaveNome(c.nome_completo), { nome: c.nome_completo.trim(), equipe: c.cargo })
  }
  return mapa
}

/** Quem está em atendimento agora: ativos por etapa e por funil; o número da manchete é Qualificado → Proposta. */
export function emAtendimento(base) {
  const ativos = base.filter((a) => a.is_ativo)
  const fase = (a) => a.fase_ordem ?? 0
  const etapas = ETAPAS_ATIVAS.map((e) => {
    const linhas = ativos.filter((a) => fase(a) >= e.de && fase(a) <= e.ate)
    return { label: e.label, total: linhas.length, porFunil: Object.fromEntries(FUNIS.map((f) => [f.chave, linhas.filter((a) => a.funil === f.chave).length])) }
  })
  const qp = ativos.filter((a) => fase(a) >= 4 && fase(a) <= 6)
  const conta = (campo, valor) => qp.filter((a) => a[campo] === valor).length
  return {
    total: qp.length,
    Venda: conta('finalidade', 'Venda'),
    Aluguel: conta('finalidade', 'Aluguel'),
    porFunil: Object.fromEntries(FUNIS.map((f) => [f.chave, conta('funil', f.chave)])),
    visita: qp.filter((a) => fase(a) === 5).length,
    proposta: qp.filter((a) => fase(a) === 6).length,
    etapas,
  }
}

/** Etapa mais avançada que o atendimento alcançou (pela fase atual; o CRM não guarda o histórico de fases). */
const etapaAlcancada = (a) => {
  if (a.is_negocio || (a.fase_ordem ?? 0) >= 7) return 'Negócio'
  return ETAPAS_ATIVAS.find((e) => (a.fase_ordem ?? 0) >= e.de && (a.fase_ordem ?? 0) <= e.ate)?.label ?? 'Lead'
}
const ETAPAS_ALCANCADAS = [...ETAPAS_ATIVAS.map((e) => e.label), 'Negócio']

/**
 * Funil do período (16/10: efetividade no período): leads que entraram no
 * período, por funil, com a etapa mais avançada que alcançaram e a conversão de
 * cada passagem, comparada com o período anterior. Gargalo = menor passagem a
 * partir de Qualificado, com pelo menos 10 na etapa de origem.
 */
export function funilPorOrigem(base, periodo) {
  const doPeriodo = (p) => base.filter((a) => dentro(a.data_entrada, p))
  const atual = doPeriodo(periodo)
  const anterior = doPeriodo(periodo.anterior)
  const grupos = FUNIS.map((f) => {
    const linhas = atual.filter((a) => a.funil === f.chave)
    const etapas = funilDe(linhas)
    const etapasAnt = funilDe(anterior.filter((a) => a.funil === f.chave))
    const comDelta = etapas.map((e, i) => ({
      ...e,
      delta: e.passagem != null && etapasAnt[i].passagem != null && etapasAnt[i - 1]?.n >= 10 ? e.passagem - etapasAnt[i].passagem : null,
    }))
    const candidatas = comDelta.filter((e, i) => e.passagem != null && e.ordem >= 5 && comDelta[i - 1].n >= 10)
    const gargalo = candidatas.reduce((min, e) => (min == null || e.passagem < min.passagem ? e : min), null)
    const alcancadas = ETAPAS_ALCANCADAS.map((label) => ({ label, n: linhas.filter((a) => etapaAlcancada(a) === label).length }))
    return {
      chave: f.chave,
      rotulo: f.label,
      cor: f.cor,
      total: linhas.length,
      ativos: linhas.filter((a) => a.is_ativo).length,
      alcancadas,
      etapas: comDelta,
      gargalo,
      proposta: etapas[3].n,
      negocios: etapas[4].n,
      conversao: pct(etapas[3].n, etapas[0].n),
    }
  })
  const pior = grupos.filter((g) => g.gargalo).reduce((min, g) => (min == null || g.gargalo.passagem < min.gargalo.passagem ? g : min), null)
  return { grupos, pior }
}

/** Cores das etapas na linha do funil (tokens do design system), da entrada ao fim. */
export const CORES_ETAPA = { Lead: '#B8B5B0', Qualificado: '#C9A96E', Visita: '#D4755A', Proposta: '#5C8A6B', 'Negócio': '#2D2D2D' }

/** Passagens do funil (safra madura) de um recorte: [{ de, para, ordem, n, passaram, taxa }]. */
function passagensDe(linhas) {
  const etapas = funilDe(linhas)
  return etapas.slice(1).map((e, i) => ({ de: etapas[i].label, para: e.label, ordem: e.ordem, n: etapas[i].n, passaram: e.n, taxa: e.passagem }))
}

/**
 * Onde perdemos mais (respeita todos os filtros). Compara a seleção com uma
 * referência: com corretor filtrado, a média da equipe dele (sem nomes);
 * sem corretor, o semestre anterior. `baseComparar` (só Gestão) é outro corretor.
 * A maior perda é a passagem mais fraca a partir de Qualificado, com amostra mínima.
 */
export function perdaComparada({ base, baseEquipe, baseComparar, hoje, corretor }) {
  const janela = { de: 242, ate: 60 }
  const sel = passagensDe(safraMadura(base, hoje, janela).linhas)
  const ref = corretor
    ? passagensDe(safraMadura(baseEquipe, hoje, janela).linhas)
    : passagensDe(safraMadura(base, hoje, { de: 425, ate: 243 }).linhas)
  const comp = baseComparar ? passagensDe(safraMadura(baseComparar, hoje, janela).linhas) : null
  const minimo = corretor ? 5 : 10
  const linhas = sel.map((p, i) => ({
    ...p,
    ref: ref[i].n >= minimo ? ref[i].taxa : null,
    comp: comp ? comp[i] : null,
    dif: p.n >= minimo && ref[i].n >= minimo ? p.taxa - ref[i].taxa : null,
  }))
  const candidatas = linhas.filter((p) => p.ordem >= 5 && p.n >= minimo)
  const pior = candidatas.reduce((m, p) => (m == null || p.taxa < m.taxa ? p : m), null)
  return { linhas, pior, minimo, rotuloRef: corretor ? 'Média da equipe' : 'Semestre anterior' }
}

/** Selo de comparação com a média da equipe (±10%). */
export function seloMedia(valor, media) {
  if (!media) return null
  const r = valor / media
  if (r > 1 + FAIXA_MEDIA) return { chave: 'acima', label: 'Acima da média', badge: 'badge-success' }
  if (r < 1 - FAIXA_MEDIA) return { chave: 'abaixo', label: 'Abaixo da média', badge: 'badge-danger' }
  return { chave: 'media', label: 'Na média', badge: 'badge-gray' }
}

/**
 * Atividades realizadas no período (sem "Anotações"): volume e variedade
 * (por tipo), contra a média da equipe (vendas ou locação; a média inclui
 * quem fez zero). Com corretor filtrado, devolve só ele contra a equipe, sem
 * citar colegas.
 */
export function atividadesPainel(feitas, equipes, periodo, filtros) {
  const validas = feitas.filter((a) => a.nometipo !== 'Anotações' && dentro(a.datahorainicio, periodo))
  const anteriores = feitas.filter((a) => a.nometipo !== 'Anotações' && dentro(a.datahorainicio, periodo.anterior))
  const porPessoa = new Map()
  for (const a of validas) {
    const k = chaveNome(a.nomeusuario)
    if (!porPessoa.has(k)) porPessoa.set(k, new Map())
    const m = porPessoa.get(k)
    m.set(a.nometipo, (m.get(a.nometipo) ?? 0) + 1)
  }
  const totalDe = (k) => [...(porPessoa.get(k)?.values() ?? [])].reduce((s, n) => s + n, 0)
  const antesDe = (k) => anteriores.filter((a) => chaveNome(a.nomeusuario) === k).length
  const tiposDe = (chaves) => {
    const m = new Map()
    for (const k of chaves) for (const [t, n] of porPessoa.get(k) ?? []) m.set(t, (m.get(t) ?? 0) + n)
    return m
  }
  const resumoEquipe = (eq) => {
    const membros = [...equipes.entries()].filter(([, v]) => v.equipe === eq)
    const chaves = membros.map(([k]) => k)
    const total = chaves.reduce((s, k) => s + totalDe(k), 0)
    const media = chaves.length ? total / chaves.length : 0
    const tipos = [...tiposDe(chaves).entries()].map(([tipo, n]) => ({ tipo, n, media: n / (chaves.length || 1) })).sort((a, b) => b.n - a.n)
    const linhas = membros
      .map(([k, v]) => {
        const n = totalDe(k)
        return { corretor: v.nome, n, anterior: antesDe(k), variedade: porPessoa.get(k)?.size ?? 0, selo: seloMedia(n, media) }
      })
      .sort((a, b) => b.n - a.n)
    return { equipe: eq, label: LABEL_EQUIPE[eq], membros: chaves.length, total, media, tipos, linhas, anterior: chaves.reduce((s, k) => s + antesDe(k), 0) }
  }

  if (filtros.corretor !== 'todos') {
    const k = chaveNome(filtros.corretor)
    const info = equipes.get(k)
    const eq = info ? resumoEquipe(info.equipe) : null
    const meus = porPessoa.get(k) ?? new Map()
    const total = totalDe(k)
    const tiposNomes = new Set([...meus.keys(), ...(eq?.tipos.map((t) => t.tipo) ?? [])])
    const tipos = [...tiposNomes]
      .map((tipo) => ({ tipo, n: meus.get(tipo) ?? 0, media: eq?.tipos.find((t) => t.tipo === tipo)?.media ?? 0 }))
      .sort((a, b) => b.n - a.n || b.media - a.media)
    const selo = eq ? seloMedia(total, eq.media) : null
    return {
      modo: 'corretor',
      corretor: filtros.corretor,
      equipe: eq?.label ?? null,
      total,
      anterior: antesDe(k),
      media: eq?.media ?? null,
      variedade: meus.size,
      variedadeEquipe: eq?.tipos.length ?? 0,
      selo,
      tipos,
      abaixo: selo?.chave === 'abaixo' ? [filtros.corretor] : [],
    }
  }

  const so = filtros.finalidade === 'todas' ? null : EQUIPE_DA_FINALIDADE[filtros.finalidade]
  const grupos = Object.keys(LABEL_EQUIPE).filter((eq) => !so || eq === so).map(resumoEquipe)
  const todos = grupos.flatMap((g) => g.linhas)
  return {
    modo: 'equipes',
    grupos,
    total: grupos.reduce((s, g) => s + g.total, 0),
    anterior: grupos.reduce((s, g) => s + g.anterior, 0),
    abaixo: todos.filter((l) => l.selo?.chave === 'abaixo').map((l) => l.corretor),
  }
}

/** Frases da manchete v2: só atendimento, sem ritmo de entrada de leads; com corretor filtrado, não cita colegas. */
export function mancheteAtendimento({ atendimento, perda, atividades, pessoasCap, corretor }) {
  const frases = []
  frases.push(
    `${corretor ? `${corretor} tem` : 'Temos'} ${fmtNum(atendimento.total)} clientes em atendimento entre qualificado e proposta: ${fmtNum(atendimento.visita)} em visita e ${fmtNum(atendimento.proposta)} em proposta.`
  )
  if (perda.pior) {
    const ref = perda.pior.ref != null ? ` (${perda.rotuloRef.toLowerCase()}: ${fmtPct(perda.pior.ref, 0)})` : ''
    frases.push(`A maior perda está entre ${perda.pior.de.toLowerCase()} e ${perda.pior.para.toLowerCase()}: só ${fmtPct(perda.pior.taxa, 0)} avançam${ref}.`)
  }
  if (atividades.modo === 'corretor') {
    if (atividades.media) {
      const dif = ((atividades.total - atividades.media) / atividades.media) * 100
      const lado = Math.abs(dif) <= FAIXA_MEDIA * 100 ? 'na média da equipe' : `${fmtPct(Math.abs(dif), 0)} ${dif > 0 ? 'acima' : 'abaixo'} da média da equipe (${fmtNum(atividades.media, 0)})`
      frases.push(`${fmtNum(atividades.total)} atividades realizadas no período, ${lado}.`)
    }
  } else if (atividades.abaixo.length) {
    const n = atividades.abaixo.length
    frases.push(`${n} ${n === 1 ? 'corretor está' : 'corretores estão'} abaixo da média de atividades da equipe: ${atividades.abaixo.join(', ')}.`)
  }
  if (pessoasCap.totais.semContato > 0) {
    if (corretor) frases.push(`${pessoasCap.totais.semContato} leads ativos sem nenhum contato registrado.`)
    else {
      const top = [...pessoasCap.linhas].sort((a, b) => b.semContato - a.semContato)[0]
      frases.push(`${pessoasCap.totais.semContato} leads ativos estão sem nenhum contato registrado; ${top.corretor} concentra ${top.semContato}.`)
    }
  }
  return frases
}

// ---------------------------------------------------------------------------
// Manchete: 3 frases geradas pelos números
// ---------------------------------------------------------------------------

export function manchete({ rit, resultado, funilCap, pessoasCap, periodo, conversao }) {
  const frases = []
  const mes = nomeMes(isoLocal().slice(0, 7)).split(' ')[0]
  if (rit.media3m > 0) {
    const dif = variacao(rit.projecaoMes, rit.media3m)
    const lado = dif == null || Math.abs(dif) < 5 ? 'em linha com' : dif > 0 ? `${fmtPct(Math.abs(dif), 0)} acima da` : `${fmtPct(Math.abs(dif), 0)} abaixo da`
    frases.push(`No ritmo dos últimos 30 dias (${fmtDecimal(rit.porDia)} leads por dia), ${mes} fecha com cerca de ${fmtNum(rit.projecaoMes)} leads, ${lado} média dos 3 meses anteriores.`)
  }
  if (conversao) {
    const d = conversao.anterior != null ? conversao.atual - conversao.anterior : null
    const tendencia = d == null || Math.abs(d) < 0.3 ? 'estável' : d > 0 ? `subindo (era ${fmtPct(conversao.anterior)})` : `caindo (era ${fmtPct(conversao.anterior)})`
    frases.push(`De cada 100 leads, ${fmtNum(conversao.atual, 1)} viram negócio; a taxa está ${tendencia}. ${resultado.negocios} ${resultado.negocios === 1 ? 'negócio fechado' : 'negócios fechados'} ${periodo.label}.`)
  }
  if (funilCap.pior) {
    const g = funilCap.pior
    const i = g.etapas.findIndex((e) => e.ordem === g.gargalo.ordem)
    frases.push(
      `O maior gargalo é ${g.etapas[i - 1].label.toLowerCase()} → ${g.gargalo.label.toLowerCase()} na ${LABEL_FINALIDADE[g.finalidade].toLowerCase()}: só ${fmtPct(g.gargalo.passagem, 0)} avançam.`
    )
  }
  if (pessoasCap.totais.semContato > 0) {
    const top = [...pessoasCap.linhas].sort((a, b) => b.semContato - a.semContato)[0]
    frases.push(`${pessoasCap.totais.semContato} leads ativos estão sem nenhum contato registrado; ${top.corretor} concentra ${top.semContato}.`)
  }
  return frases
}

export function conversaoSafra(base, hoje) {
  const atual = safraMadura(base, hoje, { de: 242, ate: 60 }).linhas
  const anterior = safraMadura(base, hoje, { de: 425, ate: 243 }).linhas
  const taxa = (l) => pct(l.filter((a) => chegou(a, 7)).length, l.length)
  return { atual: taxa(atual), anterior: anterior.length >= 100 ? taxa(anterior) : null, n: atual.length, negocios: atual.filter((a) => chegou(a, 7)).length }
}

export function cicloMediano(base, hoje) {
  const desde = somarDias(hoje, -365)
  return mediana(base.filter((a) => a.is_negocio && a.data_encerramento >= desde && a.dias_ate_ganho >= 0).map((a) => a.dias_ate_ganho))
}

/** Corte de "desatualizado" da carteira, igual ao `vw_estoque_imoveis` (PRD §5.0c cap. 4). */
export const DIAS_DESATUALIZADO = 45

/**
 * Carteira de imóveis em estoque por captador (PRD §5.0c cap. 4, 16/10).
 * `imoveis`: linhas de `vw_estoque_imoveis` (só situações negociáveis).
 * Imóvel com mais de um captador conta para cada um (decidido 16/10), então a soma por pessoa pode passar do total.
 */
export function carteiraPorCaptador(imoveis, finalidade) {
  const lista = finalidade === 'todas' ? imoveis : imoveis.filter((i) => i.finalidade === finalidade)
  // valores separados por finalidade: preço de venda e aluguel mensal não se somam
  const novaConta = (extra) => ({ ...extra, n: 0, desatualizados: 0, valor: { Venda: 0, Aluguel: 0 }, valorDesat: { Venda: 0, Aluguel: 0 } })
  const somar = (l, i) => {
    const desat = i.desatualizado !== false
    const v = Number(i.valor) || 0
    l.n++
    if (desat) l.desatualizados++
    if (i.finalidade in l.valor) {
      l.valor[i.finalidade] += v
      if (desat) l.valorDesat[i.finalidade] += v
    }
  }
  const porCaptador = new Map()
  const geral = novaConta()
  let semCaptador = novaConta()
  for (const i of lista) {
    somar(geral, i)
    const caps = (i.captadores ?? []).filter(Boolean)
    if (!caps.length) {
      somar(semCaptador, i)
      continue
    }
    for (const c of new Set(caps)) {
      if (!porCaptador.has(c)) porCaptador.set(c, novaConta({ captador: c }))
      somar(porCaptador.get(c), i)
    }
  }
  const linhas = [...porCaptador.values()]
    .map((l) => ({ ...l, atualizados: l.n - l.desatualizados, pctAtualizado: pct(l.n - l.desatualizados, l.n) }))
    .sort((a, b) => b.desatualizados - a.desatualizados || b.n - a.n || a.captador.localeCompare(b.captador, 'pt-BR'))
  semCaptador = { ...semCaptador, atualizados: semCaptador.n - semCaptador.desatualizados, pctAtualizado: pct(semCaptador.n - semCaptador.desatualizados, semCaptador.n) }
  return {
    total: geral.n,
    desatualizados: geral.desatualizados,
    atualizados: geral.n - geral.desatualizados,
    pctAtualizado: pct(geral.n - geral.desatualizados, geral.n),
    valor: geral.valor,
    valorDesat: geral.valorDesat,
    linhas,
    semCaptador,
    pior: linhas.find((l) => l.desatualizados > 0) ?? null,
  }
}

export { INICIO_HISTORICO_CONFIAVEL }
