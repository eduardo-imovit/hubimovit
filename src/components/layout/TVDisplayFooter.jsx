import WeatherCardTV from './WeatherCardTV'
import AgendaFotografoSemanalTV from '../calendar/AgendaFotografoSemanalTV'

export default function TVDisplayFooter() {
  return (
    <footer className="tv-footer">
      <div className="tv-footer-col tv-footer-col--clima">
        <WeatherCardTV />
      </div>

      <div className="tv-footer-col tv-footer-col--fotografo">
        <AgendaFotografoSemanalTV />
      </div>
    </footer>
  )
}
