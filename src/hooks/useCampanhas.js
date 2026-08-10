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

export const ETAPAS_FUNIL = [
  { etapa: 'topo', label: 'Topo (reconhecimento)', cor: 'var(--info)' },
  { etapa: 'mql', label: 'MQL', cor: 'var(--warning)' },
  { etapa: 'lead', label: 'Lead (conversão)', cor: 'var(--success)' },
]
const ETAPA_NAO_CLASSIFICADO = { etapa: 'nao_classificado', label: 'Não classificado', cor: 'var(--grafite-fade)' }

/** Agrupa campanhas já agregadas (agregarPorCampanha) pela etapa de funil cadastrada em metas_campanhas. */
export function agruparPorEtapaFunil(campanhas, classificacao) {
  const grupos = new Map(ETAPAS_FUNIL.map((e) => [e.etapa, { ...e, campanhas: [], investimento: 0, leads: 0 }]))
  grupos.set(ETAPA_NAO_CLASSIFICADO.etapa, { ...ETAPA_NAO_CLASSIFICADO, campanhas: [], investimento: 0, leads: 0 })

  for (const c of campanhas) {
    const etapa = classificacao.get(c.campanha) ?? 'nao_classificado'
    const grupo = grupos.get(etapa) ?? grupos.get('nao_classificado')
    grupo.campanhas.push(c)
    grupo.investimento += c.investimento
    grupo.leads += c.leads
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, campanhas: g.campanhas.sort((a, b) => b.investimento - a.investimento), cpl: g.leads > 0 ? g.investimento / g.leads : null }))
    .filter((g) => g.campanhas.length > 0)
}
