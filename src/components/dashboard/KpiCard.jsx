export default function KpiCard({ label, valor, sub, corDestaque }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={corDestaque ? { color: corDestaque } : undefined}>{valor}</div>
      {sub && <div className="stat-sub is-muted">{sub}</div>}
    </div>
  )
}
