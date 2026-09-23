import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Os números mudam devagar (CRM sincroniza por lote); 5 min basta pra TV.
const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000

/**
 * KPIs agregados da TV Display, vindos da função kpis_tv() do banco -- a conta
 * da TV não lê as tabelas de CRM direto. Atualiza sozinho; se uma atualização
 * falhar, mantém os últimos números na tela em vez de apagar o painel.
 */
export function useKpisTV() {
  const [kpis, setKpis] = useState(null)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('kpis_tv')
    if (error) {
      setErro(error.message)
      return
    }
    setErro(null)
    setKpis(data)
  }, [])

  useEffect(() => {
    carregar()
    const timer = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(timer)
  }, [carregar])

  return { kpis, erro }
}
