import { useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CORES = ['var(--coral)', 'var(--investidores)', 'var(--ninho-vazio)', 'var(--casais)', 'var(--ninho-cheio)', 'var(--solteiros)']

// Agrega atendimentos descartados por fase: conta por fase_ordem e calcula
// pct_do_total a partir da soma (nunca faz media de percentuais prontos).
function agregarDescartes(linhas) {
  const total = linhas.length
  const porFase = new Map()
  for (const l of linhas) {
    const acc = porFase.get(l.fase_ordem) ?? { fase_ordem: l.fase_ordem, fase_label: l.fase_label, qtd: 0 }
    acc.qtd += 1
    porFase.set(l.fase_ordem, acc)
  }
  return [...porFase.values()]
    .map((f) => ({ ...f, pct_do_total: total > 0 ? Math.round((f.qtd / total) * 1000) / 10 : 0 }))
    .sort((a, b) => a.fase_ordem - b.fase_ordem)
}

function TooltipDescarte({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.fase_label}</div>
      <div>{d.qtd} descartes — {d.pct_do_total}%</div>
    </div>
  )
}

export default function LeadsDescartesChart({ dados }) {
  const [finalidade, setFinalidade] = useState('Venda')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const filtrados = useMemo(
    () => dados.filter((d) =>
      d.finalidade === finalidade &&
      (!dataInicio || d.data_encerramento >= dataInicio) &&
      (!dataFim || d.data_encerramento <= dataFim)
    ),
    [dados, finalidade, dataInicio, dataFim]
  )

  const porFase = useMemo(() => agregarDescartes(filtrados), [filtrados])

  return (
    <div>
      <div className="filters-bar">
        <div className="segmented">
          <button type="button" className={finalidade === 'Venda' ? 'is-active' : ''} onClick={() => setFinalidade('Venda')}>Venda</button>
          <button type="button" className={finalidade === 'Aluguel' ? 'is-active' : ''} onClick={() => setFinalidade('Aluguel')}>Aluguel</button>
        </div>
        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} title="Descarte a partir de" />
        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Descarte até" />
        {(dataInicio || dataFim) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDataInicio(''); setDataFim('') }}>
            Limpar período
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        {porFase.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Sem descartes para {finalidade.toLowerCase()}</div>
          </div>
        ) : (
          <div style={{ height: 260, flex: '1 1 320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porFase} dataKey="qtd" nameKey="fase_label" innerRadius={60} outerRadius={100} paddingAngle={2} isAnimationActive={false}>
                  {porFase.map((d, i) => <Cell key={d.fase_label} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip content={<TooltipDescarte />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => {
                    const d = porFase.find((x) => x.fase_label === value)
                    return <span style={{ color: 'var(--grafite)', fontSize: 'var(--text-xs)' }}>{value} — {d?.pct_do_total}%</span>
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="stat-card" style={{ flex: '0 1 260px' }}>
          <div className="stat-sub" style={{ color: 'var(--danger)' }}>
            0% dos descartes tem motivo registrado no CRM
          </div>
        </div>
      </div>
    </div>
  )
}
