import BannerCarrossel from '../components/home/BannerCarrossel'
import TVDisplayFooter from '../components/layout/TVDisplayFooter'

export default function TVDisplay() {
  return (
    <div className="tv-display-page">
      <BannerCarrossel variante="tv" />
      <div className="tv-display-grain" aria-hidden="true" />

      <div className="tv-display-conteudo">
        <TVDisplayFooter />
      </div>
    </div>
  )
}
