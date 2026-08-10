import { Navigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import AppShell from './AppShell'

export default function ProtectedRoute({ children, somenteAdmin = false }) {
  const { session, carregando: carregandoSessao } = useSession()
  const { perfil, carregando: carregandoPerfil } = usePerfil()

  if (carregandoSessao || (session && somenteAdmin && carregandoPerfil)) {
    return <div className="hub-loading">Carregando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (somenteAdmin && perfil?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <AppShell>{children}</AppShell>
}
