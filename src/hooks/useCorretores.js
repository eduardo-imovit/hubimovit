import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Corretores ativos do CRM (colaboradores_raw): a maioria não tem login no Hub,
 * então a lista de "corretor responsável" sai daqui, não de perfis.
 */
export function useCorretores() {
  const [corretores, setCorretores] = useState([])

  useEffect(() => {
    let ativo = true
    supabase
      .from('colaboradores_raw')
      .select('id_corretor_crm, nome_completo, email_oficial')
      .eq('ativo', true)
      .order('nome_completo')
      .then(({ data }) => ativo && setCorretores(data ?? []))
    return () => { ativo = false }
  }, [])

  return corretores
}
