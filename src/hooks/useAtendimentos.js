import { useEffect, useMemo, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'
import { nomeCorretorCrm } from '../lib/verComo'
import { useMeuCorretor } from './useMeuCorretor'

// Agendamento (fase 8 do Imoview) conta como "Lead qualificado" (fase 7) no Hub — decisão de 28/10.
const FASE_AGENDAMENTO = 8
const FASE_LEAD_QUALIFICADO = 7

/**
 * Traduz uma linha da vw_atendimentos_base para os nomes que o Kanban e
 * Dados de Atendimento já usam (os da antiga dashboard_atendimentos_crm).
 * Assim as telas não mudam: só a fonte muda.
 */
function paraFormatoDasTelas(v) {
  return {
    id: v.codigo, // chave única na tela: lead só da jornada não tem id da tabela antiga
    codigo: v.codigo,
    corretor: v.corretor,
    data_de_entrada: v.data_entrada,
    // data de encerramento da view: negócio pela data do CRM e descarte pela interação de descarte
    data_fechamento: v.data_encerramento,
    fase: v.fase === FASE_AGENDAMENTO ? FASE_LEAD_QUALIFICADO : v.fase,
    fase_crm: v.fase,
    funil: v.funil,
    campanha: v.campanha,
    midia: v.midia_raw,
    situacao: v.situacao,
    finalidade: v.finalidade,
  }
}

/**
 * Atendimentos do CRM, pela mesma fonte dos painéis (vw_atendimentos_base, cuja
 * fase vem da jornada). Antes (até 28/10) liam a dashboard_atendimentos_crm direto,
 * e o Kanban divergia dos painéis (achado A1 do docs/07-mapa-de-dados.md).
 * Para o corretor (ou a Gestão em "Ver como" um corretor) ficam só os dele;
 * a RLS já faz isso no banco para o corretor de verdade.
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
        .from('vw_atendimentos_base')
        .select('id, codigo, corretor, data_entrada, data_encerramento, fase, funil, campanha, midia_raw, situacao, finalidade')
        // mesma regra dos painéis (filtrarBase): sem ruído (mídia não informada/teste) e sem captação interna
        // — decisão do Eduardo em 29/10, para o Kanban e os painéis darem o mesmo número
        // "is not true" mantém os nulos (mídia vazia), como o !a.is_ruido dos painéis
        .not('is_ruido', 'is', true)
        .not('is_interno', 'is', true)
        .order('data_entrada', { ascending: false })
        // desempate: a busca vem em páginas de 1.000; sem ordem única, uma linha pode repetir ou sumir entre páginas
        .order('codigo', { ascending: false })
    )
      .then((data) => {
        if (!ativo) return
        setAtendimentos(data.map(paraFormatoDasTelas))
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
