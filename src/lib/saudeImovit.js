// Saúde Imovit (Fase 29a S3, PRD §5.23, Schema §2.22).
// A conta é toda do banco (`saude_imovit`); aqui só período, rótulos e formatos.
import { fmtMoeda, fmtNum, fmtPct, isoLocal, somarDias } from './paineis'
import { fmtMoedaCurta } from './admLocacao'

export const PERIODOS = ['7', '14', '30', '60', '90']
export const MAX_DIAS = 366

/** Filtros na URL. Padrão do plano: 30 dias até ontem, todas as finalidades. */
export const FILTROS_SAUDE = { periodo: '30', finalidade: 'todas', de: '', ate: '', canal: 'todos', comparar: '' }

export const FINALIDADES = [
  { valor: 'todas', label: 'Tudo' },
  { valor: 'locacao', label: 'Locação', ponto: 'Aluguel' },
  { valor: 'venda', label: 'Venda', ponto: 'Venda' },
]

/** Início e fim do período. Chips = N dias até ontem; personalizado = as 2 datas. */
export function intervalo(filtros, hoje = isoLocal()) {
  const ontem = somarDias(hoje, -1)
  if (filtros.periodo !== 'personalizado') {
    const n = Number(filtros.periodo) || 30
    return { inicio: somarDias(ontem, -(n - 1)), fim: ontem, erro: null }
  }
  const { de, ate } = filtros
  if (!de || !ate) return { inicio: de, fim: ate, erro: 'Escolha a data de início e a de fim.' }
  if (ate < de) return { inicio: de, fim: ate, erro: 'A data de fim vem antes da de início.' }
  const dias = Math.round((new Date(`${ate}T12:00:00`) - new Date(`${de}T12:00:00`)) / 86400000) + 1
  if (dias > MAX_DIAS) return { inicio: de, fim: ate, erro: `O período vai até ${MAX_DIAS} dias.` }
  return { inicio: de, fim: ate, erro: null }
}

/** '2026-11-16' → '16/11' */
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
/** '2026-11-16' → '16/11/26' */
export const ddmmaa = (iso) => (iso ? `${ddmm(iso)}/${iso.slice(2, 4)}` : '—')

/** Explicação de cada régua (aparece ao passar o mouse na etiqueta). */
export const REGUA_DICA = {
  entrada: 'ENTRADA: conta os leads que entraram no CRM no período (coorte), mesmo que o resto tenha acontecido depois.',
  evento: 'EVENTO: o que aconteceu no período, pela data do fato (negócio, visita, pagamento, gasto).',
  agora: 'AGORA: foto do momento, na data fim do período. Compara com a semana anterior e com a média de até 8 semanas.',
  'evento ÷ entrada': 'Gasto do período (evento) dividido pelos leads ou qualificados que entraram no período (entrada).',
  'último dia': 'ÚLTIMO DIA: o valor do último dia capturado no período, comparado com o último dia capturado do período anterior.',
}

/** Nome de cada rede do orgânico (29e). Rede nova sem rótulo aparece com a 1ª letra maiúscula. */
const ROTULO_REDE = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }
export const nomeRede = (r) => ROTULO_REDE[r] ?? (r ? r.charAt(0).toUpperCase() + r.slice(1) : '—')

/** '1 negócio' / '2 negócios' */
export const plural = (n, um, varios) => `${fmtNum(n ?? 0)} ${Number(n) === 1 ? um : varios}`

/** Formatos usados nos números. */
export const FORMATO = {
  moeda: (v) => fmtMoeda(v == null ? null : Number(v)),
  moedaCurta: (v) => fmtMoedaCurta(v == null ? null : Number(v)),
  num: (v) => fmtNum(v == null ? null : Number(v), 1),
  pct: (v) => fmtPct(v == null ? null : Number(v)),
}

/** Selo do sinal que o banco já calculou (verde/amarelo/vermelho/neutro/poucos/acumulando). */
export function selo(numero) {
  if (!numero) return null
  const { sinal, variacao } = numero
  const v = variacao == null ? null : Number(variacao)
  const seta = v == null || Math.abs(v) < 0.05 ? '→' : v > 0 ? '↑' : '↓'
  const pctTxt = v == null ? null : `${seta} ${fmtNum(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`
  const contra = numero.referencia === 'media' ? 'vs média' : 'vs anterior'
  if (sinal === 'poucos') return { classe: 'badge-gray', texto: `⚪ poucos casos${pctTxt ? ` · ${pctTxt}` : ''}` }
  if (sinal === 'acumulando') return { classe: 'badge-gray', texto: `⚪ acumulando${pctTxt ? ` · ${pctTxt}` : ''}` }
  if (!pctTxt) return null
  const classe = { verde: 'badge-success', amarelo: 'badge-warning', vermelho: 'badge-danger' }[sinal] ?? 'badge-gray'
  return { classe, texto: `${pctTxt} ${contra}` }
}

/** Texto da referência: "anterior X" ou "média de N semanas X · semana anterior Y". */
export function referencia(numero, fmt) {
  if (!numero) return null
  if (numero.referencia === 'media' && numero.media != null) {
    const n = numero.n ?? 0
    return `média de ${n} ${n === 1 ? 'semana' : 'semanas'}: ${fmt(numero.media)} · semana anterior: ${fmt(numero.anterior)}`
  }
  if (numero.anterior == null) return 'sem comparação'
  return `anterior: ${fmt(numero.anterior)}`
}

/** Variação curta para tabelas, com a cor do sinal (só verde e vermelho pintam). */
export function variacaoCurta(numero) {
  if (!numero || numero.variacao == null) return null
  const v = Number(numero.variacao)
  const classe = numero.sinal === 'verde' ? 'pg-delta-bom' : numero.sinal === 'vermelho' ? 'pg-delta-ruim' : undefined
  const seta = Math.abs(v) < 0.05 ? '→' : v > 0 ? '↑' : '↓'
  return { classe, texto: `${seta}${fmtNum(Math.abs(v), 0)}%` }
}
