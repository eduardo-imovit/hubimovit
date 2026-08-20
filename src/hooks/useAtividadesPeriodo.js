import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Atividades cruas num intervalo de datas, com o corretor responsável — usado para relatórios por equipe/período. */
export function useAtividadesPeriodo(inicioISO, fimISO) {
  const [atividades, setAtividades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    supabase
      .from('atividades')
      .select('codigousuario, nometipo, datahorainicio, realizada')
      .gte('datahorainicio', `${inicioISO}T00:00:00`)
      .lte('datahorainicio', `${fimISO}T23:59:59`)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErro(error.message)
        else setAtividades(data ?? [])
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [inicioISO, fimISO])

  return { atividades, carregando, erro }
}
