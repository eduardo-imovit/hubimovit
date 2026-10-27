-- vw_atendimentos_base: canais depois da limpeza de mídias do CRM (27/10).
-- O Eduardo juntou as mídias no Imoview (67 -> 19). Duas são novas e caíam em "Outros":
--   'Meta Ads'    (absorveu campanha_*, campanha-meta-*, campanha_wpp_*)
--   'Lançamentos' (absorveu Campanha Halma, Casa Arborais, EntreVerdes, landing pages)
-- Antes da limpeza, todas essas iam para "Campanhas pagas"; continuam indo, para o CPL
-- (performance_leads_pagos) e o gráfico de canais seguirem comparáveis com o histórico.
-- Os nomes antigos ficam: os leads antigos continuam gravados com eles.
-- Única mudança em relação a 20261019120000: a linha de "Campanhas pagas". Mesmas colunas, mesma ordem.

create or replace view public.vw_atendimentos_base
with (security_invoker = true) as
with ult as (
  select distinct on (j.codigo) j.codigo, j.fase_crm, btrim(j.situacao) as situacao, j.data_evento, j.tipo,
    (select max(to_date(substr(i->>'datahora', 1, 10), 'DD/MM/YYYY'))
       from jsonb_array_elements(case when jsonb_typeof(j.payload->'interacoes') = 'array' then j.payload->'interacoes' else '[]'::jsonb end) i
      where i->>'descricao' ilike 'ATENDIMENTO descartado%' and i->>'datahora' ~ '^\d{2}/\d{2}/\d{4}') as data_descarte
  from public.crm_atendimento_jornada j
  order by j.codigo, j.id desc
),
norm as (
  select
    a.codigo,
    a.id,
    btrim(a.corretor) as corretor_raw,
    a.data_de_entrada::date as data_entrada,
    case
      when coalesce(u.situacao, btrim(a.situacao)) = 'Em atendimento' then null
      else coalesce(
        a.data_fechamento::date,
        case when u.situacao = 'Descartado' then u.data_descarte end,
        case when u.tipo <> 'primeira_leitura' then u.data_evento end
      )
    end as data_encerramento,
    coalesce(u.fase_crm, a.fase) as fase,
    btrim(a.funil) as funil,
    nullif(btrim(a.campanha), '') as campanha,
    btrim(a.midia) as midia_raw,
    lower(btrim(a.midia)) as midia_key,
    coalesce(u.situacao, btrim(a.situacao)) as situacao,
    btrim(a.finalidade) as finalidade
  from public.dashboard_atendimentos_crm a
  left join ult u on u.codigo = a.codigo
)
select
  codigo,
  id,
  case when corretor_raw = 'Gabriel Simon C' then 'Gabriel Simon' else corretor_raw end as corretor,
  corretor_raw = 'Desativado' as corretor_inativo,
  data_entrada,
  date_trunc('month', data_entrada::timestamptz)::date as mes_entrada,
  data_encerramento,
  finalidade,
  funil,
  situacao,
  fase,
  case fase when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 4 then 5 when 5 then 6 when 6 then 7 else null::integer end as fase_ordem,
  case fase
    when 1 then 'Pre-atendimento' when 2 then 'Selecao de perfil' when 3 then 'Selecao de imoveis'
    when 7 then 'Lead qualificado' when 4 then 'Visita' when 5 then 'Proposta' when 6 then 'Negocio'
    else null::text
  end as fase_label,
  midia_raw,
  campanha,
  case
    when midia_key = any (array['não informado', 'teste api make']) then 'Nao identificado'
    when midia_key = 'grupo olx' then 'Portais'
    when midia_key = 'indicação' then 'Indicacao'
    when midia_key like 'whatsapp-site%' or midia_key = 'wpp_site_geral' or midia_key = any (array['site da imobiliária', 'site', 'site pagina geral']) then 'Site'
    when midia_key = 'whatsapp' then 'WhatsApp'
    when midia_key = 'instagram' then 'Instagram'
    when midia_key like 'campanha%' or midia_key like 'landing page%' or midia_key like 'lp_%' or midia_key = any (array['msg_padrao_wpp_manychat', 'meta ads', 'lançamentos']) then 'Campanhas pagas'
    when midia_key = 'prospecção outbound' then 'Outbound'
    when midia_key = 'captação' then 'Captacao (interno)'
    else 'Outros'
  end as canal,
  substring(midia_key, '(\d{3,})') as id_origem_externo,
  midia_key = any (array['não informado', 'teste api make']) as is_ruido,
  midia_key = 'captação' as is_interno,
  situacao = 'Negócio realizado' as is_negocio,
  situacao = 'Descartado' as is_descartado,
  situacao = 'Em atendimento' as is_ativo,
  case when situacao = 'Negócio realizado' then 'Ganho' when situacao = 'Descartado' then 'Perdido' else null::text end as tipo_encerramento,
  data_encerramento - data_entrada as dias_ate_encerramento,
  case when situacao = 'Negócio realizado' then data_encerramento - data_entrada else null::integer end as dias_ate_ganho,
  case when situacao = 'Em atendimento' then current_date - data_entrada else null::integer end as dias_parado
from norm n;
