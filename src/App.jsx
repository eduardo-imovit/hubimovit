import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Home from './pages/Home'
import Kanban from './pages/Kanban'
import DadosAtendimento from './pages/DadosAtendimento'
import RelatorioAtividades from './pages/RelatorioAtividades'
import DashboardVisaoGeral from './pages/DashboardVisaoGeral'
import DashboardFunil from './pages/DashboardFunil'
import DashboardCampanhas from './pages/DashboardCampanhas'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/kanban/atividades" element={<ProtectedRoute><RelatorioAtividades /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute somenteAdmin><DashboardVisaoGeral /></ProtectedRoute>} />
        <Route path="/dashboard/funil" element={<ProtectedRoute somenteAdmin><DashboardFunil /></ProtectedRoute>} />
        <Route path="/dashboard/campanhas" element={<ProtectedRoute somenteAdmin><DashboardCampanhas /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
