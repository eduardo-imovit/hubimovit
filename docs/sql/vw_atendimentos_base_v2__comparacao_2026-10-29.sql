-- NÃO É MIGRATION: view usada só na comparação da Fase 24 (S2), sempre dentro de BEGIN … ROLLBACK.
-- O corpo dela virou a vw_atendimentos_base oficial na migration 20261029130000_fonte_unica_jornada.
-- vw_atendimentos_base_v2: a view base lendo SÓ a jornada (Fase 24, S2; Schema §2.17). 29/10.
-- Fica AO LADO da oficial, sem uso por nenhuma tela, para comparar número a número.
-- Mesmas colunas e mesma ordem da vw_atendimentos_base (versão 20261028120000).
-- De onde vem cada coluna:
--   lista de leads ........ todos os códigos de crm_atendimento_jornada
--   fase, situação ......... última linha da jornada (igual à oficial)
--   corretor, mídia, finalidade, funil, campanha ... última linha da jornada; reserva: tabela antiga
--   data de entrada ........ payload.datahoraentradalead (última linha com o campo);
--                            reserva: tabela antiga; depois: evento 'entrada' da jornada
--   data de encerramento ... a mesma ordem da oficial, com a interação "NEGÓCIO REALIZADO"
--                            como reserva para negócios que a tabela antiga não tem
--   id ..................... id da tabela antiga (nulo para lead só da jornada; as telas usam o código)
-- Privada até a troca (S3): nenhum papel do app lê.

create or replace view public.vw_atendimentos_base_v2
with (security_invoker = true) as
with ult as (
  select distinct on (j.codigo)
    j.codigo, j.fase_crm, btrim(j.situacao) as situacao, j.data_evento, j.tipo,
    nullif(btrim(j.corretor), '') as corretor, nullif(btrim(j.midia), '') as midia,
    nullif(btrim(j.finalidade), '') as finalidade, nullif(btrim(j.funil), '') as funil,
    nullif(btrim(j.campanha), '') as campanha,
    (select max(to_date(substr(i->>'datahora', 1, 10), 'DD/MM/YYYY'))
       from jsonb_array_elements(case when jsonb_typeof(j.payload->'interacoes') = 'array' then j.payload->'interacoes' else '[]'::jsonb end) i
      where i->>'descricao' ilike 'ATENDIMENTO descartado%' and i->>'datahora' ~ '^\d{2}/\d{2}/\d{4}') as data_descarte,
    (select max(to_date(substr(i->>'datahora', 1, 10), 'DD/MM/YYYY'))
       from jsonb_array_elements(case when jsonb_typeof(j.payload->'interacoes') = 'array' then j.payload->'interacoes' else '[]'::jsonb end) i
      where i->>'descricao' ilike 'NEG%CIO REALIZADO%' and i->>'datahora' ~ '^\d{2}/\d{2}/\d{4}') as data_negocio
  from public.crm_atendimento_jornada j
  order by j.codigo, j.id desc
),
pay as (
  select distinct on (j.codigo) j.codigo,
    to_date(substr(j.payload->>'datahoraentradalead', 1, 10), 'DD/MM/YYYY') as data_entrada
  from public.crm_atendimento_jornada j
  where j.payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4}'
  order by j.codigo, j.id desc
),
ent as (
  select j.codigo, min(j.data_evento) as data_entrada
  from public.crm_atendimento_jornada j
  where j.tipo = 'entrada'
  group by j.codigo
),
norm as (
  select
    u.codigo,
    a.id,
    coalesce(u.corretor, btrim(a.corretor)) as corretor_raw,
    coalesce(p.data_entrada, a.data_de_entrada::date, e.data_entrada) as data_entrada,
    case
      when u.situacao = 'Em atendimento' then null
      else coalesce(
        a.data_fechamento::date,
        case when u.situacao = 'Negócio realizado' then u.data_negocio end,
        case when u.situacao = 'Descartado' then u.data_descarte end,
        case when u.tipo <> 'primeira_leitura' then u.data_evento end
      )
    end as data_encerramento,
    u.fase_crm as fase,
    coalesce(u.funil, btrim(a.funil)) as funil,
    coalesce(u.campanha, nullif(btrim(a.campanha), '')) as campanha,
    coalesce(u.midia, btrim(a.midia)) as midia_raw,
    lower(coalesce(u.midia, btrim(a.midia))) as midia_key,
    u.situacao,
    coalesce(u.finalidade, btrim(a.finalidade)) as finalidade
  from ult u
  left join pay p on p.codigo = u.codigo
  left join ent e on e.codigo = u.codigo
  left join public.dashboard_atendimentos_crm a on a.codigo = u.codigo
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
  case fase when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 8 then 4 when 4 then 5 when 5 then 6 when 6 then 7 else null::integer end as fase_ordem,
  case fase
    when 1 then 'Pre-atendimento' when 2 then 'Selecao de perfil' when 3 then 'Selecao de imoveis'
    when 7 then 'Lead qualificado' when 8 then 'Lead qualificado' when 4 then 'Visita' when 5 then 'Proposta' when 6 then 'Negocio'
    else null::text
  end as fase_label,
  midia_raw,
  campanha,
  case
    when midia_key = any (array['não informado', 'teste api make']) then 'Nao identificado'
    when midia_key = 'grupo olx' then 'Portais'
    when midia_key = any (array['indicação', 'indicação banco pine']) then 'Indicacao'
    when midia_key like 'whatsapp-site%' or midia_key = any (array['wpp_site_geral', 'wpp_pag_imovel', 'site-wpp', 'site da imobiliária', 'site', 'site pagina geral', 'site pagina imovel', 'site_imovel']) then 'Site'
    when midia_key = any (array['whatsapp', 'wpp_nao_identificado', 'severino', 'severino_desconhecido', 'chatbot imoview']) then 'WhatsApp'
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

revoke all on public.vw_atendimentos_base_v2 from anon, authenticated;
