const SITUACAO_COR = {
  'Em atendimento': 'var(--info)',
  'Negócio realizado': 'var(--success)',
  Descartado: 'var(--grafite-fade)',
}
const ORDEM_SITUACAO = ['Em atendimento', 'Negócio realizado', 'Descartado']

function agruparPorFunil(atendimentos, funil) {
  const doFunil = atendimentos.filter((a) => a.funil === funil)
  const total = doFunil.length
  const porSituacao = ORDEM_SITUACAO.map((situacao) => ({
    situacao,
    total: doFunil.filter((a) => a.situacao === situacao).length,
  }))
  const negocios = porSituacao.find((s) => s.situacao === 'Negócio realizado')?.total ?? 0
  const conversao = total > 0 ? (negocios / total) * 100 : 0
  return { total, porSituacao, conversao }
}

export default function FunilChart({ atendimentos }) {
  const inbound = agruparPorFunil(atendimentos, 'Inbound (passivo)')
  const outbound = agruparPorFunil(atendimentos, 'Outbound (ativo)')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-7)' }}>
      {[
        { titulo: 'Inbound (passivo)', dados: inbound },
        { titulo: 'Outbound (ativo)', dados: outbound },
      ].map(({ titulo, dados }) => (
        <div key={titulo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--grafite)' }}>{titulo}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--grafite-soft)' }}>{dados.total} atendimentos</span>
          </div>
          <div className="funnel">
            {dados.porSituacao.map(({ situacao, total }) => {
              const pct = dados.total > 0 ? (total / dados.total) * 100 : 0
              return (
                <div className="funnel-row" key={situacao}>
                  <span className="funnel-label">{situacao}</span>
                  <div className="funnel-bar-track">
                    <div
                      className="funnel-bar-fill"
                      style={{ width: `${Math.max(pct, total > 0 ? 4 : 0)}%`, background: SITUACAO_COR[situacao] }}
                    >
                      {total}
                    </div>
                  </div>
                  <span className="funnel-pct">{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
          <div className="stat-sub" style={{ marginTop: 'var(--space-3)', color: 'var(--coral)' }}>
            Taxa de conversão: {dados.conversao.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  )
}
