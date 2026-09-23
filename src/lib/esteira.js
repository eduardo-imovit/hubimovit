import { supabase } from './supabaseClient'

/**
 * Chama a Edge Function esteira-locacao, que valida identidade (JWT) e
 * despacha pro RPC certo no banco. A sessão atual do supabase-js já vai
 * automaticamente no header Authorization.
 */
async function chamarEsteira(evento, dados) {
  const { data, error } = await supabase.functions.invoke('esteira-locacao', {
    body: { evento, ...dados },
  })
  if (error) {
    // FunctionsHttpError não expõe a mensagem custom que a function devolve
    // ({ erro: "..." }) direto em error.message — precisa ler o corpo.
    let mensagem = error.message
    try {
      const corpo = await error.context.json()
      if (corpo?.erro) mensagem = corpo.erro
    } catch {
      // corpo não era JSON, mantém a mensagem padrão do erro
    }
    throw new Error(mensagem)
  }
  return data
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
