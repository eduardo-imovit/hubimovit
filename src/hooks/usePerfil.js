import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'
import { EVENTO_VER_COMO, lerVerComo } from '../lib/verComo'

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

  const [verComo, setVerComo] = useState(lerVerComo)

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1)
    const trocarPrevia = () => setVerComo(lerVerComo())
    window.addEventListener(EVENTO_PERFIL_ATUALIZADO, atualizar)
    window.addEventListener(EVENTO_VER_COMO, trocarPrevia)
    return () => {
      window.removeEventListener(EVENTO_PERFIL_ATUALIZADO, atualizar)
      window.removeEventListener(EVENTO_VER_COMO, trocarPrevia)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setResultado({ perfil: null, paraUsuario: null })
      return
    }
    let ativo = true
    supabase
      .from('perfis')
      .select('id, email, role, nome, telefone, cargo, foto_url, suspenso_em')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return
        setResultado({ perfil: error ? null : data, paraUsuario: session.user.id })
      })
    return () => { ativo = false }
  }, [session, versao])

  const carregando = !!session && resultado.paraUsuario !== session.user.id

  // Prévia "Ver como" só vale para a Gestão; o perfil real fica em `papelReal`.
  const real = resultado.perfil
  const perfil = useMemo(
    () => (real?.role === 'gestao' && verComo
      ? { ...real, role: verComo.role, email: verComo.email ?? real.email, nome: verComo.nome ?? real.nome, previa: verComo, papelReal: real.role }
      : real),
    [real, verComo]
  )

  return { perfil, carregando }
}
