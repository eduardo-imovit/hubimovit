-- =============================================================================
-- KPIs da TV Display (rodapé): uma função que devolve SÓ números agregados.
--
-- A conta da TV (tvaccess) não tem leitura das tabelas de CRM/dashboard, e
-- não deve ter. Esta função roda como dona (security definer), junta tudo e
-- entrega um JSON pronto. Quem pode chamar: gestao, adm, marketing e tvaccess.
-- Datas no fuso de São Paulo.
--
-- Decisões (2026-09-23, com o Eduardo):
--   * Meta de leads: metas_mensais do mês, canal "Geral…", segmento "Todos".
--     Sem meta cadastrada, a TV compara com o mês anterior.
--   * "Imóveis locados no mês" ficou de fora: imoveis_locados está vazia.
--     No lugar: leads de venda × aluguel do mês.
-- =============================================================================

create or replace function kpis_tv() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', v_hoje)::date;
  v_mes_anterior date := (date_trunc('month', v_hoje) - interval '1 month')::date;
  v_atual vw_kpis_mensais;
  v_anterior vw_kpis_mensais;
  v_meta_leads integer;
begin
  if coalesce(papel_atual() in ('gestao', 'adm', 'marketing', 'tvaccess'), false) is not true then
    raise exception 'Sem acesso aos KPIs da TV';
  end if;

  select * into v_atual from vw_kpis_mensais where mes_entrada = v_mes;
  select * into v_anterior from vw_kpis_mensais where mes_entrada = v_mes_anterior;

  select max(leads_meta) into v_meta_leads
    from metas_mensais
   where ano_mes = v_mes and canal ilike 'Geral%' and coalesce(segmento, 'Todos') = 'Todos';

  return jsonb_build_object(
    'mes_referencia', v_mes,
    'atualizado_em', now(),
    'comercial', jsonb_build_object(
      'leads_novos', coalesce(v_atual.leads_novos, 0),
      'leads_mes_anterior', coalesce(v_anterior.leads_novos, 0),
      'meta_leads', v_meta_leads,
      'negocios', coalesce(v_atual.negocios, 0),
      'negocios_mes_anterior', coalesce(v_anterior.negocios, 0),
      'taxa_conversao', coalesce(v_atual.taxa_conversao_geral, 0),
      'taxa_conversao_mes_anterior', coalesce(v_anterior.taxa_conversao_geral, 0),
      'ciclo_medio_ganho', v_atual.ciclo_medio_ganho,
      'ciclo_medio_mes_anterior', v_anterior.ciclo_medio_ganho
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
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function kpis_tv() from public, anon;
grant execute on function kpis_tv() to authenticated;
