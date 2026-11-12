import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Ordem de exibição dentro do dia: o banco devolve na ordem de inserção,
// e a escala de locação costuma ser cadastrada com a tarde antes da manhã.
const ORDEM_TURNO = { dia_inteiro: 0, manha: 1, tarde: 2 }
const porDataETurno = (a, b) =>
  a.data.localeCompare(b.data) || (ORDEM_TURNO[a.turno] ?? 9) - (ORDEM_TURNO[b.turno] ?? 9)

export function usePlantao(inicioISO, fimISO) {
  const [plantoes, setPlantoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('plantao')
      .select('*')
      .gte('data', inicioISO)
      .lte('data', fimISO)
      .order('data', { ascending: true })
    if (error) setErro(error.message)
    else setPlantoes((data ?? []).sort(porDataETurno))
    setCarregando(false)
  }, [inicioISO, fimISO])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarPlantao(plantao) {
    const { error } = await supabase.from('plantao').insert(plantao)
    if (error) throw error
    await recarregar()
  }

  async function atualizarStatus(id, status) {
    const { error } = await supabase.from('plantao').update({ status }).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  async function atualizarPlantao(id, plantao) {
    const { error } = await supabase.from('plantao').update(plantao).eq('id', id)
    if (error) throw error
    await recarregar()
  }

  return { plantoes, carregando, erro, recarregar, criarPlantao, atualizarStatus, atualizarPlantao }
}
