import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import NavbarTV from './components/layout/NavbarTV'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Home from './pages/Home'
import TVDisplay from './pages/TVDisplay'
import SpotifyCallback from './pages/SpotifyCallback'
import GerenciarBanners from './pages/GerenciarBanners'
import Kanban from './pages/Kanban'
import DadosAtendimento from './pages/DadosAtendimento'
import RelatorioAtividades from './pages/RelatorioAtividades'
import DashboardVisaoGeral from './pages/DashboardVisaoGeral'
import DashboardFunil from './pages/DashboardFunil'
import DashboardCampanhas from './pages/DashboardCampanhas'
import DashboardPerformance from './pages/DashboardPerformance'
import DashboardLeads from './pages/DashboardLeads'
import Configuracoes from './pages/Configuracoes'
import Esteira from './pages/Esteira'
import PortalLogin from './pages/portal/PortalLogin'
import PortalStatus from './pages/portal/PortalStatus'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/tv-display" element={<ProtectedRoute papeis={['gestao', 'adm', 'tvaccess']} navbar={<NavbarTV />} semPadding semScroll><TVDisplay /></ProtectedRoute>} />
        <Route path="/spotify-callback" element={<ProtectedRoute papeis={['gestao']}><SpotifyCallback /></ProtectedRoute>} />
        <Route path="/banners" element={<ProtectedRoute papeis={['gestao', 'adm']}><GerenciarBanners /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute papeis={['gestao', 'adm']}><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute papeis={['gestao', 'adm']}><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/kanban/atividades" element={<ProtectedRoute papeis={['gestao', 'adm']}><RelatorioAtividades /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute papeis={['gestao']}><DashboardVisaoGeral /></ProtectedRoute>} />
        <Route path="/dashboard/funil" element={<ProtectedRoute papeis={['gestao']}><DashboardFunil /></ProtectedRoute>} />
        <Route path="/dashboard/campanhas" element={<ProtectedRoute papeis={['gestao']}><DashboardCampanhas /></ProtectedRoute>} />
        <Route path="/dashboard/performance" element={<ProtectedRoute papeis={['gestao']}><DashboardPerformance /></ProtectedRoute>} />
        <Route path="/dashboard/leads" element={<ProtectedRoute papeis={['gestao']}><DashboardLeads /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute papeis={['gestao', 'adm']}><Configuracoes /></ProtectedRoute>} />
        <Route path="/esteira" element={<ProtectedRoute papeis={['gestao', 'adm']}><Esteira /></ProtectedRoute>} />
        <Route path="/portal/entrar" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalStatus />} />
      </Routes>
    </BrowserRouter>
  )
}
