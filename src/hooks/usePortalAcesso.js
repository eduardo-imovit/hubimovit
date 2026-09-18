import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'

/**
 * Propostas de locação onde o usuário logado é locatário (email) ou
 * proprietário (proprietario_email) -- é o portal do cliente, não o Hub
 * interno, então não olha pra tabela `perfis` em nenhum momento aqui.
 */
export function usePortalAcesso() {
  const { session, carregando: carregandoSessao } = useSession()
  const [propostas, setPropostas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    if (!session) {
      setPropostas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    const email = session.user.email.toLowerCase()
    const { data, error } = await supabase
      .from('propostas_locacao')
      .select('*')
      .or(`email.eq.${email},proprietario_email.eq.${email}`)
      .order('timestamp_criacao', { ascending: false })
    if (error) {
      setErro(error.message)
    } else {
      setErro(null)
      setPropostas(
        (data ?? []).map((p) => ({
          ...p,
          meuPapel: p.email?.toLowerCase() === email ? 'locatario' : 'proprietario',
        }))
      )
    }
    setCarregando(false)
  }, [session])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { session, carregandoSessao, propostas, carregando, erro, recarregar }
}
