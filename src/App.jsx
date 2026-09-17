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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/tv-display" element={<ProtectedRoute navbar={<NavbarTV />} semPadding><TVDisplay /></ProtectedRoute>} />
        <Route path="/spotify-callback" element={<ProtectedRoute somenteAdmin><SpotifyCallback /></ProtectedRoute>} />
        <Route path="/banners" element={<ProtectedRoute papeis={['admin', 'editor']}><GerenciarBanners /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute somenteAdmin><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute somenteAdmin><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/kanban/atividades" element={<ProtectedRoute somenteAdmin><RelatorioAtividades /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute somenteAdmin><DashboardVisaoGeral /></ProtectedRoute>} />
        <Route path="/dashboard/funil" element={<ProtectedRoute somenteAdmin><DashboardFunil /></ProtectedRoute>} />
        <Route path="/dashboard/campanhas" element={<ProtectedRoute somenteAdmin><DashboardCampanhas /></ProtectedRoute>} />
        <Route path="/dashboard/performance" element={<ProtectedRoute somenteAdmin><DashboardPerformance /></ProtectedRoute>} />
        <Route path="/dashboard-leads" element={<ProtectedRoute somenteAdmin><DashboardLeads /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute somenteAdmin><Configuracoes /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
