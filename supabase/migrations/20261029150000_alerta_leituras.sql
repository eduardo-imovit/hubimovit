-- Alerta de leitura que falhou (29/10; prioridade 3 do Pareto).
-- saude_leituras(): confere se cada leitura automática chegou no prazo.
-- Agendador "alerta-leituras": todo dia às 7h15 (SP) = 10h15 UTC chama a Edge Function
-- alerta-leituras, que manda e-mail para eduardo@ SÓ quando alguma leitura falhou.
-- Horários (combinado com o Pareto em 29/10): CRM 6h · carteira (n8n) 6h30 · receita 6h45 ·
-- alerta 7h15 · e-mail diário da Diretoria 7h30.
-- Segredos: os mesmos do agendador da carteira (Vault: carteira_agendador_chave, supabase_anon_key).

create or replace function public.saude_leituras()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  checagens as (
    select 1 as ordem, 'CRM (jornada, 6h)' as fonte,
           (select max(dia) from crm_leituras) as ultima,
           0 as tolerancia_dias,
           'n8n > crm_jornada_diaria v3 > Executions: ver o erro e rodar à mão.' as o_que_fazer
    union all
    select 2, 'Carteira de locação (6h30)',
           (select max((lido_em at time zone 'America/Sao_Paulo')::date) from contratos_locacao_fotos),
           0, 'n8n > carteira_locacao_diaria > Executions; ou Hub > Adm locação > Atualizar.'
    union all
    select 3, 'Receita: pagamentos (6h45)',
           (select max((created at time zone 'America/Sao_Paulo')::date) from net._http_response
             where status_code = 200 and content::text like '%"atualizado":true%'),
           0, 'Supabase > Edge Functions > carteira-locacao > Logs; ou Hub > Adm locação > Atualizar.'
    union all
    select 4, 'Atividades do CRM',
           (select max(inserido_em::date) from atividades),
           1, 'n8n > Coletor atividades Imoview > Executions.'
    union all
    select 5, 'Meta Ads',
           (select max(data::date) from dashboard_meta_ads),
           2, 'n8n > meta_ads > Executions (token do Meta pode ter vencido).'
    union all
    select 6, 'Google Ads',
           (select max(data::date) from dashboard_google_ads),
           2, 'n8n > fluxo do Google Ads > Executions.'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'fonte', c.fonte,
           'ultima', c.ultima,
           'ok', c.ultima is not null and c.ultima >= h.d - c.tolerancia_dias,
           'o_que_fazer', c.o_que_fazer
         ) order by c.ordem), '[]'::jsonb)
  from checagens c cross join hoje h;
$$;

revoke execute on function public.saude_leituras() from public, anon, authenticated;
grant execute on function public.saude_leituras() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'alerta-leituras';

select cron.schedule(
  'alerta-leituras',
  '15 10 * * *',
  $job$
  select net.http_post(
    url := 'https://vlsrmtryzwddqkwqugfr.supabase.co/functions/v1/alerta-leituras',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
      'x-agendador', (select decrypted_secret from vault.decrypted_secrets where name = 'carteira_agendador_chave')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
