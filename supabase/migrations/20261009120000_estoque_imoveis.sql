-- Estoque de imóveis (RF27, PRD §5.14, Schema §2.11, Fase 18 S1).
--
-- Fonte: Imoview, Imovel/RetornarImoveisDisponiveis, lido 1×/dia pelo n8n
-- (estoque_imoveis_diario). O n8n já tira proprietários, anotações, descrição e
-- listas; manda os imóveis de uma finalidade para carregar_estoque_imoveis(),
-- que converte datas e valores, monta a chave de endereço e registra a carga.
--
-- O payload (só campos simples) fica guardado: se algum nome de campo da API
-- for diferente do esperado, dá para corrigir as colunas sem reler o Imoview.
--
-- Endereço entra (decisão de 09/10, para achar duplicados). Leitura das tabelas:
-- só Gestão. Nada de escrita pelo front.

-- Conversões ------------------------------------------------------------------

-- "R$ 35.000,00" → 35000.00; "Sob consulta" e vazio → null
create or replace function public.imoview_moeda(t text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when t ~ '\d' then nullif(replace(regexp_replace(t, '[^0-9,]', '', 'g'), ',', '.'), '')::numeric end;
$$;

-- "07/10/2026 15:19:48" → timestamptz (horário de Brasília)
create or replace function public.imoview_datahora(t text)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case when t ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}'
              then to_timestamp(left(t, 16), 'DD/MM/YYYY HH24:MI')::timestamp at time zone 'America/Sao_Paulo'
              when t ~ '^\d{2}/\d{2}/\d{4}'
              then to_date(left(t, 10), 'DD/MM/YYYY')::timestamp at time zone 'America/Sao_Paulo' end;
$$;

-- Coordenada: "-22,89" ou "-22.89" → numeric; inválida → null
create or replace function public.imoview_coordenada(t text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when btrim(coalesce(t, '')) ~ '^-?\d{1,3}([.,]\d+)?$' then replace(btrim(t), ',', '.')::numeric end;
$$;

-- Tokens de um texto de endereço: minúsculo, sem acento, sem pontuação,
-- sem palavras de preenchimento, em ordem alfabética (a ordem não importa).
create or replace function public.endereco_tokens(t text, descartar text[])
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(tok, ' ' order by tok), '')
  from (
    select distinct tok
    from regexp_split_to_table(
      translate(lower(coalesce(t, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+') tok
    where tok <> '' and not tok = any(descartar)
  ) x;
$$;

-- Chave de endereço: rua + número + unidade (complemento e bloco).
create or replace function public.endereco_chave(logradouro text, numero text, complemento text, bloco text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(btrim(coalesce(logradouro, '')), '') is null then null
    else concat_ws(' | ',
      endereco_tokens(logradouro, array['rua','r','avenida','av','ave','alameda','al','travessa','tv','trav','rodovia','rod',
        'estrada','estr','est','praca','pca','pc','largo','lgo','via','viela','dr','doutor','dra','prof','professor','profa',
        'cel','coronel','eng','engenheiro','gen','general','pres','presidente','de','da','do','das','dos','e']),
      coalesce(nullif(regexp_replace(coalesce(numero, ''), '[^0-9]', '', 'g'), ''), 's/n'),
      endereco_tokens(concat_ws(' ', complemento, bloco), array['apto','apartamento','ap','apt','unidade','un','casa','cs',
        'sala','sl','conjunto','cj','conj','bloco','bl','torre','tr','lote','lt','quadra','qd','q','andar','n','no','numero',
        'de','da','do'])
    )
  end;
$$;

-- Tabelas ---------------------------------------------------------------------

create table if not exists public.imoveis_estoque (
  codigo         integer not null,
  finalidade     text not null,          -- 'Aluguel' | 'Venda' (como vem da API)
  situacao       text,
  tipo           text,
  destinacao     text,
  titulo         text,
  -- endereço (só Gestão)
  logradouro     text,
  numero         text,
  complemento    text,
  bloco          text,
  bairro         text,
  cidade         text,
  uf             text,
  cep            text,
  condominio     text,
  endereco_chave text,
  latitude       numeric,
  longitude      numeric,
  -- valores e atributos
  valor          numeric(14,2),
  valor_m2       numeric(14,2),
  valor_condominio numeric(12,2),
  valor_iptu     numeric(12,2),
  area_principal numeric(12,2),
  area_lote      numeric(12,2),
  quartos        smallint,
  suites         smallint,
  banheiros      smallint,
  vagas          smallint,
  -- situação comercial
  exclusivo      boolean,
  placa          boolean,
  destaque       text,
  tem_proposta   boolean,
  tem_reserva    boolean,
  em_desocupacao boolean,
  no_site        boolean not null default false,
  fotos_qtd      integer,
  tem_video      boolean,
  captadores     text[] not null default '{}',
  -- datas
  cadastrado_em  timestamptz,
  alterado_em    timestamptz,
  validado_em    timestamptz,
  situacao_em    timestamptz,
  vago_desde     timestamptz,
  payload        jsonb,
  lido_em        timestamptz not null default now(),
  primary key (codigo, finalidade)
);

create index if not exists imoveis_estoque_situacao on public.imoveis_estoque (finalidade, situacao);
create index if not exists imoveis_estoque_bairro on public.imoveis_estoque (bairro);
create index if not exists imoveis_estoque_valor on public.imoveis_estoque (valor);
create index if not exists imoveis_estoque_quartos on public.imoveis_estoque (quartos);
create index if not exists imoveis_estoque_endereco on public.imoveis_estoque (finalidade, endereco_chave);

create table if not exists public.estoque_cargas (
  id              bigint generated always as identity primary key,
  finalidade      text not null,
  quantidade_api  integer,
  quantidade_lida integer not null,
  publicados      integer not null,
  feita_em        timestamptz not null default now()
);

alter table public.imoveis_estoque enable row level security;
alter table public.estoque_cargas enable row level security;

create policy "gestao le" on public.imoveis_estoque
  for select to authenticated using ((select is_gestao()));
create policy "gestao le" on public.estoque_cargas
  for select to authenticated using ((select is_gestao()));

revoke all on public.imoveis_estoque, public.estoque_cargas from anon, authenticated;
grant select on public.imoveis_estoque, public.estoque_cargas to authenticated;

-- Carga -----------------------------------------------------------------------

create or replace function public.carregar_estoque_imoveis(
  finalidade text, quantidade_api integer, imoveis jsonb, publicados integer[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  n integer;
begin
  if finalidade not in ('Aluguel', 'Venda') then
    raise exception 'carregar_estoque_imoveis: finalidade precisa ser Aluguel ou Venda';
  end if;
  if jsonb_typeof(imoveis) <> 'array' or jsonb_array_length(imoveis) = 0 then
    raise exception 'carregar_estoque_imoveis: lista de imóveis vazia';
  end if;
  if quantidade_api is not null and jsonb_array_length(imoveis) < quantidade_api then
    raise exception 'carregar_estoque_imoveis: leitura incompleta (% de %). Nada foi gravado.',
      jsonb_array_length(imoveis), quantidade_api;
  end if;

  insert into imoveis_estoque as t (
    codigo, finalidade, situacao, tipo, destinacao, titulo,
    logradouro, numero, complemento, bloco, bairro, cidade, uf, cep, condominio, endereco_chave, latitude, longitude,
    valor, valor_m2, valor_condominio, valor_iptu, area_principal, area_lote, quartos, suites, banheiros, vagas,
    exclusivo, placa, destaque, tem_proposta, tem_reserva, em_desocupacao, no_site, fotos_qtd, tem_video, captadores,
    cadastrado_em, alterado_em, validado_em, situacao_em, vago_desde, payload, lido_em
  )
  select
    (i->>'codigo')::int,
    finalidade,
    nullif(i->>'situacao', ''),
    nullif(i->>'tipo', ''),
    nullif(i->>'destinacao', ''),
    nullif(i->>'titulo', ''),
    e.logradouro, e.numero, e.complemento, e.bloco,
    nullif(i->>'bairro', ''),
    nullif(i->>'cidade', ''),
    nullif(coalesce(i->>'estado', i->>'uf'), ''),
    nullif(i->>'cep', ''),
    nullif(coalesce(i->>'nomecondominio', i->>'condominio', i->>'nomeedificio', i->>'edificio'), ''),
    endereco_chave(e.logradouro, e.numero, e.complemento, e.bloco),
    imoview_coordenada(i->>'latitude'),
    imoview_coordenada(i->>'longitude'),
    imoview_moeda(i->>'valor'),
    imoview_moeda(i->>'valorm2'),
    imoview_moeda(i->>'valorcondominio'),
    imoview_moeda(i->>'valoriptu'),
    imoview_moeda(i->>'areaprincipal'),
    imoview_moeda(coalesce(i->>'arealote', i->>'areaterreno', i->>'areatotal')),
    imoview_moeda(i->>'numeroquartos')::smallint,
    imoview_moeda(i->>'numerosuites')::smallint,
    imoview_moeda(coalesce(i->>'numerobanhos', i->>'numerobanheiros'))::smallint,
    imoview_moeda(i->>'numerovagas')::smallint,
    (i->>'exclusivo')::boolean,
    (i->>'placa')::boolean,
    nullif(i->>'destaque', ''),
    (i->>'temproposta')::boolean,
    (i->>'temreserva')::boolean,
    (i->>'emdesocupacao')::boolean,
    (i->>'codigo')::int = any(publicados),
    nullif(i->>'fotos_qtd', '')::int,
    (i->>'tem_video')::boolean,
    coalesce(array(select jsonb_array_elements_text(coalesce(i->'captadores', '[]'::jsonb))), '{}'),
    imoview_datahora(i->>'datahoracadastro'),
    imoview_datahora(i->>'datahoraultimaalteracao'),
    imoview_datahora(i->>'datahoraultimavalidacao'),
    imoview_datahora(i->>'datahoraultimasituacao'),
    imoview_datahora(i->>'datahoravagodesde'),
    -- defesa extra: o n8n já tira estes campos
    i - 'proprietarios' - 'anotacoes' - 'descricao' - 'observacao' - 'observacoes',
    now()
  from jsonb_array_elements(imoveis) i
  cross join lateral (select
    nullif(coalesce(i->>'endereco', i->>'logradouro'), '') as logradouro,
    nullif(i->>'numero', '') as numero,
    nullif(i->>'complemento', '') as complemento,
    nullif(i->>'bloco', '') as bloco
  ) e
  on conflict (codigo, finalidade) do update set
    situacao = excluded.situacao, tipo = excluded.tipo, destinacao = excluded.destinacao, titulo = excluded.titulo,
    logradouro = excluded.logradouro, numero = excluded.numero, complemento = excluded.complemento, bloco = excluded.bloco,
    bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, cep = excluded.cep, condominio = excluded.condominio,
    endereco_chave = excluded.endereco_chave, latitude = excluded.latitude, longitude = excluded.longitude,
    valor = excluded.valor, valor_m2 = excluded.valor_m2, valor_condominio = excluded.valor_condominio,
    valor_iptu = excluded.valor_iptu, area_principal = excluded.area_principal, area_lote = excluded.area_lote,
    quartos = excluded.quartos, suites = excluded.suites, banheiros = excluded.banheiros, vagas = excluded.vagas,
    exclusivo = excluded.exclusivo, placa = excluded.placa, destaque = excluded.destaque,
    tem_proposta = excluded.tem_proposta, tem_reserva = excluded.tem_reserva, em_desocupacao = excluded.em_desocupacao,
    no_site = excluded.no_site, fotos_qtd = excluded.fotos_qtd, tem_video = excluded.tem_video,
    captadores = excluded.captadores, cadastrado_em = excluded.cadastrado_em, alterado_em = excluded.alterado_em,
    validado_em = excluded.validado_em, situacao_em = excluded.situacao_em, vago_desde = excluded.vago_desde,
    payload = excluded.payload, lido_em = excluded.lido_em;
  get diagnostics n = row_count;

  insert into estoque_cargas (finalidade, quantidade_api, quantidade_lida, publicados)
  values (finalidade, quantidade_api, n, coalesce(cardinality(publicados), 0));

  return jsonb_build_object('finalidade', finalidade, 'gravados', n, 'quantidade_api', quantidade_api,
                            'publicados', coalesce(cardinality(publicados), 0));
end;
$$;

revoke execute on function public.carregar_estoque_imoveis(text, integer, jsonb, integer[]) from public, anon, authenticated;
grant execute on function public.carregar_estoque_imoveis(text, integer, jsonb, integer[]) to service_role;

-- Views -----------------------------------------------------------------------

-- Estoque = imóvel negociável (decisão E2) lido na última carga da finalidade.
create or replace view public.vw_estoque_imoveis
with (security_invoker = true) as
with ultima as (
  select finalidade, max(feita_em) as feita_em from public.estoque_cargas group by finalidade
)
select
  i.*,
  greatest(i.alterado_em, i.validado_em) as atualizado_em,
  (current_date - greatest(i.alterado_em, i.validado_em)::date) as dias_sem_atualizar,
  (current_date - greatest(i.alterado_em, i.validado_em)::date) > 45 as desatualizado,
  (current_date - coalesce(i.vago_desde, i.cadastrado_em)::date) as dias_em_estoque
from public.imoveis_estoque i
join ultima u on u.finalidade = i.finalidade and i.lido_em >= u.feita_em - interval '6 hours'
where i.situacao in ('Vago/Disponível', 'Em moderação', 'Em reforma', 'Em desocupação');

create or replace view public.vw_estoque_captacoes_mensal
with (security_invoker = true) as
select date_trunc('month', cadastrado_em at time zone 'America/Sao_Paulo')::date as mes,
       finalidade, bairro, count(*) as captacoes
from public.imoveis_estoque
where cadastrado_em is not null
group by 1, 2, 3;

-- Duplicados: mesma finalidade e mesma chave de endereço (com número), e pelo
-- menos um negociável no grupo. "alta" quando tipo, quartos e área (±5%) batem.
create or replace view public.vw_estoque_duplicados
with (security_invoker = true) as
with base as (
  select i.*,
    i.situacao in ('Vago/Disponível', 'Em moderação', 'Em reforma', 'Em desocupação') as negociavel
  from public.imoveis_estoque i
  where i.endereco_chave is not null and i.endereco_chave not like '% | s/n | %'
),
grupos as (
  select finalidade, endereco_chave,
    count(*) as imoveis_no_grupo,
    count(*) filter (where negociavel) as negociaveis_no_grupo,
    case when count(distinct tipo) = 1 and count(distinct coalesce(quartos, -1)) = 1
              and max(area_principal) <= min(area_principal) * 1.05
         then 'alta' else 'revisar' end as certeza
  from base
  group by finalidade, endereco_chave
  having count(*) > 1 and bool_or(negociavel)
)
select dense_rank() over (order by g.certeza, b.finalidade, b.bairro, g.endereco_chave) as grupo,
  g.certeza, g.imoveis_no_grupo, g.negociaveis_no_grupo, b.negociavel,
  b.codigo, b.finalidade, b.situacao, b.tipo, b.logradouro, b.numero, b.complemento, b.bloco, b.bairro, b.cidade,
  b.condominio, b.area_principal, b.quartos, b.valor, b.no_site, b.exclusivo, b.captadores, b.fotos_qtd,
  b.cadastrado_em, b.alterado_em, b.validado_em, b.endereco_chave
from grupos g
join base b on b.finalidade = g.finalidade and b.endereco_chave = g.endereco_chave;
