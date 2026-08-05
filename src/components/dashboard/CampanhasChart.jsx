import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { agregarPorCampanha } from '../../hooks/useCampanhas'

const COR_CANAL = { Meta: '#E8593C', Google: '#2B4A6B' }

function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function TooltipCampanha({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.campanha}</div>
      <div>Canal: {d.canal}</div>
      <div>Investimento: {moeda(d.investimento)}</div>
      <div>Leads: {d.leads}</div>
      {d.cpl != null && <div>CPL: {moeda(d.cpl)}</div>}
    </div>
  )
}

export default function CampanhasChart({ meta, google }) {
  const metaAgg = agregarPorCampanha(meta).map((c) => ({ ...c, canal: 'Meta' }))
  const googleAgg = agregarPorCampanha(google).map((c) => ({ ...c, canal: 'Google' }))
  const top = [...metaAgg, ...googleAgg].sort((a, b) => b.investimento - a.investimento).slice(0, 10)

  return (
    <div>
      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: 24, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--champagne)" />
            <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} stroke="var(--grafite-soft)" />
            <YAxis type="category" dataKey="campanha" width={160} fontSize={11} stroke="var(--grafite-soft)" tick={{ fill: 'var(--grafite)' }} />
            <Tooltip content={<TooltipCampanha />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
            <Bar dataKey="investimento" radius={[0, 4, 4, 0]}>
              {top.map((c) => (
                <Cell key={c.campanha + c.canal} fill={COR_CANAL[c.canal]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--grafite-soft)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COR_CANAL.Meta, marginRight: 4 }} />Meta Ads</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COR_CANAL.Google, marginRight: 4 }} />Google Ads</span>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 'var(--space-5)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Canal</th>
              <th>Investimento</th>
              <th>Cliques</th>
              <th>Leads</th>
              <th>CPL</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <tr key={c.campanha + c.canal}>
                <td>{c.campanha}</td>
                <td>{c.canal}</td>
                <td className="num">{moeda(c.investimento)}</td>
                <td className="num">{c.cliques}</td>
                <td className="num">{c.leads}</td>
                <td className="num">{c.cpl != null ? moeda(c.cpl) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
