import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const MODOS = {
  geral: { label: 'Geral', chaveA: 'leads_novos', labelA: 'Leads novos', chaveB: 'negocios', labelB: 'Negócios' },
  finalidade: { label: 'Venda × Aluguel', chaveA: 'leads_venda', labelA: 'Venda', chaveB: 'leads_aluguel', labelB: 'Aluguel' },
  funil: { label: 'Inbound × Outbound', chaveA: 'leads_inbound', labelA: 'Inbound', chaveB: 'leads_outbound', labelB: 'Outbound' },
}

const mesFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

function mesLabel(mesISO) {
  const texto = mesFormatter.format(new Date(`${mesISO}T12:00:00`))
  return texto.replace('.', '')
}

function TooltipTendencia({ active, payload, label, modo }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const valorA = d[modo.chaveA] ?? d[`${modo.chaveA}Aberto`]
  const valorB = d[modo.chaveB] ?? d[`${modo.chaveB}Aberto`]
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {label}{d.isParcial ? ' (em andamento)' : ''}
      </div>
      <div>{modo.labelA}: {valorA}</div>
      <div>{modo.labelB}: {valorB}</div>
    </div>
  )
}

export default function LeadsTendenciaChart({ dados, propostasAtivas }) {
  const [modoKey, setModoKey] = useState('geral')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const modo = MODOS[modoKey]

  const pontos = useMemo(
    () => [...dados]
      .filter((p) => (!dataInicio || p.mes_entrada >= dataInicio) && (!dataFim || p.mes_entrada <= dataFim))
      .sort((a, b) => a.mes_entrada.localeCompare(b.mes_entrada)),
    [dados, dataInicio, dataFim]
  )

  const propostasResumo = useMemo(() => {
    const porFinalidade = { Venda: { qtd: 0, somaDias: 0 }, Aluguel: { qtd: 0, somaDias: 0 } }
    for (const p of propostasAtivas) {
      const grupo = porFinalidade[p.finalidade]
      if (!grupo) continue
      grupo.qtd += 1
      grupo.somaDias += p.dias_parado ?? 0
    }
    return {
      venda: porFinalidade.Venda.qtd,
      vendaDiasMedio: porFinalidade.Venda.qtd > 0 ? Math.round((porFinalidade.Venda.somaDias / porFinalidade.Venda.qtd) * 10) / 10 : null,
      aluguel: porFinalidade.Aluguel.qtd,
      aluguelDiasMedio: porFinalidade.Aluguel.qtd > 0 ? Math.round((porFinalidade.Aluguel.somaDias / porFinalidade.Aluguel.qtd) * 10) / 10 : null,
    }
  }, [propostasAtivas])

  const dadosChart = useMemo(() => {
    const idxParcial = pontos.findIndex((p) => p.is_mes_parcial)
    return pontos.map((p, i) => {
      const fechado = idxParcial === -1 || i < idxParcial
      const segmentoAberto = idxParcial !== -1 && i >= idxParcial - 1
      return {
        mes: mesLabel(p.mes_entrada),
        isParcial: p.is_mes_parcial,
        [modo.chaveA]: fechado ? p[modo.chaveA] : null,
        [modo.chaveB]: fechado ? p[modo.chaveB] : null,
        [`${modo.chaveA}Aberto`]: segmentoAberto ? p[modo.chaveA] : null,
        [`${modo.chaveB}Aberto`]: segmentoAberto ? p[modo.chaveB] : null,
      }
    })
  }, [pontos, modo])

  return (
    <div className="dash-tendencia-layout">
      <div className="dash-tendencia-cards">
        <div className="stat-card">
          <div className="stat-label">Propostas em aberto — Venda</div>
          <div className="stat-value">{propostasResumo.venda}</div>
          <div className="stat-sub is-muted">
            {propostasResumo.vendaDiasMedio != null ? `parada em média há ${propostasResumo.vendaDiasMedio} dias` : 'sem propostas em aberto'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Propostas em aberto — Aluguel</div>
          <div className="stat-value">{propostasResumo.aluguel}</div>
          <div className="stat-sub is-muted">
            {propostasResumo.aluguelDiasMedio != null ? `parada em média há ${propostasResumo.aluguelDiasMedio} dias` : 'sem propostas em aberto'}
          </div>
        </div>
      </div>

      <div className="dash-tendencia-chart">
        {dadosChart.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Sem meses para exibir</div>
          </div>
        ) : (
          <>
            <div className="filters-bar">
              <div className="segmented">
                {Object.entries(MODOS).map(([chave, m]) => (
                  <button key={chave} type="button" className={modoKey === chave ? 'is-active' : ''} onClick={() => setModoKey(chave)}>
                    {m.label}
                  </button>
                ))}
              </div>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} title="Mês a partir de" />
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Mês até" />
              {(dataInicio || dataFim) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDataInicio(''); setDataFim('') }}>
                  Limpar período
                </button>
              )}
            </div>

            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosChart} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--champagne)" />
                  <XAxis dataKey="mes" fontSize={11} stroke="var(--grafite-soft)" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--grafite-soft)" />
                  <Tooltip content={<TooltipTendencia modo={modo} />} />
                  <Legend
                    formatter={(value) => {
                      if (value === modo.chaveA) return modo.labelA
                      if (value === modo.chaveB) return modo.labelB
                      return null
                    }}
                    payload={[
                      { value: modo.chaveA, type: 'line', color: 'var(--coral)' },
                      { value: modo.chaveB, type: 'line', color: 'var(--investidores)' },
                    ]}
                  />
                  <Line dataKey={modo.chaveA} stroke="var(--coral)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey={`${modo.chaveA}Aberto`} stroke="var(--coral)" strokeWidth={2} strokeDasharray="4 3" strokeOpacity={0.5} dot={false} legendType="none" connectNulls={false} isAnimationActive={false} />
                  <Line dataKey={modo.chaveB} stroke="var(--investidores)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey={`${modo.chaveB}Aberto`} stroke="var(--investidores)" strokeWidth={2} strokeDasharray="4 3" strokeOpacity={0.5} dot={false} legendType="none" connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--grafite-soft)', marginTop: 'var(--space-2)' }}>
              <span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--grafite-fade)', marginRight: 4, verticalAlign: 'middle' }} />
              tracejado = mês em andamento
            </div>
          </>
        )}
      </div>
    </div>
  )
}
