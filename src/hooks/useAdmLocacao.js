import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTodasLinhas, supabase } from '../lib/supabaseClient'

const COLUNAS_CONTRATO =
  'codigo, codigo_imovel, imovel_resumo, imovel_tipo, destinacao, bairro, locatario_nome, situacao, status, valor_aluguel, ' +
  'taxa_adm, taxa_adm_tipo, garantia, indice_reajuste, data_inicio, data_fim, data_proximo_reajuste, data_aviso_desocupacao, ' +
  'data_previsao_rescisao, data_rescisao, motivo_rescisao, seguro_incendio_fim, garantia_fim, receita_adm, dias_para_fim, ' +
  'prazo_indeterminado, com_aviso, reajuste_atrasado, meses_de_contrato, seguro_incendio_situacao, garantia_situacao, ' +
  'cobranca_vencida_valor, cobranca_vencida_desde, sem_baixa_valor, sem_baixa_n, grupo_cobranca'

const COLUNAS_COBRANCA = 'codigo, codigo_contrato, data_vencimento, saldo, pagamento_informado, data_pagamento_informada, dias_atraso, faixa, grupo_cobranca'

async function unica(consulta) {
  const { data, error } = await consulta
  if (error) throw error
  return data
}

async function carregar() {
  const [contratos, cobrancas, mensal, recebimentos, proprietarios, fotos] = await Promise.all([
    fetchTodasLinhas(() => supabase.from('vw_carteira_locacao').select(COLUNAS_CONTRATO).order('codigo')),
    fetchTodasLinhas(() => supabase.from('vw_cobrancas_locacao').select(COLUNAS_COBRANCA).order('codigo')),
    fetchTodasLinhas(() => supabase.from('vw_carteira_locacao_mensal').select('mes, entradas, saidas, ativos_fim_mes, aluguel_novos').order('mes')),
    unica(supabase.from('vw_recebimentos_locacao_mensal').select('*').order('mes')),
    fetchTodasLinhas(() => supabase.from('vw_proprietarios_locacao').select('*').order('codigo_proprietario')),
    unica(supabase.from('contratos_locacao_fotos').select('*').order('data', { ascending: false }).limit(400)),
  ])
  return { contratos, cobrancas, mensal, recebimentos, proprietarios, fotos }
}

/**
 * Dados do painel Adm locação (PRD §5.13). Ao abrir, pede à função
 * carteira-locacao para ler o Imoview se a última leitura tem mais de 12 h
 * (a função decide); `atualizar()` força a leitura.
 */
export function useAdmLocacao() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [erroSincronia, setErroSincronia] = useState(null)
  const ativo = useRef(true)

  const recarregar = useCallback(async () => {
    try {
      const d = await carregar()
      if (ativo.current) setDados(d)
    } catch (e) {
      if (ativo.current) setErro(e.message)
    }
  }, [])

  const sincronizar = useCallback(
    async (forcar) => {
      setSincronizando(true)
      setErroSincronia(null)
      try {
        const { data, error } = await supabase.functions.invoke('carteira-locacao', { body: { forcar } })
        if (error) {
          let msg = error.message
          try {
            msg = (await error.context?.json())?.erro ?? msg
          } catch {
            // resposta sem corpo JSON: fica a mensagem genérica
          }
          throw new Error(msg)
        }
        if (data?.atualizado) await recarregar()
      } catch (e) {
        if (ativo.current) setErroSincronia(e.message)
      } finally {
        if (ativo.current) setSincronizando(false)
      }
    },
    [recarregar]
  )

  useEffect(() => {
    ativo.current = true
    recarregar().then(() => sincronizar(false))
    return () => {
      ativo.current = false
    }
  }, [recarregar, sincronizar])

  return { dados, carregando: !dados && !erro, erro, sincronizando, erroSincronia, atualizar: () => sincronizar(true) }
}
