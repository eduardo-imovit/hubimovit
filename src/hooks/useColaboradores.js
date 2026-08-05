import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    supabase
      .from('colaboradores_raw')
      .select('id_corretor_crm, nome_completo, email_oficial, equipe, cargo, ativo')
      .eq('ativo', true)
      .order('nome_completo', { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErro(error.message)
        else setColaboradores(data ?? [])
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  return { colaboradores, carregando, erro }
}
