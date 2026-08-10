import { formatarHora } from '../../lib/dateUtils'

export default function EventoPilula({ evento, mostrarHora = false }) {
  const texto = mostrarHora ? `${formatarHora(evento.hora)} ${evento.titulo}` : evento.titulo

  if (evento.tipo === 'ocupado') {
    return <div className="cal-pill cal-pill-ocupado">{texto}</div>
  }
  if (evento.tipo === 'bloqueado') {
    return <div className="cal-pill cal-pill-bloqueado">{texto}</div>
  }
  return (
    <div
      className={`cal-pill${evento.pendente ? ' cal-pill-pendente' : ''}`}
      style={{ background: evento.cor || 'var(--champagne)', color: evento.cor ? 'var(--branco)' : 'var(--grafite-mid)' }}
      title={evento.pendente ? 'Tarefa pendente (em atraso)' : undefined}
    >
      {evento.pendente && <span className="cal-pill-pendente-dot" />}
      {texto}
    </div>
  )
}
