-- Fase 29a · Saúde Imovit: negócios de locação contados por contratos iniciados (igual ao Km 32)
-- Decisão do Eduardo (24/11): "sim, conta por contratos igual ao Km 32". Resolve a divergência D2 do Schema §2.22.
--
-- Antes: negocios = negócios "Realizado" do CRM (venda + locação), pela datanegocio.
-- Agora: venda   = negócios "Realizado" do CRM (sem mudança)
--        locação = contratos de contratos_locacao com data_inicio no período, sem Cancelado
--                  (os mesmos que já formam o valor fechado da locação; padrão campanha_resumo)
-- Consequência: contrato não tem canal/mídia no Imoview, então a locação entra no total e na finalidade
--               "Aluguel", mas some das linhas por canal/mídia (igual ao valor fechado da locação).
--
-- A 20261123170000_saude_imovit.sql já está aplicada (20261124110548): aqui só um create or replace de
-- saude_linhas(). saude_tirar_foto() e o bloco "revisadas" de saude_imovit() leem l.negocios dela,
-- então a foto semanal e a comparação passam a usar a nova contagem sem outra mudança.
-- O valor fechado não muda.


------------------------------------------------------------------------------------------
-- 4. Linhas de um período (evento/entrada). p_fin: null = todas, 'Aluguel' ou 'Venda'.
--    nivel: total | finalidade | canal | midia (pai = canal) | plataforma | campanha (pai = plataforma)
--           | anuncio (pai = campanha; só Meta — o Google só tem campanha)
--    Finalidade da mídia paga pela campanha: "loca" = Aluguel, "venda" = Venda; Brand/Engajamento só em "todas".
------------------------------------------------------------------------------------------
create or replace function public.saude_linhas(p_ini date, p_fim date, p_fin text default null)
returns table (
  nivel text, pai text, chave text,
  investimento numeric, impressoes numeric, cliques numeric, conv_plataforma numeric,
  leads int, qualificados int, visitas int, propostas int, descartados int,
  negocios int, comissao_venda numeric, taxa_adm numeric, intermediacao numeric,
  vgv_venda numeric, aluguel_locacao numeric, contratos_locacao int)
language sql stable security definer set search_path = public as $$
  with base_all as materialized (
    select codigo, data_entrada, canal, coalesce(midia_raw, '(sem mídia)') as midia, finalidade, is_ruido, is_interno
    from vw_atendimentos_base
  ),
  bf as (select * from base_all where not is_ruido and not is_interno and (p_fin is null or finalidade = p_fin)),
  q as (select codigo, min(entrou_em) as quando from vw_jornada_etapas where posicao >= 4 group by codigo),
  p6 as (select codigo, min(entrou_em) as quando from vw_jornada_etapas where posicao = 6 group by codigo),
  ev as (
    -- leads (entrada) e qualificados em até 7 dias da entrada (D4)
    select 'lead' as tipo, bf.canal, bf.midia, bf.finalidade, 1::numeric as v
      from bf where bf.data_entrada between p_ini and p_fim
    union all
    select 'qual', bf.canal, bf.midia, bf.finalidade, 1
      from bf join q using (codigo) where bf.data_entrada between p_ini and p_fim and q.quando <= bf.data_entrada + 7
    -- visitas realizadas (D6); sem atendimento só aparece em "todas"
    union all
    select 'visita', coalesce(b.canal, '(sem atendimento)'), coalesce(b.midia, '(sem atendimento)'), b.finalidade, 1
      from atividades a left join bf b on b.codigo = a.codigoatendimento
     where a.nometipo = 'Visita' and a.realizada and a.datahorainicio::date between p_ini and p_fim
       and (p_fin is null or b.codigo is not null)
    -- propostas: 1ª entrada na etapa Proposta (posição 6) no período (evento)
    union all
    select 'proposta', bf.canal, bf.midia, bf.finalidade, 1
      from p6 join bf using (codigo) where p6.quando between p_ini and p_fim
    -- descartes no período (evento)
    union all
    select 'descarte', bf.canal, bf.midia, bf.finalidade, 1
      from vw_jornada_descartes d join bf using (codigo) where d.descartado_em between p_ini and p_fim
    -- negócios de venda (D1, D2) e comissão de venda (D3). Locação conta pelos contratos (ver 'contrato', 24/11)
    union all
    select 'negocio', coalesce(b.canal, '(sem atendimento)'), coalesce(b.midia, '(sem atendimento)'), n.finalidade, 1
      from saude_negocios() n left join base_all b on b.codigo = n.atendimento
     where n.finalidade <> 'Aluguel'                                                    -- 24/11: locação sai do CRM
       and n.data_negocio between p_ini and p_fim and (p_fin is null or n.finalidade = p_fin)
    union all
    select 'comissao', coalesce(b.canal, '(sem atendimento)'), coalesce(b.midia, '(sem atendimento)'), n.finalidade, coalesce(n.comissao, 0)
      from saude_negocios() n left join base_all b on b.codigo = n.atendimento
     where n.finalidade = 'Venda' and n.data_negocio between p_ini and p_fim and (p_fin is null or p_fin = 'Venda')
    -- valor fechado (24/11): VGV da venda (por canal) e contratos de locação iniciados (sem canal, padrão Km 32)
    union all
    select 'vgv', coalesce(b.canal, '(sem atendimento)'), coalesce(b.midia, '(sem atendimento)'), n.finalidade, coalesce(n.valor, 0)
      from saude_negocios() n left join base_all b on b.codigo = n.atendimento
     where n.finalidade = 'Venda' and n.data_negocio between p_ini and p_fim and (p_fin is null or p_fin = 'Venda')
    union all
    select 'contrato', null, null, 'Aluguel', coalesce(c.valor_aluguel, 0) from contratos_locacao c
     where c.situacao <> 'Cancelado' and c.data_inicio between p_ini and p_fim and coalesce(p_fin, 'Aluguel') = 'Aluguel'
    -- taxa de adm e intermediação recebidas (só locação; sem canal)
    union all
    select 'adm', null, null, 'Aluguel', r.taxa_adm from contratos_locacao_recebimentos r
     where r.data_pagamento between p_ini and p_fim and coalesce(p_fin, 'Aluguel') = 'Aluguel'
    union all
    select 'intermed', null, null, 'Aluguel', r.taxa_intermediacao from contratos_locacao_recebimentos r
     where r.data_pagamento between p_ini and p_fim and coalesce(p_fin, 'Aluguel') = 'Aluguel'
  ),
  agg as (
    select case when grouping(midia) = 0 then 'midia' when grouping(canal) = 0 then 'canal'
                when grouping(finalidade) = 0 then 'finalidade' else 'total' end as nivel,
           case when grouping(midia) = 0 then canal end as pai,
           case when grouping(midia) = 0 then midia when grouping(canal) = 0 then canal
                when grouping(finalidade) = 0 then finalidade end as chave,
           count(*) filter (where tipo = 'lead')::int as leads,
           count(*) filter (where tipo = 'qual')::int as qualificados,
           count(*) filter (where tipo = 'visita')::int as visitas,
           count(*) filter (where tipo = 'proposta')::int as propostas,
           count(*) filter (where tipo = 'descarte')::int as descartados,
           count(*) filter (where tipo in ('negocio', 'contrato'))::int as negocios,      -- 24/11: venda (CRM) + contratos iniciados
           coalesce(sum(v) filter (where tipo = 'comissao'), 0) as comissao_venda,
           coalesce(sum(v) filter (where tipo = 'adm'), 0) as taxa_adm,
           coalesce(sum(v) filter (where tipo = 'intermed'), 0) as intermediacao,
           coalesce(sum(v) filter (where tipo = 'vgv'), 0) as vgv_venda,
           coalesce(sum(v) filter (where tipo = 'contrato'), 0) as aluguel_locacao,
           count(*) filter (where tipo = 'contrato')::int as contratos_locacao
    from ev
    group by grouping sets ((), (finalidade), (canal), (canal, midia))
    having grouping(finalidade) = 1 and grouping(canal) = 1 and grouping(midia) = 1   -- total
        or grouping(finalidade) = 0 and finalidade is not null
        or grouping(canal) = 0 and canal is not null
  ),
  ads as (
    select 'Meta' as plat, campanha, anuncio, investimento::numeric as inv, alcance_impressoes::numeric as imp,
           cliques::numeric as cli, leads_conversoes::numeric as conv
      from dashboard_meta_ads where data between p_ini and p_fim
    union all
    select 'Google', campanha, null, investimento::numeric, alcance_impressoes::numeric, cliques::numeric, leads_conversoes::numeric
      from dashboard_google_ads where data between p_ini and p_fim
  ),
  adsf as (
    select * from ads
    where p_fin is null
       or (p_fin = 'Aluguel' and campanha ~* 'loca')
       or (p_fin = 'Venda' and campanha ~* 'vend')
  ),
  aagg as (
    select case when grouping(anuncio) = 0 then 'anuncio' when grouping(campanha) = 0 then 'campanha'
                when grouping(plat) = 0 then 'plataforma' else 'ads_total' end as nivel,
           case when grouping(anuncio) = 0 then campanha when grouping(campanha) = 0 then plat end as pai,
           case when grouping(anuncio) = 0 then anuncio when grouping(campanha) = 0 then campanha
                when grouping(plat) = 0 then plat end as chave,
           round(coalesce(sum(inv), 0), 2) as investimento, coalesce(sum(imp), 0) as impressoes,
           coalesce(sum(cli), 0) as cliques, round(coalesce(sum(conv), 0), 1) as conv_plataforma
    from adsf
    group by grouping sets ((), (plat), (plat, campanha), (plat, campanha, anuncio))
    having grouping(anuncio) = 1 or anuncio is not null
  ),
  tot as (select * from aagg where nivel = 'ads_total')
  -- total e canal "Campanhas pagas" recebem os números das plataformas
  select a.nivel, a.pai, a.chave,
         case when a.nivel = 'total' or (a.nivel = 'canal' and a.chave = 'Campanhas pagas') then t.investimento end,
         case when a.nivel = 'total' or (a.nivel = 'canal' and a.chave = 'Campanhas pagas') then t.impressoes end,
         case when a.nivel = 'total' or (a.nivel = 'canal' and a.chave = 'Campanhas pagas') then t.cliques end,
         case when a.nivel = 'total' or (a.nivel = 'canal' and a.chave = 'Campanhas pagas') then t.conv_plataforma end,
         a.leads, a.qualificados, a.visitas, a.propostas, a.descartados,
         a.negocios, a.comissao_venda, a.taxa_adm, a.intermediacao,
         a.vgv_venda, a.aluguel_locacao, a.contratos_locacao
  from agg a cross join tot t
  union all
  select 'canal', null, 'Campanhas pagas', t.investimento, t.impressoes, t.cliques, t.conv_plataforma,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  from tot t
  where t.investimento > 0 and not exists (select 1 from agg where nivel = 'canal' and chave = 'Campanhas pagas')
  union all
  select nivel, pai, chave, investimento, impressoes, cliques, conv_plataforma,
         null, null, null, null, null, null, null, null, null, null, null, null
  from aagg where nivel <> 'ads_total'
$$;

------------------------------------------------------------------------------------------
-- Correção do placar da foto de 16/11 (gravada com negocios = 1 pela regra antiga; com a regra nova são 2:
-- venda 6416 + contrato 1829). Só o placar: saude_tirar_foto() regravaria o "agora" com o estado de hoje.
-- Idempotente: só mexe se ainda estiver com 1.
------------------------------------------------------------------------------------------
update public.saude_fotos
   set placar = jsonb_set(placar, '{negocios}', '2')
 where semana = '2026-11-16' and placar->>'negocios' = '1';
