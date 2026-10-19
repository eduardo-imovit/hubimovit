-- Jornada do lead para o Painel da Gestão (PRD §5.12, Schema §2.9; 19/10).
-- Duas views leves sobre crm_atendimento_jornada (sem payload), security_invoker:
-- herdam a RLS da jornada (o corretor vê só a dele). Finalidade, canal e corretor
-- vêm da vw_atendimentos_base no front, pelo código.
-- posicao = ordem do funil do Hub: fase 1,2,3,7,4,5,6 → 1..7 (Negócio = 7).

create or replace view public.vw_jornada_etapas
with (security_invoker = true) as
with ev as (
  select j.id, j.codigo, j.tipo, btrim(j.situacao) as situacao, j.data_evento,
    case j.fase_crm when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as posicao,
    lead(j.data_evento) over w as prox_data,
    lead(btrim(j.situacao)) over w as prox_sit,
    case lead(j.fase_crm) over w when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as prox_posicao
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
  case j.fase_crm when 1 then 1 when 2 then 2 when 3 then 3 when 7 then 4 when 4 then 5 when 5 then 6 when 6 then 7 end as posicao,
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

revoke all on public.vw_jornada_etapas, public.vw_jornada_descartes from anon, authenticated;
grant select on public.vw_jornada_etapas, public.vw_jornada_descartes to authenticated;
