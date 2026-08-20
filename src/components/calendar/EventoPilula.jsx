import { formatarHora } from '../../lib/dateUtils'

export default function EventoPilula({ evento, mostrarHora = false }) {
  const texto = mostrarHora ? `${formatarHora(evento.hora)} ${evento.titulo}` : evento.titulo

  return (
    <div
      className="cal-pill"
      style={{ background: evento.cor || 'var(--champagne)', color: evento.cor ? 'var(--branco)' : 'var(--grafite-mid)' }}
    >
      {texto}
    </div>
  )
}
