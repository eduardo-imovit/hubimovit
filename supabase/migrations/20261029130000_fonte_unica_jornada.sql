-- Fonte única dos atendimentos: a jornada (Fase 24, S3a; Schema §2.17). 29/10.
-- Conferido antes (S2, em BEGIN … ROLLBACK): a v2 só acrescenta leads (3.048 → 5.194),
-- ativos +16 (os invisíveis do achado A7 + fase 8), negócios conferidos no CRM (1292, 2969, 6241).
-- Partes:
--   A. meus_codigos_crm(): códigos cuja ÚLTIMA linha na jornada é do corretor logado
--   B. RLS do corretor (jornada, atividades, leads_wpp_gtm) por meus_codigos_crm()
--      Antes: jornada por linha (o corretor anterior via as linhas antigas de um lead transferido)
--      e atividades/leads pela tabela antiga (lead novo ficaria sem atividades e telefone).
--   C. vw_atendimentos_base com o corpo da v2 (mesmas colunas e ordem)
--   D. vw_jornada_etapas: data de entrada pelo payload, sem a tabela antiga
--   E. kpis_tv: 'crm_atualizado_ate' = última leitura (crm_leituras)
-- A tabela dashboard_atendimentos_crm continua existindo e sendo lida só como reserva
-- (data de entrada, data de fechamento e id dos leads antigos).

-- A
create or replace function public.meus_codigos_crm()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.codigo
  from (
    select distinct on (j.codigo) j.codigo, j.corretor
    from crm_atendimento_jornada j
    order by j.codigo, j.id desc
  ) u
  where lower(nome_corretor_crm(u.corretor)) = lower(meu_nome_crm());
$$;

revoke execute on function public.meus_codigos_crm() from public, anon;
grant execute on function public.meus_codigos_crm() to authenticated;

-- B
drop policy if exists "equipe le; corretor so os seus" on public.crm_atendimento_jornada;
create policy "equipe le; corretor so os seus" on public.crm_atendimento_jornada
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or codigo in (select meus_codigos_crm())
    )
  );

drop policy if exists "equipe le; corretor so os seus" on public.atividades;
create policy "equipe le; corretor so os seus" on public.atividades
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or lower(nomeusuario) = lower((select meu_nome_crm()))
      or codigoatendimento in (select meus_codigos_crm())
    )
  );

drop policy if exists "equipe le; corretor so os seus" on public.leads_wpp_gtm;
create policy "equipe le; corretor so os seus" on public.leads_wpp_gtm
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or codigo_atendimento in (select c::text from meus_codigos_crm() c)
    )
  );

-- C
create or replace view public.vw_atendimentos_base
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

-- D
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
),
-- data de entrada do CRM (antes vinha da dashboard_atendimentos_crm)
pay as (
  select distinct on (j.codigo) j.codigo,
    to_date(substr(j.payload->>'datahoraentradalead', 1, 10), 'DD/MM/YYYY') as data_entrada
  from public.crm_atendimento_jornada j
  where j.payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4}'
  order by j.codigo, j.id desc
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
        and p.data_entrada >= e.data_evento - 2)
  ) as entrada_conhecida
from ev e
left join pay p on p.codigo = e.codigo
where e.situacao <> 'Descartado';

-- E
CREATE OR REPLACE FUNCTION public.kpis_tv()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_meta_90d integer;
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
           filter (where is_negocio and data_encerramento >= v_hoje - 365 and dias_ate_ganho >= 0),
         round(count(*) filter (where data_entrada > v_hoje - 90 and data_entrada <= v_hoje) / 3.0)::integer
    into v_leads_mes, v_leads_30d, v_media_3m, v_neg_mes, v_neg_media_3m,
         v_safra_leads, v_safra_neg, v_ant_leads, v_ant_neg, v_ciclo, v_meta_90d
    from vw_atendimentos_base
   where not is_ruido and not is_interno;

  return jsonb_build_object(
    'mes_referencia', v_mes,
    'atualizado_em', now(),
    -- desde 29/10: dia da última leitura do CRM pela jornada (antes: última entrada na tabela antiga)
    'crm_atualizado_ate', (select max(dia) from crm_leituras),
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
      'ciclo_mediano_12m', round(v_ciclo::numeric),
      -- meta oficial da TV a partir de 25/09: média mensal dos últimos 90 dias corridos
      'meta_leads_90d', v_meta_90d
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
$function$;
