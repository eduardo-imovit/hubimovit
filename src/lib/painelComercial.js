// Painel Comercial (docs/01-prd.md §5.8): todo número respeita todos os filtros
// (período, finalidade, mídia, corretor) e o filtro geral "só equipe comercial
// ativa". Funções puras sobre as linhas já carregadas.
//
// Enquanto o histórico diário de etapas não existe (Fase 12, S1–S2), as etapas
// contam a coorte: leads que ENTRARAM no período e já passaram pela etapa (fase
// atual ou negócio realizado). Quando o histórico entrar, estas funções passam a
// contar o evento (quando o lead chegou na etapa).

import { diasEntre, fmtDataCurta, limitesMes, mesAnterior, nomeMes, pct, somarDias, STATUS_PROPOSTA_CONCLUIDA } from './paineis'
import { LABEL_FINALIDADE, nomeCanal, rotuloMes } from './painelGestao'

export const FILTROS_COMERCIAL = { periodo: 'mes', finalidade: 'todas', canal: 'todos', corretor: 'todos' }

export const OPCOES_PERIODO_COMERCIAL = [
  { valor: 'mes', label: 'Mês atual' },
  { valor: 'mes-anterior', label: 'Mês passado' },
  { valor: '30d', label: 'Últimos 30 dias' },
  { valor: '90d', label: 'Últimos 90 dias' },
  { valor: '6m', label: 'Últimos 6 meses' },
  { valor: '12m', label: 'Últimos 12 meses' },
  { valor: 'ano', label: 'Ano atual' },
]

/** Funil do Hub, 7 etapas (sem "Agendamento", decisão de 29/09). `ordem` = `fase_ordem` da view. */
export const ETAPAS_FUNIL = [
  { ordem: 1, label: 'Pré-atendimento' },
  { ordem: 2, label: 'Seleção de perfil' },
  { ordem: 3, label: 'Seleção de imóveis' },
  { ordem: 4, label: 'Lead qualificado' },
  { ordem: 5, label: 'Visita' },
  { ordem: 6, label: 'Proposta' },
  { ordem: 7, label: 'Negócio' },
]

/** Período escolhido em datas + o período anterior de mesmo tamanho, para comparar. */
export function resolverPeriodoComercial(periodo, hoje) {
  const mesHoje = hoje.slice(0, 7)
  let inicio
  let fim = hoje
  let label
  if (periodo === '30d' || periodo === '90d') {
    const n = periodo === '30d' ? 30 : 90
    inicio = somarDias(hoje, -(n - 1))
    label = `nos últimos ${n} dias`
  } else if (periodo === '6m' || periodo === '12m') {
    const n = periodo === '6m' ? 6 : 12
    inicio = `${mesAnterior(mesHoje, n - 1)}-01`
    label = `nos últimos ${n} meses`
  } else if (periodo === 'ano') {
    inicio = `${hoje.slice(0, 4)}-01-01`
    label = `em ${hoje.slice(0, 4)}`
  } else if (periodo === 'mes-anterior') {
    const m = mesAnterior(mesHoje)
    ;({ inicio, fim } = limitesMes(m))
    label = `em ${nomeMes(m)}`
  } else {
    inicio = `${mesHoje}-01`
    label = `em ${nomeMes(mesHoje).split(' ')[0]} até hoje`
  }
  const dias = diasEntre(inicio, fim) + 1
  return {
    inicio,
    fim,
    dias,
    label,
    corrente: fim === hoje,
    anterior: { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) },
  }
}

export const dentro = (data, { inicio, fim }) => !!data && data.slice(0, 10) >= inicio && data.slice(0, 10) <= fim

const variacao = (atual, anterior) => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null)

/** Chegou à etapa: fase atual igual ou além, ou negócio realizado. */
export const chegouEtapa = (a, ordem) => ordem === 1 || a.is_negocio || (a.fase_ordem ?? 0) >= ordem

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

/**
 * Filtro geral (decisão do Eduardo, 29/09): só atendimentos de corretores com
 * `equipe = 'comercial'` e `ativo`, sem ruído nem captação interna. A ligação é
 * pelo nome, porque o CRM não manda o id do corretor no atendimento.
 */
export function baseComercial(base, corretoresAtivos) {
  const nomes = new Set(corretoresAtivos.map((n) => n.trim().toLowerCase()))
  return base
    .filter((a) => !a.is_ruido && !a.is_interno && nomes.has((a.corretor ?? '').trim().toLowerCase()))
    .map((a) => ({ ...a, canal: nomeCanal(a.canal) }))
}

export function aplicarFiltros(base, filtros) {
  return base.filter(
    (a) =>
      (filtros.finalidade === 'todas' || a.finalidade === filtros.finalidade) &&
      (filtros.canal === 'todos' || a.canal === filtros.canal) &&
      (filtros.corretor === 'todos' || a.corretor === filtros.corretor)
  )
}

/** Texto do recorte, para o subtexto de cada gráfico. */
export function descreverRecorte(filtros, periodo) {
  return [
    `${fmtDataCurta(periodo.inicio)} a ${fmtDataCurta(periodo.fim)}`,
    filtros.finalidade === 'todas' ? 'venda e locação' : LABEL_FINALIDADE[filtros.finalidade].toLowerCase(),
    filtros.canal === 'todos' ? 'todas as mídias' : `mídia ${filtros.canal}`,
    filtros.corretor === 'todos' ? 'todos os corretores' : filtros.corretor,
    'só equipe comercial ativa',
  ].join(' · ')
}

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

export function indicesComercial(base, visitas, periodo) {
  const coorte = base.filter((a) => dentro(a.data_entrada, periodo))
  const coorteAnt = base.filter((a) => dentro(a.data_entrada, periodo.anterior))
  const conta = (linhas, ordem) => linhas.filter((a) => chegouEtapa(a, ordem)).length
  const vis = visitas.filter((v) => dentro(v.data, periodo))
  const visAnt = visitas.filter((v) => dentro(v.data, periodo.anterior))
  const r = {
    leads: coorte.length,
    leadsAnt: coorteAnt.length,
    emAtendimento: coorte.filter((a) => a.is_ativo).length,
    qualificados: conta(coorte, 4),
    qualificadosAnt: conta(coorteAnt, 4),
    visitas: vis.length,
    visitasAnt: visAnt.length,
    visitasRealizadas: vis.filter((v) => v.realizada).length,
    propostas: conta(coorte, 6),
    propostasAnt: conta(coorteAnt, 6),
  }
  return {
    ...r,
    leadsVar: variacao(r.leads, r.leadsAnt),
    qualificadosVar: variacao(r.qualificados, r.qualificadosAnt),
    visitasVar: variacao(r.visitas, r.visitasAnt),
    propostasVar: r.propostasAnt >= 3 ? variacao(r.propostas, r.propostasAnt) : null,
    coorte,
  }
}

// ---------------------------------------------------------------------------
// Funil de 7 etapas
// ---------------------------------------------------------------------------

function funil7(linhas) {
  const qtd = ETAPAS_FUNIL.map((e) => ({ ...e, n: linhas.filter((a) => chegouEtapa(a, e.ordem)).length }))
  return qtd.map((e, i) => ({ ...e, passagem: i === 0 ? null : pct(e.n, qtd[i - 1].n) }))
}

/**
 * Funil da coorte do período, por finalidade, comparado com a coorte do período
 * anterior. Maior queda: a menor passagem a partir de Visita (as etapas de
 * triagem ficam fora), só quando a etapa de origem tem 10+ leads.
 */
export function funilComercial(base, periodo, finalidades) {
  const coorte = base.filter((a) => dentro(a.data_entrada, periodo))
  const coorteAnt = base.filter((a) => dentro(a.data_entrada, periodo.anterior))
  const grupos = finalidades.map((f) => {
    const etapas = funil7(coorte.filter((a) => a.finalidade === f))
    const ant = funil7(coorteAnt.filter((a) => a.finalidade === f))
    const comDelta = etapas.map((e, i) => ({
      ...e,
      delta: e.passagem != null && ant[i].passagem != null && ant[i - 1].n >= 10 ? e.passagem - ant[i].passagem : null,
    }))
    const candidatas = comDelta.filter((e, i) => e.passagem != null && e.ordem >= 5 && comDelta[i - 1].n >= 10)
    const gargalo = candidatas.reduce((min, e) => (min == null || e.passagem < min.passagem ? e : min), null)
    const ganhos = coorte.filter((a) => a.finalidade === f && a.is_negocio && a.dias_ate_ganho >= 0)
    return {
      finalidade: f,
      etapas: comDelta,
      gargalo,
      conversao: pct(etapas[6].n, etapas[0].n),
      cicloMedio: ganhos.length ? ganhos.reduce((s, a) => s + a.dias_ate_ganho, 0) / ganhos.length : null,
      nGanhos: ganhos.length,
    }
  })
  const pior = grupos.filter((g) => g.gargalo).reduce((min, g) => (min == null || g.gargalo.passagem < min.gargalo.passagem ? g : min), null)
  return { grupos, pior }
}

// ---------------------------------------------------------------------------
// Ritmo: leads por dia/semana/mês dentro do período
// ---------------------------------------------------------------------------

/** Granularidade que cabe no período: dia até 31 dias, semana até 92, mês acima. */
export function granularidade(periodo) {
  if (periodo.dias <= 31) return 'dia'
  if (periodo.dias <= 92) return 'semana'
  return 'mes'
}

/** Segunda-feira da semana da data (ISO). */
function inicioSemana(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dia = new Date(y, m - 1, d).getDay()
  return somarDias(iso, -((dia + 6) % 7))
}

export function chaveBalde(iso, gran) {
  if (gran === 'dia') return iso.slice(0, 10)
  if (gran === 'semana') return inicioSemana(iso.slice(0, 10))
  return iso.slice(0, 7)
}

export function rotuloBalde(chave, gran) {
  if (gran === 'mes') return rotuloMes(chave)
  const [, m, d] = chave.split('-')
  return gran === 'semana' ? `sem ${d}/${m}` : `${d}/${m}`
}

/** Baldes vazios cobrindo o período inteiro, na ordem. */
export function baldesDoPeriodo(periodo, gran) {
  const chaves = []
  let dia = periodo.inicio
  while (dia <= periodo.fim) {
    const k = chaveBalde(dia, gran)
    if (chaves.at(-1) !== k) chaves.push(k)
    dia = somarDias(dia, 1)
  }
  return chaves
}

export function ritmoLeads(base, periodo, hoje) {
  const gran = granularidade(periodo)
  const coorte = base.filter((a) => dentro(a.data_entrada, periodo))
  const ant = base.filter((a) => dentro(a.data_entrada, periodo.anterior)).length
  const serie = baldesDoPeriodo(periodo, gran).map((k) => {
    const l = coorte.filter((a) => chaveBalde(a.data_entrada, gran) === k)
    return { chave: k, rotulo: rotuloBalde(k, gran), Venda: l.filter((a) => a.finalidade === 'Venda').length, Aluguel: l.filter((a) => a.finalidade === 'Aluguel').length }
  })
  const decorridos = periodo.corrente ? diasEntre(periodo.inicio, hoje) + 1 : periodo.dias
  const porDia = decorridos > 0 ? coorte.length / decorridos : 0
  const mesCorrente = periodo.corrente && periodo.inicio === `${hoje.slice(0, 7)}-01`
  const diasMes = limitesMes(hoje.slice(0, 7)).dias
  return {
    gran,
    serie,
    porDia,
    porDiaAnterior: ant / periodo.dias,
    variacao: variacao(porDia, ant / periodo.dias),
    projecaoMes: mesCorrente ? Math.round(coorte.length + (diasMes - decorridos) * porDia) : null,
  }
}

// ---------------------------------------------------------------------------
// Onde se perde e quanto custa
// ---------------------------------------------------------------------------

const FAIXAS_DESCARTE = [
  { etapa: 'Antes de qualificar', de: 0, ate: 3 },
  { etapa: 'Qualificado, sem visita', de: 4, ate: 4 },
  { etapa: 'Depois da visita', de: 5, ate: 5 },
  { etapa: 'Na proposta', de: 6, ate: 6 },
]

export function descartesCoorte(base, periodo) {
  const coorte = base.filter((a) => dentro(a.data_entrada, periodo))
  const descartados = coorte.filter((a) => a.is_descartado)
  const porEtapa = FAIXAS_DESCARTE.map((f) => ({
    etapa: f.etapa,
    n: descartados.filter((a) => (a.fase_ordem ?? 0) >= f.de && (a.fase_ordem ?? 0) <= f.ate).length,
  }))
  return { total: descartados.length, porEtapa, leads: coorte.length }
}

// ---------------------------------------------------------------------------
// Canais
// ---------------------------------------------------------------------------

export function canaisCoorte(base, periodo) {
  const mapa = new Map()
  for (const a of base.filter((x) => dentro(x.data_entrada, periodo))) {
    const c = mapa.get(a.canal) ?? { canal: a.canal, leads: 0, qualificados: 0, visitas: 0, negocios: 0 }
    c.leads += 1
    if (chegouEtapa(a, 4)) c.qualificados += 1
    if (chegouEtapa(a, 5)) c.visitas += 1
    if (chegouEtapa(a, 7)) c.negocios += 1
    mapa.set(a.canal, c)
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, pctQualificado: pct(c.qualificados, c.leads), pctVisita: pct(c.visitas, c.leads), conversao: pct(c.negocios, c.leads) }))
    .sort((a, b) => b.leads - a.leads)
}

// ---------------------------------------------------------------------------
// Leads em atendimento (da coorte), por etapa atual
// ---------------------------------------------------------------------------

export function emAtendimentoPorEtapa(base, periodo) {
  const ativos = base.filter((a) => a.is_ativo && dentro(a.data_entrada, periodo))
  return ETAPAS_FUNIL.slice(0, 6).map((e) => {
    const l = ativos.filter((a) => (e.ordem === 1 ? (a.fase_ordem ?? 1) <= 1 : a.fase_ordem === e.ordem))
    return { etapa: e.label, Venda: l.filter((a) => a.finalidade === 'Venda').length, Aluguel: l.filter((a) => a.finalidade === 'Aluguel').length }
  })
}

// ---------------------------------------------------------------------------
// Visitas: região (bairro) e tipo de imóvel
// ---------------------------------------------------------------------------

export const TIPOS_IMOVEL = ['Apartamento', 'Casa em Condomínio', 'Casa', 'Terreno']
/** Paleta categórica validada (skill dataviz, 29/09): azul, laranja, verde-água, amarelo; "Outros" em cinza. */
export const CORES_TIPO = { Apartamento: '#2a78d6', 'Casa em Condomínio': '#eb6834', Casa: '#1baf7a', Terreno: '#eda100', Outros: '#B8B5B0' }

/**
 * `resumoimovel` do Imoview: "Cód. 12150 | [ref |] Apartamento | Rua X, 962, Apto 81, Cambuí - Campinas/SP, CEP ...".
 * Tipo = penúltimo bloco; bairro = o trecho antes de " - Cidade/UF".
 */
export function lerImovel(resumo) {
  if (!resumo) return { tipo: null, bairro: null }
  const partes = resumo.split(' | ')
  const tipoBruto = partes.length >= 3 ? partes[partes.length - 2].trim() : null
  const endereco = partes[partes.length - 1]
  const m = endereco.match(/,\s*([^,]+?)\s+-\s+[^,]+\/[A-Z]{2}(?:,|$)/)
  return { tipo: TIPOS_IMOVEL.includes(tipoBruto) ? tipoBruto : tipoBruto ? 'Outros' : null, bairro: m ? m[1].trim() : null }
}

/**
 * Visitas (atividades "Visita") ligadas a um atendimento da base filtrada. A
 * finalidade, a mídia e o corretor vêm do atendimento, para bater com o resto
 * da página. Visitas sem atendimento vinculado ficam fora.
 */
export function prepararVisitas(atividades, baseFiltrada) {
  const porCodigo = new Map(baseFiltrada.map((a) => [a.codigo, a]))
  return atividades
    .filter((v) => v.codigoatendimento != null && porCodigo.has(Number(v.codigoatendimento)))
    .map((v) => {
      const a = porCodigo.get(Number(v.codigoatendimento))
      return { data: v.datahorainicio.slice(0, 10), realizada: v.realizada, finalidade: a.finalidade, ...lerImovel(v.resumoimovel) }
    })
}

export function visitasPorBairro(visitas, periodo, limite = 10) {
  const conta = (lista) => lista.reduce((m, v) => (v.bairro ? m.set(v.bairro, (m.get(v.bairro) ?? 0) + 1) : m), new Map())
  const atual = conta(visitas.filter((v) => dentro(v.data, periodo)))
  const ant = conta(visitas.filter((v) => dentro(v.data, periodo.anterior)))
  const linhas = [...atual.entries()].map(([bairro, n]) => ({ bairro, n, anterior: ant.get(bairro) ?? 0 })).sort((a, b) => b.n - a.n || a.bairro.localeCompare(b.bairro, 'pt-BR'))
  const semBairro = visitas.filter((v) => dentro(v.data, periodo) && !v.bairro).length
  return { linhas: linhas.slice(0, limite), totalBairros: linhas.length, semBairro }
}

export function visitasPorTipo(visitas, periodo) {
  const gran = granularidade(periodo)
  const noPeriodo = visitas.filter((v) => dentro(v.data, periodo))
  const tipos = [...TIPOS_IMOVEL, 'Outros']
  const serie = baldesDoPeriodo(periodo, gran).map((k) => {
    const p = { chave: k, rotulo: rotuloBalde(k, gran) }
    for (const t of tipos) p[t] = noPeriodo.filter((v) => chaveBalde(v.data, gran) === k && (v.tipo ?? 'Outros') === t).length
    return p
  })
  const totais = tipos.map((t) => ({ tipo: t, n: noPeriodo.filter((v) => (v.tipo ?? 'Outros') === t).length }))
  return { gran, serie, totais, total: noPeriodo.length, tipos: tipos.filter((t) => totais.find((x) => x.tipo === t).n > 0) }
}

// ---------------------------------------------------------------------------
// Propostas do Hub e valor na mesa
// ---------------------------------------------------------------------------

const ABERTA_LOCACAO = (s) => !['rejeitada', 'expirada', ...STATUS_PROPOSTA_CONCLUIDA].includes(s)
const ABERTA_VENDA = (s) => ['aguardando_cliente', 'confirmada'].includes(s)

/**
 * Propostas criadas no Hub no período. "Na mesa" = abertas: na venda,
 * aguardando o proponente ou confirmadas; na locação, fora de rejeitada,
 * expirada e concluída. O corretor vem de quem criou (perfil → e-mail do CRM).
 */
export function propostasNaMesa({ venda, locacao, perfis, colaboradores }, filtros, periodo) {
  const emailPorPerfil = new Map(perfis.map((p) => [p.id, (p.email ?? '').toLowerCase()]))
  const nomePorEmail = new Map(colaboradores.map((c) => [(c.email_oficial ?? '').toLowerCase(), c.nome_completo]))
  const corretorDe = (criadoPor) => nomePorEmail.get(emailPorPerfil.get(criadoPor)) ?? null
  const passa = (p) => dentro(p.criada_em, periodo) && (filtros.corretor === 'todos' || corretorDe(p.criado_por) === filtros.corretor)
  const linhas = [
    ...(filtros.finalidade === 'Aluguel' ? [] : venda.map((p) => ({ finalidade: 'Venda', criada_em: p.timestamp_criacao, criado_por: p.criado_por, valor: Number(p.valor_proposta ?? 0), aberta: ABERTA_VENDA(p.status) }))),
    ...(filtros.finalidade === 'Venda' ? [] : locacao.map((p) => ({ finalidade: 'Aluguel', criada_em: p.timestamp_criacao, criado_por: p.criado_por, valor: Number(p.valor_oferta ?? p.valor ?? 0), aberta: ABERTA_LOCACAO(p.status) }))),
  ].filter(passa)
  const resumo = (f) => {
    const l = linhas.filter((p) => p.finalidade === f)
    const abertas = l.filter((p) => p.aberta)
    return { finalidade: f, total: l.length, abertas: abertas.length, valorMesa: abertas.reduce((s, p) => s + p.valor, 0) }
  }
  return { porFinalidade: ['Venda', 'Aluguel'].filter((f) => filtros.finalidade === 'todas' || filtros.finalidade === f).map(resumo), total: linhas.length }
}
