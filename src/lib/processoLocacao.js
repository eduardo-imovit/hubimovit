// Processo de Locação (RF33, PRD §5.20, Schema §2.20): regras puras, sem React.
// Mesma lógica da página HTML da Direção, que continua no ar até a ADM validar o guia (D7).

/** Os dois processos guardados em locacao_etapas.processo. */
export const PROCESSOS = {
  contrato: {
    nome: 'Processo de Contrato',
    desc: 'Do fechamento da negociação até a emissão do primeiro boleto.',
  },
  adm: {
    nome: 'Administração do Contrato',
    desc: 'Solicitações que chegam durante a vigência, cada uma com seu próprio fluxo.',
    nota: 'Entrada das solicitações: e-mail, WhatsApp ou telefone (menos usado). Cada tipo de solicitação segue o fluxo da sua fase abaixo.',
  },
}

/** Abas da página (a "Em andamento" fica escondida na v1, D5). */
export const ABAS = [
  { chave: 'contrato', label: 'Contrato' },
  { chave: 'adm', label: 'Administração' },
  { chave: 'equipe', label: 'Equipe e papéis' },
]

const porOrdem = (a, b) => Number(a.ordem) - Number(b.ordem)

/** Etapas de um processo, na ordem do desenho. */
export function etapasDe(etapas, processo) {
  return etapas.filter((e) => e.processo === processo).sort(porOrdem)
}

/**
 * Fases (campo `grupo`) na ordem da 1ª aparição, cada uma com TODAS as suas etapas
 * (igual à página da Direção, mesmo se uma fase aparecer em pontos separados da ordem).
 */
export function fasesDe(etapasOrdenadas) {
  const fases = new Map()
  for (const e of etapasOrdenadas) {
    if (!fases.has(e.grupo)) fases.set(e.grupo, { nome: e.grupo, etapas: [] })
    fases.get(e.grupo).etapas.push(e)
  }
  return [...fases.values()]
}

/** Papéis que aparecem em pelo menos uma etapa do processo, na ordem dos papéis. */
export function papeisUsados(papeis, etapasOrdenadas) {
  const ids = new Set(etapasOrdenadas.map((e) => e.papel))
  return papeis.filter((p) => ids.has(p.id)).sort(porOrdem)
}

export const ordenarPapeis = (papeis) => [...papeis].sort(porOrdem)

/** Cor de fallback quando a etapa não tem papel (mesma do padrão da tabela). */
export const COR_SEM_PAPEL = '#7a8a99'
