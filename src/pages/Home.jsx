import { useSession } from '../hooks/useSession'
import { formatarDataLonga, saudacao } from '../lib/dateUtils'
import DashStats from '../components/home/DashStats'
import AgendaHoje from '../components/home/AgendaHoje'
import AvisosFeed from '../components/home/AvisosFeed'
import PlantaoCard from '../components/home/PlantaoCard'

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

      <DashStats />

      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        <section>
          <div className="page-eyebrow">Agenda de hoje</div>
          <AgendaHoje />
        </section>

        <section>
          <div className="page-eyebrow">Avisos & Novidades</div>
          <AvisosFeed />
        </section>
      </div>

      <section style={{ marginTop: 'var(--space-7)' }}>
        <div className="page-eyebrow">Controle de plantão — semana atual</div>
        <PlantaoCard />
      </section>
    </div>
  )
}
