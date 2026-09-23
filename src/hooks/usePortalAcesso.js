import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSession } from './useSession'

// Enquanto o portal está aberto, confere de tempos em tempos se a equipe
// avançou a proposta -- sem isso, o locatário só via a etapa nova pelo e-mail.
const INTERVALO_ATUALIZACAO_MS = 20000

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

  // `silencioso`: atualização em segundo plano, sem trocar a tela por "Carregando…".
  const recarregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!session) {
      setPropostas([])
      setCarregando(false)
      return
    }
    if (!silencioso) setCarregando(true)
    const email = session.user.email.toLowerCase()
    const { data, error } = await supabase
      .from('propostas_locacao')
      .select('*')
      .or(`email.eq.${email},proprietario_email.eq.${email}`)
      .order('timestamp_criacao', { ascending: false })
    if (error) {
      // Falha numa atualização em segundo plano não derruba a tela que já está aberta.
      if (!silencioso) setErro(error.message)
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

  useEffect(() => {
    if (!session) return
    const atualizar = () => {
      if (document.visibilityState === 'visible') recarregar({ silencioso: true })
    }
    const intervalo = setInterval(atualizar, INTERVALO_ATUALIZACAO_MS)
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('focus', atualizar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('focus', atualizar)
    }
  }, [session, recarregar])

  return { session, carregandoSessao, propostas, carregando, erro, recarregar }
}
