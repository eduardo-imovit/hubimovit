import { useCallback, useState } from 'react'

/**
 * Estado dos filtros do Dashboard de Performance.
 *
 * Retorno: { filters, setPeriodo, setDataAncora, setDataCustom, setCanal, setEtapa, setFinalidade, resetFiltros }
 *
 * `filters`:
 *   - periodo      'semana' | 'mes' | 'trimestre' | 'customizado'  (tamanho da janela de comparação)
 *   - dataAncora   Date  — data de referência (fim da janela). Default: hoje.
 *   - dataInicio   Date  — início da janela (derivado; editável no modo custom)
 *   - dataFim      Date  — fim da janela (= dataAncora fora do custom)
 *   - janelaDias   number — 7 / 30 / 90 / span do intervalo custom
 *   - canal        'todos' | 'google' | 'meta' | 'whatsapp'
 *   - etapa        'todos' | 'topo' | 'meio' | 'fundo'
 *   - finalidade   'todos' | 'venda' | 'locacao' | 'institucional'
 *
 * Trocar `periodo` ou `dataAncora` recalcula dataInicio/dataFim/janelaDias.
 * `setDataCustom` força periodo = 'customizado' e recalcula janelaDias pelo intervalo.
 */

export const PERIODOS = [
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'trimestre', label: 'Trimestre' },
  { valor: 'customizado', label: 'Personalizado' },
]

const DIAS_POR_PERIODO = { semana: 7, mes: 30, trimestre: 90 }

export const CANAIS = [
  { valor: 'todos', label: 'Todos os canais' },
  { valor: 'google', label: 'Google Ads' },
  { valor: 'meta', label: 'Meta Ads' },
  { valor: 'whatsapp', label: 'WhatsApp' },
]

export const ETAPAS = [
  { valor: 'todos', label: 'Todo o funil' },
  { valor: 'topo', label: 'Topo' },
  { valor: 'meio', label: 'Meio' },
  { valor: 'fundo', label: 'Fundo' },
]

export const FINALIDADES = [
  { valor: 'todos', label: 'Todas as finalidades' },
  { valor: 'venda', label: 'Venda' },
  { valor: 'locacao', label: 'Locação' },
  { valor: 'institucional', label: 'Institucional' },
]

const PADRAO = {
  periodo: 'semana',
  canal: 'todos',
  etapa: 'todos',
  finalidade: 'todos',
}

// ── Helpers de data ──────────────────────────────────────────────────────────

function inicioDoDia(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function fimDoDia(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function diasEntre(inicio, fim) {
  if (!(inicio instanceof Date) || !(fim instanceof Date)) return 7
  return Math.max(1, Math.round((fimDoDia(fim) - inicioDoDia(inicio)) / 86400000) + 1)
}

/**
 * Janela { start, end } (Date) para um preset, terminando na âncora.
 * 'customizado' devolve { start: null, end: null } — quem chama usa as datas do estado.
 */
export function calculateDateRange(periodo, ancora) {
  const dias = DIAS_POR_PERIODO[periodo]
  if (!dias) return { start: null, end: null }
  const end = fimDoDia(ancora ?? new Date())
  const start = inicioDoDia(end)
  start.setDate(start.getDate() - (dias - 1))
  return { start, end }
}

function estadoInicial() {
  const dataAncora = fimDoDia(new Date())
  const { start, end } = calculateDateRange(PADRAO.periodo, dataAncora)
  return { ...PADRAO, dataAncora, dataInicio: start, dataFim: end, janelaDias: DIAS_POR_PERIODO[PADRAO.periodo] }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePerformanceFilters() {
  const [filters, setFilters] = useState(estadoInicial)

  const setPeriodo = useCallback((periodo) => {
    setFilters((prev) => {
      if (periodo === 'customizado') {
        return { ...prev, periodo, janelaDias: diasEntre(prev.dataInicio, prev.dataFim) }
      }
      const { start, end } = calculateDateRange(periodo, prev.dataAncora)
      return { ...prev, periodo, dataInicio: start, dataFim: end, janelaDias: DIAS_POR_PERIODO[periodo] }
    })
  }, [])

  const setDataAncora = useCallback((date) => {
    if (!date) return
    setFilters((prev) => {
      const dataAncora = fimDoDia(date)
      if (prev.periodo === 'customizado') return { ...prev, dataAncora }
      const { start, end } = calculateDateRange(prev.periodo, dataAncora)
      return { ...prev, dataAncora, dataInicio: start, dataFim: end }
    })
  }, [])

  const setDataCustom = useCallback((inicio, fim) => {
    setFilters((prev) => {
      const dataInicio = inicio ? inicioDoDia(inicio) : prev.dataInicio
      const dataFim = fim ? fimDoDia(fim) : prev.dataFim
      return {
        ...prev,
        periodo: 'customizado',
        dataInicio,
        dataFim,
        janelaDias: diasEntre(dataInicio, dataFim),
      }
    })
  }, [])

  const setCanal = useCallback((canal) => setFilters((prev) => ({ ...prev, canal })), [])
  const setEtapa = useCallback((etapa) => setFilters((prev) => ({ ...prev, etapa })), [])
  const setFinalidade = useCallback((finalidade) => setFilters((prev) => ({ ...prev, finalidade })), [])

  const resetFiltros = useCallback(() => setFilters(estadoInicial()), [])

  return {
    filters,
    setPeriodo,
    setDataAncora,
    setDataCustom,
    setCanal,
    setEtapa,
    setFinalidade,
    resetFiltros,
  }
}
