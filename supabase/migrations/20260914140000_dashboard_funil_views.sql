-- vw_atendimentos_base: camada normalizada de atendimentos; toda view do dashboard lê daqui.
CREATE OR REPLACE VIEW public.vw_atendimentos_base AS
WITH norm AS (
  SELECT
    a.codigo,
    a.id,
    btrim(a.corretor)                    AS corretor_raw,
    a.data_de_entrada::date              AS data_entrada,
    a.data_fechamento::date              AS data_encerramento,
    a.fase,
    btrim(a.funil)                       AS funil,
    NULLIF(btrim(a.campanha), '')        AS campanha,
    btrim(a.midia)                       AS midia_raw,
    lower(btrim(a.midia))                AS midia_key,
    btrim(a.situacao)                    AS situacao,
    btrim(a.finalidade)                  AS finalidade
  FROM public.dashboard_atendimentos_crm a
)
SELECT
  n.codigo,
  n.id,

  -- Corretor: consolida duplicata de cadastro e marca registro nao-humano
  CASE WHEN n.corretor_raw = 'Gabriel Simon C' THEN 'Gabriel Simon'
       ELSE n.corretor_raw END                                    AS corretor,
  (n.corretor_raw = 'Desativado')                                 AS corretor_inativo,

  n.data_entrada,
  date_trunc('month', n.data_entrada)::date                       AS mes_entrada,
  n.data_encerramento,
  n.finalidade,
  n.funil,
  n.situacao,
  n.fase,

  -- Ordem real do funil: 1 > 2 > 3 > 7 > 4 > 5 > 6
  CASE n.fase WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3
              WHEN 7 THEN 4 WHEN 4 THEN 5 WHEN 5 THEN 6
              WHEN 6 THEN 7 END                                   AS fase_ordem,
  CASE n.fase WHEN 1 THEN 'Pre-atendimento'  WHEN 2 THEN 'Selecao de perfil'
              WHEN 3 THEN 'Selecao de imoveis' WHEN 7 THEN 'Lead qualificado'
              WHEN 4 THEN 'Visita'            WHEN 5 THEN 'Proposta'
              WHEN 6 THEN 'Negocio' END                           AS fase_label,

  n.midia_raw,
  n.campanha,

  -- Canal = origem do lead, nao meio de contato.
  -- whatsapp-site-* e wpp_site_geral sao cliques no botao do site: origem = Site.
  CASE
    WHEN n.midia_key IN ('não informado', 'teste api make')        THEN 'Nao identificado'
    WHEN n.midia_key = 'grupo olx'                                 THEN 'Portais'
    WHEN n.midia_key = 'indicação'                                 THEN 'Indicacao'
    WHEN n.midia_key LIKE 'whatsapp-site%'
      OR n.midia_key = 'wpp_site_geral'
      OR n.midia_key IN ('site da imobiliária','site','site pagina geral')
                                                                   THEN 'Site'
    WHEN n.midia_key = 'whatsapp'                                  THEN 'WhatsApp'
    WHEN n.midia_key = 'instagram'                                 THEN 'Instagram'
    WHEN n.midia_key LIKE 'campanha%'
      OR n.midia_key LIKE 'landing page%'
      OR n.midia_key LIKE 'lp_%'
      OR n.midia_key = 'msg_padrao_wpp_manychat'                   THEN 'Campanhas pagas'
    WHEN n.midia_key = 'prospecção outbound'                       THEN 'Outbound'
    WHEN n.midia_key = 'captação'                                  THEN 'Captacao (interno)'
    ELSE 'Outros'
  END                                                             AS canal,

  -- Preserva o ID da campanha embutido na midia para ROI por campanha no futuro
  substring(n.midia_key from '(\d{3,})')                           AS id_origem_externo,

  -- Ruido operacional: excluir de qualquer analise de canal
  (n.midia_key IN ('não informado', 'teste api make'))             AS is_ruido,
  (n.midia_key = 'captação')                                       AS is_interno,

  (n.situacao = 'Negócio realizado')                               AS is_negocio,
  (n.situacao = 'Descartado')                                      AS is_descartado,
  (n.situacao = 'Em atendimento')                                  AS is_ativo,

  -- ATENCAO: data_fechamento = encerramento do atendimento (ganho OU perdido).
  CASE WHEN n.situacao = 'Negócio realizado' THEN 'Ganho'
       WHEN n.situacao = 'Descartado'        THEN 'Perdido' END    AS tipo_encerramento,
  (n.data_encerramento - n.data_entrada)                           AS dias_ate_encerramento,
  CASE WHEN n.situacao = 'Negócio realizado'
       THEN (n.data_encerramento - n.data_entrada) END             AS dias_ate_ganho,

  -- Aging: so faz sentido para quem ainda esta em atendimento
  CASE WHEN n.situacao = 'Em atendimento'
       THEN (CURRENT_DATE - n.data_entrada) END                    AS dias_parado
FROM norm n;

-- vw_funil_acumulado: funil por finalidade e mes de entrada, com conversao etapa-a-etapa e acumulada.
CREATE OR REPLACE VIEW public.vw_funil_acumulado AS
WITH base AS (
  SELECT finalidade, mes_entrada, fase_ordem
  FROM public.vw_atendimentos_base
  WHERE NOT is_ruido
),
etapas AS (
  SELECT etapa_ordem, etapa_label
  FROM (VALUES
    (1, 'Pre-atendimento'),
    (2, 'Selecao de perfil'),
    (3, 'Selecao de imoveis'),
    (4, 'Lead qualificado'),
    (5, 'Visita'),
    (6, 'Proposta'),
    (7, 'Negocio')
  ) AS e(etapa_ordem, etapa_label)
),
combos AS (
  SELECT DISTINCT finalidade, mes_entrada FROM base
),
contagem AS (
  SELECT
    c.finalidade,
    c.mes_entrada,
    e.etapa_ordem,
    e.etapa_label,
    count(b.fase_ordem) AS leads
  FROM combos c
  CROSS JOIN etapas e
  LEFT JOIN base b
    ON b.finalidade = c.finalidade
   AND b.mes_entrada = c.mes_entrada
   AND b.fase_ordem >= e.etapa_ordem
  GROUP BY c.finalidade, c.mes_entrada, e.etapa_ordem, e.etapa_label
)
SELECT
  finalidade,
  mes_entrada,
  etapa_ordem,
  etapa_label,
  leads,
  round(100.0 * leads / NULLIF(lag(leads) OVER (PARTITION BY finalidade, mes_entrada ORDER BY etapa_ordem), 0), 1)        AS conv_etapa,
  round(100.0 * leads / NULLIF(first_value(leads) OVER (PARTITION BY finalidade, mes_entrada ORDER BY etapa_ordem), 0), 1) AS conv_acumulada
FROM contagem
ORDER BY finalidade, mes_entrada, etapa_ordem;

-- vw_origem_performance: performance de canal e campanha, funil de leads ate negocio.
CREATE OR REPLACE VIEW public.vw_origem_performance AS
SELECT
  canal,
  campanha,
  finalidade,
  count(*)                                                                        AS leads,
  count(*) FILTER (WHERE fase_ordem >= 4)                                         AS qualificados,
  count(*) FILTER (WHERE fase_ordem >= 5)                                         AS visitas,
  count(*) FILTER (WHERE fase_ordem >= 6)                                         AS propostas,
  count(*) FILTER (WHERE fase_ordem >= 7)                                         AS negocios,
  round(100.0 * count(*) FILTER (WHERE fase_ordem >= 5) / NULLIF(count(*), 0), 1) AS taxa_lead_visita,
  round(100.0 * count(*) FILTER (WHERE fase_ordem >= 7) / NULLIF(count(*), 0), 1) AS taxa_lead_negocio
FROM public.vw_atendimentos_base
WHERE NOT is_ruido
  AND NOT is_interno
GROUP BY canal, campanha, finalidade
ORDER BY leads DESC;

-- vw_corretores: carteira e desempenho por corretor ativo.
CREATE OR REPLACE VIEW public.vw_corretores AS
SELECT
  corretor,
  count(*) FILTER (WHERE is_ativo)                                                AS carteira_ativa,
  count(*)                                                                        AS total_recebido,
  count(*) FILTER (WHERE is_negocio)                                              AS negocios,
  round(100.0 * count(*) FILTER (WHERE is_negocio) / NULLIF(count(*), 0), 1)       AS taxa_conversao,
  round(avg(dias_ate_ganho) FILTER (WHERE is_negocio), 1)                          AS ciclo_medio_ganho,
  count(*) FILTER (WHERE dias_parado > 30)                                        AS leads_parados_30d
FROM public.vw_atendimentos_base
WHERE NOT is_ruido
  AND NOT corretor_inativo
GROUP BY corretor
ORDER BY total_recebido DESC;

-- vw_kpis_mensais: serie mensal de leads, negocios, conversao geral e splits.
CREATE OR REPLACE VIEW public.vw_kpis_mensais AS
SELECT
  mes_entrada,
  count(*)                                                                        AS leads_novos,
  count(*) FILTER (WHERE is_negocio)                                              AS negocios,
  round(100.0 * count(*) FILTER (WHERE is_negocio) / NULLIF(count(*), 0), 1)       AS taxa_conversao_geral,
  round(avg(dias_ate_ganho) FILTER (WHERE is_negocio), 1)                          AS ciclo_medio_ganho,
  count(*) FILTER (WHERE finalidade = 'Venda')                                    AS leads_venda,
  count(*) FILTER (WHERE finalidade = 'Aluguel')                                  AS leads_aluguel,
  round(100.0 * count(*) FILTER (WHERE finalidade = 'Venda') / NULLIF(count(*), 0), 1) AS pct_venda,
  count(*) FILTER (WHERE funil = 'Inbound (passivo)')                             AS leads_inbound,
  count(*) FILTER (WHERE funil = 'Outbound (ativo)')                              AS leads_outbound,
  round(100.0 * count(*) FILTER (WHERE funil = 'Outbound (ativo)') / NULLIF(count(*), 0), 1) AS pct_outbound,

  -- Mes corrente ainda em andamento: front deve excluir da linha de tendencia
  (mes_entrada = date_trunc('month', CURRENT_DATE)::date)                         AS is_mes_parcial
FROM public.vw_atendimentos_base
WHERE NOT is_ruido
GROUP BY mes_entrada
ORDER BY mes_entrada;

-- vw_aging_ativos: atendimentos em aberto, dias parado e faixa de aging.
CREATE OR REPLACE VIEW public.vw_aging_ativos AS
SELECT
  codigo,
  corretor,
  canal,
  finalidade,
  fase_label,
  dias_parado,
  CASE
    WHEN dias_parado <= 7  THEN '0-7'
    WHEN dias_parado <= 15 THEN '8-15'
    WHEN dias_parado <= 30 THEN '16-30'
    ELSE '31+'
  END AS faixa_aging
FROM public.vw_atendimentos_base
WHERE is_ativo
  AND NOT is_ruido
ORDER BY dias_parado DESC NULLS LAST;

-- vw_tempo_resposta: tempo (em dias) entre entrada do lead e primeira atividade registrada.
-- Cobertura parcial: so 189 dos 2208 atendimentos tem atividade ligada (ver vw_cobertura_atividades).
CREATE OR REPLACE VIEW public.vw_tempo_resposta AS
WITH atv AS (
  SELECT
    codigoatendimento,
    min(datahorainicio) AS primeira_atividade,
    count(*)            AS qtd_atividades
  FROM public.atividades
  WHERE codigoatendimento IS NOT NULL
  GROUP BY codigoatendimento
)
SELECT
  b.codigo,
  b.corretor,
  b.canal,
  b.finalidade,
  b.data_entrada,
  a.primeira_atividade,

  -- NULL quando nao ha atividade (aritmetica com NULL propaga NULL)
  (a.primeira_atividade::date - b.data_entrada) AS dias_ate_resposta,
  (a.primeira_atividade IS NOT NULL)            AS tem_atividade,
  coalesce(a.qtd_atividades, 0)                 AS qtd_atividades,

  -- 2026-05-15 = data da primeira atividade que existe no sistema (min(datahorainicio) em public.atividades).
  -- Leads entrados antes disso nunca poderiam ter atividade sincronizada: "sem atividade" ali mede o
  -- inicio da sincronizacao, nao a resposta do corretor. So confiavel a partir do corte.
  (b.data_entrada >= DATE '2026-05-15')                                             AS periodo_confiavel,
  CASE WHEN b.data_entrada >= DATE '2026-05-15'
       THEN (a.primeira_atividade::date - b.data_entrada) END                      AS dias_ate_resposta_confiavel
FROM public.vw_atendimentos_base b
LEFT JOIN atv a ON a.codigoatendimento = b.codigo
WHERE NOT b.is_ruido;

-- vw_cobertura_atividades: confiabilidade da metrica de tempo de resposta.
-- SO considera periodo_confiavel = true (entrada >= 2026-05-15, data da 1a atividade que existe no
-- sistema). Antes do corte, "sem atividade" mede inicio de sincronizacao, nao resposta do corretor
-- -- misturar os dois periodos invalida a mediana (24d misturado vs 2,5d recente / 131d antigo).
-- Distribuicao assimetrica mesmo dentro do periodo confiavel: card deve mostrar mediana + faixa, nao a media.
CREATE OR REPLACE VIEW public.vw_cobertura_atividades AS
WITH periodo AS (
  SELECT * FROM public.vw_tempo_resposta WHERE periodo_confiavel
),
fora_periodo AS (
  SELECT count(*) AS n FROM public.vw_tempo_resposta WHERE NOT periodo_confiavel
)
SELECT
  DATE '2026-05-15'                                                                AS data_corte,
  (SELECT n FROM fora_periodo)                                                     AS atendimentos_fora_periodo,
  count(*)                                                                         AS total_atendimentos_periodo,
  count(*) FILTER (WHERE tem_atividade)                                           AS com_atividade,
  round(100.0 * count(*) FILTER (WHERE tem_atividade) / NULLIF(count(*), 0), 1)    AS pct_cobertura,
  round(avg(dias_ate_resposta_confiavel) FILTER (WHERE tem_atividade), 1)          AS dias_resposta_medio,
  round(
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_ate_resposta_confiavel) FILTER (WHERE tem_atividade))::numeric, 1
  )                                                                                 AS dias_resposta_mediana,
  round(
    (percentile_cont(0.25) WITHIN GROUP (ORDER BY dias_ate_resposta_confiavel) FILTER (WHERE tem_atividade))::numeric, 1
  )                                                                                 AS dias_resposta_p25,
  round(
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY dias_ate_resposta_confiavel) FILTER (WHERE tem_atividade))::numeric, 1
  )                                                                                 AS dias_resposta_p75,
  round(100.0 * count(*) FILTER (WHERE tem_atividade AND dias_ate_resposta_confiavel <= 7)
        / NULLIF(count(*) FILTER (WHERE tem_atividade), 0), 1)                     AS pct_ate_7d,
  round(100.0 * count(*) FILTER (WHERE tem_atividade AND dias_ate_resposta_confiavel > 30)
        / NULLIF(count(*) FILTER (WHERE tem_atividade), 0), 1)                     AS pct_acima_30d
FROM periodo;

-- vw_descartes: em qual fase o lead foi descartado, por finalidade (alimenta grafico "onde os leads morrem").
CREATE OR REPLACE VIEW public.vw_descartes AS
WITH descartados AS (
  SELECT finalidade, fase_ordem, fase_label
  FROM public.vw_atendimentos_base
  WHERE is_descartado
    AND NOT is_ruido
)
SELECT
  fase_ordem,
  fase_label,
  finalidade,
  count(*)                                                                                AS qtd,
  round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (PARTITION BY finalidade), 0), 1)     AS pct_do_total
FROM descartados
GROUP BY fase_ordem, fase_label, finalidade
ORDER BY fase_ordem;

-- ================== QUERIES DE TESTE (uma por view) ==================

-- Teste vw_atendimentos_base
SELECT
  count(*)                                AS total,
  count(*) FILTER (WHERE is_ruido)        AS ruido,
  count(*) FILTER (WHERE is_interno)      AS interno
FROM public.vw_atendimentos_base;

-- Teste vw_funil_acumulado
SELECT finalidade, mes_entrada, etapa_ordem, etapa_label, leads, conv_etapa, conv_acumulada
FROM public.vw_funil_acumulado
ORDER BY finalidade, mes_entrada DESC, etapa_ordem
LIMIT 14;

-- Teste vw_origem_performance
SELECT canal, campanha, finalidade, leads, qualificados, visitas, propostas, negocios, taxa_lead_visita, taxa_lead_negocio
FROM public.vw_origem_performance
ORDER BY leads DESC
LIMIT 10;

-- Teste vw_corretores
SELECT corretor, carteira_ativa, total_recebido, negocios, taxa_conversao, ciclo_medio_ganho, leads_parados_30d
FROM public.vw_corretores
ORDER BY total_recebido DESC
LIMIT 10;

-- Teste vw_kpis_mensais
SELECT mes_entrada, leads_novos, negocios, taxa_conversao_geral, ciclo_medio_ganho,
       leads_venda, leads_aluguel, pct_venda, leads_inbound, leads_outbound, pct_outbound,
       is_mes_parcial
FROM public.vw_kpis_mensais
ORDER BY mes_entrada DESC
LIMIT 12;

-- Teste vw_aging_ativos
SELECT codigo, corretor, canal, finalidade, fase_label, dias_parado, faixa_aging
FROM public.vw_aging_ativos
ORDER BY dias_parado DESC NULLS LAST
LIMIT 10;

-- Teste vw_tempo_resposta
SELECT codigo, corretor, canal, finalidade, data_entrada, primeira_atividade, dias_ate_resposta,
       tem_atividade, qtd_atividades, periodo_confiavel, dias_ate_resposta_confiavel
FROM public.vw_tempo_resposta
ORDER BY tem_atividade DESC, dias_ate_resposta
LIMIT 10;

-- Teste vw_cobertura_atividades
SELECT data_corte, atendimentos_fora_periodo, total_atendimentos_periodo, com_atividade, pct_cobertura,
       dias_resposta_medio, dias_resposta_mediana, dias_resposta_p25, dias_resposta_p75,
       pct_ate_7d, pct_acima_30d
FROM public.vw_cobertura_atividades;

-- Teste vw_descartes
SELECT fase_ordem, fase_label, finalidade, qtd, pct_do_total
FROM public.vw_descartes
ORDER BY finalidade, fase_ordem;
