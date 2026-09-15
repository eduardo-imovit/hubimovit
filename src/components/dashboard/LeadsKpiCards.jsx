function Variacao({ atual, anterior, anteriorMesExiste }) {
  if (!anteriorMesExiste) return <div className="stat-sub is-muted">sem mês anterior</div>
  if (anterior == null) return <div className="stat-sub is-muted">sem dado no mês anterior</div>
  if (anterior === 0) return <div className="stat-sub is-muted">mês anterior zerado</div>

  const valor = ((atual - anterior) / anterior) * 100
  if (valor === 0) return <div className="stat-sub is-muted">= vs. mês anterior</div>

  const subiu = valor > 0
  return (
    <div className="stat-sub" style={{ color: subiu ? 'var(--success)' : 'var(--danger)' }}>
      {subiu ? '▲' : '▼'} {Math.abs(valor).toFixed(1)}% vs. mês anterior
    </div>
  )
}

function CardKpi({ label, valor, atual, anterior, anteriorMesExiste }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{valor}</div>
      <Variacao atual={atual} anterior={anterior} anteriorMesExiste={anteriorMesExiste} />
    </div>
  )
}

export default function LeadsKpiCards({ dados }) {
  const mesesCompletos = [...dados]
    .filter((m) => !m.is_mes_parcial)
    .sort((a, b) => a.mes_entrada.localeCompare(b.mes_entrada))

  const atual = mesesCompletos[mesesCompletos.length - 1]
  const anterior = mesesCompletos[mesesCompletos.length - 2]
  const anteriorMesExiste = anterior != null

  if (!atual) {
    return <div className="hub-loading">Sem mês fechado para exibir ainda.</div>
  }

  return (
    <div className="kpi-grid">
      <CardKpi
        label="Leads no mês"
        valor={atual.leads_novos}
        atual={atual.leads_novos}
        anterior={anterior?.leads_novos}
        anteriorMesExiste={anteriorMesExiste}
      />
      <CardKpi
        label="Negócios fechados"
        valor={atual.negocios}
        atual={atual.negocios}
        anterior={anterior?.negocios}
        anteriorMesExiste={anteriorMesExiste}
      />
      <CardKpi
        label="Taxa de conversão"
        valor={`${atual.taxa_conversao_geral}%`}
        atual={atual.taxa_conversao_geral}
        anterior={anterior?.taxa_conversao_geral}
        anteriorMesExiste={anteriorMesExiste}
      />
      <CardKpi
        label="Ciclo médio de ganho"
        valor={atual.ciclo_medio_ganho != null ? `${atual.ciclo_medio_ganho} dias` : '—'}
        atual={atual.ciclo_medio_ganho}
        anterior={anterior?.ciclo_medio_ganho}
        anteriorMesExiste={anteriorMesExiste}
      />
    </div>
  )
}
