import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAvisos() {
  const [avisos, setAvisos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('avisos')
      .select('*')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
    if (error) setErro(error.message)
    else setAvisos(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarAviso(aviso) {
    const { error } = await supabase.from('avisos').insert(aviso)
    if (error) throw error
    await recarregar()
  }

  async function desativarAviso(id) {
    const { error } = await supabase.from('avisos').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { avisos, carregando, erro, criarAviso, desativarAviso }
}
