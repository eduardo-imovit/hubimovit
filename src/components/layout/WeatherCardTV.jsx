import { useWeather } from '../../hooks/useWeather'
import { condicaoDoIcone, IconeGota, IconeVento, IconeNuvem } from './skyIcons'

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function WeatherCardTV() {
  const { clima, erro } = useWeather()

  if (!clima) {
    if (erro) {
      return (
        <div className="sky-card-tv sky-card-tv--weather sky-mist">
          <div className="sky-card-tv-content">
            <span className="sky-card-tv-desc">Clima indisponível</span>
          </div>
        </div>
      )
    }
    return <div className="sky-card-tv sky-card-tv--weather sky-card-tv--carregando" aria-hidden="true" />
  }

  const { classeFundo, Icone } = condicaoDoIcone(clima.icone)
  const descricao = capitalizar(clima.descricao)

  return (
    <div className={`sky-card-tv sky-card-tv--weather ${classeFundo}`}>
      <Icone className="sky-card-tv-icon-bg" />

      <div className="sky-card-tv-content">
        <span className="sky-card-tv-value">{clima.temperatura}°</span>
        <span className="sky-card-tv-desc">{descricao} · Campinas, SP</span>

        <div className="sky-card-tv-stats">
          <span className="sky-card-tv-stat"><IconeGota className="sky-card-tv-stat-icon" />{clima.umidade}%</span>
          <span className="sky-card-tv-stat"><IconeVento className="sky-card-tv-stat-icon" />{clima.ventoKmh}km/h</span>
        </div>
      </div>
    </div>
  )
}
