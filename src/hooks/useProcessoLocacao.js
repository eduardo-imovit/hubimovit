import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Guia do Processo de Locação (RF33): papéis + etapas, com tempo real.
 * A permissão de verdade está no banco (Schema §2.20): o time lê;
 * só gestão/adm escrevem (`is_adm_ou_gestao()`). Casos ficam de fora na v1.
 */
export function useProcessoLocacao() {
  const [papeis, setPapeis] = useState([])
  const [etapas, setEtapas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    const [p, e] = await Promise.all([
      supabase.from('locacao_papeis').select('*').order('ordem'),
      supabase.from('locacao_etapas').select('*').order('ordem'),
    ])
    const falha = p.error || e.error
    if (falha) setErro(falha.message)
    else {
      setErro(null)
      setPapeis(p.data ?? [])
      setEtapas(e.data ?? [])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()

    // Tempo real: qualquer mudança (Hub ou página da Direção) relê as duas tabelas.
    // Nome único por montagem, para o StrictMode (monta 2x em dev) não reaproveitar um canal fechado.
    const canal = supabase
      .channel(`processo-locacao-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locacao_papeis' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locacao_etapas' }, recarregar)
      .subscribe()

    // Ao sair da página, fecha o canal (senão ele continua aberto em segundo plano).
    return () => {
      supabase.removeChannel(canal)
    }
  }, [recarregar])

  return { papeis, etapas, carregando, erro, recarregar }
}
