function formatarDataCorte(dataISO) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function LeadsTempoResposta({ dados }) {
  const linha = dados[0]

  if (!linha) {
    return (
      <div className="empty">
        <div className="empty-title">Sem dados de cobertura</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'stretch' }}>
      <div className="stat-card" style={{ flex: '1 1 220px' }}>
        <div className="stat-label">Mediana de tempo até 1ª resposta</div>
        <div className="stat-value">{linha.dias_resposta_mediana != null ? `${linha.dias_resposta_mediana} dias` : '—'}</div>
        <div className="stat-sub is-muted">
          faixa p25–p75: {linha.dias_resposta_p25 ?? '—'}–{linha.dias_resposta_p75 ?? '—'} dias
        </div>
      </div>

      <div className="stat-card" style={{ flex: '1 1 260px' }}>
        <div className="stat-label">Confiabilidade da métrica</div>
        <div className="stat-sub is-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          Baseado em {linha.pct_cobertura}% dos leads a partir de {formatarDataCorte(linha.data_corte)}
        </div>
      </div>
    </div>
  )
}
