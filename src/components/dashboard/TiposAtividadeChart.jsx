import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function TiposAtividadeChart({ dados }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 40 }}>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="tipo" fontSize={10} stroke="var(--grafite-soft)" interval={0} angle={-25} textAnchor="end" height={70} />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip
            contentStyle={{ background: 'var(--branco)', border: '1px solid var(--champagne)', borderRadius: 8, fontSize: 'var(--text-xs)' }}
            cursor={{ fill: 'var(--champagne)', opacity: 0.4 }}
          />
          <Legend wrapperStyle={{ fontSize: 'var(--text-xs)' }} />
          <Bar dataKey="Realizada" stackId="atividade" fill="var(--success)" />
          <Bar dataKey="Pendente" stackId="atividade" fill="var(--warning)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
