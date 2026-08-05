import { Navigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import AppShell from './AppShell'

export default function ProtectedRoute({ children }) {
  const { session, carregando } = useSession()

  if (carregando) {
    return <div className="hub-loading">Carregando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <AppShell>{children}</AppShell>
}
