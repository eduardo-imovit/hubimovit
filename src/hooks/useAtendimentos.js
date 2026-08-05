import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAtendimentos() {
  const [atendimentos, setAtendimentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    supabase
      .from('dashboard_atendimentos_crm')
      .select('id, codigo, corretor, data_de_entrada, data_fechamento, fase, funil, campanha, midia, situacao, finalidade')
      .order('data_de_entrada', { ascending: false })
      .range(0, 4999)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErro(error.message)
        else setAtendimentos(data ?? [])
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  return { atendimentos, carregando, erro }
}
