import { Link, NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import WeatherWidget from './WeatherWidget'
import { PAPEL_LABEL, pode } from '../../lib/acessos'
import { AREAS_PROPOSTAS } from '../../lib/propostasNav'

/** Dash reúne Kanban (gestão/admin) e dashboards (gestão/marketing) num único item de navbar. */
function buildLinksDash({ verKanban, verDash }) {
  const children = []

  if (verKanban) {
    children.push({
      label: 'Kanban',
      children: [
        { to: '/kanban', label: 'Quadro' },
        { to: '/kanban/dados', label: 'Dados de Atendimento' },
        { to: '/kanban/atividades', label: 'Relatório de Atividades' },
      ],
    })
  }

  if (verDash) {
    children.unshift(
      { to: '/dashboard/gestao', label: 'Painel da Gestão' },
      { to: '/dashboard/performance', label: 'Painel de Performance' },
    )
  }

  if (children.length === 0) return []
  return [{ to: verDash ? '/dashboard/gestao' : '/kanban', label: 'Dash', children }]
}

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
  const { pathname } = useLocation()
  const emPropostas = pathname === '/propostas' || pathname.startsWith('/admin/')
  const linksDash = buildLinksDash({ verKanban: pode(perfil, 'kanban'), verDash: pode(perfil, 'dash') })
  // Propostas ▾ → Locação ▸ / Venda ▸ (processos separados, ver lib/propostasNav)
  const areasPropostas = AREAS_PROPOSTAS
    .filter((a) => pode(perfil, a.acesso))
    .map((a) => ({ label: a.label, children: a.paginas }))
  const email = session?.user?.email ?? ''
  const nomeExibido = perfil?.nome || email
  const iniciais = (perfil?.nome || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

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

        {pode(perfil, 'tv') && (
          <NavLink to="/tv-display" className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
            TV Display
          </NavLink>
        )}

        {linksDash.map((link) => (
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

        {areasPropostas.length > 0 && (
          <div className="navbar-item">
            <NavLink to="/propostas" className={`navbar-link${emPropostas ? ' is-active' : ''}`}>
              Propostas <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              {areasPropostas.map((area) => (
                <ItemMenu key={area.label} item={area} />
              ))}
            </div>
          </div>
        )}

        {pode(perfil, 'formularios') && (
          <div className="navbar-item">
            <NavLink to="/captacoes" className={({ isActive }) => `navbar-link${isActive || ['/feedback-visita', '/materiais'].includes(pathname) ? ' is-active' : ''}`}>
              Ferramentas <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              <NavLink to="/captacoes" end className={({ isActive }) => (isActive ? 'is-active' : '')}>Captações</NavLink>
              <NavLink to="/feedback-visita" end className={({ isActive }) => (isActive ? 'is-active' : '')}>Feedback de visita</NavLink>
              <NavLink to="/materiais" end className={({ isActive }) => (isActive ? 'is-active' : '')}>Materiais para clientes</NavLink>
            </div>
          </div>
        )}

        {pode(perfil, 'configuracoes') && (
          <NavLink to="/configuracoes" className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
            Configurações
          </NavLink>
        )}
      </div>

      <WeatherWidget />

      <div className="navbar-footer">
        <Link to="/perfil" title="Meu perfil" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, textDecoration: 'none' }}>
          {perfil?.foto_url
            ? <img src={perfil.foto_url} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} />
            : <span className="avatar avatar-sm">{iniciais || '?'}</span>}
          <div className="navbar-footer-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            {nomeExibido}
            {perfil?.role && <span className="navbar-footer-role" style={{ display: 'block' }}>{PAPEL_LABEL[perfil.role] ?? perfil.role}</span>}
          </div>
        </Link>
        <button type="button" onClick={sair} className="navbar-footer-role" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'var(--space-2)' }}>
          Sair
        </button>
      </div>
    </nav>
  )
}
