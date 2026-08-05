import { useHomeStats } from '../../hooks/useHomeStats'

export default function DashStats() {
  const { stats, carregando } = useHomeStats()

  const cartoes = [
    { label: 'Atendimentos hoje', valor: stats.atendimentosHoje },
    { label: 'Leads na semana', valor: stats.leadsSemana },
    { label: 'Negócios fechados no mês', valor: stats.negociosMes, destaque: true },
  ]

  return (
    <div className="kpi-grid">
      {cartoes.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value" style={c.destaque ? { color: 'var(--coral)' } : undefined}>
            {carregando ? '—' : c.valor}
          </div>
        </div>
      ))}
    </div>
  )
}
