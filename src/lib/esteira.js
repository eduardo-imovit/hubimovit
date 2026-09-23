import { chamarFuncao } from './funcoes'

/**
 * Chama a Edge Function esteira-locacao, que valida identidade (JWT) e
 * despacha pro RPC certo no banco.
 */
function chamarEsteira(evento, dados) {
  return chamarFuncao('esteira-locacao', { evento, ...dados })
}

export const criarProposta = (dados) => chamarEsteira('nova_proposta', dados)
export const confirmarDadosLocatario = (dados) => chamarEsteira('confirmar_dados_locatario', dados)
export const completarCadastro = (dados) => chamarEsteira('completar_cadastro', dados)
export const decidirAprovacaoInterna = (dados) => chamarEsteira('decisao_interna', dados)
export const descartarProposta = (dados) => chamarEsteira('descartar_proposta', dados)
export const registrarDocumentosEnviados = (proposta_id, documentos) =>
  chamarEsteira('docs_enviados', { proposta_id, documentos })
export const decidirDocumento = (dados) => chamarEsteira('decisao_adm', dados)
export const solicitarAjustes = (proposta_id) => chamarEsteira('solicitar_ajustes', { proposta_id })
export const marcarSincronizada = (proposta_id) => chamarEsteira('sincronizar_imoview', { proposta_id })
