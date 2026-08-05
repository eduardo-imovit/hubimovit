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
