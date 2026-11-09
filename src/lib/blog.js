import DOMPurify from 'dompurify'
import { supabase } from './supabaseClient'

// Revisão do blog no Hub (PRD §5.22, RF35). O motor que escreve os posts mora no
// projeto newsletters-imovit; aqui só lemos os rascunhos e chamamos blog_decidir(),
// que confere no banco se quem está logado é gestão ou marketing.

export async function listarRascunhos() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, titulo, tema, publico, data_geracao')
    .eq('status', 'rascunho')
    .order('data_geracao', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function lerPost(id) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, titulo, tema, angulo, publico, conteudo_html, data_geracao')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** acao: 'approve' | 'reject'. Devolve { resultado, titulo }. */
export async function decidir(id, acao, observacao) {
  const { data, error } = await supabase.rpc('blog_decidir', {
    p_post_id: id,
    p_acao: acao,
    p_observacao: observacao?.trim() || null,
  })
  if (error) throw error
  return data?.[0] ?? null
}

// O artigo foi escrito por IA a partir de páginas da internet: antes de mostrar dentro
// do Hub (onde há sessão logada), só passa texto, títulos, listas e links comuns.
const PERMITIDO = {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['href'],
}
DOMPurify.addHook('afterSanitizeAttributes', (el) => {
  if (el.tagName === 'A') {
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  }
})
export const htmlSeguro = (html) => DOMPurify.sanitize(html ?? '', PERMITIDO)
