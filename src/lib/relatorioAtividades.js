import { diasDaSemana, inicioDaSemanaISO } from './dateUtils'

/** Cargo (colaboradores_raw) → equipe do relatório. Só locação e vendas têm tabela própria; analista só entra no total geral. */
const EQUIPE_POR_CARGO = { locação: 'Locação', vendas: 'Vendas', analista: 'Analista' }

function equipeDoCorretor(codigousuario, colaboradoresPorId) {
  const cargo = colaboradoresPorId.get(codigousuario)?.cargo
  return cargo ? (EQUIPE_POR_CARGO[cargo] ?? null) : null
}

/** Intervalos da semana em foco (segunda a domingo) e da semana anterior, para comparação. */
export function semanasComparacao(dataFocoISO) {
  const inicioAtual = inicioDaSemanaISO(0, dataFocoISO)
  const inicioAnterior = inicioDaSemanaISO(-7, dataFocoISO)
  const diasAtual = diasDaSemana(inicioAtual)
  const diasAnterior = diasDaSemana(inicioAnterior)
  return {
    atual: { inicio: diasAtual[0], fim: diasAtual[6], dias: diasAtual },
    anterior: { inicio: diasAnterior[0], fim: diasAnterior[6], dias: diasAnterior },
  }
}

function periodoDoDia(diaISO, periodo) {
  if (diaISO >= periodo.atual.inicio && diaISO <= periodo.atual.fim) return 'atual'
  if (diaISO >= periodo.anterior.inicio && diaISO <= periodo.anterior.fim) return 'anterior'
  return null
}

function linhaVazia() {
  return { atualRealizadas: 0, atualAgendadas: 0, anteriorRealizadas: 0, anteriorAgendadas: 0 }
}

/** Totais de realizadas/agendadas por equipe (Locação, Vendas, Analista) e o somatório Geral, semana atual x anterior. */
export function resumoPorEquipe(atividades, colaboradores, periodo) {
  const porId = new Map(colaboradores.map((c) => [c.id_corretor_crm, c]))
  const totais = { Locação: linhaVazia(), Vendas: linhaVazia(), Analista: linhaVazia() }

  for (const a of atividades) {
    const equipe = equipeDoCorretor(a.codigousuario, porId)
    if (!equipe || !a.datahorainicio) continue
    const periodoChave = periodoDoDia(a.datahorainicio.slice(0, 10), periodo)
    if (!periodoChave) continue
    totais[equipe][`${periodoChave}Agendadas`] += 1
    if (a.realizada) totais[equipe][`${periodoChave}Realizadas`] += 1
  }

  const geral = linhaVazia()
  for (const t of Object.values(totais)) {
    geral.atualRealizadas += t.atualRealizadas
    geral.atualAgendadas += t.atualAgendadas
    geral.anteriorRealizadas += t.anteriorRealizadas
    geral.anteriorAgendadas += t.anteriorAgendadas
  }

  return { ...totais, Geral: geral }
}

/** Volume por tipo de atividade, separado por equipe (só Locação e Vendas têm tabela própria), semana atual x anterior. */
export function agruparPorEquipeETipo(atividades, colaboradores, periodo) {
  const porId = new Map(colaboradores.map((c) => [c.id_corretor_crm, c]))
  const mapa = { Locação: new Map(), Vendas: new Map() }

  for (const a of atividades) {
    const equipe = equipeDoCorretor(a.codigousuario, porId)
    if (equipe !== 'Locação' && equipe !== 'Vendas') continue
    if (!a.datahorainicio) continue
    const periodoChave = periodoDoDia(a.datahorainicio.slice(0, 10), periodo)
    if (!periodoChave) continue

    const tipo = a.nometipo || 'Outro'
    const porTipo = mapa[equipe]
    if (!porTipo.has(tipo)) porTipo.set(tipo, { tipo, ...linhaVazia() })
    const linha = porTipo.get(tipo)
    linha[`${periodoChave}Agendadas`] += 1
    if (a.realizada) linha[`${periodoChave}Realizadas`] += 1
  }

  return {
    Locação: [...mapa.Locação.values()].sort((a, b) => b.atualAgendadas - a.atualAgendadas),
    Vendas: [...mapa.Vendas.values()].sort((a, b) => b.atualAgendadas - a.atualAgendadas),
  }
}

/** Realizadas/agendadas por dia da semana em foco, Locação x Vendas — para a tabela de distribuição diária. */
export function distribuicaoDiaria(atividades, colaboradores, periodo) {
  const porId = new Map(colaboradores.map((c) => [c.id_corretor_crm, c]))
  const idxPorDia = new Map(periodo.atual.dias.map((d, i) => [d, i]))
  const linhas = periodo.atual.dias.map((dia) => ({
    dia, locacaoRealizadas: 0, locacaoAgendadas: 0, vendasRealizadas: 0, vendasAgendadas: 0,
  }))

  for (const a of atividades) {
    if (!a.datahorainicio) continue
    const i = idxPorDia.get(a.datahorainicio.slice(0, 10))
    if (i === undefined) continue
    const equipe = equipeDoCorretor(a.codigousuario, porId)
    if (equipe !== 'Locação' && equipe !== 'Vendas') continue
    const prefixo = equipe === 'Locação' ? 'locacao' : 'vendas'
    linhas[i][`${prefixo}Agendadas`] += 1
    if (a.realizada) linhas[i][`${prefixo}Realizadas`] += 1
  }

  return linhas
}

/** Variação percentual de `atual` em relação a `anterior` — 100% quando não havia base de comparação. */
export function variacaoPercentual(atual, anterior) {
  if (anterior === 0) return atual > 0 ? 100 : 0
  return ((atual - anterior) / anterior) * 100
}
