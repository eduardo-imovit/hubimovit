import { Navigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import AppShell from './AppShell'

export default function ProtectedRoute({ children, somenteAdmin = false, papeis, navbar, semPadding }) {
  const { session, carregando: carregandoSessao } = useSession()
  const { perfil, carregando: carregandoPerfil } = usePerfil()

  const exigeChecagemPerfil = somenteAdmin || !!papeis

  if (carregandoSessao || (session && exigeChecagemPerfil && carregandoPerfil)) {
    return <div className="hub-loading">Carregando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (somenteAdmin && perfil?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (papeis && !papeis.includes(perfil?.role)) {
    return <Navigate to="/" replace />
  }

  return <AppShell navbar={navbar} semPadding={semPadding}>{children}</AppShell>
}
