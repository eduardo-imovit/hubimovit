import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useMetas() {
  const [metasCampanhas, setMetasCampanhas] = useState([])
  const [metasMensais, setMetasMensais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    Promise.all([
      supabase.from('metas_campanhas').select('*').eq('ativo', true),
      supabase.from('metas_mensais').select('*'),
    ]).then(([campanhasRes, mensaisRes]) => {
      if (!ativo) return
      if (campanhasRes.error) setErro(campanhasRes.error.message)
      else if (mensaisRes.error) setErro(mensaisRes.error.message)
      else {
        setMetasCampanhas(campanhasRes.data ?? [])
        setMetasMensais(mensaisRes.data ?? [])
      }
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  return { metasCampanhas, metasMensais, carregando, erro }
}

/**
 * Classificação de campanhas por etapa de funil (topo/mql/lead), cadastrada em metas_campanhas.
 * Busca todos os períodos (não só o ativo) porque a etapa é um atributo estável da campanha,
 * não algo que muda mês a mês — em caso de conflito entre períodos, vale o mais recente.
 */
export function useClassificacaoCampanhas() {
  const [classificacao, setClassificacao] = useState(new Map())
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    supabase
      .from('metas_campanhas')
      .select('campanha_nome, etapa_funil, periodo_fim')
      .then(({ data, error }) => {
        if (!ativo) return
        if (!error) {
          const maisRecentePorCampanha = new Map()
          for (const linha of data ?? []) {
            const atual = maisRecentePorCampanha.get(linha.campanha_nome)
            if (!atual || linha.periodo_fim > atual.periodo_fim) maisRecentePorCampanha.set(linha.campanha_nome, linha)
          }
          setClassificacao(new Map([...maisRecentePorCampanha].map(([nome, l]) => [nome, l.etapa_funil])))
        }
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  return { classificacao, carregando }
}
