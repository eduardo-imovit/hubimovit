import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TooltipCorretor({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.corretor}</div>
      <div>{d.total} atendimentos</div>
      <div>{d.negocios} negócios fechados ({d.conversao.toFixed(1)}%)</div>
    </div>
  )
}

export default function CorretorChart({ dados }) {
  const altura = Math.max(dados.length * 36, 160)

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--champagne)" />
          <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <YAxis type="category" dataKey="corretor" width={130} fontSize={11} stroke="var(--grafite-soft)" tick={{ fill: 'var(--grafite)' }} />
          <Tooltip content={<TooltipCorretor />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
          <Bar dataKey="total" fill="var(--coral)" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="conversao" position="right" formatter={(v) => `${v.toFixed(0)}% conv.`} fontSize={10} fill="var(--grafite-soft)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
