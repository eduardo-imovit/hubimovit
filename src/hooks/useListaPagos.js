import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Quem está atrás de um número da Saúde Imovit (degraus da escada paga e fatias das pizzas).
 * Desde o Sprint B (24/11) a conta é do banco: `saude_lista(p_inicio, p_fim, p_finalidade, p_etapa,
 * p_canal, p_midia)` (Schema §2.22), com as mesmas regras da saude_linhas(). Só é chamada no clique,
 * porque é pesada. A função confere o papel (Gestão e Marketing) e recusa os outros.
 * Etapas: leads, qualificados, visitas, propostas, descartados (negócios ainda não abre lista).
 */
export function useListaAtendimentos({ inicio, fim, finalidade, etapa, canal, midia }) {
  const [estado, setEstado] = useState({ linhas: null, erro: null })

  useEffect(() => {
    if (!etapa || !inicio || !fim) return
    let vivo = true
    setEstado({ linhas: null, erro: null })
    supabase
      .rpc('saude_lista', {
        p_inicio: inicio,
        p_fim: fim,
        p_finalidade: finalidade,
        p_etapa: etapa,
        p_canal: canal ?? null,
        p_midia: midia ?? null,
      })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setEstado({ linhas: null, erro: error.code === '42501' ? 'sem acesso' : error.message })
        else setEstado({ linhas: (data ?? []).map((l) => ({ ...l, respostaMin: l.resposta_min == null ? null : Number(l.resposta_min) })), erro: null })
      })
    return () => {
      vivo = false
    }
  }, [inicio, fim, finalidade, etapa, canal, midia])

  return estado
}

/** Degraus da escada paga: o mesmo, sempre no canal "Campanhas pagas". */
export function useListaPagos({ inicio, fim, finalidade, etapa }) {
  return useListaAtendimentos({ inicio, fim, finalidade, etapa, canal: 'Campanhas pagas' })
}
