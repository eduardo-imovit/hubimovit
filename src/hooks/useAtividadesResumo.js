import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Atividades cruas do período + resumo agregado por atendimento (quantidade, primeiro e último contato). */
export function useAtividadesResumo() {
  const [atividades, setAtividades] = useState([])
  const [resumoPorAtendimento, setResumoPorAtendimento] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    supabase
      .from('atividades')
      .select('codigoatendimento, datahorainicio, nometipo, resumoimovel, realizada')
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) {
          setErro(error.message)
        } else {
          setAtividades(data ?? [])
          const mapa = {}
          for (const a of data ?? []) {
            if (a.codigoatendimento == null) continue
            const atual = mapa[a.codigoatendimento]
            if (!atual) {
              mapa[a.codigoatendimento] = { quantidade: 1, ultimoContato: a.datahorainicio, primeiroContato: a.datahorainicio }
            } else {
              atual.quantidade += 1
              if (a.datahorainicio > atual.ultimoContato) atual.ultimoContato = a.datahorainicio
              if (a.datahorainicio < atual.primeiroContato) atual.primeiroContato = a.datahorainicio
            }
          }
          setResumoPorAtendimento(mapa)
        }
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  return { atividades, resumoPorAtendimento, carregando, erro }
}
