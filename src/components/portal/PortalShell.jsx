import { supabase } from '../../lib/supabaseClient'

export default function PortalShell({ children }) {
  async function sair() {
    await supabase.auth.signOut()
  }

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">Esteira de locação</span>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={sair} className="btn btn-ghost btn-sm">
          Sair
        </button>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  )
}
