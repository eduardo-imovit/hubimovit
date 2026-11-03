import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Guia do Processo de Locação (RF33): papéis + etapas, com tempo real.
 * A permissão de verdade está no banco (Schema §2.20): o time lê;
 * só gestão/adm escrevem (`is_adm_ou_gestao()`). Casos ficam de fora na v1.
 */
export function useProcessoLocacao() {
  const [papeis, setPapeis] = useState([])
  const [etapas, setEtapas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    const [p, e] = await Promise.all([
      supabase.from('locacao_papeis').select('*').order('ordem'),
      supabase.from('locacao_etapas').select('*').order('ordem'),
    ])
    const falha = p.error || e.error
    if (falha) setErro(falha.message)
    else {
      setErro(null)
      setPapeis(p.data ?? [])
      setEtapas(e.data ?? [])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    recarregar()

    // Tempo real: qualquer mudança (Hub ou página da Direção) relê as duas tabelas.
    // Nome único por montagem, para o StrictMode (monta 2x em dev) não reaproveitar um canal fechado.
    const canal = supabase
      .channel(`processo-locacao-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locacao_papeis' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locacao_etapas' }, recarregar)
      .subscribe()

    // Ao sair da página, fecha o canal (senão ele continua aberto em segundo plano).
    return () => {
      supabase.removeChannel(canal)
    }
  }, [recarregar])

  // ---------- escrita (só gestão/adm: o banco recusa os outros, ver Schema §2.20) ----------
  // Cada função lança o erro para a tela mostrar; depois relê (o realtime também avisaria).
  // Atenção: quando a RLS barra um UPDATE/DELETE, o banco NÃO dá erro, só afeta 0 linhas.
  // Por isso pedimos as linhas de volta (.select('id')) e conferimos que veio alguma.
  async function executar(consulta) {
    const { data, error } = await consulta.select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Nada foi alterado: você não tem permissão ou o item foi excluído por outra pessoa.')
    await recarregar()
  }

  const agora = () => new Date().toISOString()

  /** Cria (id = null) ou atualiza uma etapa. */
  const salvarEtapa = (id, campos) => executar(
    id
      ? supabase.from('locacao_etapas').update({ ...campos, atualizado_em: agora() }).eq('id', id)
      : supabase.from('locacao_etapas').insert(campos),
  )

  const excluirEtapa = (id) => executar(supabase.from('locacao_etapas').delete().eq('id', id))

  /** Aplica a troca de ordem calculada por trocaDeOrdem() (duas atualizações). */
  async function moverEtapa(trocas) {
    try {
      for (const t of trocas) {
        const { data, error } = await supabase.from('locacao_etapas').update(t.patch).eq('id', t.id).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Nada foi alterado: você não tem permissão ou a etapa foi excluída.')
      }
    } finally {
      await recarregar() // mesmo se a 2ª falhar, a tela mostra o estado real do banco
    }
  }

  /** Quantos casos em andamento estão nesta etapa (aviso antes de excluir). */
  async function casosNaEtapa(id) {
    const { count, error } = await supabase
      .from('locacao_casos').select('id', { count: 'exact', head: true })
      .eq('etapa_id', id).eq('status', 'andamento')
    return error ? 0 : count ?? 0
  }

  const salvarPapel = (id, campos) => executar(
    id
      ? supabase.from('locacao_papeis').update({ ...campos, atualizado_em: agora() }).eq('id', id)
      : supabase.from('locacao_papeis').insert(campos),
  )

  const excluirPapel = (id) => executar(supabase.from('locacao_papeis').delete().eq('id', id))

  return {
    papeis, etapas, carregando, erro, recarregar,
    salvarEtapa, excluirEtapa, moverEtapa, casosNaEtapa, salvarPapel, excluirPapel,
  }
}
