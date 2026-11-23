-- Saúde semanal — gabarito dos números (Fase 29a S1, Schema §2.22) — 23/11
-- Só leitura. Rode no SQL Editor do Supabase (projeto Imovit Database).
-- Semana = segunda a domingo. Troque a data em "params" pela SEGUNDA-FEIRA da semana que quer ver.
-- Valores de referência (conferidos em 23/11):
--   S-2 = 2026-11-09 (09–15/11)   ·   S-1 = 2026-11-16 (16–22/11)

------------------------------------------------------------------------------------------
-- Q1 · Placar: negócios fechados na semana  (régua: EVENTO, pela data do negócio no CRM)
-- 1 linha por codigonegocio (um atendimento pode ter 2 negócios). Só "Realizado".
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
ult as (
  select distinct on (codigo) codigo, payload
  from crm_atendimento_jornada
  where jsonb_typeof(payload->'imoveisnegocio') = 'array'
  order by codigo, id desc
),
neg as (
  select distinct on ((n->>'codigonegocio')::bigint)
         (n->>'codigonegocio')::bigint as codigonegocio,
         u.codigo as atendimento,
         to_date(left(n->>'datanegocio', 10), 'DD/MM/YYYY') as data_negocio,
         n->>'finalidade' as finalidade,
         (n->>'valornegocio')::numeric as valor,
         (n->>'valorcomissao')::numeric as comissao
  from ult u, jsonb_array_elements(u.payload->'imoveisnegocio') n
  where n->>'datanegocio' ~ '^\d{2}/\d{2}/\d{4}'
    and n->>'situacaonegocio' = 'Realizado'
  order by (n->>'codigonegocio')::bigint
)
select finalidade, count(*) as negocios, sum(valor) as valor, sum(comissao) as comissao
from neg, params p
where data_negocio between p.ini and p.ini + 6
group by finalidade;
-- S-2: 1 (Aluguel)          · S-1: 1 (Venda, R$ 1.610.000, comissão R$ 73.000)

------------------------------------------------------------------------------------------
-- Q2 · Placar: receita da semana  (régua: EVENTO)
-- = comissão bruta das VENDAS da Q1 + taxa de administração recebida na semana.
-- A intermediação aparece à parte (decisão pendente D3).
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select
  (select coalesce(sum(taxa_adm), 0) from contratos_locacao_recebimentos, params p
    where data_pagamento between p.ini and p.ini + 6) as taxa_adm,
  (select coalesce(sum(taxa_intermediacao), 0) from contratos_locacao_recebimentos, params p
    where data_pagamento between p.ini and p.ini + 6) as intermediacao_informativa;
-- receita = comissão de venda (Q1) + taxa_adm
-- S-2: 0 + 5.064,33 = R$ 5.064,33   (intermediação R$ 6.750,00)
-- S-1: 73.000 + 17.833,81 = R$ 90.833,81   (intermediação R$ 0)

------------------------------------------------------------------------------------------
-- Q3 · Aquisição: leads que chegaram ao CRM  (régua: ENTRADA)
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select count(*) as leads,
       count(*) filter (where canal = 'Campanhas pagas') as leads_pagos
from vw_atendimentos_base, params p
where not is_ruido and not is_interno
  and data_entrada between p.ini and p.ini + 6;
-- S-2: 18   · S-1: 33

------------------------------------------------------------------------------------------
-- Q4 · Aquisição: % qualificados em até 7 dias da entrada  (régua: ENTRADA, coorte)
-- Qualificado = chegou à posição ≥ 4 (fase ≥ 4 do Imoview) — 1ª vez na jornada.
-- A semana só fica completa 7 dias depois do domingo. Média: só coortes desde 12/10 (jornada começa em 06/10).
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
q as (
  select codigo, min(entrou_em::date) as quando
  from vw_jornada_etapas where posicao >= 4 group by codigo
)
select count(b.codigo) as leads,
       count(*) filter (where q.quando <= b.data_entrada + 7) as qualificados_7d,
       round(100.0 * count(*) filter (where q.quando <= b.data_entrada + 7) / nullif(count(b.codigo), 0), 1) as pct
from vw_atendimentos_base b
left join q using (codigo), params p
where not b.is_ruido and not b.is_interno
  and b.data_entrada between p.ini and p.ini + 6;
-- S-2: 4 de 18 = 22,2%   · S-1: 11 de 33 = 33,3% (PARCIAL até 29/11)

------------------------------------------------------------------------------------------
-- Q5 · Aquisição: custo por qualificado  (régua: EVENTO no gasto, ENTRADA nos qualificados)
-- gasto Meta + Google da semana ÷ qualificados em 7 dias de "Campanhas pagas" da mesma semana.
-- Com menos de 5 qualificados → "acumulando". Alternativa (D5): janela de 4 semanas.
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini, 1 as semanas),   -- troque semanas para 4 para a janela móvel
q as (select codigo, min(entrou_em::date) as quando from vw_jornada_etapas where posicao >= 4 group by codigo),
j as (select p.ini - 7 * (p.semanas - 1) as de, p.ini + 6 as ate from params p)
select
  (select coalesce(sum(investimento), 0) from dashboard_meta_ads, j where data between j.de and j.ate)
  + (select coalesce(sum(investimento), 0) from dashboard_google_ads, j where data between j.de and j.ate) as gasto,
  (select count(*) from vw_atendimentos_base b join q using (codigo), j
     where not b.is_ruido and not b.is_interno and b.canal = 'Campanhas pagas'
       and b.data_entrada between j.de and j.ate and q.quando <= b.data_entrada + 7) as qualificados_pagos;
-- 1 semana:  S-2: R$ 1.282,13 ÷ 0 → acumulando   · S-1: R$ 1.360,90 ÷ 3 = R$ 453,63 → acumulando (< 5)
-- 4 semanas: S-2: R$ 5.261,13 ÷ 6 = R$ 876,86     · S-1: R$ 5.145,76 ÷ 6 = R$ 857,63

------------------------------------------------------------------------------------------
-- Q6 · Comercial: visitas realizadas  (régua: EVENTO, pela data da visita)
-- Fonte recomendada: atividades (tipo "Visita", realizada). A jornada desloca a data quando a captura falha.
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select count(*) as visitas, count(distinct codigoatendimento) as atendimentos
from atividades, params p
where nometipo = 'Visita' and realizada
  and datahorainicio::date between p.ini and p.ini + 6;
-- S-2: 6   · S-1: 2

------------------------------------------------------------------------------------------
-- Q7 · Comercial: etapa gargalo e parados acima da mediana  (régua: AGORA)
-- Mediana = todas as passagens que entraram na etapa nas últimas 8 semanas (abertas contam com o tempo até hoje).
-- Gargalo = etapa com mais ativos parados acima da mediana.
------------------------------------------------------------------------------------------
with p as (
  select posicao, coalesce(dias, current_date - entrou_em::date) as dias
  from vw_jornada_etapas
  where entrada_conhecida and entrou_em >= current_date - 56
),
med as (
  select posicao, count(*) as n, percentile_cont(0.5) within group (order by dias) as mediana
  from p group by posicao
),
ab as (
  select j.posicao, j.codigo, current_date - j.entrou_em::date as dias_agora
  from vw_jornada_etapas j join vw_atendimentos_base b using (codigo)
  where j.como_saiu = 'em_aberto' and b.is_ativo and not b.is_ruido and not b.is_interno
)
select m.posicao, m.n as passagens, m.mediana,
       count(ab.codigo) as ativos,
       count(ab.codigo) filter (where ab.dias_agora > m.mediana) as parados
from med m left join ab using (posicao)
group by m.posicao, m.n, m.mediana
order by parados desc;
-- 23/11: posição 4 (Lead qualificado), mediana 16 dias, 83 de 98 parados → gargalo
-- S-2 e S-1: não dá para reconstruir (número "agora" sem foto guardada)

------------------------------------------------------------------------------------------
-- Q8 · Comercial: dinheiro na mesa em receita da Imovit  (régua: AGORA)
-- v1: só leads ativos em Proposta (posição 6), que têm o imóvel no CRM.
-- Venda: valor da proposta aberta (ou do imóvel) × 4,68%. Locação: 1 mês de aluguel (intermediação; D8, 23/11).
------------------------------------------------------------------------------------------
with ult as (
  select distinct on (codigo) codigo, payload from crm_atendimento_jornada
  where payload is not null order by codigo, id desc
),
p as (
  select b.codigo, im->>'finalidade' as fin, im->>'situacao' as situacao_imovel,
         replace(replace(replace(im->>'valor', 'R$ ', ''), '.', ''), ',', '.')::numeric as valor_imovel,
         (select (n->>'valorproposta')::numeric
            from jsonb_array_elements(coalesce(im->'negociacoes', '[]')) n
           where n->>'situacaonegociacao' !~* 'cancel|recus'
           order by to_timestamp(n->>'datanegociacao', 'DD/MM/YYYY HH24:MI') desc limit 1) as valor_proposta
  from vw_atendimentos_base b
  join ult u using (codigo), jsonb_array_elements(u.payload->'imoveisproposta') im
  where b.is_ativo and not b.is_ruido and not b.is_interno and b.fase_ordem = 6
)
select codigo, fin, situacao_imovel, valor_imovel, valor_proposta,
       round(case when fin = 'Venda' then coalesce(valor_proposta, valor_imovel) * 0.0468
                  else coalesce(valor_proposta, valor_imovel) end, 2) as receita_estimada
from p order by codigo;
-- 23/11: 7 propostas = R$ 363.802,80 (venda 347.302,80 + locação 16.500,00)
--        ⚠ 5716 tem imóvel "Vendido" e negociação cancelada (R$ 81.900): sem ele, R$ 281.902,80

------------------------------------------------------------------------------------------
-- Q9 · Carteira: taxa de administração recebida no mês  (régua: EVENTO, mês até o domingo)
-- Referência proposta (D9): o mês anterior até o mesmo dia.
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select
  (select sum(taxa_adm) from contratos_locacao_recebimentos, params p
    where data_pagamento between date_trunc('month', p.ini + 6)::date and p.ini + 6) as mes_ate_domingo,
  (select sum(taxa_adm) from contratos_locacao_recebimentos, params p
    where data_pagamento between (date_trunc('month', p.ini + 6) - interval '1 month')::date
                             and (p.ini + 6 - interval '1 month')::date) as mes_anterior_mesmo_dia;
-- S-2 (1–15/11): R$ 26.737,30 × out R$ 59.292,81   · S-1 (1–22/11): R$ 44.571,11 × out R$ 70.674,33

------------------------------------------------------------------------------------------
-- Q10 · Carteira: R$ em atraso  (régua: AGORA → foto do domingo)
-- Inadimplentes pela regra do Imoview, da foto diária da carteira (existe desde 11/10).
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select f.data, f.inadimplentes, f.inadimplentes_valor
from contratos_locacao_fotos f, params p
where f.data between p.ini and p.ini + 6
order by f.data desc limit 1;
-- S-2: 9 contratos, R$ 431.881,32   · S-1: 18 contratos, R$ 476.838,52

------------------------------------------------------------------------------------------
-- Q11 · Carteira: saídas avisadas  (régua: AGORA → reconstruída no domingo)
-- Contratos com aviso de desocupação até o domingo e ainda não rescindidos nesse dia.
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini)
select count(*) as avisados,
       count(*) filter (where c.data_aviso_desocupacao between p.ini and p.ini + 6) as avisos_novos_na_semana
from contratos_locacao c, params p
where c.data_aviso_desocupacao <= p.ini + 6
  and (c.data_rescisao is null or c.data_rescisao > p.ini + 6)
  and c.situacao <> 'Cancelado';
-- S-2: 10 (0 novos)   · S-1: 9 (1 novo)

------------------------------------------------------------------------------------------
-- Q12 · Referência: série semanal + semana anterior + média das N semanas anteriores (até 8)
-- Números de evento/entrada do placar, Aquisição e visitas. Para o % qualificados, ignore as
-- coortes antes de 12/10 (saem 0% porque a jornada começa em 06/10).
------------------------------------------------------------------------------------------
with s as (select generate_series(date '2026-09-14', date '2026-11-16', interval '7 days')::date as ini),
ult as (select distinct on (codigo) codigo, payload from crm_atendimento_jornada
        where jsonb_typeof(payload->'imoveisnegocio') = 'array' order by codigo, id desc),
neg as (select distinct on ((n->>'codigonegocio')::bigint)
               to_date(left(n->>'datanegocio', 10), 'DD/MM/YYYY') as dn, n->>'finalidade' as fin,
               (n->>'valorcomissao')::numeric as com
        from ult u, jsonb_array_elements(u.payload->'imoveisnegocio') n
        where n->>'datanegocio' ~ '^\d{2}/\d{2}/\d{4}' and n->>'situacaonegocio' = 'Realizado'
        order by (n->>'codigonegocio')::bigint),
b as (select codigo, data_entrada from vw_atendimentos_base where not is_ruido and not is_interno),
q as (select codigo, min(entrou_em::date) as quando from vw_jornada_etapas where posicao >= 4 group by codigo),
serie as (
  select s.ini,
    (select count(*) from neg where dn between s.ini and s.ini + 6) as negocios,
    (select coalesce(sum(com), 0) from neg where fin = 'Venda' and dn between s.ini and s.ini + 6)
      + (select coalesce(sum(taxa_adm), 0) from contratos_locacao_recebimentos
          where data_pagamento between s.ini and s.ini + 6) as receita,
    (select count(*) from b where data_entrada between s.ini and s.ini + 6) as leads,
    (select round(100.0 * count(*) filter (where q.quando <= b.data_entrada + 7) / nullif(count(*), 0), 1)
       from b left join q using (codigo) where b.data_entrada between s.ini and s.ini + 6) as pct_qualif_7d,
    (select count(*) from atividades where nometipo = 'Visita' and realizada
        and datahorainicio::date between s.ini and s.ini + 6) as visitas
  from s
)
select ini, negocios, round(receita, 2) as receita, leads, pct_qualif_7d, visitas,
  lag(negocios) over w as ant_negocios, round(avg(negocios) over w8, 2) as media_negocios,
  round(lag(receita) over w, 2) as ant_receita, round(avg(receita) over w8, 2) as media_receita,
  lag(leads) over w as ant_leads, round(avg(leads) over w8, 1) as media_leads,
  lag(visitas) over w as ant_visitas, round(avg(visitas) over w8, 1) as media_visitas
from serie
window w as (order by ini), w8 as (order by ini rows between 8 preceding and 1 preceding)
order by ini;
-- S-2: negócios 1 (ant 3, média 1,50) · receita 5.064,33 (ant 229.911,97, média 81.231,50)
--      leads 18 (ant 31, média 41,0) · visitas 6 (ant 8, média 7,1)
-- S-1: negócios 1 (ant 1, média 1,25) · receita 90.833,81 (ant 5.064,33, média 71.543,72)
--      leads 33 (ant 18, média 38,5) · visitas 2 (ant 6, média 7,6)

------------------------------------------------------------------------------------------
-- FORMATO GRANULAR (Eduardo, 23/11) — blocos 1.1 a 2.4 da página
------------------------------------------------------------------------------------------

------------------------------------------------------------------------------------------
-- Q13 · 1.1 Investimento e performance por campanha  (régua: EVENTO)
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
c as (
  select 'Meta' as plat, campanha, data, investimento::numeric as inv, alcance_impressoes as imp, cliques, leads_conversoes::numeric as conv from dashboard_meta_ads
  union all
  select 'Google', campanha, data, investimento::numeric, alcance_impressoes, cliques, leads_conversoes::numeric from dashboard_google_ads
)
select plat, campanha,
       round(sum(inv), 2) as investimento, sum(imp) as impressoes, sum(cliques) as cliques,
       round(100.0 * sum(cliques) / nullif(sum(imp), 0), 1) as ctr,
       round(sum(inv) / nullif(sum(cliques), 0), 2) as cpc,
       round(sum(conv), 1) as leads_plataforma,
       round(sum(inv) / nullif(sum(conv), 0), 2) as custo_lead_plataforma
from c, params p
where data between p.ini and p.ini + 6
group by plat, campanha
order by investimento desc;
-- S-1: Google Pesquisa Locação R$ 1.024,80 · 258 cliques · 9,7 conv · R$ 105,65
--      Meta Locação WhatsApp   R$   303,80 · 154 cliques · 20 conv  · R$ 15,19
--      Google Brand Exatos     R$    32,30 ·  93 cliques · 20,7 conv ⚠ (suspeito)
--      Total R$ 1.360,90 · 50,4 leads na plataforma

------------------------------------------------------------------------------------------
-- Q14 · 1.2 Da plataforma ao CRM  (plataforma: EVENTO · CRM: ENTRADA)
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
q as (select codigo, min(entrou_em::date) as quando from vw_jornada_etapas where posicao >= 4 group by codigo)
select
  (select round(sum(leads_conversoes)::numeric, 1) from dashboard_meta_ads, params p where data between p.ini and p.ini + 6)
  + (select round(sum(leads_conversoes)::numeric, 1) from dashboard_google_ads, params p where data between p.ini and p.ini + 6) as leads_plataforma,
  (select count(*) from vw_atendimentos_base b, params p where not b.is_ruido and not b.is_interno
     and b.canal = 'Campanhas pagas' and b.data_entrada between p.ini and p.ini + 6) as leads_pagos_crm,
  (select count(*) from vw_atendimentos_base b join q using (codigo), params p where not b.is_ruido and not b.is_interno
     and b.canal = 'Campanhas pagas' and b.data_entrada between p.ini and p.ini + 6 and q.quando <= b.data_entrada + 7) as qualificados_pagos;
-- S-1: 50,4 → 8 → 3   · custo por lead no CRM = R$ 1.360,90 ÷ 8 = R$ 170,11

------------------------------------------------------------------------------------------
-- Q15 · 1.3 Leads no CRM por canal e mídia  (régua: ENTRADA)
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
q as (select codigo, min(entrou_em::date) as quando from vw_jornada_etapas where posicao >= 4 group by codigo)
select b.canal, b.midia_raw,
       count(*) filter (where b.finalidade = 'Aluguel') as locacao,
       count(*) filter (where b.finalidade = 'Venda') as venda,
       count(*) as total,
       count(*) filter (where q.quando <= b.data_entrada + 7) as qualificados_7d
from vw_atendimentos_base b left join q using (codigo), params p
where not b.is_ruido and not b.is_interno and b.data_entrada between p.ini and p.ini + 6
group by b.canal, b.midia_raw
order by total desc;
-- S-1: Portais/OLX 10 (2) · Campanhas pagas 8 (3) · Indicação 7 (3) · Site 5 (3) · WhatsApp 2 (0) · Instagram 1 (0)

------------------------------------------------------------------------------------------
-- Q16 · 2.3 Ativos por canal  (régua: AGORA)
------------------------------------------------------------------------------------------
select canal,
       count(*) filter (where is_ativo) as ativos,
       count(*) filter (where is_ativo and dias_parado > 30) as abertos_mais_30d,
       count(*) filter (where is_ativo and fase_ordem >= 4) as ativos_qualificados
from vw_atendimentos_base
where not is_ruido and not is_interno
group by canal order by ativos desc;
-- 23/11: Indicação 60 (46) · Site 39 (26) · Portais 26 (10) · WhatsApp 24 (17) · Pagos 22 (9) · Instagram 9 (7) · Outbound 5 (4)

------------------------------------------------------------------------------------------
-- Q17 · 2.4 Canais que mais descartam  (régua: ENTRADA, coorte de 8 semanas)
-- Dos leads que ENTRARAM na janela, quantos já foram descartados (não misturar com descartes da janela).
------------------------------------------------------------------------------------------
with params as (select date '2026-11-16' as ini),
b as (select codigo, canal, is_descartado from vw_atendimentos_base, params p
      where not is_ruido and not is_interno and data_entrada between p.ini - 49 and p.ini + 6),
d as (select distinct on (codigo) codigo, motivo from vw_jornada_descartes order by codigo, descartado_em desc),
q as (select distinct codigo from vw_jornada_etapas where posicao >= 4),
top as (select distinct on (b.canal) b.canal, d.motivo, count(*) as n
        from b join d using (codigo) where b.is_descartado group by b.canal, d.motivo order by b.canal, count(*) desc)
select b.canal, count(*) as leads,
       count(*) filter (where b.is_descartado) as descartados,
       round(100.0 * count(*) filter (where b.is_descartado) / count(*)) as pct_descarte,
       count(*) filter (where q.codigo is not null) as qualificaram,
       count(*) filter (where b.is_descartado and q.codigo is not null) as perdidos_apos_qualificar,
       t.motivo || ' (' || t.n || ')' as motivo_principal
from b left join q using (codigo) left join top t on t.canal = b.canal
group by b.canal, t.motivo, t.n
order by leads desc;
-- 28/09–22/11: Pagos 79 · 76% · 15 de 20 qualificados perdidos (Não responde 24)
--              Portais 74 · 70% · 18 de 30 · WhatsApp 67 · 78% · 8 de 16 · Site 51 · 59% · 10 de 24 (Repique ⚠ 8)
--              Indicação 36 · 25% · 6 de 23