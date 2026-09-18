import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { usePerfil } from '../hooks/usePerfil'
import { formatarDataLonga, saudacao } from '../lib/dateUtils'
import Calendario from '../components/calendar/Calendario'
import AvisosFeed from '../components/home/AvisosFeed'
import BibliotecaLinks from '../components/home/BibliotecaLinks'
import PlantaoCard from '../components/home/PlantaoCard'
import BannerCarrossel from '../components/home/BannerCarrossel'

export default function Home() {
  const { session } = useSession()
  const { perfil, carregando: carregandoPerfil } = usePerfil()
  const nome = session?.user?.email?.split('@')[0] ?? ''
  const primeiroNome = nome.charAt(0).toUpperCase() + nome.slice(1)

  // Conta de acesso da TV: nunca fica na Home, vai direto pra tela de exibição.
  if (perfil?.role === 'tvaccess') {
    return <Navigate to="/tv-display" replace />
  }

  // Sessão autenticada sem linha em `perfis` = cliente externo da esteira de
  // locação (locatário/proprietário, logado via magic link) -- nunca deve
  // cair na Home interna, mesmo que a rota "/" não exija nenhum papel.
  if (session && !carregandoPerfil && !perfil) {
    return <Navigate to="/portal" replace />
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-title">{saudacao()}, <em>{primeiroNome}.</em></div>
          <div className="page-sub">{formatarDataLonga()}</div>
        </div>
      </header>

      <BannerCarrossel />

      <section style={{ marginBottom: 'var(--space-7)' }}>
        <div className="page-eyebrow">Controle de plantão — semana atual</div>
        <PlantaoCard />
      </section>

      <section style={{ marginBottom: 'var(--space-7)' }}>
        <div className="page-eyebrow">Agenda</div>
        <Calendario />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        <section>
          <div className="page-eyebrow">Avisos & Novidades</div>
          <AvisosFeed />
        </section>

        <section>
          <div className="page-eyebrow">Links Úteis & Manuais</div>
          <BibliotecaLinks />
        </section>
      </div>
    </div>
  )
}
