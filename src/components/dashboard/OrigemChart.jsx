import RankingHorizontalChart from './RankingHorizontalChart'

function TooltipOrigem({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : '0'
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.midia}</div>
      <div>{d.total} atendimentos ({pct}%)</div>
    </div>
  )
}

export default function OrigemChart({ dados }) {
  const total = dados.reduce((acc, d) => acc + d.total, 0)
  return <RankingHorizontalChart dados={dados} chaveLabel="midia" renderTooltip={(props) => <TooltipOrigem {...props} total={total} />} />
}
