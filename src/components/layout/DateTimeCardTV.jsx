import { useEffect, useState } from 'react'
import { formatarDataLonga } from '../../lib/dateUtils'
import { IconeRelogio } from './skyIcons'

const horaFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

export default function DateTimeCardTV() {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="sky-card-tv sky-neutro">
      <IconeRelogio className="sky-card-tv-icon-bg" />

      <div className="sky-card-tv-content">
        <span className="sky-card-tv-value">{horaFormatter.format(agora)}</span>
        <span className="sky-card-tv-desc">{formatarDataLonga(agora)}</span>
      </div>
    </div>
  )
}
