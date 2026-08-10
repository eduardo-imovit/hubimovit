import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TooltipEtapa({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.etapa}</div>
      <div>{d.total} atendimentos</div>
    </div>
  )
}

export default function FunilEtapasChart({ dados }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 24 }}>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="etapa" fontSize={10} stroke="var(--grafite-soft)" interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip content={<TooltipEtapa />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
          <Bar dataKey="total" fill="var(--coral)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
