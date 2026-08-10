import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_EVENTO = ['Visita', 'Reunião', 'Compromisso', 'Agendar Fotos']

export function useAtividadesPeriodo(inicioISO, fimISO) {
  const [atividades, setAtividades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    supabase
      .from('atividades')
      .select('codigo, titulo, datahorainicio, datahorafim, nometipo, cortipo, nomeusuario, nomepessoa, resumoimovel, realizada')
      .in('nometipo', TIPOS_EVENTO)
      .gte('datahorainicio', `${inicioISO}T00:00:00`)
      .lte('datahorainicio', `${fimISO}T23:59:59`)
      .order('datahorainicio', { ascending: true })
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
