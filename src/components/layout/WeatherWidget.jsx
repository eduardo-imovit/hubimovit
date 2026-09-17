import { useWeather } from '../../hooks/useWeather'

function IconeSol({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconeNuvem({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 6.5 19h11z" />
    </svg>
  )
}

function IconeChuva({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 13a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 5 13h11z" />
      <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </svg>
  )
}

function IconeNeve({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 13a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 5 13h11z" />
      <path d="M8 18v3M12 18v3M16 18v3M7 19.5l2 1M11 19.5l2 1M15 19.5l2 1" />
    </svg>
  )
}

const ICONES_POR_PREFIXO = {
  '01': IconeSol,
  '02': IconeNuvem,
  '03': IconeNuvem,
  '04': IconeNuvem,
  '09': IconeChuva,
  10: IconeChuva,
  11: IconeChuva,
  13: IconeNeve,
  50: IconeNuvem,
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function WeatherWidget() {
  const { clima, erro } = useWeather()

  if (!clima) {
    if (erro) {
      return (
        <div className="weather-widget weather-widget--erro">
          <IconeNuvem className="weather-widget-icon" />
          <span>Indisponível</span>
        </div>
      )
    }
    return <div className="weather-widget weather-widget--carregando" aria-hidden="true" />
  }

  const Icone = ICONES_POR_PREFIXO[clima.icone?.slice(0, 2)] ?? IconeNuvem
  const descricao = capitalizar(clima.descricao)

  return (
    <div className="weather-widget" title={`${descricao}, ${clima.temperatura}°C em Campinas, SP`}>
      <Icone className="weather-widget-icon" />
      <div className="weather-widget-info">
        <span className="weather-widget-temp">
          {clima.temperatura}°C <span className="weather-widget-desc">{descricao}</span>
        </span>
        <span className="weather-widget-local">Campinas, SP</span>
      </div>
    </div>
  )
}
