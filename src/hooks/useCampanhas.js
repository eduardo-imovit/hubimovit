import { useEffect, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'

export function useCampanhas() {
  const [meta, setMeta] = useState([])
  const [google, setGoogle] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    Promise.all([
      fetchTodasLinhas(() =>
        supabase.from('dashboard_meta_ads').select('data, campanha, anuncio, investimento, alcance_impressoes, cliques, leads_conversoes')
      ),
      fetchTodasLinhas(() =>
        supabase.from('dashboard_google_ads').select('data, campanha, investimento, alcance_impressoes, cliques, leads_conversoes')
      ),
    ])
      .then(([metaData, googleData]) => {
        if (!ativo) return
        setMeta(metaData)
        setGoogle(googleData)
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

  return { meta, google, carregando, erro }
}

export function agregarPorCampanha(linhas) {
  const mapa = new Map()
  for (const l of linhas) {
    const chave = l.campanha ?? 'Sem campanha'
    const atual = mapa.get(chave) ?? { campanha: chave, investimento: 0, cliques: 0, impressoes: 0, leads: 0 }
    atual.investimento += l.investimento ?? 0
    atual.cliques += l.cliques ?? 0
    atual.impressoes += l.alcance_impressoes ?? 0
    atual.leads += l.leads_conversoes ?? 0
    mapa.set(chave, atual)
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, cpl: c.leads > 0 ? c.investimento / c.leads : null }))
    .sort((a, b) => b.investimento - a.investimento)
}
