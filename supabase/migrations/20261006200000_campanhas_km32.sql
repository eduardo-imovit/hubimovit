-- Campanhas com metas, e o resumo do realizado a partir da jornada do CRM
-- (RF25, PRD §5.9, Schema §2.8, Plano Fase 13 S1). Primeira campanha: Km 32.
--
-- Os negócios não são digitados: saem de crm_atendimento_jornada (fluxo
-- crm_jornada_diaria v3). Para cada atendimento vale o registro mais recente;
-- conta se a situação é "Negócio realizado" e a interação "NEGÓCIO REALIZADO"
-- cai dentro do período da campanha. Valor = soma de imoveisnegocio[].valornegocio.

create table if not exists public.campanhas (
  id bigint generated always as identity primary key,
  slug text not null unique,
  nome text not null,
  inicio date not null,
  fim date not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);

create table if not exists public.campanha_metas (
  campanha_id bigint not null references public.campanhas (id) on delete cascade,
  finalidade text not null check (finalidade in ('Venda', 'Aluguel')),
  meta_valor numeric not null check (meta_valor > 0),
  meta_negocios integer not null check (meta_negocios > 0),
  primary key (campanha_id, finalidade)
);

alter table public.campanhas enable row level security;
alter table public.campanha_metas enable row level security;

create policy "quem tem nivel le" on public.campanhas for select to authenticated using (pode_ler_comercial());
create policy "gestao grava" on public.campanhas for all to authenticated using (is_gestao()) with check (is_gestao());
create policy "quem tem nivel le" on public.campanha_metas for select to authenticated using (pode_ler_comercial());
create policy "gestao grava" on public.campanha_metas for all to authenticated using (is_gestao()) with check (is_gestao());

revoke all on public.campanhas, public.campanha_metas from anon;

-- Km 32 · 4º tri 2026: começa a contar em 06/10 (decisão C6)
insert into public.campanhas (slug, nome, inicio, fim)
values ('km32-4tri-2026', 'Km 32 · Campanha 4º Tri 2026', date '2026-10-06', date '2026-12-31')
on conflict (slug) do nothing;

insert into public.campanha_metas (campanha_id, finalidade, meta_valor, meta_negocios)
select id, m.finalidade, m.meta_valor, m.meta_negocios
from public.campanhas,
     (values ('Venda', 28000000::numeric, 14), ('Aluguel', 160000::numeric, 18)) as m(finalidade, meta_valor, meta_negocios)
where slug = 'km32-4tri-2026'
on conflict do nothing;

-- Resumo agregado (nunca linhas): o corretor vê o total da imobiliária (C3)
-- sem ler atendimentos de outros. Só para quem tem nível.
create or replace function public.campanha_resumo(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c campanhas;
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
    select distinct on (codigo) codigo, finalidade, situacao, payload
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
  )
  select jsonb_object_agg(m.finalidade, jsonb_build_object(
           'meta_valor', m.meta_valor,
           'meta_negocios', m.meta_negocios,
           'negocios', coalesce(t.negocios, 0),
           'valor', coalesce(t.valor, 0),
           'sem_valor', coalesce(t.sem_valor, 0),
           'ticket', case when coalesce(t.com_valor, 0) > 0 then round(t.valor / t.com_valor, 2) end,
           'ultimo_negocio', t.ultimo
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
  where m.campanha_id = c.id;

  return jsonb_build_object(
    'slug', c.slug,
    'nome', c.nome,
    'inicio', c.inicio,
    'fim', c.fim,
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'ultima_leitura', (select max(lido_em) from crm_leituras where origem = 'n8n'),
    'finalidades', coalesce(v_finalidades, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.campanha_resumo(text) from public, anon;
grant execute on function public.campanha_resumo(text) to authenticated;
