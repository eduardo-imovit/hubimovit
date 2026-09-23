import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import NavbarTV from './components/layout/NavbarTV'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Home from './pages/Home'
import TVDisplay from './pages/TVDisplay'
import SpotifyCallback from './pages/SpotifyCallback'
import Kanban from './pages/Kanban'
import DadosAtendimento from './pages/DadosAtendimento'
import RelatorioAtividades from './pages/RelatorioAtividades'
import DashboardVisaoGeral from './pages/DashboardVisaoGeral'
import DashboardFunil from './pages/DashboardFunil'
import DashboardCampanhas from './pages/DashboardCampanhas'
import DashboardPerformance from './pages/DashboardPerformance'
import DashboardLeads from './pages/DashboardLeads'
import Configuracoes from './pages/Configuracoes'
import Propostas from './pages/admin/Propostas'
import Esteiras from './pages/admin/Esteiras'
import Processos from './pages/admin/Processos'
import PortalLogin from './pages/portal/PortalLogin'
import PortalStatus from './pages/portal/PortalStatus'
import Perfil from './pages/Perfil'
import { ACESSO } from './lib/acessos'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/tv-display" element={<ProtectedRoute papeis={ACESSO.tv} navbar={<NavbarTV />} semPadding semScroll><TVDisplay /></ProtectedRoute>} />
        <Route path="/spotify-callback" element={<ProtectedRoute papeis={ACESSO.spotify}><SpotifyCallback /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute papeis={ACESSO.kanban}><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute papeis={ACESSO.kanban}><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/kanban/atividades" element={<ProtectedRoute papeis={ACESSO.kanban}><RelatorioAtividades /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute papeis={ACESSO.dash}><DashboardVisaoGeral /></ProtectedRoute>} />
        <Route path="/dashboard/funil" element={<ProtectedRoute papeis={ACESSO.dash}><DashboardFunil /></ProtectedRoute>} />
        <Route path="/dashboard/campanhas" element={<ProtectedRoute papeis={ACESSO.dash}><DashboardCampanhas /></ProtectedRoute>} />
        <Route path="/dashboard/performance" element={<ProtectedRoute papeis={ACESSO.dash}><DashboardPerformance /></ProtectedRoute>} />
        <Route path="/dashboard/leads" element={<ProtectedRoute papeis={ACESSO.dash}><DashboardLeads /></ProtectedRoute>} />
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
