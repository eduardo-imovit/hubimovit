import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import WeatherWidget from './WeatherWidget'
import { PAPEL_LABEL, pode } from '../../lib/acessos'
import { AREAS_PROPOSTAS, paginasVisiveis } from '../../lib/propostasNav'

/**
 * Navegação por trabalho (decisão do Eduardo, 15/10): Painéis, Atendimento,
 * Locação, Venda e Ferramentas. Cada item aparece conforme o nível (acessos.js).
 * Um menu sem nenhum item visível não aparece.
 */
function buildMenus(perfil) {
  const ehCorretor = perfil?.role === 'corretor'
  const menus = []

  const paineis = []
  if (pode(perfil, 'dashComercial')) paineis.push({ to: '/dashboard/comercial', label: ehCorretor ? 'Meus números' : 'Comercial' })
  if (pode(perfil, 'dash')) paineis.push({ to: '/dashboard/gestao', label: 'Painel da Gestão' })
  if (pode(perfil, 'dashPerformance')) paineis.push({ to: '/dashboard/performance', label: 'Painel de Performance' })
  if (pode(perfil, 'dashAdmLocacao')) paineis.push({ to: '/dashboard/adm-locacao', label: 'Adm locação' })
  menus.push({ label: 'Painéis', children: paineis })

  const atendimento = []
  if (pode(perfil, 'kanban')) {
    atendimento.push(
      { to: '/kanban', label: 'Kanban' },
      { to: '/kanban/dados', label: 'Dados de atendimento' },
      { to: '/kanban/atividades', label: 'Relatório de atividades' },
    )
  }
  if (pode(perfil, 'formularios')) {
    atendimento.push({ to: '/captacoes', label: 'Captações' }, { to: '/feedback-visita', label: 'Feedback de visita' })
  }
  menus.push({ label: 'Atendimento', children: atendimento })

  // Locação e Venda: as áreas de lib/propostasNav, cada uma vira um menu
  for (const area of AREAS_PROPOSTAS) {
    if (pode(perfil, area.acesso)) menus.push({ label: area.label, children: paginasVisiveis(area, perfil) })
  }

  const ferramentas = []
  if (pode(perfil, 'formularios')) ferramentas.push({ to: '/materiais', label: 'Materiais para clientes' })
  // quem vê Locação ▸ Cadastros já tem os links lá; o corretor manda por aqui
  if (pode(perfil, 'formularios') && !pode(perfil, 'esteira')) ferramentas.push({ to: '/ferramentas/cadastros', label: 'Links de cadastro' })
  if (pode(perfil, 'tv')) ferramentas.push({ to: '/tv-display', label: 'TV Display' })
  menus.push({ label: 'Ferramentas', children: ferramentas })

  return menus.filter((m) => m.children.length > 0)
}

/** O menu fica ativo quando a página atual é um dos seus itens (ou subpágina). */
const menuAtivo = (menu, pathname) =>
  menu.children.some((c) => c.to && (pathname === c.to || (c.to !== '/kanban' && pathname.startsWith(`${c.to}/`))))

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
  // Celular e telas médias (≤ 1100px): os links viram um painel aberto pelo botão ☰
  const [aberto, setAberto] = useState(false)
  useEffect(() => { setAberto(false) }, [pathname])
  const menus = buildMenus(perfil)
  const email = session?.user?.email ?? ''
  const nomeExibido = perfil?.nome || email
  const iniciais = (perfil?.nome || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  async function sair() {
    await supabase.auth.signOut()
  }

  return (
    <nav className={`navbar${aberto ? ' is-aberto' : ''}`}>
      <div className="navbar-brand">
        <span className="navbar-logo">imovit</span>
        <span className="navbar-tagline">Lares com a sua alma.</span>
      </div>

      <button
        type="button"
        className="navbar-menu-btn"
        aria-expanded={aberto}
        aria-controls="navbar-links"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? '✕' : '☰'}
      </button>

      <div className="navbar-links" id="navbar-links">
        <NavLink to="/" end className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}>
          Home
        </NavLink>

        {menus.map((menu) => (
          <div className="navbar-item" key={menu.label}>
            <NavLink to={menu.children[0].to} className={`navbar-link${menuAtivo(menu, pathname) ? ' is-active' : ''}`}>
              {menu.label} <span className="navbar-caret">▾</span>
            </NavLink>
            <div className="navbar-dropdown">
              {menu.children.map((child) => (
                <ItemMenu key={child.to ?? child.label} item={child} />
              ))}
            </div>
          </div>
        ))}

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
