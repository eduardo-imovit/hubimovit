import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Linha do tempo de uma proposta (status_historico) -- usado no portal do cliente e no painel interno. */
export function useHistoricoProposta(propostaId) {
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    if (!propostaId) {
      setHistorico([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    const { data } = await supabase
      .from('status_historico')
      .select('*')
      .eq('proposta_id', propostaId)
      .order('timestamp_registro', { ascending: true })
    setHistorico(data ?? [])
    setCarregando(false)
  }, [propostaId])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { historico, carregando, recarregar }
}
