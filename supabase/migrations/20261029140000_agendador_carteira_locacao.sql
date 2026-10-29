-- Agendador da receita da carteira de locação (29/10; prioridade 2 do Pareto).
-- Problema: os pagamentos (contratos_locacao_recebimentos, de onde sai a adm recebida) só
-- eram lidos pela Edge Function carteira-locacao quando alguém abria o Adm locação E clicava
-- em "Atualizar" (a regra das 12 h olha a foto que o n8n grava às 6h30). Última leitura: 19/10.
-- Correção: o banco chama a função todo dia às 6h45 (São Paulo) = 09h45 UTC, depois do n8n.
-- Segredos ficam no Vault (nunca no repo):
--   carteira_agendador_chave  mesma chave da secret AGENDADOR_CHAVE da Edge Function
--   supabase_anon_key         a chave anon (JWT) só para passar pelo portão das Edge Functions
-- A resposta de cada chamada fica em net._http_response (status 200 = ok).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'carteira-locacao-receita';

select cron.schedule(
  'carteira-locacao-receita',
  '45 9 * * *',
  $job$
  select net.http_post(
    url := 'https://vlsrmtryzwddqkwqugfr.supabase.co/functions/v1/carteira-locacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
      'x-agendador', (select decrypted_secret from vault.decrypted_secrets where name = 'carteira_agendador_chave')
    ),
    body := '{"forcar": true}'::jsonb,
    timeout_milliseconds := 150000
  );
  $job$
);
