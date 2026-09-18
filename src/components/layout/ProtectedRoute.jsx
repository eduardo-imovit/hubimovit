import { Navigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import AppShell from './AppShell'

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

  if (papeis && !papeis.includes(perfil?.role)) {
    return <Navigate to="/" replace />
  }

  return <AppShell navbar={navbar} semPadding={semPadding} semScroll={semScroll}>{children}</AppShell>
}
