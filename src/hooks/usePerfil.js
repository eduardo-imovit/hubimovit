import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'

/** Perfil (nível de acesso) do usuário logado, lido de public.perfis. */
export function usePerfil() {
  const { session } = useSession()
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!session) {
      setPerfil(null)
      setCarregando(false)
      return
    }
    let ativo = true
    supabase
      .from('perfis')
      .select('id, email, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return
        if (!error) setPerfil(data)
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [session])

  return { perfil, carregando }
}
