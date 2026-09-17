import { formatCurrency, formatNumber } from '../../utils/performanceCalculations'

// Recomendações automáticas do Dashboard de Performance.
// Props: { data, anomalies } — data de usePerformanceDashboard, anomalies de AnomaliesOpportunities.
// 5 regras condicionais; entram no máximo 5 cards, numerados na ordem em que disparam.

function todasCampanhas(data) {
  const f = data?.campanhasPorFunil ?? {}
  return [...(f.topo ?? []), ...(f.meio ?? []), ...(f.fundo ?? [])]
}

function soma(lista, acessar) {
  return lista.reduce((acc, item) => acc + (Number(acessar(item)) || 0), 0)
}

function razao(num, den) {
  return Number(den) > 0 ? Number(num) / Number(den) : null
}

function variacaoPct(atual, anterior) {
  return Number(anterior) > 0 ? ((Number(atual) - anterior) / anterior) * 100 : null
}

function media(valores) {
  const nums = valores.filter((v) => v != null)
  return nums.length ? nums.reduce((a, v) => a + v, 0) / nums.length : null
}

function gerarRecomendacoes(data, anomalies) {
  const campanhas = todasCampanhas(data)
  const usados = new Set()
  const recs = []

  const cpl = (c) => razao(c.realizadoUltimaSemana?.investimento, c.realizadoUltimaSemana?.leads)
  const cpc = (c) => razao(c.realizadoUltimaSemana?.investimento, c.realizadoUltimaSemana?.cliques)
  const cpcAnterior = (c) => razao(c.realizadoSemanaAnterior?.investimento, c.realizadoSemanaAnterior?.cliques)
  const ctr = (c) => razao(c.realizadoUltimaSemana?.cliques, c.realizadoUltimaSemana?.alcance)

  const investimentoMedio = campanhas.length
    ? soma(campanhas, (c) => c.realizadoUltimaSemana?.investimento) / campanhas.length
    : 0
  const ctrMedio = media(campanhas.map(ctr))

  // 1. Aumentar — over-performer (> 200% da meta)
  const over = campanhas
    .filter((c) => (c.percentualAtingido ?? 0) > 200)
    .sort((a, b) => b.percentualAtingido - a.percentualAtingido)[0]
  if (over) {
    usados.add(over.campanha)
    const inv = over.realizadoUltimaSemana?.investimento ?? 0
    const orcamentoBaixo = inv < investimentoMedio
    recs.push({
      titulo: `Aumentar ${over.campanha}`,
      body:
        `${orcamentoBaixo ? 'Campanha com orçamento abaixo da média' : 'Campanha'} gerou ` +
        `${formatNumber(over.realizadoUltimaSemana?.leads ?? 0)} leads (${formatNumber(over.percentualAtingido, 0)}% da meta). ` +
        `Aumentar orçamento em +50% — de ${formatCurrency(inv)} para ${formatCurrency(inv * 1.5)} no período.`,
    })
  }

  // 2. Pausar/reformular — performance < 50% da meta
  const fraca = campanhas
    .filter((c) => (c.metaSemanal?.leads ?? 0) > 0 && (c.percentualAtingido ?? 0) < 50 && !usados.has(c.campanha))
    .sort((a, b) => (a.percentualAtingido ?? 0) - (b.percentualAtingido ?? 0))[0]
  if (fraca) {
    usados.add(fraca.campanha)
    recs.push({
      titulo: `Pausar/reformular ${fraca.campanha}`,
      body:
        `Performance em ${formatNumber(fraca.percentualAtingido ?? 0, 0)}% da meta com ` +
        `${formatCurrency(fraca.realizadoUltimaSemana?.investimento ?? 0)} investidos. ` +
        'Queda crítica detectada — testar novo criativo antes de expandir, ou pausar.',
    })
  }

  // 3. Investigar — sinal específico de CPC/CTR fora da curva
  const suspeita = campanhas
    .filter((c) => !usados.has(c.campanha))
    .map((c) => {
      const varCpc = variacaoPct(cpc(c), cpcAnterior(c))
      const desvioCtr = ctrMedio ? ((ctr(c) - ctrMedio) / ctrMedio) * 100 : null
      return { c, varCpc, desvioCtr }
    })
    .filter((x) => (x.varCpc != null && x.varCpc > 30) || (x.desvioCtr != null && Math.abs(x.desvioCtr) > 40))
    .sort((a, b) => Math.abs(b.desvioCtr ?? 0) + (b.varCpc ?? 0) - (Math.abs(a.desvioCtr ?? 0) + (a.varCpc ?? 0)))[0]
  if (suspeita) {
    usados.add(suspeita.c.campanha)
    const partes = []
    if (suspeita.varCpc != null && suspeita.varCpc > 30) {
      partes.push(`CPC subiu ${formatNumber(suspeita.varCpc, 0)}% vs. período anterior`)
    }
    if (suspeita.desvioCtr != null && suspeita.desvioCtr > 40) {
      partes.push(`CTR ${formatNumber(suspeita.desvioCtr, 0)}% acima da média das campanhas`)
    } else if (suspeita.desvioCtr != null && suspeita.desvioCtr < -40) {
      partes.push(`CTR ${formatNumber(Math.abs(suspeita.desvioCtr), 0)}% abaixo da média`)
    }
    const positivo = suspeita.desvioCtr != null && suspeita.desvioCtr > 40
    recs.push({
      titulo: `Investigar ${suspeita.c.campanha}`,
      body:
        `${partes.join(' e ')}. ` +
        (positivo
          ? 'Público muito qualificado — considere uma campanha dedicada de geração de leads.'
          : 'Revisar leilão, palavras-chave e qualidade do criativo antes de manter a verba.'),
    })
  } else if (anomalies.length) {
    // Sem sinal de dados: aproveita uma anomalia que não seja de campanha já citada.
    const a = anomalies.find((an) => ![...usados].some((nome) => an.titulo.includes(nome)))
    if (a) {
      recs.push({ titulo: `Investigar: ${a.titulo}`, body: `${a.descricao} ${a.acao}`.trim() })
    }
  }

  // 4. Manter estável — performance entre 80% e 120% da meta
  const estaveis = campanhas.filter(
    (c) =>
      !usados.has(c.campanha) &&
      c.percentualAtingido != null &&
      c.percentualAtingido >= 80 &&
      c.percentualAtingido <= 120,
  )
  const manter =
    estaveis.filter((c) => cpl(c) != null).sort((a, b) => cpl(a) - cpl(b))[0] ?? estaveis[0]
  if (manter) {
    usados.add(manter.campanha)
    const c = cpl(manter)
    recs.push({
      titulo: `Manter ${manter.campanha} estável`,
      body:
        `Performance em ${formatNumber(manter.percentualAtingido, 0)}% da meta` +
        `${c != null ? ` com CPL de ${formatCurrency(c)}` : ''}. ` +
        'Melhor equilíbrio do período — duplicar o segmento de melhor performance sem mexer no orçamento.',
    })
  }

  // 5. Priorizar ação de vendas — conversão do CRM > 12%
  const crm = data.funilCRM ?? {}
  const totalCRM = (crm.emAtendimento ?? 0) + (crm.negocioFechado ?? 0) + (crm.descartado ?? 0)
  const taxaConv = totalCRM > 0 ? ((crm.negocioFechado ?? 0) / totalCRM) * 100 : 0
  if (taxaConv > 12) {
    recs.push({
      titulo: 'Priorizar ação de vendas',
      body:
        `${formatNumber(crm.emAtendimento ?? 0)} atendimentos em aberto. ` +
        `Taxa de conversão em ${formatNumber(taxaConv, 1)}% — sólida, mas há espaço para fechar mais. ` +
        'Reforçar o follow-up dos leads no fundo de funil.',
    })
  }

  return recs
}

function CardRecomendacao({ numero, rec }) {
  return (
    <li className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white">
        {numero}
      </span>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-slate-800">{rec.titulo}</div>
        <p className="text-xs leading-relaxed text-slate-500">{rec.body}</p>
      </div>
    </li>
  )
}

export default function Recommendations({ data, anomalies = [] }) {
  if (!data) return null

  const recomendacoes = gerarRecomendacoes(data, anomalies)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-slate-900">Recomendações do período</h3>

      {recomendacoes.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          Nenhuma recomendação automática — performance dentro do esperado.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {recomendacoes.map((rec, i) => (
            <CardRecomendacao key={rec.titulo} numero={i + 1} rec={rec} />
          ))}
        </ol>
      )}
    </section>
  )
}
