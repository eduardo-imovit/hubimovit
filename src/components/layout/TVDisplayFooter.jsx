import { useEffect, useState } from 'react'
import WeatherCardTV from './WeatherCardTV'
import AgendaFotografoSemanalTV from '../calendar/AgendaFotografoSemanalTV'
import AgendaEventosSemanalTV from '../calendar/AgendaEventosSemanalTV'
import CarrosselRodapeTV from '../tv/CarrosselRodapeTV'
import PlantaoSemanalTV from '../tv/PlantaoSemanalTV'
import { KpisComercialTV, KpisOperacaoTV } from '../tv/KpisTV'
import { useKpisTV } from '../../hooks/useKpisTV'
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
  const { kpis, erro } = useKpisTV()

  // Ordem: Fotógrafo → Plantão (24/09) → KPIs 1 → KPIs 2 → Eventos.
  const paineis = [
    { chave: 'fotografo', rotulo: 'Fotógrafo', conteudo: <AgendaFotografoSemanalTV /> },
    { chave: 'plantao', rotulo: 'Plantão', conteudo: <PlantaoSemanalTV hojeISO={hoje} /> },
    { chave: 'comercial', rotulo: 'Comercial', conteudo: <KpisComercialTV kpis={kpis} erro={erro} /> },
    { chave: 'operacao', rotulo: 'Operação', conteudo: <KpisOperacaoTV kpis={kpis} erro={erro} /> },
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
