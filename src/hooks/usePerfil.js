import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'

// A página de Perfil dispara este evento ao salvar, pra navbar e demais
// telas que usam o hook buscarem o perfil de novo.
const EVENTO_PERFIL_ATUALIZADO = 'hub:perfil-atualizado'

export function avisarPerfilAtualizado() {
  window.dispatchEvent(new Event(EVENTO_PERFIL_ATUALIZADO))
}

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
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1)
    window.addEventListener(EVENTO_PERFIL_ATUALIZADO, atualizar)
    return () => window.removeEventListener(EVENTO_PERFIL_ATUALIZADO, atualizar)
  }, [])

  useEffect(() => {
    if (!session) {
      setResultado({ perfil: null, paraUsuario: null })
      return
    }
    let ativo = true
    supabase
      .from('perfis')
      .select('id, email, role, nome, telefone, cargo, foto_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return
        setResultado({ perfil: error ? null : data, paraUsuario: session.user.id })
      })
    return () => { ativo = false }
  }, [session, versao])

  const carregando = !!session && resultado.paraUsuario !== session.user.id

  return { perfil: resultado.perfil, carregando }
}
