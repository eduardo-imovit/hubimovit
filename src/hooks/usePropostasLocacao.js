import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Propostas de locação ativas (visão interna, gestao/adm) -- reaproveita a view propostas_ativas (já exclui "sincronizada"). */
export function usePropostasLocacao() {
  const [propostas, setPropostas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase.from('propostas_ativas').select('*')
    if (error) {
      setErro(error.message)
    } else {
      setErro(null)
      setPropostas(data ?? [])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { propostas, carregando, erro, recarregar }
}
