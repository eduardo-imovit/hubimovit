import { useMemo } from 'react'

const FAIXAS = [
  { valor: '0-7', label: '0–7 dias', cor: 'var(--success)' },
  { valor: '8-15', label: '8–15 dias', cor: 'var(--grafite-fade)' },
  { valor: '16-30', label: '16–30 dias', cor: 'var(--warning)' },
  { valor: '31+', label: '31+ dias', cor: 'var(--danger)' },
]

export default function LeadsAgingCards({ dados }) {
  const contagemPorFaixa = useMemo(() => {
    const contagem = new Map(FAIXAS.map((f) => [f.valor, 0]))
    for (const linha of dados) {
      contagem.set(linha.faixa_aging, (contagem.get(linha.faixa_aging) ?? 0) + 1)
    }
    return contagem
  }, [dados])

  if (dados.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Sem leads em aberto</div>
      </div>
    )
  }

  return (
    <div className="kpi-grid">
      {FAIXAS.map((f) => (
        <div key={f.valor} className="stat-card" style={{ borderTop: `3px solid ${f.cor}` }}>
          <div className="stat-label">{f.label}</div>
          <div className="stat-value">{contagemPorFaixa.get(f.valor) ?? 0}</div>
          <div className="stat-sub is-muted">leads parados</div>
        </div>
      ))}
    </div>
  )
}
