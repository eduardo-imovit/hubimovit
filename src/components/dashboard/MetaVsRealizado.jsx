import { agregarPorCampanha } from '../../hooks/useCampanhas'

function moeda(valor) {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function pct(realizado, meta) {
  if (!meta) return null
  return (realizado / meta) * 100
}

export default function MetaVsRealizado({ metasCampanhas, meta, google }) {
  const realizadoPorCampanha = new Map(
    [...agregarPorCampanha(meta), ...agregarPorCampanha(google)].map((c) => [c.campanha, c])
  )

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
            <th>Meta investimento</th>
            <th>Realizado</th>
            <th>% da meta</th>
            <th>Meta leads</th>
            <th>Leads realizado</th>
          </tr>
        </thead>
        <tbody>
          {metasCampanhas.map((m) => {
            const realizado = realizadoPorCampanha.get(m.campanha_nome)
            const percInvest = pct(realizado?.investimento, m.meta_investimento)
            return (
              <tr key={m.id}>
                <td>{m.campanha_nome}</td>
                <td className="num">{moeda(m.meta_investimento)}</td>
                <td className="num">{moeda(realizado?.investimento)}</td>
                <td className="num">
                  {percInvest != null ? (
                    <span className={`badge ${percInvest >= 100 ? 'badge-warning' : 'badge-success'}`}>{percInvest.toFixed(0)}%</span>
                  ) : '—'}
                </td>
                <td className="num">{m.meta_leads ?? '—'}</td>
                <td className="num">{realizado?.leads ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
