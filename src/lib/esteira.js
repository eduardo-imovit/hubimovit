import { chamarFuncao } from './funcoes'

/**
 * Chama a Edge Function esteira-locacao, que valida identidade (JWT) e
 * despacha pro RPC certo no banco.
 */
// Em teste local (.env.development.local) aponta para a função paralela
// esteira-locacao-v4; o site publicado sempre usa esteira-locacao.
const FUNCAO_ESTEIRA = import.meta.env.VITE_FUNCAO_ESTEIRA || 'esteira-locacao'

function chamarEsteira(evento, dados) {
  return chamarFuncao(FUNCAO_ESTEIRA, { evento, ...dados })
}

export const criarProposta = (dados) => chamarEsteira('nova_proposta', dados)
export const editarProposta = (dados) => chamarEsteira('editar_proposta', dados)
export const validarProposta = (proposta_id) => chamarEsteira('validar_proposta', { proposta_id })
export const pedirCorrecao = (proposta_id, motivo) => chamarEsteira('pedir_correcao', { proposta_id, motivo })
export const completarCadastro = (dados) => chamarEsteira('completar_cadastro', dados)
export const descartarProposta = (dados) => chamarEsteira('descartar_proposta', dados)
export const registrarDocumentosEnviados = (proposta_id, documentos) =>
  chamarEsteira('docs_enviados', { proposta_id, documentos })
export const decidirDocumento = (dados) => chamarEsteira('decisao_adm', dados)
export const solicitarAjustes = (proposta_id) => chamarEsteira('solicitar_ajustes', { proposta_id })
export const marcarSincronizada = (proposta_id) => chamarEsteira('sincronizar_imoview', { proposta_id })
