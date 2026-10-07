// Painel Dash ▸ Adm locação (docs/01-prd.md §5.13, Schema §2.10): contas da
// carteira de contratos administrados. Tudo roda no navegador sobre as views
// vw_carteira_locacao, vw_cobrancas_locacao, vw_carteira_locacao_mensal,
// vw_recebimentos_locacao_mensal e vw_proprietarios_locacao.

import { diasEntre, mediana, pct, somarDias } from './paineis'

export const FILTROS_ADM_LOCACAO = { destinacao: 'todas', tipo: 'todos', garantia: 'todas', indice: 'todos' }

/** R$ 1,30 mi · R$ 65,1 mil · R$ 850 */
export function fmtMoedaCurta(v) {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
  if (a >= 10_000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** '2026-09-01' → 'set/26' */
export const rotuloMes = (iso) => `${NOME_MES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`

const soma = (linhas, campo) => linhas.reduce((s, l) => s + (Number(l[campo]) || 0), 0)
const contar = (linhas, chave) => {
  const m = new Map()
  for (const l of linhas) {
    const k = (typeof chave === 'function' ? chave(l) : l[chave]) || 'Não informado'
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([rotulo, n]) => ({ rotulo, n })).sort((a, b) => b.n - a.n)
}

export function opcoesFiltros(contratos) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const distintos = (campo) => [...new Set(ativos.map((c) => c[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { destinacao: distintos('destinacao'), tipo: distintos('imovel_tipo'), garantia: distintos('garantia'), indice: distintos('indice_reajuste') }
}

export function aplicarFiltros(contratos, f) {
  return contratos.filter(
    (c) =>
      (f.destinacao === 'todas' || c.destinacao === f.destinacao) &&
      (f.tipo === 'todos' || c.imovel_tipo === f.tipo) &&
      (f.garantia === 'todas' || c.garantia === f.garantia) &&
      (f.indice === 'todos' || c.indice_reajuste === f.indice)
  )
}

export function descreverRecorte(f) {
  const partes = []
  if (f.destinacao !== 'todas') partes.push(f.destinacao)
  if (f.tipo !== 'todos') partes.push(f.tipo)
  if (f.garantia !== 'todas') partes.push(`garantia ${f.garantia.toLowerCase()}`)
  if (f.indice !== 'todos') partes.push(`índice ${f.indice}`)
  return partes.length ? partes.join(' · ') : 'Toda a carteira'
}

/** Manchete e capítulo 1: carteira hoje e o que entra para a Imovit. */
export function resumoCarteira(contratos, recebimentosMensais, hoje) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const atrasados = ativos.filter((c) => c.status === 'Atrasado')
  const somaAluguel = soma(ativos, 'valor_aluguel')
  const admPrevista = soma(ativos, 'receita_adm')

  const mesAtual = `${hoje.slice(0, 7)}-01`
  const meses = [...recebimentosMensais].sort((a, b) => a.mes.localeCompare(b.mes))
  const fechados = meses.filter((m) => m.mes < mesAtual)
  const ultimo = fechados.at(-1) ?? null
  const anterior = fechados.at(-2) ?? null
  const corrente = meses.find((m) => m.mes === mesAtual) ?? null

  return {
    ativos: ativos.length,
    emAtivacao: contratos.filter((c) => c.situacao === 'Moderação').length,
    saudaveis: ativos.length - atrasados.length,
    atrasados: atrasados.length,
    somaAluguel,
    ticketMedio: ativos.length ? somaAluguel / ativos.length : null,
    admPrevista,
    taxaMedia: pct(admPrevista, somaAluguel),
    admUltimoMes: ultimo ? { mes: ultimo.mes, valor: Number(ultimo.adm_recebida), intermediacao: Number(ultimo.intermediacao_recebida), pagantes: ultimo.contratos_pagantes } : null,
    admVariacao: ultimo && anterior && Number(anterior.adm_recebida) > 0 ? pct(Number(ultimo.adm_recebida) - Number(anterior.adm_recebida), Number(anterior.adm_recebida)) : null,
    admMesCorrente: corrente ? Number(corrente.adm_recebida) : 0,
    serieAdm: fechados.slice(-12).map((m) => ({ mes: m.mes, rotulo: rotuloMes(m.mes), adm: Number(m.adm_recebida), intermediacao: Number(m.intermediacao_recebida) })),
  }
}

/**
 * Capítulo 2: novos × rescindidos, rotatividade e permanência.
 * Regra do CRM (conferida em 07/10): novos pela data de início, encerrados pela data de rescisão.
 */
export function crescimento(contratos, mensal, hoje) {
  const serie = [...mensal].sort((a, b) => a.mes.localeCompare(b.mes))
  const ultimos24 = serie.slice(-24).map((m) => ({ mes: m.mes, rotulo: rotuloMes(m.mes), entradas: m.entradas, saidas: m.saidas, ativos: m.ativos_fim_mes }))
  const ultimos12 = serie.slice(-12)
  const entradas12 = ultimos12.reduce((s, m) => s + m.entradas, 0)
  const saidas12 = ultimos12.reduce((s, m) => s + m.saidas, 0)
  const mediaAtivos = ultimos12.length ? ultimos12.reduce((s, m) => s + m.ativos_fim_mes, 0) / ultimos12.length : null

  const umAno = somarDias(hoje, -365)
  const novos = contratos.filter((c) => ['Ativo', 'Rescindido'].includes(c.situacao) && c.data_inicio >= umAno)
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const encerrados = contratos.filter((c) => c.situacao === 'Rescindido' && c.data_rescisao && c.data_rescisao >= somarDias(hoje, -730))

  return {
    serie: ultimos24,
    periodo12: ultimos12.length ? `${rotuloMes(ultimos12[0].mes)} a ${rotuloMes(ultimos12.at(-1).mes)}` : '12 meses',
    semDataRescisao: contratos.filter((c) => c.situacao === 'Rescindido' && !c.data_rescisao).length,
    entradas12,
    saidas12,
    saldo12: entradas12 - saidas12,
    rotatividade: mediaAtivos ? pct(saidas12, mediaAtivos) : null,
    aluguelNovos: novos.length ? soma(novos, 'valor_aluguel') / novos.length : null,
    aluguelCarteira: ativos.length ? soma(ativos, 'valor_aluguel') / ativos.length : null,
    permanenciaMeses: mediana(encerrados.map((c) => c.meses_de_contrato)),
    permanenciaN: encerrados.length,
  }
}

const FAIXAS_ALUGUEL = [
  { rotulo: 'Até R$ 3 mil', ate: 3000 },
  { rotulo: 'R$ 3 a 5 mil', ate: 5000 },
  { rotulo: 'R$ 5 a 8 mil', ate: 8000 },
  { rotulo: 'R$ 8 a 15 mil', ate: 15000 },
  { rotulo: 'Acima de R$ 15 mil', ate: Infinity },
]

/** Capítulo 3: bairros, tipos, faixas de aluguel e destinação dos ativos. */
export function ondeEOque(contratos) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const porBairro = new Map()
  for (const c of ativos) {
    const b = c.bairro || 'Não informado'
    const atual = porBairro.get(b) ?? { rotulo: b, n: 0, valor: 0 }
    atual.n += 1
    atual.valor += Number(c.valor_aluguel) || 0
    porBairro.set(b, atual)
  }
  const bairros = [...porBairro.values()].sort((a, b) => b.n - a.n || b.valor - a.valor)
  return {
    total: ativos.length,
    bairros: bairros.slice(0, 10),
    totalBairros: bairros.length,
    tipos: contar(ativos, 'imovel_tipo'),
    faixas: FAIXAS_ALUGUEL.map((f, i) => ({
      rotulo: f.rotulo,
      n: ativos.filter((c) => Number(c.valor_aluguel) <= f.ate && (i === 0 || Number(c.valor_aluguel) > FAIXAS_ALUGUEL[i - 1].ate)).length,
    })),
    destinacao: contar(ativos, 'destinacao'),
  }
}

/** Capítulo 4: quem está saindo e por quê. */
export function saidas(contratos, hoje) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const comAviso = ativos.filter((c) => c.com_aviso).sort((a, b) => (a.data_previsao_rescisao ?? '9').localeCompare(b.data_previsao_rescisao ?? '9'))
  const ultimoTrimestre = ativos.filter((c) => c.dias_para_fim != null && c.dias_para_fim >= 0 && c.dias_para_fim <= 90).sort((a, b) => a.dias_para_fim - b.dias_para_fim)
  const indeterminado = ativos.filter((c) => c.prazo_indeterminado)
  const umAno = somarDias(hoje, -365)
  const rescindidos12 = contratos.filter((c) => c.situacao === 'Rescindido' && c.data_rescisao && c.data_rescisao >= umAno)
  // O Imoview tem dois motivos para a mesma coisa: "Sem Administração" e "Proprietário tirou a administração".
  const motivos = contar(rescindidos12, (c) =>
    /sem administra|tirou a administra/i.test(c.motivo_rescisao ?? '') ? 'Proprietário tirou a administração' : c.motivo_rescisao || 'Sem motivo registrado'
  )
  return {
    comAviso,
    comAvisoValor: soma(comAviso, 'valor_aluguel'),
    comAvisoAdm: soma(comAviso, 'receita_adm'),
    ultimoTrimestre,
    ultimoTrimestreValor: soma(ultimoTrimestre, 'valor_aluguel'),
    indeterminado: indeterminado.length,
    indeterminadoValor: soma(indeterminado, 'valor_aluguel'),
    rescindidos12: rescindidos12.length,
    motivos,
    semAdministracao: motivos.find((m) => m.rotulo === 'Proprietário tirou a administração')?.n ?? 0,
  }
}

/** Capítulo 5: reajustes dos próximos 3 meses e os vencidos. */
export function reajustes(contratos, hoje) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo' && c.data_proximo_reajuste)
  const limite = somarDias(hoje, 90)
  const proximos = ativos.filter((c) => c.data_proximo_reajuste >= hoje && c.data_proximo_reajuste <= limite)
  const porMes = new Map()
  for (const c of proximos) {
    const mes = `${c.data_proximo_reajuste.slice(0, 7)}-01`
    porMes.set(mes, (porMes.get(mes) ?? 0) + 1)
  }
  const porIndice = contar(proximos, 'indice_reajuste').map((i) => ({ ...i, valor: soma(proximos.filter((c) => (c.indice_reajuste || 'Não informado') === i.rotulo), 'valor_aluguel') }))
  const vencidos = ativos.filter((c) => c.reajuste_atrasado).sort((a, b) => a.data_proximo_reajuste.localeCompare(b.data_proximo_reajuste))
  return {
    proximos: proximos.length,
    proximosValor: soma(proximos, 'valor_aluguel'),
    porMes: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, n]) => ({ rotulo: rotuloMes(mes), n })),
    porIndice,
    vencidos,
    vencidosValor: soma(vencidos, 'valor_aluguel'),
  }
}

const ORDEM_FAIXA = ['1-30', '31-60', '61-90', '90+']
const ROTULO_FAIXA = { '1-30': '1 a 30 dias', '31-60': '31 a 60 dias', '61-90': '61 a 90 dias', '90+': 'Mais de 90 dias' }

/** Capítulo 6: inadimplência pela regra do Imoview (contrato "Atrasado") e atenção. */
export function inadimplencia(contratos, cobrancas, hoje) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const codigos = new Set(contratos.map((c) => c.codigo))
  const doRecorte = cobrancas.filter((b) => codigos.has(b.codigo_contrato))
  const inadimplentes = ativos.filter((c) => c.grupo_cobranca === 'inadimplente').sort((a, b) => b.cobranca_vencida_valor - a.cobranca_vencida_valor)
  const vencidasInad = doRecorte.filter((b) => b.grupo_cobranca === 'inadimplente' && !b.pagamento_informado)

  const porGarantia = contar(ativos, 'garantia').map((g) => {
    const doGrupo = ativos.filter((c) => (c.garantia || 'Não informado') === g.rotulo)
    const atrasados = doGrupo.filter((c) => c.grupo_cobranca === 'inadimplente').length
    return { rotulo: g.rotulo, ativos: doGrupo.length, atrasados, taxa: pct(atrasados, doGrupo.length) }
  })

  const pagasSemBaixa = doRecorte.filter((b) => b.pagamento_informado)
  // Uma linha por contrato: o mesmo contrato costuma ter várias cobranças pequenas (encargos) na mesma situação.
  const porContrato = new Map()
  for (const b of pagasSemBaixa) {
    const atual = porContrato.get(b.codigo_contrato) ?? {
      codigo: b.codigo_contrato,
      contrato: contratos.find((c) => c.codigo === b.codigo_contrato),
      cobrancas: 0,
      valor: 0,
      vencimento: b.data_vencimento,
      pagamento: b.data_pagamento_informada,
    }
    atual.cobrancas += 1
    atual.valor += Number(b.saldo) || 0
    if (b.data_vencimento < atual.vencimento) atual.vencimento = b.data_vencimento
    porContrato.set(b.codigo_contrato, atual)
  }
  const semBaixa = [...porContrato.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const foraDaRegua = contratos.filter((c) => c.grupo_cobranca === 'atencao' && c.cobranca_vencida_valor > 0)
  const encerrados = contratos.filter((c) => c.grupo_cobranca === 'encerrado_debito').sort((a, b) => b.cobranca_vencida_valor - a.cobranca_vencida_valor)

  return {
    ativos: ativos.length,
    inadimplentes,
    taxa: pct(inadimplentes.length, ativos.length),
    valor: soma(inadimplentes, 'cobranca_vencida_valor'),
    faixas: ORDEM_FAIXA.map((f) => ({ rotulo: ROTULO_FAIXA[f], valor: soma(vencidasInad.filter((b) => b.faixa === f), 'saldo') })),
    porGarantia,
    semBaixa,
    semBaixaCobrancas: pagasSemBaixa.length,
    semBaixaValor: soma(pagasSemBaixa, 'saldo'),
    // garantia com a maior taxa, entre as que têm ao menos 10 contratos (taxa de 1 contrato não diz nada)
    garantiaPior: porGarantia.filter((g) => g.ativos >= 10).reduce((m, g) => (m == null || g.taxa > m.taxa ? g : m), null)?.rotulo ?? null,
    foraDaRegua,
    encerrados,
    encerradosValor: soma(encerrados, 'cobranca_vencida_valor'),
    diasAtraso: (c) => (c.cobranca_vencida_desde ? diasEntre(c.cobranca_vencida_desde, hoje) : null),
  }
}

/** Capítulo 7: seguro incêndio e garantias com validade. */
export function protecao(contratos) {
  const ativos = contratos.filter((c) => c.situacao === 'Ativo')
  const por = (campo, valor) => ativos.filter((c) => c[campo] === valor)
  const lista = ativos
    .filter((c) => ['vencido', 'vence_30', 'sem_registro'].includes(c.seguro_incendio_situacao) || ['vencida', 'vence_60'].includes(c.garantia_situacao))
    .sort((a, b) => (a.seguro_incendio_fim ?? a.garantia_fim ?? '0').localeCompare(b.seguro_incendio_fim ?? b.garantia_fim ?? '0'))
  return {
    seguroVencido: por('seguro_incendio_situacao', 'vencido').length,
    seguroVence30: por('seguro_incendio_situacao', 'vence_30').length,
    seguroSemRegistro: por('seguro_incendio_situacao', 'sem_registro').length,
    seguroVigente: por('seguro_incendio_situacao', 'vigente').length,
    garantiaVencida: por('garantia_situacao', 'vencida').length,
    garantiaVence60: por('garantia_situacao', 'vence_60').length,
    comValidade: ativos.filter((c) => c.garantia_fim).length,
    lista,
  }
}

/** Capítulo 8: proprietários (não segue os filtros: a view agrega a carteira inteira). */
export function proprietarios(lista) {
  const ordenados = [...lista].sort((a, b) => Number(b.receita_adm) - Number(a.receita_adm))
  const total = soma(ordenados, 'receita_adm')
  const top10 = ordenados.slice(0, 10)
  return {
    total: ordenados.length,
    multiplos: ordenados.filter((p) => p.contratos > 1).length,
    top10,
    concentracaoTop10: pct(soma(top10, 'receita_adm'), total),
    receitaTotal: total,
  }
}
