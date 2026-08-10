import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TooltipAtualizacoes({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.bucket} atividade(s)</div>
      <div>{d.total} atendimentos</div>
    </div>
  )
}

export default function AtualizacoesChart({ dados }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="bucket" fontSize={11} stroke="var(--grafite-soft)" />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip content={<TooltipAtualizacoes />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
          <Bar dataKey="total" fill="var(--coral)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
