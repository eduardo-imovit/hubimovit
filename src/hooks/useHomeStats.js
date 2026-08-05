import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { hojeISO, inicioDaSemanaISO } from '../lib/dateUtils'

export function useHomeStats() {
  const [stats, setStats] = useState({ atendimentosHoje: null, leadsSemana: null, negociosMes: null })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    const hoje = hojeISO()
    const inicioSemana = inicioDaSemanaISO()
    const inicioMes = `${hoje.slice(0, 7)}-01`

    Promise.all([
      supabase
        .from('dashboard_atendimentos_crm')
        .select('codigo', { count: 'exact', head: true })
        .gte('data_de_entrada', `${hoje}T00:00:00`)
        .lte('data_de_entrada', `${hoje}T23:59:59`),
      supabase
        .from('dashboard_atendimentos_crm')
        .select('codigo', { count: 'exact', head: true })
        .gte('data_de_entrada', `${inicioSemana}T00:00:00`),
      supabase
        .from('dashboard_atendimentos_crm')
        .select('codigo', { count: 'exact', head: true })
        .eq('situacao', 'Negócio realizado')
        .gte('data_fechamento', `${inicioMes}T00:00:00`),
    ]).then(([atendimentosHoje, leadsSemana, negociosMes]) => {
      if (!ativo) return
      setStats({
        atendimentosHoje: atendimentosHoje.count ?? 0,
        leadsSemana: leadsSemana.count ?? 0,
        negociosMes: negociosMes.count ?? 0,
      })
      setCarregando(false)
    })

    return () => { ativo = false }
  }, [])

  return { stats, carregando }
}
