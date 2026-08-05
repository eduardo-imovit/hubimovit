import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos no .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// O PostgREST do projeto limita cada resposta a 1000 linhas, mesmo pedindo
// um range maior — por isso paginamos manualmente até a página vir incompleta.
export async function fetchTodasLinhas(criarConsulta, tamanhoPagina = 1000) {
  let offset = 0
  let todas = []
  while (true) {
    const { data, error } = await criarConsulta().range(offset, offset + tamanhoPagina - 1)
    if (error) throw error
    todas = todas.concat(data ?? [])
    if (!data || data.length < tamanhoPagina) break
    offset += tamanhoPagina
  }
  return todas
}
