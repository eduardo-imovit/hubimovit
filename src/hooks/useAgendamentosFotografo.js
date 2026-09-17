import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Blocos semanais fixos da agenda do fotógrafo (ex.: corretor X, toda terça, 12:00–14:00). */
export function useAgendamentosFotografo() {
  const [blocos, setBlocos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('agendamentos_fotografo')
      .select('*')
      .eq('ativo', true)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })
    if (error) setErro(error.message)
    else setBlocos(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarBloco(bloco) {
    const { error } = await supabase.from('agendamentos_fotografo').insert(bloco)
    if (error) throw error
    await recarregar()
  }

  async function removerBloco(id) {
    const { error } = await supabase.from('agendamentos_fotografo').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { blocos, carregando, erro, criarBloco, removerBloco }
}
