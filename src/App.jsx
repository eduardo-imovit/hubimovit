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
import PainelComercial from './pages/PainelComercial'
import PainelPerformance from './pages/PainelPerformance'
import Configuracoes from './pages/Configuracoes'
import Propostas from './pages/admin/Propostas'
import Vendas from './pages/admin/Vendas'
import PropostasInicio from './pages/PropostasInicio'
import Captacoes from './pages/admin/Captacoes'
import FeedbackVisita from './pages/FeedbackVisita'
import CaptacaoPublica from './pages/publico/CaptacaoPublica'
import ApresentacaoImovit from './pages/publico/ApresentacaoImovit'
import MateriaisClientes from './pages/MateriaisClientes'
import Esteiras from './pages/admin/Esteiras'
import Processos from './pages/admin/Processos'
import PortalLogin from './pages/portal/PortalLogin'
import PortalStatus from './pages/portal/PortalStatus'
import PortalVendaLogin from './pages/portal/PortalVendaLogin'
import PortalVenda from './pages/portal/PortalVenda'
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
        <Route path="/dashboard/comercial" element={<ProtectedRoute papeis={ACESSO.dashComercial}><PainelComercial /></ProtectedRoute>} />
        <Route path="/dashboard/gestao" element={<ProtectedRoute papeis={ACESSO.dash}><PainelGestao /></ProtectedRoute>} />
        <Route path="/dashboard/performance" element={<ProtectedRoute papeis={ACESSO.dashPerformance}><PainelPerformance /></ProtectedRoute>} />
        {/* endereços antigos do Dash: redirecionam para os painéis novos */}
        <Route path="/dashboard" element={<Redirecionar para="/dashboard/gestao" />} />
        <Route path="/dashboard/performance-v2" element={<Redirecionar para="/dashboard/performance" />} />
        <Route path="/dashboard/campanhas" element={<Redirecionar para="/dashboard/performance" />} />
        <Route path="/dashboard/*" element={<Redirecionar para="/dashboard/gestao" />} />
        <Route path="/configuracoes" element={<ProtectedRoute papeis={ACESSO.configuracoes}><Configuracoes /></ProtectedRoute>} />
        <Route path="/admin/propostas" element={<ProtectedRoute papeis={ACESSO.esteira}><Propostas /></ProtectedRoute>} />
        <Route path="/propostas" element={<ProtectedRoute papeis={ACESSO.propostas}><PropostasInicio /></ProtectedRoute>} />
        <Route path="/admin/vendas" element={<ProtectedRoute papeis={ACESSO.vendas}><Vendas key="propostas" modo="propostas" /></ProtectedRoute>} />
        <Route path="/admin/vendas/processos" element={<ProtectedRoute papeis={ACESSO.vendas}><Vendas key="processos" modo="processos" /></ProtectedRoute>} />
        <Route path="/admin/esteiras" element={<ProtectedRoute papeis={ACESSO.esteira}><Esteiras /></ProtectedRoute>} />
        <Route path="/admin/processos" element={<ProtectedRoute papeis={ACESSO.esteira}><Processos /></ProtectedRoute>} />
        <Route path="/captacoes" element={<ProtectedRoute papeis={ACESSO.formularios}><Captacoes /></ProtectedRoute>} />
        <Route path="/feedback-visita" element={<ProtectedRoute papeis={ACESSO.formularios}><FeedbackVisita /></ProtectedRoute>} />
        <Route path="/materiais" element={<ProtectedRoute papeis={ACESSO.formularios}><MateriaisClientes /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
        {/* público (proprietário, sem login): link fixo de captação do corretor (código aleatório) */}
        <Route path="/captacao" element={<CaptacaoPublica />} />
        <Route path="/captacao/:token" element={<CaptacaoPublica />} />
        {/* público (leads): Apresentação Imovit, personalizada pelo código do corretor */}
        <Route path="/apresentacao" element={<ApresentacaoImovit />} />
        <Route path="/apresentacao/:token" element={<ApresentacaoImovit />} />
        <Route path="/portal/entrar" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalStatus />} />
        <Route path="/venda/entrar" element={<PortalVendaLogin />} />
        <Route path="/venda" element={<PortalVenda />} />
      </Routes>
    </BrowserRouter>
  )
}
