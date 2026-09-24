-- =============================================================================
-- KPIs da TV alinhados com os painéis da Gestão e de Performance (24/09).
--
-- Problemas da versão de 23/09 (vinham de vw_kpis_mensais):
--   * "taxa de conversão" = negócios ÷ leads do mês: leads recentes ainda não
--     tiveram tempo de fechar;
--   * "negócios" contava pelo mês de ENTRADA do lead, não pelo de fechamento;
--   * "ciclo" só com leads do mês (amostra imatura);
--   * "leads parados 30+ dias" contava dias desde a entrada, não sem movimento.
--
-- Esta versão ACRESCENTA campos (merge nos objetos comercial/operacao) e mantém
-- os antigos, para a TV em produção não quebrar antes do push do frontend.
-- Definições iguais às de src/lib/painelGestao.js (PRD §5.0):
--   * leads válidos = sem ruído e sem captação interna;
--   * ritmo = leads dos últimos 30 dias ÷ 30; projeção = realizado + dias
--     restantes × ritmo;
--   * negócios pela data de encerramento;
--   * conversão da safra madura: leads de 60 a 242 dias atrás × semestre
--     anterior (243 a 425), nunca antes de 01/10/2025 (início dos negócios no CRM);
--   * ciclo = mediana de dias até o ganho, negócios dos últimos 12 meses.
-- =============================================================================

create or replace function kpis_tv() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', v_hoje)::date;
  v_mes_anterior date := (date_trunc('month', v_hoje) - interval '1 month')::date;
  v_fim_mes date := (date_trunc('month', v_hoje) + interval '1 month - 1 day')::date;
  v_piso date := date '2025-10-01';
  v_atual vw_kpis_mensais;
  v_anterior vw_kpis_mensais;
  v_meta_leads integer;
  v_leads_mes integer;
  v_leads_30d integer;
  v_media_3m numeric;
  v_neg_mes integer;
  v_neg_media_3m numeric;
  v_safra_leads integer;
  v_safra_neg integer;
  v_ant_leads integer;
  v_ant_neg integer;
  v_ciclo numeric;
begin
  if coalesce(papel_atual() in ('gestao', 'adm', 'marketing', 'tvaccess'), false) is not true then
    raise exception 'Sem acesso aos KPIs da TV';
  end if;

  select * into v_atual from vw_kpis_mensais where mes_entrada = v_mes;
  select * into v_anterior from vw_kpis_mensais where mes_entrada = v_mes_anterior;

  select max(leads_meta) into v_meta_leads
    from metas_mensais
   where ano_mes = v_mes and canal ilike 'Geral%' and coalesce(segmento, 'Todos') = 'Todos';

  -- leads válidos
  select count(*) filter (where data_entrada between v_mes and v_hoje),
         count(*) filter (where data_entrada > v_hoje - 30 and data_entrada <= v_hoje),
         count(*) filter (where data_entrada >= (v_mes - interval '3 months')::date and data_entrada < v_mes) / 3.0,
         count(*) filter (where is_negocio and data_encerramento between v_mes and v_hoje),
         count(*) filter (where is_negocio and data_encerramento >= (v_mes - interval '3 months')::date and data_encerramento < v_mes) / 3.0,
         count(*) filter (where data_entrada between greatest(v_hoje - 242, v_piso) and v_hoje - 60),
         count(*) filter (where data_entrada between greatest(v_hoje - 242, v_piso) and v_hoje - 60 and (fase_ordem >= 7 or is_negocio)),
         count(*) filter (where data_entrada between greatest(v_hoje - 425, v_piso) and v_hoje - 243),
         count(*) filter (where data_entrada between greatest(v_hoje - 425, v_piso) and v_hoje - 243 and (fase_ordem >= 7 or is_negocio)),
         percentile_cont(0.5) within group (order by dias_ate_ganho)
           filter (where is_negocio and data_encerramento >= v_hoje - 365 and dias_ate_ganho >= 0)
    into v_leads_mes, v_leads_30d, v_media_3m, v_neg_mes, v_neg_media_3m,
         v_safra_leads, v_safra_neg, v_ant_leads, v_ant_neg, v_ciclo
    from vw_atendimentos_base
   where not is_ruido and not is_interno;

  return jsonb_build_object(
    'mes_referencia', v_mes,
    'atualizado_em', now(),
    'crm_atualizado_ate', (select max(data_de_entrada)::date from dashboard_atendimentos_crm),
    'comercial', jsonb_build_object(
      -- campos de 23/09 (TV antiga)
      'leads_novos', coalesce(v_atual.leads_novos, 0),
      'leads_mes_anterior', coalesce(v_anterior.leads_novos, 0),
      'meta_leads', v_meta_leads,
      'negocios', coalesce(v_atual.negocios, 0),
      'negocios_mes_anterior', coalesce(v_anterior.negocios, 0),
      'taxa_conversao', coalesce(v_atual.taxa_conversao_geral, 0),
      'taxa_conversao_mes_anterior', coalesce(v_anterior.taxa_conversao_geral, 0),
      'ciclo_medio_ganho', v_atual.ciclo_medio_ganho,
      'ciclo_medio_mes_anterior', v_anterior.ciclo_medio_ganho,
      -- campos alinhados com os painéis (24/09)
      'leads_mes', v_leads_mes,
      'ritmo_dia', round(v_leads_30d / 30.0, 1),
      'projecao_mes', round(v_leads_mes + (v_leads_30d / 30.0) * (v_fim_mes - v_hoje)),
      'leads_media_3m', round(v_media_3m),
      'negocios_fechados_mes', v_neg_mes,
      'negocios_media_3m', round(v_neg_media_3m, 1),
      'conversao_safra', case when v_safra_leads > 0 then round(100.0 * v_safra_neg / v_safra_leads, 1) end,
      'conversao_safra_anterior', case when v_ant_leads >= 100 then round(100.0 * v_ant_neg / v_ant_leads, 1) end,
      'conversao_safra_n', v_safra_leads,
      'ciclo_mediano_12m', round(v_ciclo::numeric)
    ),
    'operacao', jsonb_build_object(
      'propostas_por_etapa', coalesce((
        select jsonb_object_agg(status_efetivo, n)
          from (
            select status_efetivo, count(*) as n
              from propostas_ativas
             where status_efetivo not in ('rejeitada', 'expirada')
             group by status_efetivo
          ) x
      ), '{}'::jsonb),
      'leads_parados_30d', coalesce((select sum(leads_parados_30d) from vw_corretores), 0),
      'leads_venda', coalesce(v_atual.leads_venda, 0),
      'leads_aluguel', coalesce(v_atual.leads_aluguel, 0),
      'plantao_hoje', coalesce((
        select jsonb_agg(jsonb_build_object('nome', corretor_nome, 'turno', turno) order by turno, corretor_nome)
          from plantao
         where data = v_hoje and coalesce(status, '') <> 'cancelado'
      ), '[]'::jsonb),
      -- campos alinhados com os painéis (24/09)
      'sem_contato', (
        select count(*)
          from vw_tempo_resposta t
          join vw_atendimentos_base b on b.codigo = t.codigo
         where t.periodo_confiavel and not t.tem_atividade
           and b.is_ativo and not b.is_ruido and not b.is_interno
      ),
      'abertos_30d', (
        select count(*)
          from vw_aging_ativos g
          join vw_atendimentos_base b on b.codigo = g.codigo
         where g.faixa_aging = '31+' and not b.is_ruido and not b.is_interno
      ),
      'atividades_vencidas_30d', (
        select count(*)
          from atividades
         where not realizada
           and datahorainicio::date >= v_hoje - 30
           and datahorainicio::date < v_hoje
      )
    )
  );
end;
$$;

revoke execute on function kpis_tv() from public, anon;
grant execute on function kpis_tv() to authenticated;
