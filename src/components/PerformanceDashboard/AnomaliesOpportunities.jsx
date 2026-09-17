import { detectarAnomalias } from '../../utils/performanceInsights'

// Alertas automáticos do Dashboard de Performance.
// Props: { data } — data de usePerformanceDashboard.
// A lógica das 3 regras vive em src/utils/performanceInsights.js.

const TONS = {
  danger: { card: 'border-l-4 border-danger-600 bg-danger-50', titulo: 'text-danger-700' },
  oportunidade: { card: 'border-l-4 border-accent-600 bg-surface-1', titulo: 'text-slate-800' },
  positivo: { card: 'border-l-4 border-green-600 bg-green-50', titulo: 'text-green-700' },
}

function AlertaCard({ alerta }) {
  const tom = TONS[alerta.tom] ?? TONS.oportunidade
  return (
    <div className={`flex flex-col gap-2 rounded-r-md p-4 ${tom.card}`}>
      <div className={`text-sm font-semibold ${tom.titulo}`}>
        {alerta.emoji} {alerta.titulo}
      </div>
      <p className="text-xs leading-relaxed text-slate-600">{alerta.descricao}</p>
      <p className="text-xs leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">Ação sugerida:</span> {alerta.acao}
      </p>
    </div>
  )
}

export default function AnomaliesOpportunities({ data }) {
  if (!data) return null

  const alertas = detectarAnomalias(data)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-slate-900">Anomalias e oportunidades</h3>

      {alertas.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          Nenhuma anomalia detectada no período.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {alertas.map((alerta) => (
            <AlertaCard key={alerta.chave} alerta={alerta} />
          ))}
        </div>
      )}
    </section>
  )
}
