-- Carteira de locação: contratos ativos (RF26, PRD §5.13, Schema §2.10, Fase 17).
--
-- Fonte: Imoview, lido 1×/dia pelo n8n.
--   contratos: GET /ContratoAluguel/RetornarContratos (todos, inclusive rescindidos)
--   cobranças: GET /Movimento/RetornarMovimentos (módulo 2 = locação, pendentes e vencidas)
-- O n8n manda as listas cruas para carregar_carteira_locacao(); a função converte
-- datas (dd/MM/yyyy) e números (1.234,56), tira os CPFs/CNPJs e grava tudo de uma vez.
--
-- Inadimplência segue a regra do Imoview (decisão de 07/10): o contrato marcado
-- "Atrasado". Cobrança vencida em contrato que o Imoview não marca vai para "atenção".
--
-- Leitura: só Gestão e ADM. Nada de escrita pelo front.

-- Conversões do formato da API ------------------------------------------------

create or replace function public.imoview_data(t text)
returns date
language sql
immutable
set search_path = public
as $$
  select case when t ~ '^\d{2}/\d{2}/\d{4}' then to_date(left(t, 10), 'DD/MM/YYYY') end;
$$;

create or replace function public.imoview_numero(t text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when nullif(btrim(t), '') is null then null
              else replace(replace(btrim(t), '.', ''), ',', '.')::numeric end;
$$;

-- Tabelas ---------------------------------------------------------------------

create table if not exists public.contratos_locacao (
  codigo                  integer primary key,
  codigo_imovel           integer,
  imovel_resumo           text,
  imovel_tipo             text,
  imovel_endereco         text,
  destinacao              text,
  locatario_codigo        integer,
  locatario_nome          text,
  locatario_telefone      text,
  locatario_email         text,
  situacao                text not null,
  status                  text,
  motivo_status           text,
  valor_aluguel           numeric(12,2),
  valor_condominio        numeric(12,2),
  taxa_adm                numeric(12,2),
  taxa_adm_tipo           text,
  taxa_intermediacao      numeric(12,2),
  taxa_intermediacao_tipo text,
  garantia                text,
  indice_reajuste         text,
  data_inicio             date,
  data_fim                date,
  data_proximo_reajuste   date,
  data_aviso_desocupacao  date,
  data_previsao_rescisao  date,
  data_rescisao           date,
  motivo_rescisao         text,
  dia_vencimento          smallint,
  locadores               jsonb not null default '[]'::jsonb,
  payload                 jsonb,
  atualizado_em           timestamptz not null default now()
);

create index if not exists contratos_locacao_situacao on public.contratos_locacao (situacao);

create table if not exists public.contratos_locacao_cobrancas (
  codigo          integer primary key,
  codigo_contrato integer not null,
  codigo_imovel   integer,
  historico       text,
  data_vencimento date not null,
  saldo           numeric(12,2) not null,
  lido_em         timestamptz not null default now()
);

create index if not exists contratos_locacao_cobrancas_contrato on public.contratos_locacao_cobrancas (codigo_contrato);

create table if not exists public.contratos_locacao_fotos (
  data                    date primary key,
  ativos                  integer not null,
  em_ativacao             integer not null,
  soma_aluguel            numeric(14,2) not null,
  receita_adm             numeric(14,2) not null,
  inadimplentes           integer not null,
  inadimplentes_valor     numeric(14,2) not null,
  atencao                 integer not null,
  atencao_valor           numeric(14,2) not null,
  encerrados_debito       integer not null,
  encerrados_debito_valor numeric(14,2) not null,
  lido_em                 timestamptz not null default now()
);

-- Leitura: só Gestão e ADM ----------------------------------------------------

alter table public.contratos_locacao enable row level security;
alter table public.contratos_locacao_cobrancas enable row level security;
alter table public.contratos_locacao_fotos enable row level security;

create policy "gestao e adm leem" on public.contratos_locacao
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.contratos_locacao_cobrancas
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.contratos_locacao_fotos
  for select to authenticated using ((select is_adm_ou_gestao()));

revoke all on public.contratos_locacao, public.contratos_locacao_cobrancas, public.contratos_locacao_fotos from anon, authenticated;
grant select on public.contratos_locacao, public.contratos_locacao_cobrancas, public.contratos_locacao_fotos to authenticated;

-- Views -----------------------------------------------------------------------

create or replace view public.vw_carteira_locacao
with (security_invoker = true) as
with cob as (
  select codigo_contrato, sum(saldo) as valor, min(data_vencimento) as desde
  from public.contratos_locacao_cobrancas
  group by codigo_contrato
)
select
  c.*,
  case when c.situacao <> 'Ativo' then 0
       when c.taxa_adm_tipo = 'R$' then coalesce(c.taxa_adm, 0)
       else round(coalesce(c.valor_aluguel, 0) * coalesce(c.taxa_adm, 0) / 100, 2)
  end as receita_adm,
  c.data_fim - current_date as dias_para_fim,
  (c.situacao = 'Ativo' and c.data_fim < current_date) as prazo_indeterminado,
  (c.situacao = 'Ativo' and c.data_aviso_desocupacao is not null) as com_aviso,
  (c.situacao = 'Ativo' and c.data_proximo_reajuste < current_date) as reajuste_atrasado,
  coalesce(cob.valor, 0) as cobranca_vencida_valor,
  cob.desde as cobranca_vencida_desde,
  case
    when c.situacao = 'Ativo' and c.status = 'Atrasado' then 'inadimplente'
    when c.situacao <> 'Ativo' and c.status = 'Atrasado' then 'encerrado_debito'
    when cob.valor > 0 then 'atencao'
  end as grupo_cobranca
from public.contratos_locacao c
left join cob on cob.codigo_contrato = c.codigo;

create or replace view public.vw_cobrancas_locacao
with (security_invoker = true) as
select
  b.*,
  current_date - b.data_vencimento as dias_atraso,
  case
    when current_date - b.data_vencimento <= 30 then '1-30'
    when current_date - b.data_vencimento <= 60 then '31-60'
    when current_date - b.data_vencimento <= 90 then '61-90'
    else '90+'
  end as faixa,
  v.situacao,
  v.status,
  v.locatario_nome,
  v.imovel_resumo,
  v.grupo_cobranca
from public.contratos_locacao_cobrancas b
left join public.vw_carteira_locacao v on v.codigo = b.codigo_contrato;

create or replace view public.vw_carteira_locacao_mensal
with (security_invoker = true) as
with base as (
  select data_inicio,
         case when situacao = 'Rescindido' then coalesce(data_rescisao, data_fim) end as saida
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
  (select count(*) from base where date_trunc('month', saida) = m.mes) as saidas,
  (select count(*) from base
    where data_inicio < (m.mes + interval '1 month')
      and (saida is null or saida >= (m.mes + interval '1 month'))) as ativos_fim_mes
from meses m;

revoke all on public.vw_carteira_locacao, public.vw_cobrancas_locacao, public.vw_carteira_locacao_mensal from anon, authenticated;
grant select on public.vw_carteira_locacao, public.vw_cobrancas_locacao, public.vw_carteira_locacao_mensal to authenticated;

-- Carga (n8n, service role) ---------------------------------------------------

create or replace function public.carregar_carteira_locacao(contratos jsonb, cobrancas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_contratos integer;
  n_cobrancas integer;
  foto record;
begin
  if jsonb_typeof(contratos) <> 'array' or jsonb_array_length(contratos) = 0 then
    raise exception 'carregar_carteira_locacao: lista de contratos vazia';
  end if;
  if jsonb_typeof(cobrancas) <> 'array' then
    raise exception 'carregar_carteira_locacao: cobrancas precisa ser uma lista';
  end if;

  insert into contratos_locacao as t (
    codigo, codigo_imovel, imovel_resumo, imovel_tipo, imovel_endereco, destinacao,
    locatario_codigo, locatario_nome, locatario_telefone, locatario_email,
    situacao, status, motivo_status,
    valor_aluguel, valor_condominio, taxa_adm, taxa_adm_tipo, taxa_intermediacao, taxa_intermediacao_tipo,
    garantia, indice_reajuste,
    data_inicio, data_fim, data_proximo_reajuste, data_aviso_desocupacao, data_previsao_rescisao, data_rescisao,
    motivo_rescisao, dia_vencimento, locadores, payload, atualizado_em
  )
  select
    (c->>'codigo')::int,
    nullif(c#>>'{imoveis,0,codigo}', '')::int,
    nullif(c#>>'{imoveis,0,resumo}', ''),
    nullif(c#>>'{imoveis,0,tipoimovel}', ''),
    nullif(c#>>'{imoveis,0,endereco}', ''),
    nullif(c->>'destinacao', ''),
    nullif(c->>'locatariocodigo', '')::int,
    nullif(c->>'locatarionome', ''),
    nullif(c->>'locatariotelefone1', ''),
    nullif(c->>'locatarioemail', ''),
    c->>'situacao',
    nullif(c->>'status', ''),
    nullif(c->>'motivostatus', ''),
    (c->>'valoraluguel')::numeric,
    nullif(c#>>'{imoveis,0,valorcondominio}', '')::numeric,
    imoview_numero(c->>'taxaadministracao'),
    nullif(c->>'tipotaxaadministracao', ''),
    imoview_numero(c->>'taxaintermediacao'),
    nullif(c->>'tipotaxaintermediacao', ''),
    nullif(c->>'garantia', ''),
    nullif(c->>'indicereajuste', ''),
    imoview_data(c->>'datainicio'),
    imoview_data(c->>'datafim'),
    imoview_data(c->>'dataproximoreajuste'),
    imoview_data(c->>'dataavisodesocupacao'),
    imoview_data(c->>'dataprevisaorescisao'),
    imoview_data(c->>'datarescisao'),
    nullif(c->>'motivorescisao', ''),
    nullif(c->>'diavencimentoaluguel', '')::smallint,
    coalesce((
      select jsonb_agg(jsonb_build_object('codigo', l->'codigo', 'nome', l->'nome', 'percentual', l->'percentual'))
      from jsonb_array_elements(coalesce(c#>'{imoveis,0,locadores}', '[]'::jsonb)) l
    ), '[]'::jsonb),
    -- payload cru sem CPF/CNPJ (locatário e locadores)
    (c - 'locatariocpf') || jsonb_build_object('imoveis', coalesce((
      select jsonb_agg(i || jsonb_build_object('locadores', coalesce((
        select jsonb_agg(l - 'cpfcnpj' - 'responsavelfiscalcpfcnpj')
        from jsonb_array_elements(coalesce(i->'locadores', '[]'::jsonb)) l
      ), '[]'::jsonb)))
      from jsonb_array_elements(coalesce(c->'imoveis', '[]'::jsonb)) i
    ), '[]'::jsonb)),
    now()
  from jsonb_array_elements(contratos) c
  on conflict (codigo) do update set
    codigo_imovel = excluded.codigo_imovel,
    imovel_resumo = excluded.imovel_resumo,
    imovel_tipo = excluded.imovel_tipo,
    imovel_endereco = excluded.imovel_endereco,
    destinacao = excluded.destinacao,
    locatario_codigo = excluded.locatario_codigo,
    locatario_nome = excluded.locatario_nome,
    locatario_telefone = excluded.locatario_telefone,
    locatario_email = excluded.locatario_email,
    situacao = excluded.situacao,
    status = excluded.status,
    motivo_status = excluded.motivo_status,
    valor_aluguel = excluded.valor_aluguel,
    valor_condominio = excluded.valor_condominio,
    taxa_adm = excluded.taxa_adm,
    taxa_adm_tipo = excluded.taxa_adm_tipo,
    taxa_intermediacao = excluded.taxa_intermediacao,
    taxa_intermediacao_tipo = excluded.taxa_intermediacao_tipo,
    garantia = excluded.garantia,
    indice_reajuste = excluded.indice_reajuste,
    data_inicio = excluded.data_inicio,
    data_fim = excluded.data_fim,
    data_proximo_reajuste = excluded.data_proximo_reajuste,
    data_aviso_desocupacao = excluded.data_aviso_desocupacao,
    data_previsao_rescisao = excluded.data_previsao_rescisao,
    data_rescisao = excluded.data_rescisao,
    motivo_rescisao = excluded.motivo_rescisao,
    dia_vencimento = excluded.dia_vencimento,
    locadores = excluded.locadores,
    payload = excluded.payload,
    atualizado_em = excluded.atualizado_em;
  get diagnostics n_contratos = row_count;

  -- Cobranças: a lista é sempre a foto atual das pendentes vencidas.
  delete from contratos_locacao_cobrancas where true;
  insert into contratos_locacao_cobrancas (codigo, codigo_contrato, codigo_imovel, historico, data_vencimento, saldo, lido_em)
  select distinct on ((m->>'codigo')::int)
    (m->>'codigo')::int,
    (m->>'codigocontratoaluguel')::int,
    nullif(m->>'codigoimovel', '')::int,
    nullif(m->>'historico', ''),
    imoview_data(m->>'datavencimento'),
    imoview_numero(m->>'saldo'),
    now()
  from jsonb_array_elements(cobrancas) m
  where (m->>'modulo')::int = 2
    and coalesce(nullif(m->>'codigocontratoaluguel', '')::int, 0) > 0
    and nullif(m->>'datapagamento', '') is null
    and imoview_data(m->>'datavencimento') < current_date
  order by (m->>'codigo')::int;
  get diagnostics n_cobrancas = row_count;

  select
    count(*) filter (where situacao = 'Ativo') as ativos,
    count(*) filter (where situacao = 'Moderação') as em_ativacao,
    coalesce(sum(valor_aluguel) filter (where situacao = 'Ativo'), 0) as soma_aluguel,
    coalesce(sum(receita_adm), 0) as receita_adm,
    count(*) filter (where grupo_cobranca = 'inadimplente') as inadimplentes,
    coalesce(sum(cobranca_vencida_valor) filter (where grupo_cobranca = 'inadimplente'), 0) as inadimplentes_valor,
    count(*) filter (where grupo_cobranca = 'atencao') as atencao,
    coalesce(sum(cobranca_vencida_valor) filter (where grupo_cobranca = 'atencao'), 0) as atencao_valor,
    count(*) filter (where grupo_cobranca = 'encerrado_debito') as encerrados_debito,
    coalesce(sum(cobranca_vencida_valor) filter (where grupo_cobranca = 'encerrado_debito'), 0) as encerrados_debito_valor
  into foto
  from vw_carteira_locacao;

  insert into contratos_locacao_fotos as f (
    data, ativos, em_ativacao, soma_aluguel, receita_adm, inadimplentes, inadimplentes_valor,
    atencao, atencao_valor, encerrados_debito, encerrados_debito_valor, lido_em
  ) values (
    current_date, foto.ativos, foto.em_ativacao, foto.soma_aluguel, foto.receita_adm,
    foto.inadimplentes, foto.inadimplentes_valor, foto.atencao, foto.atencao_valor,
    foto.encerrados_debito, foto.encerrados_debito_valor, now()
  )
  on conflict (data) do update set
    ativos = excluded.ativos, em_ativacao = excluded.em_ativacao,
    soma_aluguel = excluded.soma_aluguel, receita_adm = excluded.receita_adm,
    inadimplentes = excluded.inadimplentes, inadimplentes_valor = excluded.inadimplentes_valor,
    atencao = excluded.atencao, atencao_valor = excluded.atencao_valor,
    encerrados_debito = excluded.encerrados_debito, encerrados_debito_valor = excluded.encerrados_debito_valor,
    lido_em = excluded.lido_em;

  return jsonb_build_object(
    'contratos', n_contratos,
    'cobrancas_vencidas', n_cobrancas,
    'foto', to_jsonb(foto)
  );
end;
$$;

revoke execute on function public.carregar_carteira_locacao(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.carregar_carteira_locacao(jsonb, jsonb) to service_role;
