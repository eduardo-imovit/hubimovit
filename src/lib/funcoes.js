import { supabase } from './supabaseClient'

/**
 * Chama uma Edge Function do projeto. A sessão atual do supabase-js já vai
 * automaticamente no header Authorization.
 */
export async function chamarFuncao(nome, body) {
  const { data, error } = await supabase.functions.invoke(nome, { body })
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
