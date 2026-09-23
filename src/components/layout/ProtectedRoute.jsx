import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import AppShell from './AppShell'

/**
 * Colaborador suspenso pela Gestão: o banco já nega tudo e o login fica
 * bloqueado; aqui só explica o que aconteceu, em vez de mostrar telas vazias.
 */
function AcessoSuspenso() {
  return (
    <div className="empty" style={{ marginTop: 'var(--space-8)' }}>
      <div className="empty-title">Seu acesso ao Hub está suspenso</div>
      <div className="empty-sub">Fale com a Gestão da Imovit para reativar.</div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </div>
  )
}

export default function ProtectedRoute({ children, papeis, navbar, semPadding, semScroll }) {
  const { session, carregando: carregandoSessao } = useSession()
  const { perfil, carregando: carregandoPerfil } = usePerfil()

  const exigeChecagemPerfil = !!papeis

  if (carregandoSessao || (session && exigeChecagemPerfil && carregandoPerfil)) {
    return <div className="hub-loading">Carregando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (perfil?.suspenso_em) {
    return <AcessoSuspenso />
  }

  if (papeis && !papeis.includes(perfil?.role)) {
    return <Navigate to="/" replace />
  }

  return <AppShell navbar={navbar} semPadding={semPadding} semScroll={semScroll}>{children}</AppShell>
}
