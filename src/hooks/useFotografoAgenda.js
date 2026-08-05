import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const STATUS_OCUPADO = ['solicitado', 'aprovado', 'fila', 'realizado']

export function useFotografoAgenda(inicioISO, fimISO) {
  const [ocupacoes, setOcupacoes] = useState([])
  const [bloqueios, setBloqueios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    const [ocupacoesRes, bloqueiosRes] = await Promise.all([
      supabase
        .from('agendamentos_fotografo')
        .select('*')
        .in('status', STATUS_OCUPADO)
        .gte('data_hora_inicio', `${inicioISO}T00:00:00`)
        .lte('data_hora_inicio', `${fimISO}T23:59:59`),
      supabase
        .from('fotografo_bloqueios')
        .select('*')
        .gte('data_hora_inicio', `${inicioISO}T00:00:00`)
        .lte('data_hora_inicio', `${fimISO}T23:59:59`),
    ])
    if (ocupacoesRes.error) setErro(ocupacoesRes.error.message)
    else if (bloqueiosRes.error) setErro(bloqueiosRes.error.message)
    else {
      setOcupacoes(ocupacoesRes.data ?? [])
      setBloqueios(bloqueiosRes.data ?? [])
    }
    setCarregando(false)
  }, [inicioISO, fimISO])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function criarAgendamento(dados) {
    const { error } = await supabase.from('agendamentos_fotografo').insert({ ...dados, status: 'aprovado' })
    if (error) throw error
    await recarregar()
  }

  async function criarBloqueio(dados) {
    const { error } = await supabase.from('fotografo_bloqueios').insert(dados)
    if (error) throw error
    await recarregar()
  }

  return { ocupacoes, bloqueios, carregando, erro, criarAgendamento, criarBloqueio }
}
