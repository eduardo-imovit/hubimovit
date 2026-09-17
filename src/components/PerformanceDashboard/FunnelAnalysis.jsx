import { calculateTrend, formatCurrency, formatNumber } from '../../utils/performanceCalculations'

// Análise por etapa de funil (Topo / Meio / Fundo).
// Props: { data, filters } — data de usePerformanceDashboard.
// Topo e Meio: tabela de campanhas (data.campanhasPorFunil[etapa]).
// Fundo: cards do CRM (data.funilCRM) + tabela se houver campanhas classificadas como fundo.

const CANAL_LABEL = { google: 'Google', meta: 'Meta' }

const SECOES = [
  {
    etapa: 'topo',
    emoji: '🔭',
    titulo: 'Topo de funil',
    pergunta: 'Estamos alcançando gente suficiente?',
    metrica: { key: 'alcance', label: 'Alcance' },
  },
  {
    etapa: 'meio',
    emoji: '🎯',
    titulo: 'Meio de funil',
    pergunta: 'Quantos avançaram para lead qualificado?',
    metrica: { key: 'leads', label: 'Leads' },
  },
  {
    etapa: 'fundo',
    emoji: '🤝',
    titulo: 'Fundo de funil',
    pergunta: 'Quantos viraram negócio?',
    metrica: { key: 'leads', label: 'Leads' },
  },
]

function soma(lista, acessar) {
  return lista.reduce((acc, item) => acc + (Number(acessar(item)) || 0), 0)
}

function corTrend(trendClass) {
  if (trendClass === 'up') return 'text-green-600'
  if (trendClass === 'down') return 'text-red-600'
  return 'text-slate-400'
}

function classificarStatus(pct) {
  if (pct == null) return { icone: '—', texto: 'sem meta', classe: 'bg-slate-100 text-slate-500' }
  if (pct >= 90) return { icone: '✓', texto: 'acima da meta', classe: 'bg-green-50 text-green-700' }
  if (pct >= 70) return { icone: '⚠', texto: 'atenção', classe: 'bg-amber-50 text-amber-700' }
  return { icone: '❌', texto: 'crítico', classe: 'bg-danger-50 text-danger-700' }
}

function LinhaCampanha({ campanha, metrica }) {
  const realizado = campanha.realizadoUltimaSemana?.[metrica.key] ?? 0
  const anterior = campanha.realizadoSemanaAnterior?.[metrica.key] ?? 0
  const trend = calculateTrend(realizado, anterior)
  const pct = campanha.percentualAtingido
  const status = classificarStatus(pct)
  const metaLeads = campanha.metaSemanal?.leads ?? 0

  return (
    <tr>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800">{campanha.campanha}</div>
        <div className="text-xs text-slate-400">{CANAL_LABEL[campanha.canal] ?? campanha.canal ?? '—'}</div>
      </td>
      <td className="px-3 py-2 tabular-nums text-slate-700">{formatNumber(realizado)}</td>
      <td className="px-3 py-2 text-slate-600">
        {metaLeads > 0 ? (
          <span className="tabular-nums">
            {formatNumber(metaLeads, 1)} <span className="text-slate-300">·</span>{' '}
            {pct != null ? `${formatNumber(pct, 0)}%` : '—'}
          </span>
        ) : (
          <span className="text-slate-400">sem meta</span>
        )}
      </td>
      <td className={`px-3 py-2 font-medium ${corTrend(trend.class)}`}>
        {trend.arrow} {trend.label}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.classe}`}
        >
          {status.icone} {status.texto}
        </span>
      </td>
    </tr>
  )
}

function TabelaCampanhas({ campanhas, metrica }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Campanha</th>
            <th className="px-3 py-2 font-medium">{metrica.label}</th>
            <th className="px-3 py-2 font-medium">Meta · %</th>
            <th className="px-3 py-2 font-medium">Tendência</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campanhas.map((campanha) => (
            <LinhaCampanha key={campanha.campanha} campanha={campanha} metrica={metrica} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CrmCards({ funilCRM, finalidade }) {
  const emAtendimento = funilCRM?.emAtendimento ?? 0
  const fechados = funilCRM?.negocioFechado ?? 0
  const descartados = funilCRM?.descartado ?? 0
  const total = emAtendimento + fechados + descartados
  const sufixo = finalidade && finalidade !== 'todos' ? ` · ${finalidade}` : ''

  const cards = [
    { label: 'Em Atendimento', valor: emAtendimento, meta: `pipeline aberto${sufixo}` },
    {
      label: 'Negócios Fechados',
      valor: fechados,
      meta: total > 0 ? `${formatNumber((fechados / total) * 100, 1)}% de conversão${sufixo}` : `—${sufixo}`,
    },
    {
      label: 'Descartados',
      valor: descartados,
      meta: total > 0 ? `${formatNumber((descartados / total) * 100, 0)}% do total${sufixo}` : `—${sufixo}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-600">{card.label}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(card.valor)}</div>
          <div className="text-xs text-slate-400">{card.meta}</div>
        </div>
      ))}
    </div>
  )
}

function SecaoFunil({ secao, campanhas, funilCRM, finalidade }) {
  const totalRealizado = soma(campanhas, (c) => c.realizadoUltimaSemana?.investimento)
  const totalMeta = soma(campanhas, (c) => c.metaSemanal?.investimento)

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span aria-hidden="true">{secao.emoji}</span>
          {secao.titulo}
        </h3>
        <p className="text-sm text-slate-500">{secao.pergunta}</p>
        {campanhas.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {formatCurrency(totalRealizado)} investidos no período · meta {formatCurrency(totalMeta)}
          </p>
        )}
      </header>

      {funilCRM && <CrmCards funilCRM={funilCRM} finalidade={finalidade} />}

      {campanhas.length > 0 ? (
        <TabelaCampanhas campanhas={campanhas} metrica={secao.metrica} />
      ) : (
        !funilCRM && (
          <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-400">
            Nenhuma campanha classificada nesta etapa no período.
          </p>
        )
      )}
    </section>
  )
}

export default function FunnelAnalysis({ data, filters }) {
  if (!data) return null

  return (
    <div className="flex flex-col gap-8">
      {SECOES.map((secao) => (
        <SecaoFunil
          key={secao.etapa}
          secao={secao}
          campanhas={data.campanhasPorFunil?.[secao.etapa] ?? []}
          funilCRM={secao.etapa === 'fundo' ? data.funilCRM : null}
          finalidade={filters?.finalidade}
        />
      ))}
    </div>
  )
}
