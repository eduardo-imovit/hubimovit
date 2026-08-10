function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function MiniFunilEtapas({ grupos }) {
  const totalInvestimento = grupos.reduce((acc, g) => acc + g.investimento, 0)

  if (totalInvestimento === 0) {
    return (
      <div className="mini-funnel">
        <div className="mini-funnel-title">Investimento por etapa</div>
        <div className="stat-sub is-muted">Sem campanhas no período.</div>
      </div>
    )
  }

  return (
    <div className="mini-funnel">
      <div className="mini-funnel-title">Investimento por etapa</div>
      {grupos.map((g) => {
        const pct = (g.investimento / totalInvestimento) * 100
        return (
          <div className="mini-funnel-row" key={g.etapa}>
            <div className="mini-funnel-row-label">
              <span>{g.label}</span>
              <span>{moeda(g.investimento)}</span>
            </div>
            <div className="mini-funnel-track">
              <div className="mini-funnel-fill" style={{ width: `${Math.max(pct, 3)}%`, background: g.cor }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
