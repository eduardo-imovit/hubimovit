import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Home from './pages/Home'
import Kanban from './pages/Kanban'
import DadosAtendimento from './pages/DadosAtendimento'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/kanban/dados" element={<ProtectedRoute><DadosAtendimento /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute somenteAdmin><Dashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
