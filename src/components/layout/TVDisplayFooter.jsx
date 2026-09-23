import { useEffect, useState } from 'react'
import WeatherCardTV from './WeatherCardTV'
import AgendaFotografoSemanalTV from '../calendar/AgendaFotografoSemanalTV'
import AgendaEventosSemanalTV from '../calendar/AgendaEventosSemanalTV'
import CarrosselRodapeTV from '../tv/CarrosselRodapeTV'
import { hojeISO } from '../../lib/dateUtils'

/** Data de hoje que se atualiza sozinha: a TV fica ligada dias seguidos e a semana precisa virar. */
function useHojeISO() {
  const [hoje, setHoje] = useState(hojeISO())
  useEffect(() => {
    const timer = setInterval(() => setHoje(hojeISO()), 60000)
    return () => clearInterval(timer)
  }, [])
  return hoje
}

export default function TVDisplayFooter() {
  const hoje = useHojeISO()

  const paineis = [
    { chave: 'fotografo', rotulo: 'Fotógrafo', conteudo: <AgendaFotografoSemanalTV /> },
    { chave: 'eventos', rotulo: 'Eventos', conteudo: <AgendaEventosSemanalTV hojeISO={hoje} /> },
  ]

  return (
    <footer className="tv-footer">
      <div className="tv-footer-col tv-footer-col--clima">
        <WeatherCardTV />
      </div>

      <div className="tv-footer-col tv-footer-col--fotografo">
        <CarrosselRodapeTV paineis={paineis} />
      </div>
    </footer>
  )
}
