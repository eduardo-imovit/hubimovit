import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'

/**
 * Perfil (nível de acesso) do usuário logado, lido de public.perfis.
 *
 * `carregando` é derivado (não estado de efeito): fica true enquanto há sessão mas
 * o perfil ainda não foi buscado PARA essa sessão. Isso fecha a janela em que o
 * ProtectedRoute via `perfil: null` logo após a sessão chegar e redirecionava admin.
 */
export function usePerfil() {
  const { session } = useSession()
  const [resultado, setResultado] = useState({ perfil: null, paraUsuario: null })

  useEffect(() => {
    if (!session) {
      setResultado({ perfil: null, paraUsuario: null })
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
        setResultado({ perfil: error ? null : data, paraUsuario: session.user.id })
      })
    return () => { ativo = false }
  }, [session])

  const carregando = !!session && resultado.paraUsuario !== session.user.id

  return { perfil: resultado.perfil, carregando }
}
