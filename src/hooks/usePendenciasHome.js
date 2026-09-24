import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isoLocal, limitesMes, nomeMes, somarDias } from '../lib/paineis'

// Status em que a proposta já saiu da esteira.
const ENCERRADAS = ['sincronizada', 'concluida', 'rejeitada', 'descartada', 'expirada']

async function dados(consulta) {
  const { data, error } = await consulta
  if (error) throw error
  return data ?? []
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

/** Pendências da Gestão: pedidos de nível, CRM parado e leads sem contato (via kpis_tv). */
async function pendenciasGestao(hoje) {
  const out = []
  const [pedidos, kpis] = await Promise.all([
    dados(supabase.from('solicitacoes_acesso').select('id').eq('status', 'pendente')),
    supabase.rpc('kpis_tv').then(({ data }) => data),
  ])
  if (pedidos.length) out.push({ tom: 'atencao', n: pedidos.length, texto: plural(pedidos.length, 'pedido de nível aguardando você', 'pedidos de nível aguardando você'), to: '/configuracoes?aba=usuarios', acao: 'Decidir' })
  if (kpis?.crm_atualizado_ate) {
    const [a, m, d] = kpis.crm_atualizado_ate.split('-').map(Number)
    const dias = Math.round((new Date(`${hoje}T12:00:00`) - new Date(a, m - 1, d, 12)) / 86400000)
    if (dias > 1) out.push({ tom: 'ruim', n: dias, texto: `O CRM está sem leads novos há ${dias} dias: os números podem estar incompletos`, to: '/dashboard/gestao', acao: 'Ver' })
  }
  const semContato = kpis?.operacao?.sem_contato
  if (semContato) out.push({ tom: 'atencao', n: semContato, texto: plural(semContato, 'lead ativo sem nenhum contato', 'leads ativos sem nenhum contato'), to: '/dashboard/gestao', acao: 'Ver quem' })
  return out
}

/** Pendências do Admin: documentos esperando decisão e propostas esperando aprovação interna. */
async function pendenciasAdm() {
  const propostas = await dados(supabase.from('propostas_locacao').select('id, status'))
  const abertas = propostas.filter((p) => !ENCERRADAS.includes(p.status))
  const out = []
  if (abertas.length) {
    const docs = await dados(supabase.from('documentos_enviados').select('id, proposta_id').eq('status', 'enviado').in('proposta_id', abertas.map((p) => p.id)))
    if (docs.length) out.push({ tom: 'atencao', n: docs.length, texto: plural(docs.length, 'documento esperando sua decisão', 'documentos esperando sua decisão'), to: '/admin/esteiras', acao: 'Revisar' })
  }
  const aprovacao = abertas.filter((p) => p.status === 'aguardando_aprovacao_interna').length
  if (aprovacao) out.push({ tom: 'atencao', n: aprovacao, texto: plural(aprovacao, 'proposta aguardando aprovação interna', 'propostas aguardando aprovação interna'), to: '/admin/propostas', acao: 'Aprovar' })
  return out
}

/** Pendências do Corretor: as propostas dele (a RLS já filtra) e os leads dele sem contato. */
async function pendenciasCorretor(email, hoje) {
  const out = []
  const propostas = await dados(supabase.from('propostas_locacao').select('id, status, link_expira_em, updated_at'))
  const abertas = propostas.filter((p) => !ENCERRADAS.includes(p.status))
  const vencendo = abertas.filter((p) => p.link_expira_em && p.link_expira_em.slice(0, 10) <= somarDias(hoje, 3)).length
  if (vencendo) out.push({ tom: 'ruim', n: vencendo, texto: plural(vencendo, 'proposta com link vencendo em até 3 dias', 'propostas com link vencendo em até 3 dias'), to: '/admin/esteiras', acao: 'Ver' })
  const paradas = abertas.filter((p) => p.updated_at && p.updated_at.slice(0, 10) < somarDias(hoje, -7)).length
  if (paradas) out.push({ tom: 'atencao', n: paradas, texto: plural(paradas, 'proposta sua parada há mais de 7 dias', 'propostas suas paradas há mais de 7 dias'), to: '/admin/esteiras', acao: 'Ver' })

  // login ↔ corretor do CRM pelo e-mail oficial
  const [colab] = await dados(supabase.from('colaboradores_raw').select('nome_completo').ilike('email_oficial', email).limit(1))
  if (colab?.nome_completo) {
    const [ativos, semAtividade] = await Promise.all([
      dados(supabase.from('vw_atendimentos_base').select('codigo').eq('corretor', colab.nome_completo).eq('is_ativo', true)),
      dados(supabase.from('vw_tempo_resposta').select('codigo').eq('corretor', colab.nome_completo).eq('periodo_confiavel', true).eq('tem_atividade', false)),
    ])
    const codigos = new Set(ativos.map((a) => a.codigo))
    const semContato = semAtividade.filter((t) => codigos.has(t.codigo)).length
    if (semContato) out.push({ tom: 'atencao', n: semContato, texto: plural(semContato, 'lead seu sem nenhum contato registrado', 'leads seus sem nenhum contato registrado'), to: '/kanban', acao: 'Ver' })
  }
  return out
}

/** Pendências do Marketing: orçamento do mês e dias sem plantão na próxima semana. */
async function pendenciasMarketing(hoje) {
  const out = []
  const mes = hoje.slice(0, 7)
  const [orcamentos, plantoes] = await Promise.all([
    dados(supabase.from('metas_campanhas').select('id').gte('periodo_inicio', limitesMes(mes).inicio).lte('periodo_inicio', limitesMes(mes).fim)),
    dados(supabase.from('plantao').select('data').gte('data', hoje).lte('data', somarDias(hoje, 6)).neq('status', 'cancelado')),
  ])
  if (!orcamentos.length) out.push({ tom: 'atencao', n: null, texto: `O orçamento de mídia de ${nomeMes(mes).split(' ')[0]} não está cadastrado`, to: '/dashboard/performance', acao: 'Ver' })
  const comPlantao = new Set(plantoes.map((p) => p.data))
  const semPlantao = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i)).filter((d) => !comPlantao.has(d)).length
  if (semPlantao) out.push({ tom: 'atencao', n: semPlantao, texto: plural(semPlantao, 'dia sem plantão nos próximos 7 dias', 'dias sem plantão nos próximos 7 dias'), to: '/configuracoes?aba=plantao', acao: 'Importar escala' })
  return out
}

/** Sem nível: pedir acesso (se ainda não pediu). */
async function pendenciasSemNivel(perfilId) {
  const pedidos = await dados(supabase.from('solicitacoes_acesso').select('id').eq('perfil_id', perfilId).eq('status', 'pendente'))
  if (pedidos.length) return [{ tom: 'neutro', n: null, texto: 'Seu pedido de acesso está com a Gestão', to: '/perfil', acao: 'Ver' }]
  return [{ tom: 'atencao', n: null, texto: 'Você ainda não tem um nível de acesso: peça o seu', to: '/perfil', acao: 'Pedir' }]
}

/**
 * Pendências da Home para o nível `papel` (docs/01-prd.md §5.4). Cada item:
 * { tom, n, texto, to, acao }. Falhas de uma consulta não derrubam a Home:
 * o bloco só mostra o que conseguiu carregar.
 */
export function usePendenciasHome(papel, perfil) {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!papel || !perfil) return
    let ativo = true
    const hoje = isoLocal()
    const carregar = {
      gestao: () => pendenciasGestao(hoje),
      adm: () => pendenciasAdm(),
      corretor: () => pendenciasCorretor(perfil.email, hoje),
      marketing: () => pendenciasMarketing(hoje),
      user: () => pendenciasSemNivel(perfil.id),
    }[papel]
    setItens(null)
    setErro(null)
    ;(carregar ? carregar() : Promise.resolve([]))
      .then((r) => ativo && setItens(r))
      .catch((e) => {
        if (!ativo) return
        setErro(e.message)
        setItens([])
      })
    return () => { ativo = false }
  }, [papel, perfil])

  return { itens, erro }
}
