import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TooltipSeveridade({ active, payload, sufixo }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.bucket}</div>
      <div>{d.total} {sufixo}</div>
    </div>
  )
}

export default function SeveridadeBarChart({ dados, sufixo = 'atendimentos' }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="bucket" fontSize={10} stroke="var(--grafite-soft)" interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip content={(props) => <TooltipSeveridade {...props} sufixo={sufixo} />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {dados.map((d) => (
              <Cell key={d.bucket} fill={d.cor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
