-- Saúde Imovit v2 (Fase 29a S2, PRD §5.23, Schema §2.22) — reescrita em 24/11 para PERÍODO LIVRE
-- Decisões D1–D12 (handoff 23/11) + decisões de 24/11:
--   período 7/14/30/60/90 dias ou personalizado (p_inicio, p_fim) · finalidade todas/locacao/venda
--   comparação = período anterior de mesmo tamanho · média 8 semanas + foto semanal só para os números "agora"
--   sem mídias sociais e sem GA4 na v1 (placeholders "aguardando captura") · sem "Evento" (não existe mídia no CRM)
-- Valor fechado (Eduardo, 24/11, "para manter um padrão" com o Km 32): a manchete é o VALOR FECHADO
--   venda = valornegocio do CRM (VGV) · locação = aluguel mensal dos contratos iniciados (contratos_locacao,
--   data_inicio, sem Cancelado) — mesmo padrão do campanha_resumo. A receita (comissão + adm + intermediação)
--   continua calculada em "receita_referencia", fora da manchete, para poder religar depois.
-- Acesso: Gestão + Marketing (pode_ver_saude). Só saude_imovit() e pode_ver_saude() são chamáveis pelo app.
-- Peças:
--   pode_ver_saude()                         quem vê
--   saude_sinal() / saude_num()              cor e formato de um número (D10, D12)
--   saude_negocios()                         1 linha por negócio do CRM (D1, D2)
--   saude_linhas(ini, fim, fin)              todos os números de evento/entrada de um período, por total/canal/mídia/
--                                            finalidade/plataforma/campanha/anúncio (interna)
--   saude_linha(a, b)                        junta período atual × anterior de uma linha em jsonb
--   saude_agora(fin)                         funil, gargalo, atendimentos em aberto, ativos por canal, dinheiro na mesa
--   saude_carteira_em(d)                     contratos ativos, atraso, saídas avisadas numa data (reconstruível)
--   saude_fotos + saude_tirar_foto() + pg_cron   foto semanal dos "agora" (D11)
--   saude_imovit(p_inicio, p_fim, p_finalidade)  a página inteira em 1 jsonb

------------------------------------------------------------------------------------------
-- 1. Quem vê
------------------------------------------------------------------------------------------
create or replace function public.pode_ver_saude()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(papel_atual() in ('gestao', 'marketing'), false);
$$;

------------------------------------------------------------------------------------------
-- 2. Sinal e formato de um número
--    ref = média (números "agora") ou período anterior (números de período).
--    invertido: true = mais é pior (custo, atraso, saídas); null = sem cor (ex.: investimento).
--    casos: base do D12 (cor só com base >= minimo); por padrão a própria referência.
------------------------------------------------------------------------------------------
create or replace function public.saude_sinal(v numeric, ref numeric, invertido boolean default false,
                                              minimo numeric default 0, casos numeric default null)
returns text language sql immutable as $$
  select case
    when invertido is null then 'neutro'
    when v is null or ref is null then null
    when coalesce(casos, ref) < minimo then 'poucos'                    -- D12
    when ref = 0 then case when v = 0 then 'verde' when invertido then 'vermelho' else 'verde' end
    when not invertido and v >= ref then 'verde'
    when not invertido and (v - ref) / ref >= -0.15 then 'amarelo'
    when not invertido then 'vermelho'
    when v <= ref then 'verde'
    when (v - ref) / ref <= 0.15 then 'amarelo'
    else 'vermelho'
  end
$$;

create or replace function public.saude_num(v numeric, ant numeric, regua text, invertido boolean default false,
                                            minimo numeric default 0, media numeric default null, n int default null,
                                            casos numeric default null)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'valor', v, 'anterior', ant, 'media', round(media, 2), 'n', n, 'regua', regua,
    'referencia', case when media is not null then 'media' else 'anterior' end,
    'variacao', case when coalesce(media, ant) <> 0 and v is not null
                     then round((v - coalesce(media, ant)) / coalesce(media, ant) * 100, 1) end,
    'sinal', public.saude_sinal(v, coalesce(media, ant), invertido, minimo, casos),
    'invertido', invertido))
$$;

------------------------------------------------------------------------------------------
-- 3. Negócios do CRM: 1 por codigonegocio, pela datanegocio (D1, D2)
------------------------------------------------------------------------------------------
create or replace function public.saude_negocios()
returns table (codigonegocio bigint, atendimento bigint, data_negocio date, finalidade text, valor numeric, comissao numeric)
language sql stable security definer set search_path = public as $$
  with ult as (
    select distinct on (j.codigo) j.codigo, j.payload
    from crm_atendimento_jornada j
    where jsonb_typeof(j.payload->'imoveisnegocio') = 'array'
    order by j.codigo, j.id desc
  )
  select distinct on ((n->>'codigonegocio')::bigint)
         (n->>'codigonegocio')::bigint, u.codigo,
         to_date(left(n->>'datanegocio', 10), 'DD/MM/YYYY'),
         n->>'finalidade', (n->>'valornegocio')::numeric, (n->>'valorcomissao')::numeric
  from ult u, jsonb_array_elements(u.payload->'imoveisnegocio') n
  where n->>'datanegocio' ~ '^\d{2}/\d{2}/\d{4}'
    and n->>'situacaonegocio' = 'Realizado'
    and n->>'codigonegocio' ~ '^\d+$'
  order by (n->>'codigonegocio')::bigint
$$;

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
    -- negócios (D1, D2) e comissão de venda (D3)
    union all
    select 'negocio', coalesce(b.canal, '(sem atendimento)'), coalesce(b.midia, '(sem atendimento)'), n.finalidade, 1
      from saude_negocios() n left join base_all b on b.codigo = n.atendimento
     where n.data_negocio between p_ini and p_fim and (p_fin is null or n.finalidade = p_fin)
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
           count(*) filter (where tipo = 'negocio')::int as negocios,
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
-- 5. Uma linha atual × anterior → jsonb com cada número (valor, anterior, variação, sinal)
--    Contagens: cor só com base >= 5 (D12). Investimento: sem cor. Custos: invertidos (D10).
------------------------------------------------------------------------------------------
create or replace function public.saude_linha(a jsonb, b jsonb, p_parcial boolean default false)
returns jsonb language sql immutable set search_path = public as $$
  with x as (
    select
      (a->>'investimento')::numeric as inv, (b->>'investimento')::numeric as inv_b,
      (a->>'leads')::numeric as le, (b->>'leads')::numeric as le_b,
      (a->>'qualificados')::numeric as qu, (b->>'qualificados')::numeric as qu_b,
      (a->>'comissao_venda')::numeric + (a->>'taxa_adm')::numeric + (a->>'intermediacao')::numeric as rec,
      (b->>'comissao_venda')::numeric + (b->>'taxa_adm')::numeric + (b->>'intermediacao')::numeric as rec_b,
      (a->>'vgv_venda')::numeric + (a->>'aluguel_locacao')::numeric as vf,
      (b->>'vgv_venda')::numeric + (b->>'aluguel_locacao')::numeric as vf_b
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'nivel', a->>'nivel', 'pai', a->>'pai', 'chave', coalesce(a->>'chave', b->>'chave'),
    'investimento', case when x.inv is not null or x.inv_b is not null then saude_num(x.inv, x.inv_b, 'evento', null) end,
    'impressoes', case when a ? 'impressoes' and a->>'impressoes' is not null
                       then saude_num((a->>'impressoes')::numeric, (b->>'impressoes')::numeric, 'evento', false, 5) end,
    'cliques', case when a->>'cliques' is not null
                    then saude_num((a->>'cliques')::numeric, (b->>'cliques')::numeric, 'evento', false, 5) end,
    'conv_plataforma', case when a->>'conv_plataforma' is not null
                            then saude_num((a->>'conv_plataforma')::numeric, (b->>'conv_plataforma')::numeric, 'evento', false, 5) end,
    'ctr', case when (a->>'impressoes')::numeric > 0
                then saude_num(round(100 * (a->>'cliques')::numeric / (a->>'impressoes')::numeric, 2),
                               round(100 * (b->>'cliques')::numeric / nullif((b->>'impressoes')::numeric, 0), 2), 'evento', false, 0,
                               null, null, least((a->>'cliques')::numeric, (b->>'cliques')::numeric)) end,
    'cpc', case when (a->>'cliques')::numeric > 0
                then saude_num(round(x.inv / (a->>'cliques')::numeric, 2),
                               round(x.inv_b / nullif((b->>'cliques')::numeric, 0), 2), 'evento', true, 5,
                               null, null, least((a->>'cliques')::numeric, (b->>'cliques')::numeric)) end,
    'custo_conv_plataforma', case when (a->>'conv_plataforma')::numeric > 0
                then saude_num(round(x.inv / (a->>'conv_plataforma')::numeric, 2),
                               round(x.inv_b / nullif((b->>'conv_plataforma')::numeric, 0), 2), 'evento', true, 5,
                               null, null, least((a->>'conv_plataforma')::numeric, (b->>'conv_plataforma')::numeric)) end,
    'leads', case when x.le is not null then saude_num(x.le, x.le_b, 'entrada', false, 5) end,
    'qualificados', case when x.qu is not null
                         then saude_num(x.qu, x.qu_b, 'entrada', false, 5) || jsonb_build_object('parcial', p_parcial) end,
    'pct_qualificados', case when x.le > 0
                             then saude_num(round(100 * x.qu / x.le, 1), round(100 * x.qu_b / nullif(x.le_b, 0), 1), 'entrada',
                                            false, 5, null, null, least(x.le, x.le_b)) || jsonb_build_object('parcial', p_parcial) end,
    'visitas', case when a->>'visitas' is not null then saude_num((a->>'visitas')::numeric, (b->>'visitas')::numeric, 'evento', false, 5) end,
    'propostas', case when a->>'propostas' is not null then saude_num((a->>'propostas')::numeric, (b->>'propostas')::numeric, 'evento', false, 5) end,
    'descartados', case when a->>'descartados' is not null
                        then saude_num((a->>'descartados')::numeric, (b->>'descartados')::numeric, 'evento', true, 5) end,
    'negocios', case when a->>'negocios' is not null then saude_num((a->>'negocios')::numeric, (b->>'negocios')::numeric, 'evento', false, 5) end,
    'valor_fechado', case when x.vf is not null
                    then saude_num(x.vf, x.vf_b, 'evento', false, 0)
                         || jsonb_build_object('venda', (a->>'vgv_venda')::numeric, 'locacao', (a->>'aluguel_locacao')::numeric,
                                               'contratos_locacao', (a->>'contratos_locacao')::int,
                                               'anterior_venda', (b->>'vgv_venda')::numeric,
                                               'anterior_locacao', (b->>'aluguel_locacao')::numeric,
                                               'anterior_contratos_locacao', (b->>'contratos_locacao')::int,
                                               'regra', 'venda = valor do negócio (VGV) · locação = aluguel mensal dos contratos iniciados') end,
    'receita_referencia', case when x.rec is not null
                    then saude_num(x.rec, x.rec_b, 'evento', false, 0)
                         || jsonb_build_object('venda', (a->>'comissao_venda')::numeric, 'adm', (a->>'taxa_adm')::numeric,
                                               'intermediacao', (a->>'intermediacao')::numeric,
                                               'anterior_venda', (b->>'comissao_venda')::numeric, 'anterior_adm', (b->>'taxa_adm')::numeric,
                                               'anterior_intermediacao', (b->>'intermediacao')::numeric) end,
    'custo_lead_crm', case when a->>'chave' = 'Campanhas pagas' and x.le > 0
                           then saude_num(round(x.inv / x.le, 2), round(x.inv_b / nullif(x.le_b, 0), 2), 'evento ÷ entrada', true, 5,
                                          null, null, least(x.le, x.le_b)) end,
    'custo_qualificado', case when a->>'chave' = 'Campanhas pagas' and x.qu > 0
                              then saude_num(round(x.inv / x.qu, 2), round(x.inv_b / nullif(x.qu_b, 0), 2), 'evento ÷ entrada', true, 5,
                                             null, null, least(x.qu, x.qu_b)) || jsonb_build_object('parcial', p_parcial) end
  ))
  from x
$$;

------------------------------------------------------------------------------------------
-- 6. Números "agora" (D7, D8), por finalidade (null = todas)
------------------------------------------------------------------------------------------
create or replace function public.saude_agora(p_fin text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  b as materialized (select * from vw_atendimentos_base
                     where not is_ruido and not is_interno and (p_fin is null or finalidade = p_fin)),
  pas as (
    select j.posicao, coalesce(j.dias, (select d from hoje) - j.entrou_em::date) as dias
    from vw_jornada_etapas j join b using (codigo)
    where j.entrada_conhecida and j.entrou_em >= (select d from hoje) - 56
  ),
  med as (select posicao, count(*) as n, percentile_cont(0.5) within group (order by dias) as mediana from pas group by posicao),
  ab as (
    select j.posicao, (select d from hoje) - j.entrou_em::date as dias
    from vw_jornada_etapas j join b using (codigo)
    where j.como_saiu = 'em_aberto' and b.is_ativo
  ),
  funil as (
    select m.posicao,
           (array['Pré-atendimento','Seleção de perfil','Seleção de imóveis','Lead qualificado','Visita','Proposta','Negócio'])[m.posicao] as etapa,
           count(ab.posicao) as ativos, m.mediana, m.n as passagens,
           count(ab.posicao) filter (where ab.dias > m.mediana) as parados
    from med m left join ab using (posicao)
    where m.posicao between 1 and 6
    group by m.posicao, m.mediana, m.n
  ),
  canais as (
    select canal, count(*) filter (where is_ativo) as ativos,
           count(*) filter (where is_ativo and dias_parado > 30) as abertos_mais_30d
    from b group by canal
  ),
  ult as (select distinct on (codigo) codigo, payload from crm_atendimento_jornada where payload is not null order by codigo, id desc),
  prop as (
    select im->>'finalidade' as fin, im->>'situacao' as situacao_imovel,
           nullif(replace(regexp_replace(im->>'valor', '[^0-9,]', '', 'g'), ',', '.'), '')::numeric as valor_imovel,
           (select (n->>'valorproposta')::numeric from jsonb_array_elements(coalesce(im->'negociacoes', '[]')) n
             where n->>'situacaonegociacao' !~* 'cancel|recus' and n->>'valorproposta' ~ '^[0-9.]+$'
             order by to_timestamp(n->>'datanegociacao', 'DD/MM/YYYY HH24:MI') desc limit 1) as valor_proposta
    from b join ult u using (codigo),
         jsonb_array_elements(case when jsonb_typeof(u.payload->'imoveisproposta') = 'array' then u.payload->'imoveisproposta' else '[]' end) im
    where b.is_ativo and b.fase_ordem = 6
  ),
  mesa as (
    select fin, situacao_imovel,
           coalesce(valor_proposta, valor_imovel) as valor,                                -- 24/11: valor fechado (venda = proposta/imóvel, locação = 1 aluguel)
           case when fin = 'Venda' then coalesce(valor_proposta, valor_imovel) * 0.0468      -- referência: comissão média (PRD §5.23)
                else coalesce(valor_proposta, valor_imovel) end as receita                   -- D8: locação = 1 aluguel
    from prop
    where p_fin is null or (p_fin = 'Venda') = (fin = 'Venda')
  )
  select jsonb_build_object(
    'calculado_em', now(),
    'atendimentos_abertos', (select count(*) from b where is_ativo),
    'funil', (select jsonb_agg(to_jsonb(f) order by f.posicao) from funil f),
    'gargalo', (select to_jsonb(f) from funil f order by f.parados desc, f.posicao limit 1),
    'ativos_por_canal', (select coalesce(jsonb_agg(to_jsonb(c) order by c.ativos desc), '[]') from canais c where c.ativos > 0),
    'dinheiro_mesa', (select jsonb_build_object(
        'total', round(coalesce(sum(valor), 0), 2),
        'venda', round(coalesce(sum(valor) filter (where fin = 'Venda'), 0), 2),
        'locacao', round(coalesce(sum(valor) filter (where fin <> 'Venda'), 0), 2),
        'regra', 'valor fechado: venda = valor da proposta (ou do imóvel) · locação = 1 aluguel',
        'receita_referencia', jsonb_build_object(
            'total', round(coalesce(sum(receita), 0), 2),
            'venda', round(coalesce(sum(receita) filter (where fin = 'Venda'), 0), 2),
            'locacao', round(coalesce(sum(receita) filter (where fin <> 'Venda'), 0), 2),
            'regra', 'venda × 4,68% (comissão média) + locação 1 aluguel'),
        'propostas', count(*),
        'propostas_venda', count(*) filter (where fin = 'Venda'),
        'propostas_locacao', count(*) filter (where fin <> 'Venda'),
        'com_imovel_vendido', count(*) filter (where situacao_imovel ~* 'vendid'),
        'valor_com_imovel_vendido', round(coalesce(sum(valor) filter (where situacao_imovel ~* 'vendid'), 0), 2))
      from mesa)
  )
$$;

------------------------------------------------------------------------------------------
-- 7. Carteira numa data (reconstruível: foto diária da carteira + datas dos contratos)
------------------------------------------------------------------------------------------
create or replace function public.saude_carteira_em(p_data date)
returns table (dia date, contratos_ativos int, atraso numeric, atraso_contratos int, saidas_avisadas int)
language sql stable security definer set search_path = public as $$
  select f.data, f.ativos, f.inadimplentes_valor, f.inadimplentes,
         (select count(*) from contratos_locacao c
           where c.data_aviso_desocupacao <= p_data
             and (c.data_rescisao is null or c.data_rescisao > p_data) and c.situacao <> 'Cancelado')::int
  from (select * from contratos_locacao_fotos where data <= p_data and data > p_data - 7 order by data desc limit 1) f
$$;

------------------------------------------------------------------------------------------
-- 8. Foto semanal (D11): domingo à noite guarda os "agora" (por finalidade) e o placar da semana
------------------------------------------------------------------------------------------
create table if not exists public.saude_fotos (
  semana date primary key check (extract(isodow from semana) = 1),   -- segunda-feira da semana
  tirada_em timestamptz not null default now(),
  agora jsonb not null,                                             -- {todas, locacao, venda}: saude_agora()
  placar jsonb not null                                             -- negócios e receita como estavam (D1: "revisada")
);
alter table public.saude_fotos enable row level security;           -- sem policy: só as funções leem
revoke all on public.saude_fotos from anon, authenticated;
comment on table public.saude_fotos is 'Foto semanal da Saúde Imovit (D11). Gravada por saude_tirar_foto() no domingo à noite (pg_cron).';

create or replace function public.saude_tirar_foto(p_semana date default null)
returns date language plpgsql security definer set search_path = public as $$
declare
  v_semana date := date_trunc('week', coalesce(p_semana, (now() at time zone 'America/Sao_Paulo')::date))::date;
  v_placar jsonb;
begin
  select jsonb_build_object('negocios', l.negocios, 'comissao_venda', l.comissao_venda, 'taxa_adm', l.taxa_adm,
                            'intermediacao', l.intermediacao, 'receita', l.comissao_venda + l.taxa_adm + l.intermediacao,
                            'vgv_venda', l.vgv_venda, 'aluguel_locacao', l.aluguel_locacao,
                            'contratos_locacao', l.contratos_locacao, 'valor_fechado', l.vgv_venda + l.aluguel_locacao)
    into v_placar
    from saude_linhas(v_semana, v_semana + 6, null) l where l.nivel = 'total';
  insert into saude_fotos (semana, tirada_em, agora, placar)
  values (v_semana, now(),
          jsonb_build_object('todas', saude_agora(null), 'locacao', saude_agora('Aluguel'), 'venda', saude_agora('Venda')),
          v_placar)
  on conflict (semana) do update set tirada_em = excluded.tirada_em, agora = excluded.agora, placar = excluded.placar;
  return v_semana;
end;
$$;

------------------------------------------------------------------------------------------
-- 9. A página: saude_imovit(p_inicio, p_fim, p_finalidade) → jsonb
--    Padrão: últimos 30 dias até ontem, todas as finalidades.
------------------------------------------------------------------------------------------
create or replace function public.saude_imovit(p_inicio date default null, p_fim date default null,
                                               p_finalidade text default 'todas')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_fim date := coalesce(p_fim, (now() at time zone 'America/Sao_Paulo')::date - 1);
  v_ini date;
  v_len int;
  v_ant_ini date;
  v_ant_fim date;
  v_fin text;
  v_chave text := coalesce(p_finalidade, 'todas');
  v_parcial boolean;
  v_linhas jsonb;
  v_total jsonb;
  v_pagos jsonb;
  v_agora jsonb;
  v_ref jsonb;
  v_cart jsonb;
  v_revisadas jsonb;
begin
  if not pode_ver_saude() then
    raise exception 'Sem acesso à Saúde Imovit' using errcode = '42501';
  end if;
  if v_chave not in ('todas', 'locacao', 'venda') then
    raise exception 'Finalidade inválida: % (use todas, locacao ou venda)', p_finalidade using errcode = '22023';
  end if;
  v_ini := coalesce(p_inicio, v_fim - 29);
  if v_fim < v_ini then raise exception 'Fim antes do início' using errcode = '22023'; end if;
  v_len := v_fim - v_ini + 1;
  if v_len > 366 then raise exception 'Período máximo: 366 dias' using errcode = '22023'; end if;
  v_ant_fim := v_ini - 1;
  v_ant_ini := v_ini - v_len;
  v_fin := case v_chave when 'locacao' then 'Aluguel' when 'venda' then 'Venda' end;
  v_parcial := v_fim + 7 >= v_hoje;                                   -- D4: coorte só fecha 7 dias depois

  -- 9.1 Todas as linhas: atual × anterior
  with a as (select * from saude_linhas(v_ini, v_fim, v_fin)),
       b as (select * from saude_linhas(v_ant_ini, v_ant_fim, v_fin)),
       j as (
         select coalesce(a.nivel, b.nivel) as nivel, coalesce(a.pai, b.pai) as pai, coalesce(a.chave, b.chave) as chave,
                saude_linha(coalesce(to_jsonb(a), to_jsonb(b) - array['investimento','impressoes','cliques','conv_plataforma','leads',
                                       'qualificados','visitas','propostas','descartados','negocios']
                                       || jsonb_build_object('comissao_venda', 0, 'taxa_adm', 0, 'intermediacao', 0,
                                                             'vgv_venda', 0, 'aluguel_locacao', 0, 'contratos_locacao', 0)
                                       || case when b.leads is not null then jsonb_build_object('leads', 0, 'qualificados', 0, 'visitas', 0,
                                              'propostas', 0, 'descartados', 0, 'negocios', 0) else '{}' end
                                       || case when b.investimento is not null then jsonb_build_object('investimento', 0, 'impressoes', 0,
                                              'cliques', 0, 'conv_plataforma', 0) else '{}' end),
                            to_jsonb(b), v_parcial) as linha
         from a full join b
           on a.nivel = b.nivel and coalesce(a.pai, '') = coalesce(b.pai, '') and coalesce(a.chave, '') = coalesce(b.chave, '')
       )
  select jsonb_object_agg(nivel, linhas) into v_linhas
  from (select nivel, jsonb_agg(linha order by coalesce((linha->'investimento'->>'valor')::numeric, 0) desc,
                                         coalesce((linha->'leads'->>'valor')::numeric, 0) desc, chave) as linhas
        from j group by nivel) z;

  v_total := v_linhas->'total'->0;
  v_pagos := (select l from jsonb_array_elements(v_linhas->'canal') l where l->>'chave' = 'Campanhas pagas');

  -- 9.2 "Agora": ao vivo; referência = foto da semana anterior e média das até 8 fotos semanais (D11)
  v_agora := saude_agora(v_fin);
  select jsonb_build_object(
    'atendimentos_abertos', saude_num((v_agora->>'atendimentos_abertos')::numeric,
        (array_agg((f.agora->v_chave->>'atendimentos_abertos')::numeric order by f.semana desc))[1], 'agora', false, 5,
        avg((f.agora->v_chave->>'atendimentos_abertos')::numeric), count(*)::int),
    'parados_gargalo', saude_num((v_agora->'gargalo'->>'parados')::numeric,
        (array_agg((f.agora->v_chave->'gargalo'->>'parados')::numeric order by f.semana desc))[1], 'agora', true, 5,
        avg((f.agora->v_chave->'gargalo'->>'parados')::numeric), count(*)::int),
    'dinheiro_mesa', saude_num((v_agora->'dinheiro_mesa'->>'total')::numeric,
        (array_agg((f.agora->v_chave->'dinheiro_mesa'->>'total')::numeric order by f.semana desc))[1], 'agora', false, 0,
        avg((f.agora->v_chave->'dinheiro_mesa'->>'total')::numeric), count(*)::int))
    into v_ref
    from (select * from saude_fotos where semana < date_trunc('week', v_hoje)::date order by semana desc limit 8) f;

  -- 9.3 Carteira (só locação): taxa adm do período × anterior; ativos, atraso e saídas na data fim × semana anterior
  --     × média das 8 semanas anteriores (reconstruído); contratos novos no último trimestre
  if v_chave in ('todas', 'locacao') then
    with c as (select * from saude_carteira_em(v_fim)),
         h as (select k, s.* from generate_series(1, 8) k, lateral saude_carteira_em(v_fim - 7 * k) s),
         tri as (select
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio > (v_fim - interval '3 months')::date and data_inicio <= v_fim) as atual,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio > (v_fim - interval '6 months')::date and data_inicio <= (v_fim - interval '3 months')::date) as anterior,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio between v_ini and v_fim) as no_periodo,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio between v_ant_ini and v_ant_fim) as no_periodo_anterior)
    select jsonb_build_object(
      'taxa_adm', saude_num((v_total->'receita_referencia'->>'adm')::numeric, (v_total->'receita_referencia'->>'anterior_adm')::numeric, 'evento'),
      'intermediacao', saude_num((v_total->'receita_referencia'->>'intermediacao')::numeric,
                                 (v_total->'receita_referencia'->>'anterior_intermediacao')::numeric, 'evento', null),
      'em', (select dia from c),
      'contratos_ativos', saude_num((select contratos_ativos from c), (select contratos_ativos from h where k = 1), 'agora', false, 5,
                                    (select avg(contratos_ativos) from h), (select count(contratos_ativos) from h)::int),
      'atraso', saude_num((select atraso from c), (select atraso from h where k = 1), 'agora', true, 0,
                          (select avg(atraso) from h), (select count(atraso) from h)::int)
                || jsonb_build_object('contratos', (select atraso_contratos from c)),
      'saidas_avisadas', saude_num((select saidas_avisadas from c), (select saidas_avisadas from h where k = 1), 'agora', true, 5,
                                   (select avg(saidas_avisadas) from h), (select count(saidas_avisadas) from h)::int),
      'contratos_trimestre', saude_num(tri.atual, tri.anterior, 'evento', false, 5)
                || jsonb_build_object('regra', 'contratos novos (data de início) nos 3 meses até a data fim × 3 meses antes',
                                      'no_periodo', tri.no_periodo, 'no_periodo_anterior', tri.no_periodo_anterior))
      into v_cart from tri;
  end if;

  -- 9.4 D1 "revisada": semanas com foto dentro do período cujo placar mudou depois da foto
  select coalesce(jsonb_agg(jsonb_build_object('semana', f.semana, 'foto_em', f.tirada_em,
                                               'negocios_antes', f.placar->'negocios', 'negocios_agora', l.negocios,
                                               'valor_fechado_antes', f.placar->'valor_fechado',
                                               'valor_fechado_agora', l.vgv_venda + l.aluguel_locacao,
                                               'receita_antes', f.placar->'receita',
                                               'receita_agora', l.comissao_venda + l.taxa_adm + l.intermediacao) order by f.semana), '[]')
    into v_revisadas
    from saude_fotos f, lateral saude_linhas(f.semana, f.semana + 6, null) l
   where l.nivel = 'total' and f.semana >= v_ini and f.semana + 6 <= v_fim
     and ((f.placar->>'negocios')::int is distinct from l.negocios
          or round((f.placar->>'valor_fechado')::numeric, 2) is distinct from round(l.vgv_venda + l.aluguel_locacao, 2)
          or round((f.placar->>'receita')::numeric, 2) is distinct from round(l.comissao_venda + l.taxa_adm + l.intermediacao, 2));

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_ini, 'fim', v_fim, 'dias', v_len, 'finalidade', v_chave,
                                  'anterior_inicio', v_ant_ini, 'anterior_fim', v_ant_fim,
                                  'qualificados_parcial', v_parcial, 'qualificados_fecha_em', v_fim + 7),
    'revisadas', v_revisadas,
    'cabecalho', jsonb_build_object(
        'negocios', v_total->'negocios', 'valor_fechado', v_total->'valor_fechado',   -- manchete (24/11)
        'receita_referencia', v_total->'receita_referencia',                           -- fora da manchete, para religar depois
        'investimento', v_total->'investimento',
        'atendimentos_abertos', v_ref->'atendimentos_abertos'),
    'performance', jsonb_build_object(
        'total', coalesce(v_pagos, '{}') || jsonb_build_object('conv_plataforma', v_total->'conv_plataforma',
                                                              'impressoes', v_total->'impressoes', 'cliques', v_total->'cliques',
                                                              'ctr', v_total->'ctr', 'cpc', v_total->'cpc',
                                                              'custo_conv_plataforma', v_total->'custo_conv_plataforma'),
        'nota_impressoes', 'dashboard_meta_ads.alcance_impressoes guarda impressões, não alcance',
        'por_plataforma', coalesce(v_linhas->'plataforma', '[]'),
        'por_campanha', coalesce(v_linhas->'campanha', '[]'),
        'por_anuncio', coalesce(v_linhas->'anuncio', '[]'),            -- só Meta
        'por_midia', coalesce((select jsonb_agg(l) from jsonb_array_elements(v_linhas->'midia') l
                                where l->>'pai' = 'Campanhas pagas'), '[]')),
    'comercial', jsonb_build_object(
        'total', v_total,
        'por_finalidade', coalesce(v_linhas->'finalidade', '[]'),
        'por_canal', coalesce(v_linhas->'canal', '[]'),
        'por_midia', coalesce(v_linhas->'midia', '[]'),
        'agora', v_agora || jsonb_build_object('referencia', v_ref)),
    'carteira', coalesce(v_cart, jsonb_build_object('oculta', 'finalidade venda')),
    'midias_sociais', jsonb_build_object('status', 'aguardando captura', 'fase', '29e'),
    'ga4', jsonb_build_object('status', 'aguardando captura', 'blocos', jsonb_build_array('acessos', 'melhores páginas')),
    'leituras', jsonb_build_object(
        'crm', (select max(dia) from crm_leituras),
        'meta', (select max(data) from dashboard_meta_ads),
        'google', (select max(data) from dashboard_google_ads),
        'atividades', (select max(data_referencia) from atividades),
        'carteira', (select max(data) from contratos_locacao_fotos))
  );
end;
$$;

------------------------------------------------------------------------------------------
-- 10. Permissões: só a página e pode_ver_saude são chamáveis pelo app; o resto é interno
------------------------------------------------------------------------------------------
revoke all on function public.saude_negocios() from public, anon, authenticated;
revoke all on function public.saude_linhas(date, date, text) from public, anon, authenticated;
revoke all on function public.saude_agora(text) from public, anon, authenticated;
revoke all on function public.saude_carteira_em(date) from public, anon, authenticated;
revoke all on function public.saude_tirar_foto(date) from public, anon, authenticated;
revoke all on function public.saude_imovit(date, date, text) from public, anon;
grant execute on function public.saude_imovit(date, date, text) to authenticated;
grant execute on function public.pode_ver_saude() to authenticated;

------------------------------------------------------------------------------------------
-- 11. Agendamento: domingo 23h30 em São Paulo = segunda 02h30 UTC
------------------------------------------------------------------------------------------
select cron.schedule('saude-foto-semanal', '30 2 * * 1', $$select public.saude_tirar_foto()$$);

-- 12. Foto inicial da semana 16–22/11 (tirada na aplicação, depois do fechamento; registrado no Schema §2.22)
select public.saude_tirar_foto(date '2026-11-16');
