import { useEffect, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'
import { isoLocal } from '../lib/paineis'
import { PROPOSTAS_ATIVAS } from '../lib/acessos'

const COLUNAS_BASE =
  'codigo, corretor, data_entrada, data_encerramento, finalidade, situacao, fase_ordem, canal, is_ruido, is_interno, is_negocio, is_ativo, is_descartado, dias_ate_ganho'

const COLUNAS_PROPOSTA = 'id, status, valor, valor_oferta, updated_at, link_expira_em, nome_cliente, imovel_titulo, codigo_imovel'

async function unica(consulta) {
  const { data, error } = await consulta
  if (error) throw error
  return data
}

/** Carrega um conjunto de consultas em paralelo; `carregar` devolve um objeto de promises. */
function useCarga(carregar) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    const promessas = carregar()
    const chaves = Object.keys(promessas)
    Promise.all(Object.values(promessas))
      .then((valores) => {
        if (ativo) setDados(Object.fromEntries(chaves.map((k, i) => [k, valores[i]])))
      })
      .catch((e) => {
        if (ativo) setErro(e.message)
      })
    return () => { ativo = false }
    // carregar é estável por página (definido fora do componente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { dados, carregando: !dados && !erro, erro }
}

function ultimaData(tabela, coluna) {
  return unica(supabase.from(tabela).select(coluna).order(coluna, { ascending: false }).limit(1)).then((d) => d?.[0]?.[coluna] ?? null)
}

function carregarOperacional() {
  const fimDeHoje = `${isoLocal()}T23:59:59`
  return {
    base: fetchTodasLinhas(() => supabase.from('vw_atendimentos_base').select(COLUNAS_BASE)),
    tempoResposta: fetchTodasLinhas(() =>
      supabase
        .from('vw_tempo_resposta')
        .select('codigo, corretor, data_entrada, tem_atividade, dias_ate_resposta_confiavel, periodo_confiavel')
        .eq('periodo_confiavel', true)
    ),
    aging: fetchTodasLinhas(() => supabase.from('vw_aging_ativos').select('codigo, corretor, finalidade, faixa_aging, dias_parado')),
    atividades: fetchTodasLinhas(() =>
      supabase.from('atividades').select('codigo, datahorainicio, nomeusuario').eq('realizada', false).lte('datahorainicio', fimDeHoje)
    ),
    propostas: fetchTodasLinhas(() => supabase.from('propostas_locacao').select(COLUNAS_PROPOSTA)),
    ultimaCrm: ultimaData('dashboard_atendimentos_crm', 'data_de_entrada'),
    ultimaMeta: ultimaData('dashboard_meta_ads', 'data'),
    ultimaGoogle: ultimaData('dashboard_google_ads', 'data'),
    ultimaAtividades: ultimaData('atividades', 'inserido_em'),
  }
}

function carregarGestao() {
  const op = carregarOperacional()
  return {
    base: op.base,
    tempoResposta: op.tempoResposta,
    aging: op.aging,
    atividades: op.atividades,
    propostas: op.propostas,
    meta: fetchTodasLinhas(() => supabase.from('dashboard_meta_ads').select('data, investimento, leads_conversoes')),
    google: fetchTodasLinhas(() => supabase.from('dashboard_google_ads').select('data, investimento, leads_conversoes')),
    ultimaCrm: op.ultimaCrm,
    ultimaMeta: op.ultimaMeta,
    ultimaGoogle: op.ultimaGoogle,
    ultimaAtividades: op.ultimaAtividades,
  }
}

const COLUNAS_ANUNCIO = 'data, campanha, investimento, alcance_impressoes, cliques, leads_conversoes'

function carregarPerformance() {
  return {
    meta: fetchTodasLinhas(() => supabase.from('dashboard_meta_ads').select(COLUNAS_ANUNCIO)),
    google: fetchTodasLinhas(() => supabase.from('dashboard_google_ads').select(COLUNAS_ANUNCIO)),
    metasCampanhas: fetchTodasLinhas(() =>
      supabase.from('metas_campanhas').select('campanha_nome, canal, etapa_funil, periodo_inicio, periodo_fim, meta_investimento, meta_leads, meta_cpl, ativo')
    ),
    // leads pagos da imobiliária inteira (o corretor também vê a Performance; sem código nem corretor)
    pagos: fetchTodasLinhas(() => supabase.rpc('performance_leads_pagos')),
    ultimaCrm: ultimaData('dashboard_atendimentos_crm', 'data_de_entrada'),
    ultimaMeta: ultimaData('dashboard_meta_ads', 'data'),
    ultimaGoogle: ultimaData('dashboard_google_ads', 'data'),
  }
}

function carregarComercial() {
  return {
    base: fetchTodasLinhas(() => supabase.from('vw_atendimentos_base').select(COLUNAS_BASE)),
    // filtro geral do Painel Comercial: só a equipe comercial ativa (PRD §5.8)
    colaboradores: fetchTodasLinhas(() => supabase.from('colaboradores_raw').select('nome_completo, email_oficial, equipe, ativo')),
    visitas: fetchTodasLinhas(() =>
      supabase.from('atividades').select('codigo, datahorainicio, realizada, codigoatendimento, resumoimovel').eq('nometipo', 'Visita')
    ),
    // sem o módulo de Propostas (produção, por enquanto) o "valor na mesa" não aparece
    propostasVenda: PROPOSTAS_ATIVAS ? fetchTodasLinhas(() => supabase.from('propostas_venda').select('id, status, valor_proposta, timestamp_criacao, criado_por')) : [],
    propostasLocacao: PROPOSTAS_ATIVAS ? fetchTodasLinhas(() => supabase.from('propostas_locacao').select('id, status, valor, valor_oferta, timestamp_criacao, criado_por')) : [],
    perfis: fetchTodasLinhas(() => supabase.from('perfis').select('id, email')),
    ultimaCrm: ultimaData('dashboard_atendimentos_crm', 'data_de_entrada'),
    ultimaAtividades: ultimaData('atividades', 'inserido_em'),
  }
}

/** Dados do Painel Comercial (PRD §5.8): os filtros rodam no navegador sobre a base inteira. */
export function usePainelComercial() {
  return useCarga(carregarComercial)
}

/** Dados do Painel de Performance (mídia + orçamento + leads pagos do CRM). */
export function usePainelPerformance() {
  return useCarga(carregarPerformance)
}

/** Tudo que o Painel da Gestão usa, numa carga só (os filtros rodam no navegador). */
export function usePainelGestao() {
  return useCarga(carregarGestao)
}
