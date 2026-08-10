import RankingHorizontalChart from './RankingHorizontalChart'

function TooltipBairro({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.bairro}</div>
      <div>{d.total} visitas</div>
    </div>
  )
}

export default function BairrosChart({ dados }) {
  return <RankingHorizontalChart dados={dados} chaveLabel="bairro" cor="var(--investidores)" renderTooltip={TooltipBairro} />
}
