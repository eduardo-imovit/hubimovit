import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import WeatherWidget from './WeatherWidget'

const linksOperacao = [
  {
    to: '/kanban',
    label: 'Kanban',
    children: [
      { to: '/kanban', label: 'Quadro' },
      { to: '/kanban/dados', label: 'Dados de Atendimento' },
      { to: '/kanban/atividades', label: 'Relatório de Atividades' },
    ],
  },
]

const linksAdmin = [
  {
    to: '/admin/propostas',
    label: 'Admin',
    children: [
      { to: '/admin/propostas', label: 'Propostas' },
      { to: '/admin/esteiras', label: 'Esteiras' },
      { to: '/admin/processos', label: 'Processos' },
    ],
  },
]

const linksGestao = [
  {
    to: '/dashboard',
    label: 'Dash',
    children: [
      {
        label: 'Negócio',
        children: [
          { to: '/dashboard', label: 'Visão Geral' },
          { to: '/dashboard/leads', label: 'Leads' },
        ],
      },
      {
        label: 'Performance',
        children: [
          { to: '/dashboard/performance', label: 'Performance' },
          { to: '/dashboard/campanhas', label: 'Campanhas' },
        ],
      },
      { to: '/dashboard/funil', label: 'Funil' },
    ],
  },
]

/** Item de dropdown: link direto (sem children) ou submenu-flyout (com children). */
function ItemMenu({ item }) {
  if (!item.children) {
    return (
      <NavLink to={item.to} end className={({ isActive }) => (isActive ? 'is-active' : '')}>
        {item.label}
      </NavLink>
    )
  }
  return (
    <div className="navbar-subitem">
      <span className="navbar-subitem-label">
        {item.label} <span className="navbar-caret navbar-caret--flyout">▸</span>
      </span>
      <div className="navbar-flyout">
        {item.children.map((child) => (
          <ItemMenu key={child.to ?? child.label} item={child} />
        ))}
      </div>
    </div>
  )
}

export default function Navbar() {
  const { session } = useSession()
  const { perfil } = usePerfil()
  const ehGestao = perfil?.role === 'gestao'
  const ehAdmOuGestao = perfil?.role === 'gestao' || perfil?.role === 'adm'
  const podeGerenciarBanners = ehAdmOuGestao
  const podeVerTV = !!perfil?.role && perfil.role !== 'user'
  const email = session?.user?.email ?? ''
  const iniciais = email.slice(0, 2).toUpperCase()

  async function sair() {
    await supabase.auth.signOut()
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">imovit</span>
        <span className="navbar-tagline">Lares com a sua alma.</span>
      </div>

      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
          Home
        </NavLink>

        {podeVerTV && (
          <NavLink to="/tv-display" className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
            TV Display
          </NavLink>
        )}

        {ehAdmOuGestao && linksOperacao.map((link) => (
          <div className="navbar-item" key={link.to}>
            <NavLink to={link.to} end className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
              {link.label} <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              {link.children.map((child) => (
                <NavLink key={child.to} to={child.to} end className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {ehGestao && linksGestao.map((link) => (
          <div className="navbar-item" key={link.to}>
            <NavLink to={link.to} end className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
              {link.label} <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              {link.children.map((child) => (
                <ItemMenu key={child.to ?? child.label} item={child} />
              ))}
            </div>
          </div>
        ))}

        {podeGerenciarBanners && (
          <NavLink to="/banners" className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
            Banners
          </NavLink>
        )}

        {ehAdmOuGestao && linksAdmin.map((link) => (
          <div className="navbar-item" key={link.to}>
            <NavLink to={link.to} end className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
              {link.label} <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              {link.children.map((child) => (
                <NavLink key={child.to} to={child.to} end className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {ehAdmOuGestao && (
          <NavLink to="/configuracoes" className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
            Configurações
          </NavLink>
        )}
      </div>

      <WeatherWidget />

      <div className="navbar-footer">
        <span className="avatar avatar-sm">{iniciais || '?'}</span>
        <div style={{ minWidth: 0 }}>
          <div className="navbar-footer-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{email}</div>
          <button type="button" onClick={sair} className="navbar-footer-role" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
