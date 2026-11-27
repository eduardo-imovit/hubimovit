-- Vigia de dados: uma linha por fonte automática, dizendo se o dado de hoje chegou.
-- 27/11/2026 (Asimov, a pedido do Brooks). Fase 31 do plano. Schema: docs/05-backend-schema.md §2.25.
-- STATUS: APLICADA em 27/11/2026 (versão 20261127134546), com OK do Eduardo.
--
-- Por que existe:
--   A jornada do CRM ficou sem rodar de 18 a 22/11 e ninguém percebeu; as fotos daqueles dias se
--   perderam. O fluxo n8n "Vigia de dados · 7h30" chama esta função pela API (service_role) e manda
--   UM e-mail só com as fontes atrasadas. Tudo ok = nenhum e-mail.
--
-- Régua de cada fonte (calibrada pelo histórico de 01/09 a 27/11/2026):
--   CRM (crm_leituras.dia)                  diária, inclusive fim de semana (roda 6h) → espera o dia de hoje
--   Atividades (max(data_referencia))       fim de semana e feriado têm 0–3 atividades (21/11 teve 0; 07/09 teve 0)
--                                           → espera atividade em um dos 2 últimos dias úteis (seg–sex). A falha
--                                           do Imoview aparece antes no CRM, que tem a régua de 0 dia.
--   Fotos da carteira (fotos.data)          diária (n8n 6h30) → hoje
--   Receita: pagamentos (receb.lido_em)     diária (Edge 6h45; o upsert regrava o lido_em da janela) → hoje
--   Estoque (estoque_cargas.feita_em)       diária (≈ 1h40 de SP) → hoje. Parado desde 24/11 (fluxo não migrado).
--   Leads do Severino (leads_wpp_gtm)       maior intervalo real em 120 dias: 52h44; p99 47h → 60 h sem lead
--   Google Ads / Meta Ads (data)            o dado de ontem chega de madrugada; nunca faltou 1 dia → D-2
--   Orgânico Instagram (organico_diario)    DESLIGADA pelo parâmetro p_desligar (fluxo pausado por decisão)
--   imoview_sessao                          sem campo de erro (só obtido_em/usado_em/logins) → fora do vigia
--
-- Ligar/desligar uma fonte sem migration: o n8n pode mandar {"p_desligar": [...]} no corpo da RPC.
-- Sem corpo, vale o padrão abaixo (só o orgânico desligado).
-- Acesso: security definer; EXECUTE só para service_role (n8n). Só lê; não grava nada.

create or replace function public.vigia_fontes(
  p_desligar text[] default array['organico_instagram']
)
returns table (
  chave        text,
  fonte        text,
  ligada       boolean,
  ultimo_dado  timestamptz,
  esperado_ate timestamptz,
  atrasada     boolean,
  detalhe      text,
  onde_olhar   text
)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select now() as agora,
           (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  -- 2º dia útil (seg–sex) antes de hoje. Ex.: sexta → quarta; segunda → quinta; terça → sexta.
  util as (
    select (select g::date
              from generate_series(p.hoje - 10, p.hoje - 1, interval '1 day') g
             where extract(isodow from g) < 6
             order by g desc
             offset 1 limit 1) as d2
    from p
  ),
  -- meia-noite de São Paulo de uma data
  f as (
    select 1 as ordem, 'crm' as chave, 'CRM: jornada (6h)' as fonte, true as so_dia,
           (select (max(dia)::timestamp at time zone 'America/Sao_Paulo') from crm_leituras) as ultimo,
           (p.hoje::timestamp at time zone 'America/Sao_Paulo') as esperado,
           'diária, inclusive fim de semana' as regra,
           'n8n ▸ crm_jornada_diaria ▸ Executions; rodar à mão no mesmo dia (a foto do dia não volta depois)' as onde
      from p
    union all
    select 2, 'atividades', 'Atividades do CRM', true,
           (select (max(data_referencia)::timestamp at time zone 'America/Sao_Paulo') from atividades),
           (u.d2::timestamp at time zone 'America/Sao_Paulo'),
           'espera atividade em um dos 2 últimos dias úteis',
           'n8n ▸ Coletor atividades ▸ Executions; a execução manual recarrega 7 dias'
      from p, util u
    union all
    select 3, 'carteira_fotos', 'Carteira de locação: foto do dia (6h30)', true,
           (select (max(data)::timestamp at time zone 'America/Sao_Paulo') from contratos_locacao_fotos),
           (p.hoje::timestamp at time zone 'America/Sao_Paulo'),
           'diária',
           'n8n ▸ carteira_locacao_diaria ▸ Executions; rodar à mão até 21h (a foto do dia não volta depois)'
      from p
    union all
    select 4, 'carteira_receita', 'Receita: pagamentos (6h45)', false,
           (select max(lido_em) from contratos_locacao_recebimentos),
           (p.hoje::timestamp at time zone 'America/Sao_Paulo'),
           'diária',
           'Supabase ▸ Edge Functions ▸ carteira-locacao ▸ Logs; ou Hub ▸ Adm locação ▸ Atualizar'
      from p
    union all
    select 5, 'estoque', 'Estoque de imóveis', false,
           (select max(feita_em) from estoque_cargas),
           (p.hoje::timestamp at time zone 'America/Sao_Paulo'),
           'diária (madrugada)',
           'n8n ▸ estoque_imoveis_diario ▸ Executions'
      from p
    union all
    select 6, 'leads_severino', 'Leads do Severino (WhatsApp)', false,
           (select max(created_at) from leads_wpp_gtm),
           p.agora - interval '60 hours',
           'alerta com 60 h sem nenhum lead (maior intervalo real: 52 h)',
           'n8n ▸ wpp_entrada ▸ Executions; conferir se o Severino está respondendo'
      from p
    union all
    select 7, 'google_ads', 'Google Ads', true,
           (select (max(data)::timestamp at time zone 'America/Sao_Paulo') from dashboard_google_ads),
           ((p.hoje - 2)::timestamp at time zone 'America/Sao_Paulo'),
           'tolerância D-2',
           'n8n ▸ google_ads ▸ Executions'
      from p
    union all
    select 8, 'meta_ads', 'Meta Ads', true,
           (select (max(data)::timestamp at time zone 'America/Sao_Paulo') from dashboard_meta_ads),
           ((p.hoje - 2)::timestamp at time zone 'America/Sao_Paulo'),
           'tolerância D-2',
           'n8n ▸ meta_ads ▸ Executions (o token do Meta pode ter vencido)'
      from p
    union all
    select 9, 'organico_instagram', 'Orgânico: Instagram', true,
           (select (max(data)::timestamp at time zone 'America/Sao_Paulo') from organico_diario where rede = 'instagram'),
           ((p.hoje - 2)::timestamp at time zone 'America/Sao_Paulo'),
           'tolerância D-2',
           'n8n ▸ organico_meta ▸ Executions'
      from p
  ),
  r as (
    select f.*,
           not (f.chave = any (coalesce(p_desligar, '{}'::text[]))) as lig,
           case when f.so_dia then 'DD/MM' else 'DD/MM HH24:MI' end as fmt
      from f
  )
  select r.chave,
         r.fonte,
         r.lig,
         r.ultimo,
         r.esperado,
         r.lig and (r.ultimo is null or r.ultimo < r.esperado),
         case
           when not r.lig then
             'Desligada no vigia. Último dado: '
             || coalesce(to_char(r.ultimo at time zone 'America/Sao_Paulo', r.fmt), 'nenhum') || '.'
           when r.ultimo is null then
             'Nenhum dado na tabela. Regra: ' || r.regra || '.'
           when r.ultimo < r.esperado then
             'Último dado: ' || to_char(r.ultimo at time zone 'America/Sao_Paulo', r.fmt)
             || '; esperado a partir de ' || to_char(r.esperado at time zone 'America/Sao_Paulo', r.fmt)
             || ' (' || r.regra || ').'
           else
             'OK. Último dado: ' || to_char(r.ultimo at time zone 'America/Sao_Paulo', r.fmt) || '.'
         end,
         r.onde
    from r
   order by r.ordem;
$$;

comment on function public.vigia_fontes(text[]) is
  'Vigia de dados (Fase 31): uma linha por fonte automática com ultimo_dado, esperado_ate e atrasada. '
  'Chamada pelo n8n "Vigia de dados · 7h30". Só service_role. Schema §2.25.';

revoke execute on function public.vigia_fontes(text[]) from public, anon, authenticated;
grant execute on function public.vigia_fontes(text[]) to service_role;
