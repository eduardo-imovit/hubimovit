import Calendario from '../components/calendar/Calendario'

/** Agenda completa (mês, semana, dia): saiu da Home para ela ficar curta (docs/01-prd.md §5.4). */
export default function Agenda() {
  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Escritório</div>
          <div className="page-title">Agenda</div>
          <div className="page-sub">Reuniões, plantão, fotógrafo, avisos com data e aniversários.</div>
        </div>
      </header>
      <Calendario />
    </div>
  )
}
