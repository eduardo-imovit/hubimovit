import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Lista de perfis (todos os usuários do Hub) — só a Gestão enxerga via RLS. */
export function usePerfis() {
  const [perfis, setPerfis] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('perfis')
      .select('id, email, role, criado_em, nome, cargo, foto_url')
      .order('email', { ascending: true })
    if (error) setErro(error.message)
    else setPerfis(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function atualizarRole(id, role) {
    const { error } = await supabase.from('perfis').update({ role }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { perfis, carregando, erro, atualizarRole, recarregar }
}
