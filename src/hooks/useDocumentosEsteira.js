import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Checklist de documentos obrigatórios de uma proposta (por tipo_pessoa/tem_conjuge) + o que já foi enviado. */
export function useDocumentosEsteira(proposta) {
  const [tipos, setTipos] = useState([])
  const [enviados, setEnviados] = useState([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    if (!proposta?.id) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    const [{ data: tiposData }, { data: enviadosData }] = await Promise.all([
      supabase.from('documentos_tipos_obrigatorios').select('*').order('codigo'),
      supabase.from('documentos_enviados').select('*').eq('proposta_id', proposta.id),
    ])
    setTipos(tiposData ?? [])
    setEnviados(enviadosData ?? [])
    setCarregando(false)
  }, [proposta?.id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const checklist = tipos
    .filter(
      (t) =>
        (t.tipo_pessoa === proposta?.tipo_pessoa || t.tipo_pessoa === 'Ambos') &&
        (!t.exige_conjuge || proposta?.tem_conjuge)
    )
    .map((tipo) => ({ ...tipo, envio: enviados.find((e) => e.documento_codigo === tipo.codigo) ?? null }))

  return { checklist, carregando, recarregar }
}
