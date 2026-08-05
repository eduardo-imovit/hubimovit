import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useBibliotecaLinks() {
  const [links, setLinks] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('biblioteca_links')
      .select('*')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('ordem', { ascending: true })
    if (error) setErro(error.message)
    else setLinks(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarLink(link) {
    const { error } = await supabase.from('biblioteca_links').insert(link)
    if (error) throw error
    await recarregar()
  }

  async function desativarLink(id) {
    const { error } = await supabase.from('biblioteca_links').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { links, carregando, erro, criarLink, desativarLink }
}
