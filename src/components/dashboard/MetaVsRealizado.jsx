function moeda(valor) {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function pct(realizado, meta) {
  if (!meta) return null
  return (realizado / meta) * 100
}

/** Soma investimento/leads de uma campanha só dentro do período da meta — comparar com o histórico todo infla o % da meta. */
function realizadoDoPeriodo(linhas, campanhaNome, periodoInicio, periodoFim) {
  const doPeriodo = linhas.filter(
    (l) => l.campanha === campanhaNome && l.data >= periodoInicio && l.data <= periodoFim
  )
  return {
    investimento: doPeriodo.reduce((acc, l) => acc + (l.investimento ?? 0), 0),
    leads: doPeriodo.reduce((acc, l) => acc + (l.leads_conversoes ?? 0), 0),
  }
}

export default function MetaVsRealizado({ metasCampanhas, meta, google }) {
  if (metasCampanhas.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Sem metas cadastradas</div>
        <div className="empty-sub">Cadastre metas em <code>metas_campanhas</code> para ver a comparação aqui.</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Período</th>
            <th>Meta investimento</th>
            <th>Realizado</th>
            <th>% da meta</th>
            <th>Meta leads</th>
            <th>Leads realizado</th>
          </tr>
        </thead>
        <tbody>
          {metasCampanhas.map((m) => {
            const linhas = m.canal === 'google' ? google : meta
            const realizado = realizadoDoPeriodo(linhas, m.campanha_nome, m.periodo_inicio, m.periodo_fim)
            const percInvest = pct(realizado.investimento, m.meta_investimento)
            return (
              <tr key={m.id}>
                <td>{m.campanha_nome}</td>
                <td className="num">
                  {new Date(`${m.periodo_inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                </td>
                <td className="num">{moeda(m.meta_investimento)}</td>
                <td className="num">{moeda(realizado.investimento)}</td>
                <td className="num">
                  {percInvest != null ? (
                    <span className={`badge ${percInvest >= 100 ? 'badge-warning' : 'badge-success'}`}>{percInvest.toFixed(0)}%</span>
                  ) : '—'}
                </td>
                <td className="num">{m.meta_leads ?? '—'}</td>
                <td className="num">{Math.round(realizado.leads)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
