import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Página inteira da Saúde Imovit numa chamada: `saude_imovit(p_inicio, p_fim, p_finalidade)`
 * (Schema §2.22). A função confere o papel (pode_ver_saude) e recusa quem não pode.
 * Guarda o tempo da última resposta para acompanhar períodos longos (90 dias).
 */
export function useSaudeImovit({ inicio, fim, finalidade, pular }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [segundos, setSegundos] = useState(null)
  const pedido = useRef(0)

  useEffect(() => {
    if (pular) return
    const meu = ++pedido.current
    const t0 = performance.now()
    setCarregando(true)
    setErro(null)
    supabase
      .rpc('saude_imovit', { p_inicio: inicio, p_fim: fim, p_finalidade: finalidade })
      .then(({ data, error }) => {
        if (meu !== pedido.current) return // resposta de um filtro antigo
        if (error) {
          setErro(error.code === '42501' ? 'Sem acesso à Saúde Imovit.' : error.message)
        } else {
          setDados(data)
          setSegundos((performance.now() - t0) / 1000)
        }
        setCarregando(false)
      })
  }, [inicio, fim, finalidade, pular])

  return { dados, erro, carregando, segundos }
}
