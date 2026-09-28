import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Propostas de venda (visão interna). Espelha usePropostasLocacao, lendo a
 * view propostas_venda_ativas (o RLS já filtra: gestão/adm tudo, corretor as
 * que criou). `somenteAtivas=false` traz o histórico completo.
 */
export function usePropostasVenda(somenteAtivas = true) {
  const [propostas, setPropostas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = somenteAtivas
      ? await supabase.from('propostas_venda_ativas').select('*')
      : await supabase.from('propostas_venda').select('*').order('timestamp_criacao', { ascending: false })
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
