import { useEffect, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'

// Hook generico: le qualquer view do Supabase.
// useView('vw_kpis_mensais') ou useView('vw_funil_acumulado', { finalidade: 'Venda' })
export function useView(nomeView, filtros = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const chaveFiltros = JSON.stringify(filtros)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError(null)

    fetchTodasLinhas(() => {
      let query = supabase.from(nomeView).select('*')
      for (const [coluna, valor] of Object.entries(filtros)) {
        if (valor !== undefined && valor !== null && valor !== '') {
          query = query.eq(coluna, valor)
        }
      }
      return query
    })
      .then((linhas) => {
        if (!ativo) return
        setData(linhas)
      })
      .catch((erroConsulta) => {
        if (!ativo) return
        setError(erroConsulta.message)
        setData([])
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => { ativo = false }
  }, [nomeView, chaveFiltros])

  return { data, loading, error }
}
