import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import NavbarTV from './components/layout/NavbarTV'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import TVDisplay from './pages/TVDisplay'
import SpotifyCallback from './pages/SpotifyCallback'
import Kanban from './pages/Kanban'
import DadosAtendimento from './pages/DadosAtendimento'
import RelatorioAtividades from './pages/RelatorioAtividades'
import PainelGestao from './pages/PainelGestao'
import PainelPerformance from './pages/PainelPerformance'
import Configuracoes from './pages/Configuracoes'
import Propostas from './pages/admin/Propostas'
import Esteiras from './pages/admin/Esteiras'
import Processos from './pages/admin/Processos'
import PortalLogin from './pages/portal/PortalLogin'
import PortalStatus from './pages/portal/PortalStatus'
import Perfil from './pages/Perfil'
import { ACESSO } from './lib/acessos'

/** Redireciona mantendo os filtros da URL (links de recorte antigos continuam valendo). */
function Redirecionar({ para }) {
  const { search } = useLocation()
  return <Navigate to={`${para}${search}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
        <Route path="/tv-display" element={<ProtectedRoute papeis={ACESSO.tv} navbar={<NavbarTV />} semPadding semScroll><TVDisplay /></ProtectedRoute>} />
        <Route path="/spotify-callback" element={<ProtectedRoute papeis={ACESSO.spotify}><SpotifyCallback /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute papeis={ACESSO.kanban}><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute papeis={ACESSO.kanban}><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/kanban/atividades" element={<ProtectedRoute papeis={ACESSO.kanban}><RelatorioAtividades /></ProtectedRoute>} />
        <Route path="/dashboard/gestao" element={<ProtectedRoute papeis={ACESSO.dash}><PainelGestao /></ProtectedRoute>} />
        <Route path="/dashboard/performance" element={<ProtectedRoute papeis={ACESSO.dash}><PainelPerformance /></ProtectedRoute>} />
        {/* endereços antigos do Dash: redirecionam para os painéis novos */}
        <Route path="/dashboard" element={<Redirecionar para="/dashboard/gestao" />} />
        <Route path="/dashboard/performance-v2" element={<Redirecionar para="/dashboard/performance" />} />
        <Route path="/dashboard/campanhas" element={<Redirecionar para="/dashboard/performance" />} />
        <Route path="/dashboard/*" element={<Redirecionar para="/dashboard/gestao" />} />
        <Route path="/configuracoes" element={<ProtectedRoute papeis={ACESSO.configuracoes}><Configuracoes /></ProtectedRoute>} />
        <Route path="/admin/propostas" element={<ProtectedRoute papeis={ACESSO.esteira}><Propostas /></ProtectedRoute>} />
        <Route path="/admin/esteiras" element={<ProtectedRoute papeis={ACESSO.esteira}><Esteiras /></ProtectedRoute>} />
        <Route path="/admin/processos" element={<ProtectedRoute papeis={ACESSO.esteira}><Processos /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
        <Route path="/portal/entrar" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalStatus />} />
      </Routes>
    </BrowserRouter>
  )
}
