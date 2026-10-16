import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Resumo da campanha (campanha_resumo). Com `intervaloMs`, relê sozinho:
 * a TV fica ligada dias seguidos e não recarrega a página.
 */
export function useCampanha(slug, intervaloMs = 0) {
  const [estado, setEstado] = useState({ dados: null, erro: false, carregando: true })
  useEffect(() => {
    let ativo = true
    const ler = () => supabase.rpc('campanha_resumo', { p_slug: slug }).then(({ data, error }) => {
      if (!ativo) return
      // numa releitura que falhar, mantém os últimos números na tela
      setEstado((anterior) => (error && anterior.dados ? anterior : { dados: data ?? null, erro: !!error, carregando: false }))
    })
    ler()
    const timer = intervaloMs ? setInterval(ler, intervaloMs) : null
    return () => {
      ativo = false
      if (timer) clearInterval(timer)
    }
  }, [slug, intervaloMs])
  return estado
}
