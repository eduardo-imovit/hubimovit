-- Km 32: o "verde" do quadro "em proposta" passa de 15 para 30 dias
-- (decisão do Eduardo, 13/10). Só muda a janela da última interação; o resto
-- é igual a 20261013120000_campanha_resumo_em_proposta.

create or replace function public.campanha_resumo(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c campanhas;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_finalidades jsonb;
begin
  if not pode_ler_comercial() then
    raise exception 'Sem permissão para ver a campanha' using errcode = '42501';
  end if;

  select * into c from campanhas where slug = p_slug and ativa;
  if not found then
    return null;
  end if;

  with ultimo as (
    select distinct on (codigo) codigo, finalidade, situacao, fase_crm, payload
    from crm_atendimento_jornada
    order by codigo, id desc
  ),
  negocios as (
    select
      u.codigo,
      u.finalidade,
      (
        select max(to_timestamp(i ->> 'datahora', 'DD/MM/YYYY HH24:MI')::timestamp)
        from jsonb_array_elements(case when jsonb_typeof(u.payload -> 'interacoes') = 'array' then u.payload -> 'interacoes' else '[]'::jsonb end) i
        where upper(i ->> 'descricao') like 'NEGÓCIO REALIZADO%'
      ) as realizado_em,
      (
        select sum((x ->> 'valornegocio')::numeric)
        from jsonb_array_elements(case when jsonb_typeof(u.payload -> 'imoveisnegocio') = 'array' then u.payload -> 'imoveisnegocio' else '[]'::jsonb end) x
        where (x ->> 'valornegocio') ~ '^[0-9]+(\.[0-9]+)?$'
      ) as valor
    from ultimo u
    where u.situacao = 'Negócio realizado'
  ),
  da_campanha as (
    select * from negocios
    where realizado_em is not null and realizado_em::date between c.inicio and c.fim
  ),
  -- Propostas "verdes" (interação nos últimos 30 dias): a negociação mais recente de cada imóvel proposto
  ultima_negociacao as (
    select distinct on (u.codigo, im ->> 'codigo')
      u.codigo,
      u.finalidade,
      n ->> 'situacaonegociacao' as situacao_negociacao,
      case when (n ->> 'valorproposta') ~ '^[0-9]+(\.[0-9]+)?$' then (n ->> 'valorproposta')::numeric end as valor
    from ultimo u
    cross join lateral jsonb_array_elements(case when jsonb_typeof(u.payload -> 'imoveisproposta') = 'array' then u.payload -> 'imoveisproposta' else '[]'::jsonb end) im
    cross join lateral jsonb_array_elements(case when jsonb_typeof(im -> 'negociacoes') = 'array' then im -> 'negociacoes' else '[]'::jsonb end) n
    where u.situacao = 'Em atendimento'
      and u.fase_crm = 5
      and nullif(u.payload ->> 'datahoraultimainteracao', '') is not null
      and to_timestamp(u.payload ->> 'datahoraultimainteracao', 'DD/MM/YYYY HH24:MI')::date > v_hoje - 30
    order by u.codigo, im ->> 'codigo', to_timestamp(n ->> 'datanegociacao', 'DD/MM/YYYY HH24:MI') desc nulls last
  ),
  em_proposta as (
    select finalidade, count(*) as propostas, sum(valor) as valor
    from ultima_negociacao
    where situacao_negociacao = 'Em análise' and valor is not null
    group by finalidade
  )
  select jsonb_object_agg(m.finalidade, jsonb_build_object(
           'meta_valor', m.meta_valor,
           'meta_negocios', m.meta_negocios,
           'negocios', coalesce(t.negocios, 0),
           'valor', coalesce(t.valor, 0),
           'sem_valor', coalesce(t.sem_valor, 0),
           'ticket', case when coalesce(t.com_valor, 0) > 0 then round(t.valor / t.com_valor, 2) end,
           'ultimo_negocio', t.ultimo,
           'em_proposta', coalesce(p.valor, 0),
           'propostas', coalesce(p.propostas, 0)
         ))
    into v_finalidades
  from campanha_metas m
  left join (
    select finalidade,
           count(*) as negocios,
           count(valor) as com_valor,
           count(*) - count(valor) as sem_valor,
           sum(valor) as valor,
           max(realizado_em) as ultimo
    from da_campanha
    group by finalidade
  ) t on t.finalidade = m.finalidade
  left join em_proposta p on p.finalidade = m.finalidade
  where m.campanha_id = c.id;

  return jsonb_build_object(
    'slug', c.slug,
    'nome', c.nome,
    'inicio', c.inicio,
    'fim', c.fim,
    'hoje', v_hoje,
    'ultima_leitura', (select max(lido_em) from crm_leituras where origem = 'n8n'),
    'finalidades', coalesce(v_finalidades, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.campanha_resumo(text) from public, anon;
grant execute on function public.campanha_resumo(text) to authenticated;
