import BannerCarrossel from '../components/home/BannerCarrossel'
import AgendaFotografoSemanalTV from '../components/calendar/AgendaFotografoSemanalTV'

export default function TVDisplay() {
  return (
    <div className="tv-display-page">
      <BannerCarrossel variante="tv" />
      <div className="tv-display-grain" aria-hidden="true" />

      <div className="tv-display-conteudo">
        <AgendaFotografoSemanalTV />
      </div>
    </div>
  )
}
