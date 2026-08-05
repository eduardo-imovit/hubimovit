import { diasDaSemana, inicioDaSemanaISO } from './dateUtils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function primeiroDiaDoMesISO(anoMesISO) {
  return `${anoMesISO.slice(0, 7)}-01`
}

export function ultimoDiaDoMesISO(anoMesISO) {
  const [ano, mes] = anoMesISO.slice(0, 7).split('-').map(Number)
  const d = new Date(ano, mes, 0)
  return d.toLocaleDateString('en-CA')
}

export function mesAnterior(anoMesISO) {
  const d = new Date(`${primeiroDiaDoMesISO(anoMesISO)}T12:00:00`)
  d.setMonth(d.getMonth() - 1)
  return d.toLocaleDateString('en-CA')
}

export function mesSeguinte(anoMesISO) {
  const d = new Date(`${primeiroDiaDoMesISO(anoMesISO)}T12:00:00`)
  d.setMonth(d.getMonth() + 1)
  return d.toLocaleDateString('en-CA')
}

export function diaAnterior(dataISO) {
  const d = new Date(`${dataISO}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

export function diaSeguinte(dataISO) {
  const d = new Date(`${dataISO}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA')
}

export function formatarMesAno(dataISO) {
  const [ano, mes] = dataISO.slice(0, 7).split('-').map(Number)
  return `${MESES[mes - 1]} de ${ano}`
}

/** Matriz de semanas (cada uma com 7 datas ISO) cobrindo o mês inteiro, começando na segunda-feira. */
export function matrizDoMes(anoMesISO) {
  const inicioMes = primeiroDiaDoMesISO(anoMesISO)
  const fimMes = ultimoDiaDoMesISO(anoMesISO)
  const primeiraSemana = inicioDaSemanaISO(0, inicioMes)
  const semanas = []
  let semanaAtual = primeiraSemana
  while (semanaAtual <= fimMes) {
    semanas.push(diasDaSemana(semanaAtual))
    const proxima = new Date(`${semanaAtual}T12:00:00`)
    proxima.setDate(proxima.getDate() + 7)
    semanaAtual = proxima.toLocaleDateString('en-CA')
  }
  return semanas
}

/** Resolve a ocorrência de uma data comemorativa recorrente no ano de referência. */
export function ocorrenciaNoAno(dataBaseISO, anoAlvo) {
  const [, mes, dia] = dataBaseISO.split('-').map(Number)
  const ultimoDiaMesAlvo = new Date(anoAlvo, mes, 0).getDate()
  const diaAjustado = Math.min(dia, ultimoDiaMesAlvo)
  return `${anoAlvo}-${String(mes).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`
}

/** Formato ISO 8601 de semana, ex: "2026-W32" — exigido pela coluna semana_iso de agendamentos_fotografo. */
export function semanaISO(dataISO) {
  const d = new Date(`${dataISO}T12:00:00`)
  const diaSemanaISO = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() + 4 - diaSemanaISO)
  const inicioAno = new Date(d.getFullYear(), 0, 1)
  const numeroSemana = Math.ceil(((d - inicioAno) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(numeroSemana).padStart(2, '0')}`
}

export function dataComemorativaOcorreEm(dataComemorativa, dataISO) {
  if (dataComemorativa.recorrente_anual) {
    const anoAlvo = Number(dataISO.slice(0, 4))
    return ocorrenciaNoAno(dataComemorativa.data, anoAlvo) === dataISO
  }
  return dataComemorativa.data === dataISO
}
