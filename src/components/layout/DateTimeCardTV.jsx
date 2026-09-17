import { useEffect, useState } from 'react'

const horaFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})
const diaSemanaFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', timeZone: 'America/Sao_Paulo',
})
const dataCurtaFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo',
})

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function DateTimeCardTV() {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="datetime-plain-tv">
      <span className="datetime-plain-tv-hora">{horaFormatter.format(agora)}</span>
      <span className="datetime-plain-tv-dia">{capitalizar(diaSemanaFormatter.format(agora))}</span>
      <span className="datetime-plain-tv-data">{dataCurtaFormatter.format(agora)}</span>
    </div>
  )
}
