import { useEffect, useState } from 'react'
import WeatherCardTV from './WeatherCardTV'
import AgendaFotografoSemanalTV from '../calendar/AgendaFotografoSemanalTV'
import AgendaEventosSemanalTV from '../calendar/AgendaEventosSemanalTV'
import CarrosselRodapeTV from '../tv/CarrosselRodapeTV'
import PlantaoSemanalTV from '../tv/PlantaoSemanalTV'
import { KpisComercialTV, KpisOperacaoTV } from '../tv/KpisTV'
import { Km32TV } from '../tv/Km32TV'
import { useKpisTV } from '../../hooks/useKpisTV'
import { useCampanha } from '../../hooks/useCampanha'
import { SLUG_KM32, campanhaNoAr } from '../../lib/campanhaKm32'
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
  // Km 32 (16/10): relê a cada 5 min; o painel só entra na rotação com a campanha no ar
  const { dados: campanha } = useCampanha(SLUG_KM32, 5 * 60 * 1000)

  // Ordem: Fotógrafo → Plantão (24/09) → Km 32 (16/10) → KPIs 1 → KPIs 2 → Eventos.
  const paineis = [
    { chave: 'fotografo', rotulo: 'Fotógrafo', conteudo: <AgendaFotografoSemanalTV /> },
    { chave: 'plantao', rotulo: 'Plantão', conteudo: <PlantaoSemanalTV hojeISO={hoje} /> },
    ...(campanhaNoAr(campanha) ? [{ chave: 'km32', rotulo: 'Km 32', conteudo: <Km32TV dados={campanha} /> }] : []),
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
