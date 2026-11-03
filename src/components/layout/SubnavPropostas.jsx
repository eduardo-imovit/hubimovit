import { Link, NavLink } from 'react-router-dom'
import { usePerfil } from '../../hooks/usePerfil'
import { areaPropostas, paginasVisiveis } from '../../lib/propostasNav'
import { pode } from '../../lib/acessos'

/** Caminho "Propostas › Locação" + abas das páginas da área (topo de cada página). */
export default function SubnavPropostas({ area }) {
  const a = areaPropostas(area)
  const { perfil } = usePerfil()
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        {/* o corretor não abre /propostas (só gestão/adm): para ele, "Propostas" é texto, não link */}
        {pode(perfil, 'propostas') ? <Link to="/propostas" style={{ color: 'inherit' }}>Propostas</Link> : 'Propostas'} › {a.label}
      </div>
      <div className="tabs">
        {paginasVisiveis(a, perfil).map((p) => (
          <NavLink key={p.to} to={p.to} end className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
            {p.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
