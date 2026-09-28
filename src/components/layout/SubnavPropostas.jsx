import { Link, NavLink } from 'react-router-dom'
import { areaPropostas } from '../../lib/propostasNav'

/** Caminho "Propostas › Locação" + abas das páginas da área (topo de cada página). */
export default function SubnavPropostas({ area }) {
  const a = areaPropostas(area)
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/propostas" style={{ color: 'inherit' }}>Propostas</Link> › {a.label}
      </div>
      <div className="tabs">
        {a.paginas.map((p) => (
          <NavLink key={p.to} to={p.to} end className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
            {p.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
