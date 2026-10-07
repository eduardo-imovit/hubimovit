-- Novos × encerrados pela regra do CRM (Imoview), conferida com o Eduardo em 07/10:
--   novos       = contratos Ativo/Rescindido pela data de início
--   encerrados  = contratos com data de rescisão, pelo mês dela
-- Antes, o rescindido sem data de rescisão entrava como encerrado na data de fim do
-- contrato: +6 rescisões em 2025 e +6 em 2026, e o saldo não batia com o CRM
-- (ex.: nov/25 dava +1, o CRM dá +2). Esses contratos continuam saindo da contagem de
-- ativos na data de fim (senão ficariam ativos para sempre), mas não contam como rescisão.

create or replace view public.vw_carteira_locacao_mensal
with (security_invoker = true) as
with base as (
  select data_inicio, valor_aluguel, data_rescisao,
         case when situacao = 'Rescindido' then coalesce(data_rescisao, data_fim) end as saida_ativos
  from public.contratos_locacao
  where situacao in ('Ativo', 'Rescindido') and data_inicio is not null
),
meses as (
  select generate_series(date_trunc('month', min(data_inicio)), date_trunc('month', current_date), interval '1 month')::date as mes
  from base
)
select
  m.mes,
  (select count(*) from base where date_trunc('month', data_inicio) = m.mes) as entradas,
  (select count(*) from base where date_trunc('month', data_rescisao) = m.mes) as saidas,
  (select count(*) from base
    where data_inicio < (m.mes + interval '1 month')
      and (saida_ativos is null or saida_ativos >= (m.mes + interval '1 month'))) as ativos_fim_mes,
  (select coalesce(sum(valor_aluguel), 0) from base where date_trunc('month', data_inicio) = m.mes) as aluguel_novos
from meses m;
