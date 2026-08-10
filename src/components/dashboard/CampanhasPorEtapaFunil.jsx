function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function CampanhasPorEtapaFunil({ grupos }) {
  if (grupos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Sem campanhas no período</div>
      </div>
    )
  }

  return (
    <div>
      {grupos.map((g, i) => (
        <details key={g.etapa} className="etapa-group" open={i === 0}>
          <summary>
            <div className="etapa-group-title">
              <span className="etapa-dot" style={{ background: g.cor }} />
              <span className="etapa-group-name">{g.label}</span>
              <span className="etapa-group-count">{g.campanhas.length} campanha{g.campanhas.length === 1 ? '' : 's'}</span>
            </div>
            <div className="etapa-group-stats">
              <span><strong>{moeda(g.investimento)}</strong> investido</span>
              <span><strong>{Math.round(g.leads)}</strong> leads</span>
              {g.cpl != null && <span>CPL <strong>{moeda(g.cpl)}</strong></span>}
            </div>
          </summary>
          <div style={{ overflowX: 'auto' }}>
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
                {g.campanhas.map((c) => (
                  <tr key={c.campanha + c.canal}>
                    <td>{c.campanha}</td>
                    <td>{c.canal}</td>
                    <td className="num">{moeda(c.investimento)}</td>
                    <td className="num">{c.cliques}</td>
                    <td className="num">{Math.round(c.leads)}</td>
                    <td className="num">{c.cpl != null ? moeda(c.cpl) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )
}
