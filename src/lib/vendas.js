import { chamarFuncao } from './funcoes'

/**
 * Proposta de VENDA — chama a Edge Function proposta-venda (fluxo paralelo
 * ao esteira-locacao; a página de locação não é tocada).
 */
function chamarVenda(evento, dados) {
  return chamarFuncao('proposta-venda', { evento, ...dados })
}

export const criarPropostaVenda = (dados) => chamarVenda('nova_proposta', dados)
export const confirmarPropostaVenda = (dados) => chamarVenda('confirmar_proposta', dados)
export const descartarPropostaVenda = (dados) => chamarVenda('descartar_proposta', dados)
