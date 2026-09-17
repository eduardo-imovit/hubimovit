import { useSession } from '../hooks/useSession'
import { formatarDataLonga, saudacao } from '../lib/dateUtils'
import Calendario from '../components/calendar/Calendario'
import AvisosFeed from '../components/home/AvisosFeed'
import BibliotecaLinks from '../components/home/BibliotecaLinks'
import PlantaoCard from '../components/home/PlantaoCard'
import BannerCarrossel from '../components/home/BannerCarrossel'

export default function Home() {
  const { session } = useSession()
  const nome = session?.user?.email?.split('@')[0] ?? ''
  const primeiroNome = nome.charAt(0).toUpperCase() + nome.slice(1)

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
