import { FASES_FUNIL } from './atendimentos'

const MS_POR_DIA = 86400000

function diasEntre(inicio, fim) {
  return Math.max(0, Math.floor((fim - inicio) / MS_POR_DIA))
}

/** Ranking de mídias de origem, agrupando o rabo longo em "Outras". */
export function agruparOrigem(atendimentos, limiteTop = 8) {
  const contagem = new Map()
  for (const a of atendimentos) {
    const chave = (a.midia || 'Não informado').trim() || 'Não informado'
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const top = ordenado.slice(0, limiteTop).map(([midia, total]) => ({ midia, total }))
  const outros = ordenado.slice(limiteTop).reduce((acc, [, n]) => acc + n, 0)
  if (outros > 0) top.push({ midia: 'Outras', total: outros })
  return top
}

const BUCKETS_TEMPO_FUNIL = [
  { bucket: '0–3 dias', min: 0, max: 3 },
  { bucket: '4–7 dias', min: 4, max: 7 },
  { bucket: '8–15 dias', min: 8, max: 15 },
  { bucket: '16–30 dias', min: 16, max: 30 },
  { bucket: '31–60 dias', min: 31, max: 60 },
  { bucket: '60+ dias', min: 61, max: Infinity },
]

/**
 * Descartados quase nunca têm data_fechamento registrada no CRM — sem ela não sabemos
 * quanto tempo o lead ficou realmente ativo, então contar "hoje" como fim infla tudo pro
 * balde de 60+ dias. Só calculamos duração real quando existe um fim de fato (fechamento
 * registrado) ou o atendimento ainda está aberto (aí "hoje" é o fim de verdade, não um chute).
 */
function temFimConhecido(a) {
  return a.situacao !== 'Descartado' || Boolean(a.data_fechamento)
}

/** Dias entre entrada e fechamento (ou hoje, se ainda aberto), bucketado e separado por situação. */
export function agruparTempoFunil(atendimentos) {
  const agora = new Date()
  const linhas = BUCKETS_TEMPO_FUNIL.map((b) => ({
    bucket: b.bucket,
    'Em atendimento': 0,
    'Negócio realizado': 0,
    Descartado: 0,
  }))
  let semFechamentoConhecido = 0

  for (const a of atendimentos) {
    if (!a.data_de_entrada || !a.situacao) continue
    if (!temFimConhecido(a)) {
      semFechamentoConhecido += 1
      continue
    }
    const entrada = new Date(a.data_de_entrada)
    const fim = a.data_fechamento ? new Date(a.data_fechamento) : agora
    const dias = diasEntre(entrada, fim)
    const idx = BUCKETS_TEMPO_FUNIL.findIndex((b) => dias >= b.min && dias <= b.max)
    if (idx === -1 || linhas[idx][a.situacao] === undefined) continue
    linhas[idx][a.situacao] += 1
  }
  if (semFechamentoConhecido > 0) {
    linhas.push({ bucket: 'Sem data de fechamento', 'Em atendimento': 0, 'Negócio realizado': 0, Descartado: semFechamentoConhecido })
  }
  return linhas
}

/** Média de dias no funil, só entre atendimentos com fim conhecido (abertos, ou fechados com data registrada). */
export function tempoMedioFunilDias(atendimentos) {
  const agora = new Date()
  const validos = atendimentos.filter((a) => a.data_de_entrada && temFimConhecido(a))
  if (validos.length === 0) return 0
  const total = validos.reduce((acc, a) => {
    const entrada = new Date(a.data_de_entrada)
    const fim = a.data_fechamento ? new Date(a.data_fechamento) : agora
    return acc + diasEntre(entrada, fim)
  }, 0)
  return total / validos.length
}

const BUCKETS_ULTIMO_CONTATO = [
  { bucket: 'Hoje', min: 0, max: 0, cor: 'var(--success)' },
  { bucket: '1–3 dias', min: 1, max: 3, cor: 'var(--success)' },
  { bucket: '4–7 dias', min: 4, max: 7, cor: 'var(--info)' },
  { bucket: '8–15 dias', min: 8, max: 15, cor: 'var(--warning)' },
  { bucket: '16–30 dias', min: 16, max: 30, cor: 'var(--warning)' },
  { bucket: '30+ dias', min: 31, max: Infinity, cor: 'var(--danger)' },
]
const BUCKET_SEM_CONTATO = { bucket: 'Sem contato registrado', cor: 'var(--grafite-fade)' }

/**
 * Recência do último contato registrado, só para atendimentos ainda em aberto
 * (Negócio realizado / Descartado não precisam de acompanhamento de frescor).
 */
export function agruparUltimoContato(atendimentos, resumoPorAtendimento) {
  const agora = new Date()
  const linhas = [...BUCKETS_ULTIMO_CONTATO.map((b) => ({ ...b, total: 0 })), { ...BUCKET_SEM_CONTATO, total: 0 }]

  for (const a of atendimentos) {
    if (a.situacao !== 'Em atendimento') continue
    const resumo = resumoPorAtendimento[a.codigo]
    if (!resumo) {
      linhas[linhas.length - 1].total += 1
      continue
    }
    const dias = diasEntre(new Date(resumo.ultimoContato), agora)
    const idx = BUCKETS_ULTIMO_CONTATO.findIndex((b) => dias >= b.min && dias <= b.max)
    if (idx !== -1) linhas[idx].total += 1
  }
  return linhas
}

const BUCKETS_ATUALIZACOES = [
  { bucket: '0', min: 0, max: 0 },
  { bucket: '1–2', min: 1, max: 2 },
  { bucket: '3–5', min: 3, max: 5 },
  { bucket: '6–10', min: 6, max: 10 },
  { bucket: '10+', min: 11, max: Infinity },
]

/** Quantidade de atividades (ligações, visitas, anotações…) registradas por atendimento. */
export function agruparAtualizacoes(atendimentos, resumoPorAtendimento) {
  const linhas = BUCKETS_ATUALIZACOES.map((b) => ({ bucket: b.bucket, total: 0 }))
  for (const a of atendimentos) {
    const quantidade = resumoPorAtendimento[a.codigo]?.quantidade ?? 0
    const idx = BUCKETS_ATUALIZACOES.findIndex((b) => quantidade >= b.min && quantidade <= b.max)
    if (idx !== -1) linhas[idx].total += 1
  }
  return linhas
}

/** Extrai o bairro de um resumo de imóvel do Imoview: "…, Cambuí - Campinas/SP, CEP …" → "Cambuí". */
function extrairBairro(resumoImovel) {
  const m = resumoImovel.match(/,\s*([^,]+?)\s*-\s*[^,/]+\/[A-Z]{2}\b/)
  return m ? m[1].trim() : null
}

/** Bairros mais visitados, extraídos do endereço das atividades de Visita — aproximação de região de interesse. */
export function agruparBairrosVisitados(atividades, limiteTop = 8) {
  const contagem = new Map()
  for (const a of atividades) {
    if (a.nometipo !== 'Visita' || !a.resumoimovel) continue
    const bairro = extrairBairro(a.resumoimovel)
    if (!bairro) continue
    contagem.set(bairro, (contagem.get(bairro) ?? 0) + 1)
  }
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const top = ordenado.slice(0, limiteTop).map(([bairro, total]) => ({ bairro, total }))
  const outros = ordenado.slice(limiteTop).reduce((acc, [, n]) => acc + n, 0)
  if (outros > 0) top.push({ bairro: 'Outros', total: outros })
  return top
}

/** Quantos atendimentos estão em cada etapa do funil agora (independente da situação). */
export function agruparFunilEtapas(atendimentos) {
  return FASES_FUNIL.map(({ fase, label }) => ({
    etapa: label,
    total: atendimentos.filter((a) => a.fase === fase).length,
  }))
}

/**
 * Volume e taxa de conversão por corretor, ordenado por conversão — mas só entre quem tem
 * volume mínimo de atendimentos. Sem esse piso, 1 negócio em 1 atendimento vira "100% de
 * conversão" e fica acima de corretores com centenas de atendimentos reais.
 * Vendas e locação são times diferentes com funis distintos — chame uma vez para cada
 * finalidade em vez de misturar os dois num ranking só.
 */
export function agruparPorCorretor(atendimentos, limiteTop = 10, volumeMinimo = 15) {
  const mapa = new Map()
  for (const a of atendimentos) {
    const nome = a.corretor || 'Sem corretor'
    if (!mapa.has(nome)) mapa.set(nome, { corretor: nome, total: 0, negocios: 0 })
    const r = mapa.get(nome)
    r.total += 1
    if (a.situacao === 'Negócio realizado') r.negocios += 1
  }
  const corretores = [...mapa.values()].map((r) => ({ ...r, conversao: r.total > 0 ? (r.negocios / r.total) * 100 : 0 }))
  const comVolume = corretores.filter((r) => r.total >= volumeMinimo).sort((a, b) => b.conversao - a.conversao)
  const semVolume = corretores.filter((r) => r.total < volumeMinimo).sort((a, b) => b.total - a.total)
  return [...comVolume, ...semVolume].slice(0, limiteTop)
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Entradas de atendimentos por mês, separadas por finalidade (Venda x Aluguel), nos últimos N meses. */
export function agruparEntradasPorFinalidade(atendimentos, numMeses = 6) {
  const hoje = new Date()
  const meses = []
  for (let i = numMeses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    meses.push({ mes: chave, rotulo: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, Venda: 0, Aluguel: 0 })
  }
  const indice = new Map(meses.map((m, idx) => [m.mes, idx]))
  for (const a of atendimentos) {
    if (!a.data_de_entrada || !a.finalidade) continue
    const idx = indice.get(a.data_de_entrada.slice(0, 7))
    if (idx === undefined) continue
    if (meses[idx][a.finalidade] !== undefined) meses[idx][a.finalidade] += 1
  }
  return meses
}

/** Distribuição dos tipos de atividade registrados, separando realizadas de pendentes. */
export function agruparTiposAtividade(atividades, limiteTop = 8) {
  const mapa = new Map()
  for (const a of atividades) {
    const tipo = a.nometipo || 'Outro'
    if (!mapa.has(tipo)) mapa.set(tipo, { tipo, Realizada: 0, Pendente: 0 })
    const r = mapa.get(tipo)
    if (a.realizada) r.Realizada += 1
    else r.Pendente += 1
  }
  return [...mapa.values()]
    .map((r) => ({ ...r, total: r.Realizada + r.Pendente }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limiteTop)
}

const BUCKETS_PRIMEIRO_CONTATO = [
  { bucket: 'Mesmo dia', min: 0, max: 0, cor: 'var(--success)' },
  { bucket: '1 dia', min: 1, max: 1, cor: 'var(--success)' },
  { bucket: '2–3 dias', min: 2, max: 3, cor: 'var(--info)' },
  { bucket: '4–7 dias', min: 4, max: 7, cor: 'var(--warning)' },
  { bucket: '8–15 dias', min: 8, max: 15, cor: 'var(--warning)' },
  { bucket: '15+ dias', min: 16, max: Infinity, cor: 'var(--danger)' },
]

/** Média de dias entre a entrada do lead e o primeiro contato registrado, só entre os que têm contato. */
export function tempoMedioPrimeiroContatoDias(atendimentos, resumoPorAtendimento) {
  const comContato = atendimentos
    .filter((a) => a.data_de_entrada && resumoPorAtendimento[a.codigo])
    .map((a) => diasEntre(new Date(a.data_de_entrada), new Date(resumoPorAtendimento[a.codigo].primeiroContato)))
  if (comContato.length === 0) return 0
  return comContato.reduce((acc, d) => acc + d, 0) / comContato.length
}

/** Tempo entre a entrada do lead e o primeiro contato registrado — mede agilidade de resposta. */
export function agruparPrimeiroContato(atendimentos, resumoPorAtendimento) {
  const linhas = [...BUCKETS_PRIMEIRO_CONTATO.map((b) => ({ ...b, total: 0 })), { bucket: 'Sem contato registrado', cor: 'var(--grafite-fade)', total: 0 }]
  for (const a of atendimentos) {
    if (!a.data_de_entrada) continue
    const resumo = resumoPorAtendimento[a.codigo]
    if (!resumo) {
      linhas[linhas.length - 1].total += 1
      continue
    }
    const dias = diasEntre(new Date(a.data_de_entrada), new Date(resumo.primeiroContato))
    const idx = BUCKETS_PRIMEIRO_CONTATO.findIndex((b) => dias >= b.min && dias <= b.max)
    if (idx !== -1) linhas[idx].total += 1
  }
  return linhas
}
