import { useEffect, useMemo, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'
import { nomeCorretorCrm } from '../lib/verComo'
import { useMeuCorretor } from './useMeuCorretor'

/**
 * Atendimentos do CRM. Para o corretor (ou a Gestão em "Ver como" um corretor)
 * ficam só os dele; a RLS já faz isso no banco para o corretor de verdade.
 */
export function useAtendimentos() {
  const { ehCorretor, corretor, carregando: carregandoCorretor } = useMeuCorretor()
  const [atendimentos, setAtendimentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    fetchTodasLinhas(() =>
      supabase
        .from('dashboard_atendimentos_crm')
        .select('id, codigo, corretor, data_de_entrada, data_fechamento, fase, funil, campanha, midia, situacao, finalidade')
        .order('data_de_entrada', { ascending: false })
    )
      .then((data) => {
        if (!ativo) return
        setAtendimentos(data)
      })
      .catch((error) => {
        if (!ativo) return
        setErro(error.message)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  const meus = useMemo(() => {
    if (!ehCorretor) return atendimentos
    if (!corretor) return []
    return atendimentos.filter((a) => nomeCorretorCrm(a.corretor).toLowerCase() === corretor.nome.toLowerCase())
  }, [atendimentos, ehCorretor, corretor])

  return { atendimentos: meus, carregando: carregando || carregandoCorretor, erro }
}
