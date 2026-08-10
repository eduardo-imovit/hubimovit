import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function RankingHorizontalChart({ dados, chaveLabel, chaveValor = 'total', cor = 'var(--coral)', renderTooltip, larguraLabel = 170 }) {
  const altura = Math.max(dados.length * 36, 160)

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--champagne)" />
          <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <YAxis type="category" dataKey={chaveLabel} width={larguraLabel} fontSize={11} stroke="var(--grafite-soft)" tick={{ fill: 'var(--grafite)' }} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
          <Bar dataKey={chaveValor} fill={cor} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
