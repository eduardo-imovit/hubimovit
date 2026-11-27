-- Fase 29e S4 · GA4 e Search Console no orgânico (Schema §2.23, PRD §5.23 pendência 8, briefing-ga4.md)
-- 25/11 (Asimov): escrita e testada em BEGIN … ROLLBACK. NÃO aplicada (aguarda OK do Eduardo).
--
-- O que muda:
--   organico_metricas   + rede 'ga4' (8 métricas). 'search_console' já existe (cliques, impressoes, ctr, posicao_media).
--   organico_dimensao   NOVA: o mesmo formato longo, com a dimensão (canal, origem/mídia, campanha, evento, página,
--                       consulta). Não coube em organico_diario: lá a chave é (data, rede, conta, metrica) e não há
--                       onde guardar "qual página" ou "qual consulta" sem abusar da coluna conta.
--   carregar_organico_web(p_diario, p_dimensao)
--                       RPC única dos fluxos ga4_diario / search_console_diario / backfill: os totais vão para
--                       organico_diario pela carregar_organico (a mesma do Instagram, sem mudança) e as dimensões
--                       para organico_dimensao, numa transação só.
-- Regra das dimensões: cada leitura é a FOTO do dia. Para cada (data, rede, conta, dimensao) que chega, as linhas
-- antigas saem e as novas entram. Motivo: guardamos só o top N do dia (20 páginas, 50 consultas…); se uma página
-- saiu do top no reprocesso de D-2, um upsert simples deixaria a linha velha lá.
-- Não toca: organico_diario (estrutura), carregar_organico, organico_meta, wpp_entrada, meta_ads.

------------------------------------------------------------------------------------------
-- 1. Dicionário: GA4 (as métricas do Search Console já estão no banco desde 20261124190000)
------------------------------------------------------------------------------------------
insert into public.organico_metricas (rede, metrica, rotulo, descricao, ordem) values
  ('ga4', 'usuarios',          'Usuários',            'totalUsers do dia (somar dias não dá usuários únicos)', 10),
  ('ga4', 'usuarios_novos',    'Usuários novos',      'newUsers do dia', 20),
  ('ga4', 'sessoes',           'Sessões',             'sessions', 30),
  ('ga4', 'sessoes_engajadas', 'Sessões engajadas',   'engagedSessions (10 s+, 2 páginas+ ou evento-chave)', 40),
  ('ga4', 'taxa_engajamento',  'Taxa de engajamento', 'engagementRate do dia em % (no período: engajadas ÷ sessões)', 50),
  ('ga4', 'visualizacoes',     'Visualizações',       'screenPageViews', 60),
  ('ga4', 'eventos_chave',     'Eventos-chave',       'keyEvents (antigo "conversões"): só os eventos marcados como chave no GA4', 70),
  ('ga4', 'eventos',           'Eventos',             'eventCount (usado na dimensão evento)', 80)
on conflict (rede, metrica) do update
  set rotulo = excluded.rotulo, descricao = excluded.descricao, ordem = excluded.ordem;

------------------------------------------------------------------------------------------
-- 2. Dimensões do dia (top N por dia, foto substituída a cada leitura)
------------------------------------------------------------------------------------------
create table if not exists public.organico_dimensao (
  id            bigint generated always as identity primary key,
  data          date not null,
  rede          text not null,
  conta         text not null,
  dimensao      text not null,
  chave         text not null,
  metrica       text not null,
  valor         numeric not null,
  atualizado_em timestamptz not null default now(),
  constraint organico_dimensao_chave unique (data, rede, conta, dimensao, chave, metrica),
  constraint organico_dimensao_tipo check (dimensao in ('canal', 'origem_midia', 'campanha', 'evento', 'pagina', 'consulta')),
  constraint organico_dimensao_metrica_fk foreign key (rede, metrica)
    references public.organico_metricas (rede, metrica)
);

create index if not exists organico_dimensao_rede_dim_data_idx
  on public.organico_dimensao (rede, dimensao, data desc);

------------------------------------------------------------------------------------------
-- 3. RPC de carga (só service_role)
------------------------------------------------------------------------------------------
create or replace function public.carregar_organico_web(p_diario jsonb default '[]'::jsonb,
                                                        p_dimensao jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diario jsonb := '{}'::jsonb;
  v_apagadas integer := 0;
  v_dim integer := 0;
begin
  if jsonb_typeof(coalesce(p_dimensao, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'p_dimensao deve ser um array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_dimensao, '[]'::jsonb)) as x
    left join public.organico_metricas m on m.rede = x->>'rede' and m.metrica = x->>'metrica'
    where m.rede is null
       or x->>'data' is null or x->>'conta' is null or x->>'valor' is null
       or coalesce(x->>'chave', '') = ''
       or x->>'dimensao' not in ('canal', 'origem_midia', 'campanha', 'evento', 'pagina', 'consulta')
  ) then
    raise exception 'dimensão inválida: data, conta, chave ou valor ausentes; dimensão fora da lista; ou rede/métrica fora do dicionário'
      using errcode = '22023';
  end if;

  -- totais: mesma RPC do Instagram (valida pelo dicionário e faz upsert)
  if jsonb_array_length(coalesce(p_diario, '[]'::jsonb)) > 0 then
    v_diario := public.carregar_organico(p_diario);
  end if;

  -- dimensões: a foto do dia substitui a anterior, por (data, rede, conta, dimensao)
  with k as (
    select distinct (x->>'data')::date as data, x->>'rede' as rede, x->>'conta' as conta, x->>'dimensao' as dimensao
    from jsonb_array_elements(coalesce(p_dimensao, '[]'::jsonb)) as x
  )
  delete from public.organico_dimensao o
  using k
  where o.data = k.data and o.rede = k.rede and o.conta = k.conta and o.dimensao = k.dimensao;
  get diagnostics v_apagadas = row_count;

  insert into public.organico_dimensao (data, rede, conta, dimensao, chave, metrica, valor)
  -- group by: a mesma chave repetida no lote (ex.: duas URLs iguais nos 500 primeiros caracteres) vira 1 linha;
  -- contagens somam, taxas e posição tiram a média
  select (x->>'data')::date, x->>'rede', x->>'conta', x->>'dimensao', left(x->>'chave', 500), x->>'metrica',
         case when x->>'metrica' in ('ctr', 'posicao_media', 'taxa_engajamento')
              then avg((x->>'valor')::numeric) else sum((x->>'valor')::numeric) end
  from jsonb_array_elements(coalesce(p_dimensao, '[]'::jsonb)) as x
  group by 1, 2, 3, 4, 5, 6
  on conflict (data, rede, conta, dimensao, chave, metrica) do update
    set valor = excluded.valor, atualizado_em = now();
  get diagnostics v_dim = row_count;

  return jsonb_build_object('diario', coalesce(v_diario->'linhas', '0'::jsonb),
                            'dimensao', v_dim, 'dimensao_substituidas', v_apagadas);
end;
$$;

revoke all on function public.carregar_organico_web(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.carregar_organico_web(jsonb, jsonb) to service_role;

------------------------------------------------------------------------------------------
-- 4. RLS: igual à do orgânico (pode_ver_dash; decisão pendente do Eduardo sobre trocar por pode_ver_saude,
--    Schema §2.23). Escrita só pela RPC; anon fora.
------------------------------------------------------------------------------------------
alter table public.organico_dimensao enable row level security;

drop policy if exists "organico_dimensao leitura dash" on public.organico_dimensao;
create policy "organico_dimensao leitura dash" on public.organico_dimensao
  for select to authenticated using (public.pode_ver_dash());

revoke all on public.organico_dimensao from anon;
