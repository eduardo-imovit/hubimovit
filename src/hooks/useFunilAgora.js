import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Fases do Kanban com acento para exibir (a base grava sem acento). */
export const FASES_AGORA = [
  { ordem: 1, label: 'Pré-atendimento' },
  { ordem: 2, label: 'Seleção de perfil' },
  { ordem: 3, label: 'Seleção de imóveis' },
  { ordem: 4, label: 'Lead qualificado' },
  { ordem: 5, label: 'Visita' },
  { ordem: 6, label: 'Proposta' },
]

/** Campo do bloco `comercial.agora.parado` para cada filtro de dias parado (0 = todos em aberto). */
export const CAMPO_PARADO = { 0: 'abertos', 7: 'mais_7', 15: 'mais_15', 30: 'mais_30' }

/**
 * Contagem do funil agora (Sprint B, 24/11): vem pronta da saude_imovit em `comercial.agora.parado`
 * (total e por canal). Devolve { [fase_ordem]: { abertos, mais_7, mais_15, mais_30 } } do recorte de canal.
 */
export function funilAgoraDoCanal(parado, canal) {
  const linhas = !parado ? [] : !canal || canal === 'todos' ? parado.total ?? [] : (parado.por_canal ?? []).filter((l) => l.canal === canal)
  return Object.fromEntries(linhas.map((l) => [l.posicao, l]))
}

/**
 * Quem está parado numa fase (clique no funil agora): `saude_lista_agora(p_finalidade, p_canal,
 * p_posicao, p_parado)`, do mais parado para o menos. Só chamada no clique.
 */
export function useListaAgora({ finalidade, canal, posicao, parado }) {
  const [estado, setEstado] = useState({ linhas: null, erro: null })

  useEffect(() => {
    if (!posicao) return
    let vivo = true
    setEstado({ linhas: null, erro: null })
    supabase
      .rpc('saude_lista_agora', {
        p_finalidade: finalidade,
        p_canal: canal && canal !== 'todos' ? canal : null,
        p_posicao: posicao,
        p_parado: parado ?? 0,
      })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setEstado({ linhas: null, erro: error.code === '42501' ? 'sem acesso' : error.message })
        else setEstado({ linhas: data ?? [], erro: null })
      })
    return () => {
      vivo = false
    }
  }, [finalidade, canal, posicao, parado])

  return estado
}
