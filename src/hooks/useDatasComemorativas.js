import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useDatasComemorativas() {
  const [datas, setDatas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('datas_comemorativas')
      .select('*')
      .eq('ativo', true)
      .order('data', { ascending: true })
    if (error) setErro(error.message)
    else setDatas(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarDataComemorativa(dc) {
    const { error } = await supabase.from('datas_comemorativas').insert(dc)
    if (error) throw error
    await recarregar()
  }

  async function atualizarDataComemorativa(id, dc) {
    const { error } = await supabase.from('datas_comemorativas').update(dc).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  async function desativarDataComemorativa(id) {
    const { error } = await supabase.from('datas_comemorativas').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { datas, carregando, erro, criarDataComemorativa, atualizarDataComemorativa, desativarDataComemorativa }
}
