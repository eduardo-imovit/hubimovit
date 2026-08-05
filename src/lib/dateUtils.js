const dataFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
const diaSemanaFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })
const horaFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const diaCurtoFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', timeZone: 'America/Sao_Paulo' })

export function hojeISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Converte um timestamp com timezone (ex: campos timestamptz do Supabase) pro dia local de São Paulo. */
export function paraDataLocalISO(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function formatarDataLonga(date = new Date()) {
  const diaSemana = diaSemanaFormatter.format(date)
  const capitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  return `${capitalizado}, ${dataFormatter.format(date)}`
}

export function formatarHora(dataHora) {
  if (!dataHora) return '--:--'
  return horaFormatter.format(new Date(dataHora))
}

export function formatarDiaCurto(dataISO) {
  return diaCurtoFormatter.format(new Date(`${dataISO}T12:00:00`))
}

export function saudacao() {
  const hora = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' })
  const h = Number(hora)
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function inicioDaSemanaISO(offsetDias = 0, baseISO = hojeISO()) {
  const base = new Date(`${baseISO}T12:00:00`)
  base.setDate(base.getDate() + offsetDias)
  const diaSemana = base.getDay()
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana
  base.setDate(base.getDate() + diff)
  return base.toLocaleDateString('en-CA')
}

export function diasDaSemana(inicioISO) {
  const dias = []
  const base = new Date(`${inicioISO}T12:00:00`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dias.push(d.toLocaleDateString('en-CA'))
  }
  return dias
}
