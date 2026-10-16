// Contas da campanha Km 32 (PRD §5.9), usadas pela Home (TrilhaKm32) e pela
// TV Display (Km32TV). Os números vêm de campanha_resumo(); aqui fica só a régua.
export const SLUG_KM32 = 'km32-4tri-2026'
export const KM_INICIO = 32
export const KM_FIM = 42
export const FINALIDADES_KM32 = [
  { chave: 'Venda', rotulo: 'Venda' },
  { chave: 'Aluguel', rotulo: 'Locação' },
]
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const DIA_MS = 24 * 60 * 60 * 1000
export const dataLocal = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmtUm = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Venda em milhões (abaixo de R$ 1 MM, em mil); locação em mil (é aluguel mensal). */
export const moeda = (finalidade, v) => (v == null ? '—' : finalidade === 'Venda' && Math.abs(v) >= 1_000_000 ? `R$ ${fmtUm(v / 1_000_000)} MM` : `R$ ${fmtUm(v / 1_000)} mil`)
export const km = (fracao) => Math.round(KM_INICIO + (KM_FIM - KM_INICIO) * fracao)
// `pct` é só para posições no CSS; `pctTexto` é para ler (vírgula decimal)
export const pct = (f) => `${(f * 100).toFixed(2)}%`
export const pctTexto = (f) => `${(f * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/** Quanto do período já passou (0–1) até a data, contando o próprio dia. */
export function fracaoAte(inicio, fim, data) {
  const total = (dataLocal(fim) - dataLocal(inicio)) / DIA_MS + 1
  const passados = (data - dataLocal(inicio)) / DIA_MS + 1
  return Math.min(1, Math.max(0, passados / total))
}

/** Dias de calendário entre duas datas, contando as duas pontas. */
export const diasEntre = (a, b) => Math.round((b - a) / DIA_MS) + 1

/**
 * Meta do mês corrente pela mesma régua diária (16/10): meta da campanha ÷ dias
 * da campanha × dias do mês dentro dela. Dá a sensação de possível sem trocar
 * a conta: a soma das metas dos meses é a meta da campanha.
 */
export function metaDoMes(inicio, fim, hoje, meta) {
  const a = dataLocal(inicio)
  const b = dataLocal(fim)
  const h = dataLocal(hoje)
  const de = new Date(Math.max(a, new Date(h.getFullYear(), h.getMonth(), 1)))
  const ate = new Date(Math.min(b, new Date(h.getFullYear(), h.getMonth() + 1, 0)))
  return { valor: (meta / diasEntre(a, b)) * diasEntre(de, ate), mes: MESES_LONGOS[h.getMonth()] }
}

/**
 * Paradas no último dia de cada mês, na mesma régua do tempo: a tracejada
 * "hoje" encosta na parada no fim do mês. A meta acumulada da parada é a mesma
 * fração (ex.: 31/10 = 29,9% do período = 29,9% da meta).
 */
export function paradasDa(inicio, fim) {
  const a = dataLocal(inicio)
  const b = dataLocal(fim)
  const paradas = []
  for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const fimDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const data = fimDoMes < b ? fimDoMes : b
    paradas.push({ mes: MESES[d.getMonth()], data, fracao: fracaoAte(inicio, fim, data) })
  }
  return paradas
}

/** A campanha está no ar hoje (ativa e dentro do período)? */
export const campanhaNoAr = (dados) => !!dados && dados.hoje >= dados.inicio && dados.hoje <= dados.fim

/**
 * Leitura de uma finalidade: progresso, tempo, meta do mês, esperado até hoje
 * (meta ÷ dias da campanha × dias passados) e a diferença para ele.
 */
export function leituraFinalidade(dados, f) {
  const progresso = Math.min(1, f.valor / f.meta_valor)
  const tempo = fracaoAte(dados.inicio, dados.fim, dataLocal(dados.hoje))
  const esperado = f.meta_valor * tempo
  const diferenca = f.valor - esperado
  const diasCampanha = diasEntre(dataLocal(dados.inicio), dataLocal(dados.fim))
  return {
    progresso,
    tempo,
    esperado,
    diferenca,
    noRitmo: Math.abs(diferenca) < f.meta_valor * 0.01,
    diasCampanha,
    diasPassados: diasEntre(dataLocal(dados.inicio), dataLocal(dados.hoje)),
    porDia: f.meta_valor / diasCampanha,
    metaMes: metaDoMes(dados.inicio, dados.fim, dados.hoje, f.meta_valor),
    valorMes: f.valor_mes ?? f.valor,
    batida: f.valor >= f.meta_valor,
  }
}
