import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TooltipMes({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.rotulo}</div>
      <div>Venda: {d.Venda}</div>
      <div>Aluguel: {d.Aluguel}</div>
    </div>
  )
}

export default function EntradasFinalidadeChart({ dados }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="vendaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--coral)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--coral)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="aluguelFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--info)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--champagne)" />
          <XAxis dataKey="rotulo" fontSize={11} stroke="var(--grafite-soft)" />
          <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
          <Tooltip content={<TooltipMes />} cursor={{ stroke: 'var(--coral-light)', strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: 'var(--text-xs)' }} />
          <Area type="monotone" dataKey="Venda" stackId="finalidade" stroke="var(--coral)" strokeWidth={2} fill="url(#vendaFill)" dot={{ r: 3, fill: 'var(--coral)', strokeWidth: 0 }} />
          <Area type="monotone" dataKey="Aluguel" stackId="finalidade" stroke="var(--info)" strokeWidth={2} fill="url(#aluguelFill)" dot={{ r: 3, fill: 'var(--info)', strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
