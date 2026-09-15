import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const FINALIDADES = [
  { valor: 'Ambos', label: 'Ambos' },
  { valor: 'Venda', label: 'Venda' },
  { valor: 'Aluguel', label: 'Aluguel' },
]

const PERIODOS = [
  { valor: '3', label: '3 meses' },
  { valor: '6', label: '6 meses' },
  { valor: '12', label: '12 meses' },
  { valor: 'tudo', label: 'Tudo' },
]

// Agrega leads por etapa (somando os meses do periodo) e recalcula as taxas
// a partir da soma — nunca faz media das taxas ja calculadas pela view.
function agregarPorEtapa(linhas) {
  const porEtapa = new Map()
  for (const linha of linhas) {
    const acc = porEtapa.get(linha.etapa_ordem) ?? {
      etapa_ordem: linha.etapa_ordem,
      etapa_label: linha.etapa_label,
      leads: 0,
    }
    acc.leads += linha.leads
    porEtapa.set(linha.etapa_ordem, acc)
  }

  const etapas = [...porEtapa.values()].sort((a, b) => a.etapa_ordem - b.etapa_ordem)
  const primeiraEtapa = etapas[0]?.leads ?? 0

  return etapas.map((etapa, i) => ({
    ...etapa,
    conv_etapa: i === 0 || etapas[i - 1].leads === 0 ? null : (etapa.leads / etapas[i - 1].leads) * 100,
    conv_acumulada: primeiraEtapa === 0 ? null : (etapa.leads / primeiraEtapa) * 100,
  }))
}

function TooltipEtapa({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600 }}>{d.etapa_label}</div>
      <div>{d.leads} leads</div>
      <div>{d.conv_etapa == null ? '—' : `${d.conv_etapa.toFixed(1)}%`} vs. etapa anterior</div>
      <div>{d.conv_acumulada == null ? '—' : `${d.conv_acumulada.toFixed(1)}%`} acumulado desde o início</div>
    </div>
  )
}

function RotuloEtapa({ x, y, width, height, index, etapas }) {
  const linha = etapas[index]
  if (!linha) return null
  const conv = linha.conv_etapa == null ? '—' : `${linha.conv_etapa.toFixed(1)}%`
  return (
    <text x={x + width + 8} y={y + height / 2} dy={4} fontSize={11} fill="var(--grafite)">
      {linha.leads} · {conv}
    </text>
  )
}

export default function LeadsFunilChart({ dados }) {
  const [finalidade, setFinalidade] = useState('Ambos')
  const [periodo, setPeriodo] = useState('6')

  const mesesDisponiveis = useMemo(
    () => [...new Set(dados.map((d) => d.mes_entrada))].sort(),
    [dados]
  )

  const mesesSelecionados = useMemo(() => {
    if (periodo === 'tudo') return mesesDisponiveis
    return mesesDisponiveis.slice(-Number(periodo))
  }, [mesesDisponiveis, periodo])

  const etapas = useMemo(() => {
    const filtradas = dados.filter(
      (d) => (finalidade === 'Ambos' || d.finalidade === finalidade) && mesesSelecionados.includes(d.mes_entrada)
    )
    return agregarPorEtapa(filtradas)
  }, [dados, finalidade, mesesSelecionados])

  return (
    <div>
      <div className="filters-bar">
        <div className="segmented">
          {FINALIDADES.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={finalidade === f.valor ? 'is-active' : ''}
              onClick={() => setFinalidade(f.valor)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              className={periodo === p.valor ? 'is-active' : ''}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {etapas.length === 0 ? (
        <div className="hub-loading">Sem dados para o período selecionado.</div>
      ) : (
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={etapas} layout="vertical" margin={{ left: 8, right: 96, top: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--champagne)" />
              <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
              <YAxis type="category" dataKey="etapa_label" width={120} fontSize={11} stroke="var(--grafite-soft)" />
              <Tooltip content={<TooltipEtapa />} cursor={{ fill: 'var(--champagne)', opacity: 0.4 }} />
              <Bar dataKey="leads" fill="var(--coral)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="leads" content={(props) => <RotuloEtapa {...props} etapas={etapas} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
