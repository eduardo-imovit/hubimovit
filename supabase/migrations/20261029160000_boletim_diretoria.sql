-- E-mail diário da Diretoria, v1 (PRD §5.19, bloco "E-mail diário"; aprovado pelo Eduardo em 29/10).
-- boletim_diretoria(): calcula no banco os números do e-mail (placar do mês, ontem, atenção, leituras).
-- boletim_diretoria_fotos: guarda o que foi enviado em cada dia (base da variação "vs ontem").
-- Agendador "boletim-diretoria": segunda a sexta, 7h30 (SP) = 10h30 UTC, chama a Edge Function
-- boletim-diretoria (envio pelo Brevo para daniel@, gabriel@ e eduardo@).
-- ATENÇÃO: no Supabase a função tem o nome "boletim-diretoria", mas o ENDEREÇO (slug) ficou
-- "rapid-worker" (nome automático do editor na criação; não dá para mudar). O job usa o endereço.
-- Regras (PRD §5.19):
--   placar: mês até ontem × mês anterior até o mesmo dia; "Em atendimento" = agora.
--   ontem: o dia anterior; na segunda, sexta + sábado + domingo (ajuste de 29/10: o PRD dizia
--          só sábado e domingo, e a sexta ficava sem e-mail).
--   esquecido 🔴: ativo parado na etapa além do prazo (locação 3 dias, venda 7), sem atividade
--          realizada no prazo e sem atividade agendada. Ainda sem as interações do CRM.
--   perto do dinheiro: esquecidos em Visita ou Proposta.
--   sem ruído e sem captação interna (mesma regra dos painéis).

create table if not exists public.boletim_diretoria_fotos (
  dia        date primary key,
  dados      jsonb not null,
  enviado_em timestamptz not null default now()
);
alter table public.boletim_diretoria_fotos enable row level security;
revoke all on public.boletim_diretoria_fotos from anon, authenticated;

create or replace function public.boletim_diretoria(p_hoje date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date);
  v_ontem_fim date := v_hoje - 1;
  v_ontem_ini date := case when extract(isodow from v_hoje) = 1 then v_hoje - 3 else v_hoje - 1 end;
  v_mes_ini date := date_trunc('month', v_hoje - 1)::date;
  v_ant_ini date := (date_trunc('month', v_hoje - 1) - interval '1 month')::date;
  v_ant_fim date;
  r jsonb;
begin
  v_ant_fim := least(v_ant_ini + (v_ontem_fim - v_mes_ini), v_mes_ini - 1);

  with base as (
    select * from vw_atendimentos_base where not coalesce(is_ruido, false) and not coalesce(is_interno, false)
  ),
  periodo as (
    select 'mes' as p, v_mes_ini as ini, v_ontem_fim as fim
    union all select 'anterior', v_ant_ini, v_ant_fim
  ),
  placar as (
    select p.p,
      (select coalesce(sum(investimento), 0) from dashboard_meta_ads where data::date between p.ini and p.fim)
        + (select coalesce(sum(investimento), 0) from dashboard_google_ads where data::date between p.ini and p.fim) as investido,
      (select count(*) from base where data_entrada between p.ini and p.fim) as leads,
      (select count(*) from base where is_negocio and data_encerramento between p.ini and p.fim) as negocios,
      (select coalesce(sum(taxa_adm), 0) from contratos_locacao_recebimentos where data_pagamento between p.ini and p.fim) as adm,
      (select coalesce(sum(taxa_intermediacao), 0) from contratos_locacao_recebimentos where data_pagamento between p.ini and p.fim) as intermediacao,
      (select count(distinct codigo_contrato) from contratos_locacao_recebimentos
        where data_pagamento between p.ini and p.fim and coalesce(taxa_intermediacao, 0) > 0) as intermediacao_contratos
    from periodo p
  ),
  -- dias na etapa: só eventos de etapa (mesma conta da página de Atendimento; ajuste do Pareto, 29/10).
  -- Lead só com primeira_leitura fica sem data = "23+ dias" (conta como além do prazo).
  ult as (
    select codigo, max(data_evento) as desde from crm_atendimento_jornada
    where tipo in ('entrada', 'mudanca_etapa', 'reabertura')
    group by codigo
  ),
  ativos as (
    select b.codigo, b.finalidade, b.fase_ordem,
           v_hoje - u.desde as dias_na_etapa,
           case when b.finalidade = 'Venda' then 7 else 3 end as prazo
    from base b left join ult u on u.codigo = b.codigo
    where b.is_ativo
  ),
  esquecidos as (
    select a.* from ativos a
    where coalesce(a.dias_na_etapa, 999) > a.prazo
      and not exists (select 1 from atividades t where t.codigoatendimento = a.codigo and t.realizada
                        and t.datahorainicio::date >= v_hoje - a.prazo)
      and not exists (select 1 from atividades t where t.codigoatendimento = a.codigo and not t.realizada
                        and t.datahorainicio::date >= v_hoje)
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'ontem', jsonb_build_object('ini', v_ontem_ini, 'fim', v_ontem_fim),
    'mes', jsonb_build_object('ini', v_mes_ini, 'fim', v_ontem_fim),
    'anterior', jsonb_build_object('ini', v_ant_ini, 'fim', v_ant_fim),
    'placar', (select jsonb_object_agg(p, to_jsonb(placar) - 'p') from placar),
    'em_atendimento', (select count(*) from ativos),
    'captacoes_ativas', (select count(*) from vw_atendimentos_base where is_ativo and coalesce(is_interno, false)),
    'ontem_numeros', jsonb_build_object(
      'leads_aluguel', (select count(*) from base where finalidade = 'Aluguel' and data_entrada between v_ontem_ini and v_ontem_fim),
      'leads_venda', (select count(*) from base where finalidade = 'Venda' and data_entrada between v_ontem_ini and v_ontem_fim),
      'mudancas_etapa', (select count(*) from crm_atendimento_jornada
                          where tipo = 'mudanca_etapa' and data_evento between v_ontem_ini and v_ontem_fim),
      'propostas_novas', (select count(*) from crm_atendimento_jornada
                           where fase_crm = 5 and coalesce(fase_anterior, 0) <> 5
                             and tipo in ('mudanca_etapa', 'reabertura') and data_evento between v_ontem_ini and v_ontem_fim),
      'negocios', (select count(*) from base where is_negocio and data_encerramento between v_ontem_ini and v_ontem_fim),
      'avisos_rescisao', (select count(*) from contratos_locacao where data_aviso_desocupacao between v_ontem_ini and v_ontem_fim)
    ),
    'atencao', jsonb_build_object(
      'esquecidos', (select count(*) from esquecidos),
      'perto_do_dinheiro', (select count(*) from esquecidos where fase_ordem in (5, 6)),
      'perto_proposta', (select count(*) from esquecidos where fase_ordem = 6),
      'perto_visita', (select count(*) from esquecidos where fase_ordem = 5)
    ),
    'leituras', saude_leituras()
  ) into r;

  return r;
end;
$$;

revoke execute on function public.boletim_diretoria(date) from public, anon, authenticated;
grant execute on function public.boletim_diretoria(date) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'boletim-diretoria';

select cron.schedule(
  'boletim-diretoria',
  '30 10 * * 1-5',
  $job$
  select net.http_post(
    url := 'https://vlsrmtryzwddqkwqugfr.supabase.co/functions/v1/rapid-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
      'x-agendador', (select decrypted_secret from vault.decrypted_secrets where name = 'carteira_agendador_chave')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
