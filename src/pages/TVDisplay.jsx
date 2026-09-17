import BannerCarrossel from '../components/home/BannerCarrossel'
import AgendaFotografoSemanalTV from '../components/calendar/AgendaFotografoSemanalTV'

export default function TVDisplay() {
  return (
    <div className="tv-display-page">
      <div className="tv-display-bg">
        <BannerCarrossel variante="tv" mostrarControles={false} />
      </div>
      <div className="tv-display-grain" aria-hidden="true" />

      <div className="tv-display-conteudo">
        <AgendaFotografoSemanalTV />
      </div>
    </div>
  )
}
