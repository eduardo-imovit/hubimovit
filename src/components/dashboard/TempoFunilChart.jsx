import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SITUACAO_COR } from '../../lib/atendimentos'

export default function TempoFunilChart({ dados }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="bucket" fontSize={11} stroke="var(--grafite-soft)" />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip
            contentStyle={{ background: 'var(--branco)', border: '1px solid var(--champagne)', borderRadius: 8, fontSize: 'var(--text-xs)' }}
            cursor={{ fill: 'var(--champagne)', opacity: 0.4 }}
          />
          <Legend wrapperStyle={{ fontSize: 'var(--text-xs)' }} />
          {Object.entries(SITUACAO_COR).map(([situacao, cor]) => (
            <Bar key={situacao} dataKey={situacao} stackId="situacao" fill={cor} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
