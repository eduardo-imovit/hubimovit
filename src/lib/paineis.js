// Utilitários compartilhados pelos painéis da Gestão e de Performance
// (docs/01-prd.md §5.0 e §5.0b): datas, formatação, safra madura e saúde dos dados.

const DIA_MS = 24 * 60 * 60 * 1000

/** Data local em 'YYYY-MM-DD' (as datas do CRM não têm fuso). */
export function isoLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export function somarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number)
  return isoLocal(new Date(y, m - 1, d + dias))
}

export function diasEntre(isoA, isoB) {
  const [ya, ma, da] = isoA.slice(0, 10).split('-').map(Number)
  const [yb, mb, db] = isoB.slice(0, 10).split('-').map(Number)
  return Math.round((new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da)) / DIA_MS)
}

/** '2026-09' → { inicio: '2026-09-01', fim: '2026-09-30', dias: 30 } */
export function limitesMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  return { inicio: `${mes}-01`, fim: `${mes}-${String(dias).padStart(2, '0')}`, dias }
}

export function mesAnterior(mes, n = 1) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nomeMes(mes) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}


export function mediana(valores) {
  const v = valores.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

export const pct = (a, b) => (b > 0 ? (a / b) * 100 : null)

/** Moeda sem centavos; abaixo de R$ 10 mostra centavos (CPC, CPL de marca). */
export const fmtMoeda = (v) =>
  v == null
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(v) < 10 && v !== 0 ? 2 : 0, minimumFractionDigits: Math.abs(v) < 10 && v !== 0 ? 2 : 0 })

export const fmtPct = (v, casas = 1) =>
  v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`

export const fmtNum = (v, casas = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas }))

/** Leads válidos (sem ruído e sem captação interna). */
const leadsValidos = (base) => base.filter((a) => !a.is_ruido && !a.is_interno)

export const STATUS_PROPOSTA_CONCLUIDA = ['sincronizada', 'concluida']

/**
 * Negócios só existem no CRM importado para leads que entraram a partir de
 * out/2025 (antes disso os meses têm leads e zero negócios: artefato da carga).
 * Toda conta de conversão começa aqui.
 */
export const INICIO_HISTORICO_CONFIAVEL = '2025-10-01'

/**
 * Safra madura: leads que entraram entre 60 e 425 dias atrás (limitado ao
 * início do histórico confiável). 90% dos ganhos fecham em até 49 dias, então
 * essa safra já teve tempo de virar negócio.
 */
export function safraMadura(base, hoje, { de = 425, ate = 60 } = {}) {
  const inicioBruto = somarDias(hoje, -de)
  const inicio = inicioBruto < INICIO_HISTORICO_CONFIAVEL ? INICIO_HISTORICO_CONFIAVEL : inicioBruto
  const fim = somarDias(hoje, -ate)
  return {
    inicio,
    fim,
    linhas: leadsValidos(base).filter((a) => a.data_entrada >= inicio && a.data_entrada <= fim),
  }
}

export const ETAPAS = [
  { ordem: 1, label: 'Lead' },
  { ordem: 4, label: 'Qualificado' },
  { ordem: 5, label: 'Visita' },
  { ordem: 6, label: 'Proposta' },
  { ordem: 7, label: 'Negócio' },
]

/** Saúde dos dados: dias desde a última informação de cada fonte. */
export function saudeDados(ultimas, hoje) {
  return ultimas.map((f) => {
    const dias = f.ultima ? diasEntre(f.ultima.slice(0, 10), hoje) : null
    return { ...f, dias, status: dias == null ? 'ruim' : dias <= f.toleranciaDias ? 'bom' : dias <= f.toleranciaDias + 2 ? 'atencao' : 'ruim' }
  })
}
