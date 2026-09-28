import { Link } from 'react-router-dom'
import { usePerfil } from '../hooks/usePerfil'
import { pode } from '../lib/acessos'
import { AREAS_PROPOSTAS } from '../lib/propostasNav'

/** Porta de entrada do menu Propostas: escolher locação ou venda. */
export default function PropostasInicio() {
  const { perfil } = usePerfil()
  const areas = AREAS_PROPOSTAS.filter((a) => pode(perfil, a.acesso))

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Propostas</div>
          <div className="page-title">Locação ou venda?</div>
          <div className="page-sub">Os dois processos são separados. Escolha por onde seguir.</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
        {areas.map((a) => (
          <div key={a.chave} className="card card-body">
            <Link to={a.paginas[0].to} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>{a.label}</div>
              <div className="page-sub" style={{ marginBottom: 'var(--space-3)' }}>{a.descricao}</div>
            </Link>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {a.paginas.map((p) => (
                <Link key={p.to} to={p.to} className="btn btn-ghost btn-sm">{p.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
