-- Fase 8 (Agendamento) nas views do funil (28/10, Fase 24 S1b, Schema §2.17).
-- O Imoview tem a fase 8 = Agendamento (doc da API, GET /Atendimento/RetornarAtendimentos).
-- Ela estava fora do nó "Montar consultas" da crm_jornada_diaria v3; desde 28/10 a jornada a lê
-- (5 ativos: 6462, 6465, 6483 aluguel; 5735, 6127 venda). Decisão do Eduardo (28/10):
-- no Hub, Agendamento conta como a etapa "Lead qualificado" (posição 4). O código cru (8)
-- continua em crm_atendimento_jornada.fase_crm e na coluna fase da view base.
-- Única mudança nas três views: "when 8 then 4" (e o rótulo na base). Mesmas colunas, mesma
-- ordem; create or replace mantém os grants atuais.
-- Efeito conhecido: na vw_jornada_etapas, a passagem 7 -> 8 vira duas linhas na posição 4
-- (a primeira sai com como_saiu = 'outro'), então o tempo em "Lead qualificado"
-- aparece dividido nesses poucos leads.

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

create or replace view public.vw_jornada_etapas
with (security_invoker = true) as
with ev as (
  select j.id, j.codigo, j.tipo, btrim(j.situacao) as situacao, j.data_evento,
    case j.fase_crm when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 8 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as posicao,
    lead(j.data_evento) over w as prox_data,
    lead(btrim(j.situacao)) over w as prox_sit,
    case lead(j.fase_crm) over w when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 8 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as prox_posicao
  from public.crm_atendimento_jornada j
  window w as (partition by j.codigo order by j.id)
)
-- uma linha por passagem por etapa (o descarte é saída, não etapa)
select
  e.codigo,
  e.posicao,
  e.data_evento as entrou_em,
  e.prox_data as saiu_em,
  e.prox_data - e.data_evento as dias,
  case
    when e.prox_data is null then 'em_aberto'
    when e.prox_sit = 'Descartado' then 'descartado'
    when e.prox_posicao > e.posicao then 'avancou'
    when e.prox_posicao < e.posicao then 'voltou'
    else 'outro'
  end as como_saiu,
  -- primeira_leitura só é chegada real quando o lead acabou de entrar no CRM (ex.: outbound que nasce qualificado)
  (e.tipo in ('entrada', 'mudanca_etapa', 'reabertura', 'encerramento')
    or (e.tipo = 'primeira_leitura'
        and (select min(a.data_de_entrada)::date from public.dashboard_atendimentos_crm a where a.codigo = e.codigo) >= e.data_evento - 2)
  ) as entrada_conhecida
from ev e
where e.situacao <> 'Descartado';

-- descartes vistos pela jornada (desde 06/10): etapa em que estavam, data e motivo.
-- O Imoview grava "ATENDIMENTO descartado motivo: <motivo padrão>, <observação livre>".
create or replace view public.vw_jornada_descartes
with (security_invoker = true) as
select
  j.codigo,
  case j.fase_crm when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 8 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as posicao,
  j.data_evento as descartado_em,
  coalesce(nullif(btrim(split_part(m.texto, ', ', 1)), ''), 'Sem motivo registrado') as motivo,
  nullif(btrim(substr(m.texto, length(split_part(m.texto, ', ', 1)) + 3)), '') as observacao
from public.crm_atendimento_jornada j
left join lateral (
  select btrim(regexp_replace(i->>'descricao', '^.*?motivo:\s*', '', 'i')) as texto
  from jsonb_array_elements(case when jsonb_typeof(j.payload->'interacoes') = 'array' then j.payload->'interacoes' else '[]'::jsonb end) i
  where i->>'descricao' ilike 'ATENDIMENTO descartado%' and i->>'datahora' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}'
  order by to_timestamp(i->>'datahora', 'DD/MM/YYYY HH24:MI') desc
  limit 1
) m on true
where j.tipo = 'encerramento' and btrim(j.situacao) = 'Descartado';
