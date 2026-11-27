-- Fase 29b — conserto da conciliação GTM × CRM (24/11, Asimov). Aplicada em 25/11 (OK do Eduardo, opção a: filtro created_at >= 2026-10-19).
-- Diagnóstico (handoff 24/11): o nó "Gravar atendimento Imoview" do wpp_entrada nunca gravou
-- (0 PATCH em leads_wpp_gtm desde 23/11 14:09 UTC). Esta migration:
--   1. cria a coluna imoview_vinculo (como a ligação foi feita, para separar certeza de estimativa);
--   2. liga as linhas antigas do Severino ao atendimento do CRM por duas regras de horário
--      (só quando há exatamente 1 candidato dos dois lados).
-- O conserto para os leads novos é no n8n (docs/n8n/wpp_entrada__v2_29b.md); esta migration só cobre o histórico.

-- 1. Coluna nova
alter table public.leads_wpp_gtm
  add column if not exists imoview_vinculo text;   -- 'n8n' (gravado pelo fluxo) | 'backfill_entrada' | 'backfill_atividade'

comment on column public.leads_wpp_gtm.imoview_vinculo is
  'como imoview_atendimento foi preenchido: n8n (fluxo wpp_entrada) | backfill_entrada (atendimento novo no mesmo horário) | backfill_atividade (atividade no lead existente no mesmo horário, 1º nome igual)';

-- 2. Backfill do histórico
with crm as (           -- hora de entrada de cada atendimento (horário de Brasília, como o Imoview grava)
  select distinct on (codigo)
         codigo,
         to_timestamp(payload->>'datahoraentradalead', 'DD/MM/YYYY HH24:MI')::timestamp as entrada_brt,
         midia
    from public.crm_atendimento_jornada
   where payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}'
   order by codigo, id desc
),
sev as (                -- leads do Severino ainda sem atendimento
  select lead_id, nome, (created_at at time zone 'America/Sao_Paulo') as brt
    from public.leads_wpp_gtm
   where origem_registro = 'bot_severino'
     and imoview_atendimento is null
     and created_at >= '2026-10-19'   -- só a janela revisada em 24/11 (os 41 leads de antes ficam para revisão futura)
),
-- Regra 1: o wpp_entrada criou atendimento novo (IncluirLead) entre 2 min antes e 5 min depois,
--          com uma das mídias que só ele usa (campanha_*, wpp_*, site_*).
--          Par aceito só se for o mais próximo dos dois lados ("vizinho mútuo") e sem empate.
c1 as (
  select s.lead_id, c.codigo,
         abs(extract(epoch from c.entrada_brt - date_trunc('minute', s.brt))) as dist
    from sev s
    join crm c
      on c.entrada_brt between date_trunc('minute', s.brt) - interval '2 min' and s.brt + interval '5 min'
     and lower(c.midia) ~ '^(campanha_|wpp_|site_)'
),
r1 as (
  select lead_id, codigo
    from (select c1.*,
                 rank() over (partition by lead_id order by dist) as rl,
                 rank() over (partition by codigo  order by dist) as ra,
                 count(*) over (partition by lead_id, dist)       as empate_l,
                 count(*) over (partition by codigo,  dist)       as empate_a
            from c1) x
   where rl = 1 and ra = 1 and empate_l = 1 and empate_a = 1
),
-- Regra 2: lead que já existia: o wpp_entrada criou uma atividade (tipo 1) no atendimento,
--          no mesmo intervalo, e o 1º nome da pessoa bate com o nome que o Severino mandou.
--          Mesma regra do vizinho mútuo.
c2 as (
  select s.lead_id, a.codigoatendimento as codigo,
         abs(extract(epoch from a.datahorainicio - date_trunc('minute', s.brt))) as dist
    from sev s
    join public.atividades a
      on a.codigotipo = 1
     and a.codigoatendimento is not null
     and a.datahorainicio between date_trunc('minute', s.brt) - interval '2 min' and s.brt + interval '5 min'
     and lower(split_part(btrim(a.nomepessoa), ' ', 1)) = lower(split_part(btrim(s.nome), ' ', 1))
   where s.lead_id not in (select lead_id from r1)
),
r2 as (
  select distinct lead_id, codigo
    from (select c2.*,
                 dense_rank() over (partition by lead_id order by dist) as rl,
                 dense_rank() over (partition by codigo  order by dist) as ra
            from c2) x
   where rl = 1 and ra = 1
     and lead_id in (select lead_id from c2 group by lead_id having count(distinct codigo) = 1)
),
alvo as (
  select lead_id, codigo, 'backfill_entrada'   as vinculo from r1
  union all
  select lead_id, codigo, 'backfill_atividade' as vinculo from r2
)
update public.leads_wpp_gtm t
   set imoview_atendimento = alvo.codigo,
       imoview_vinculo     = alvo.vinculo
  from alvo
 where t.lead_id = alvo.lead_id
   and t.imoview_atendimento is null;
