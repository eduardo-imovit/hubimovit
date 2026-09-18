import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Propostas de locação (visão interna, gestao/adm).
 * `somenteAtivas` (padrão): reaproveita a view propostas_ativas (exclui "sincronizada") --
 * usado em Propostas/Esteiras, que são telas de trabalho em andamento.
 * `somenteAtivas: false`: todas as propostas, incluindo concluídas/rejeitadas/expiradas --
 * usado em Processos, que é a visão consolidada/histórica.
 */
export function usePropostasLocacao(somenteAtivas = true) {
  const [propostas, setPropostas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = somenteAtivas
      ? await supabase.from('propostas_ativas').select('*')
      : await supabase.from('propostas_locacao').select('*').order('timestamp_criacao', { ascending: false })
    if (error) {
      setErro(error.message)
    } else {
      setErro(null)
      setPropostas(data ?? [])
    }
    setCarregando(false)
  }, [somenteAtivas])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { propostas, carregando, erro, recarregar }
}
