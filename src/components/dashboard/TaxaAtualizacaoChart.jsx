import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

function TooltipTaxa({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.bucket}</div>
      <div>{d.total} atendimentos em aberto</div>
    </div>
  )
}

export default function TaxaAtualizacaoChart({ dados }) {
  const total = dados.reduce((acc, d) => acc + d.total, 0)

  if (total === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Sem atendimentos em aberto</div>
      </div>
    )
  }

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="bucket" innerRadius={60} outerRadius={100} paddingAngle={2}>
            {dados.map((d) => <Cell key={d.bucket} fill={d.cor} />)}
          </Pie>
          <Tooltip content={<TooltipTaxa />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => {
              const d = dados.find((x) => x.bucket === value)
              const pct = total > 0 ? ((d?.total ?? 0) / total) * 100 : 0
              return <span style={{ color: 'var(--grafite)', fontSize: 'var(--text-xs)' }}>{value} — {pct.toFixed(0)}%</span>
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
