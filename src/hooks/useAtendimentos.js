import { useEffect, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'

export function useAtendimentos() {
  const [atendimentos, setAtendimentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    fetchTodasLinhas(() =>
      supabase
        .from('dashboard_atendimentos_crm')
        .select('id, codigo, corretor, data_de_entrada, data_fechamento, fase, funil, campanha, midia, situacao, finalidade')
        .order('data_de_entrada', { ascending: false })
    )
      .then((data) => {
        if (!ativo) return
        setAtendimentos(data)
      })
      .catch((error) => {
        if (!ativo) return
        setErro(error.message)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  return { atendimentos, carregando, erro }
}
