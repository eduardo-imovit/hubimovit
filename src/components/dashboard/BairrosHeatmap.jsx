/** Intensidade do coral proporcional ao volume de visitas, sobre o creme de fundo — quanto mais visitas, mais forte. */
function corIntensidade(valor, max) {
  if (max === 0) return 'var(--creme)'
  const t = valor / max
  return `rgba(232, 89, 60, ${0.12 + t * 0.78})`
}

export default function BairrosHeatmap({ dados }) {
  if (dados.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Sem visitas com bairro identificado</div>
        <div className="empty-sub">Assim que houver visitas com endereço registrado no CRM, os bairros aparecem aqui.</div>
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.total))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
      {dados.map((d) => {
        const intensidade = max === 0 ? 0 : d.total / max
        const corTexto = intensidade > 0.55 ? 'var(--branco)' : 'var(--grafite)'
        return (
          <div
            key={d.bairro}
            style={{
              background: corIntensidade(d.total, max),
              color: corTexto,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minHeight: 76,
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, lineHeight: 1.2 }}>{d.bairro}</span>
            <span style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-mono)' }}>{d.total}</span>
          </div>
        )
      })}
    </div>
  )
}
