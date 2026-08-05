import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { hojeISO } from '../lib/dateUtils'

export function useAtividadesHoje() {
  const [atividades, setAtividades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    const hoje = hojeISO()

    supabase
      .from('atividades')
      .select('codigo, titulo, datahorainicio, datahorafim, nometipo, cortipo, nomeusuario, nomepessoa, resumoimovel, realizada')
      .gte('datahorainicio', `${hoje}T00:00:00`)
      .lte('datahorainicio', `${hoje}T23:59:59`)
      .order('datahorainicio', { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErro(error.message)
        else setAtividades(data ?? [])
        setCarregando(false)
      })

    return () => { ativo = false }
  }, [])

  return { atividades, carregando, erro }
}
