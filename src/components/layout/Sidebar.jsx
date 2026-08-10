import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/kanban', label: 'Kanban' },
  { to: '/dashboard', label: 'Dashboard', somenteAdmin: true },
]

export default function Sidebar() {
  const { session } = useSession()
  const { perfil } = usePerfil()
  const email = session?.user?.email ?? ''
  const iniciais = email.slice(0, 2).toUpperCase()
  const visiveis = links.filter((link) => !link.somenteAdmin || perfil?.role === 'admin')

  async function sair() {
    await supabase.auth.signOut()
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">imovit</div>
        <div className="sidebar-tagline">Lares com a sua alma.</div>
      </div>

      <div className="sidebar-section">Hub</div>
      {visiveis.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `sidebar-item${isActive ? ' is-active' : ''}`}
        >
          <span className="sidebar-nav-dot" style={{ background: 'currentColor', opacity: 0.6 }} />
          {link.label}
        </NavLink>
      ))}

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <span className="avatar avatar-sm">{iniciais || '?'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-footer-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
          <button type="button" onClick={sair} className="sidebar-footer-role" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
