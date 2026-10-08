-- Carteira de locação v2 (PRD §5.13 revisto em 07/10, Schema §2.10).
--
-- Painel pela ótica do gestor (pedido do Eduardo, 07/10): o que entra no caixa da
-- Imovit (administração recebida), crescimento, onde e o que alugamos, quem sai e
-- por quê, proteção da carteira (seguros e garantias) e proprietários.
--
-- Muda:
--   contratos_locacao              + bairro/cidade/uf, seguro incêndio, validade da garantia
--   contratos_locacao_cobrancas    + pagamento_informado: o Imoview mantém "em aberto"
--                                    cobranças já pagas e ainda sem baixa (achado da 1ª carga)
--   contratos_locacao_recebimentos (nova): cobranças PAGAS, com aluguel, administração
--                                    e intermediação retidas no repasse ao locador
--   carregar_carteira_locacao(contratos, cobrancas, pagas) e payload com CPF/CNPJ
--                                    mascarado (o resumo dos locadores traz CPF)
--   views recriadas + vw_recebimentos_locacao_mensal + vw_proprietarios_locacao

-- Endereço do Imoview: "Rua X, 136, Apto 81, Cambuí - Campinas/SP"
create or replace function public.imoview_endereco_partes(endereco text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select regexp_match(endereco, ',\s*([^,]+?)\s+-\s+([^/,]+?)\s*/\s*([A-Za-z]{2})\s*$');
$$;

-- Troca CPF e CNPJ formatados por *** em qualquer texto do payload.
create or replace function public.mascarar_documentos(j jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
           regexp_replace(j::text, '\d{3}\.\d{3}\.\d{3}-\d{2}', '***', 'g'),
           '\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', '***', 'g')::jsonb;
$$;

alter table public.contratos_locacao
  add column if not exists bairro                     text,
  add column if not exists cidade                     text,
  add column if not exists uf                         text,
  add column if not exists seguro_incendio_inicio     date,
  add column if not exists seguro_incendio_fim        date,
  add column if not exists seguro_incendio_seguradora text,
  add column if not exists garantia_forma             text,
  add column if not exists garantia_seguradora        text,
  add column if not exists garantia_fim               date;

alter table public.contratos_locacao_cobrancas
  add column if not exists pagamento_informado boolean not null default false,
  add column if not exists data_pagamento_informada date;

create table if not exists public.contratos_locacao_recebimentos (
  codigo             integer primary key,
  codigo_contrato    integer not null,
  codigo_imovel      integer,
  data_vencimento    date,
  data_pagamento     date not null,
  total_cobrado      numeric(12,2),
  aluguel            numeric(12,2),
  taxa_adm           numeric(12,2),
  taxa_intermediacao numeric(12,2),
  lido_em            timestamptz not null default now()
);

create index if not exists contratos_locacao_recebimentos_pagamento on public.contratos_locacao_recebimentos (data_pagamento);
create index if not exists contratos_locacao_recebimentos_contrato on public.contratos_locacao_recebimentos (codigo_contrato);

alter table public.contratos_locacao_recebimentos enable row level security;
create policy "gestao e adm leem" on public.contratos_locacao_recebimentos
  for select to authenticated using ((select is_adm_ou_gestao()));
revoke all on public.contratos_locacao_recebimentos from anon, authenticated;
grant select on public.contratos_locacao_recebimentos to authenticated;

-- Views (recriadas: c.* ganhou colunas) --------------------------------------

drop view if exists public.vw_proprietarios_locacao;
drop view if exists public.vw_cobrancas_locacao;
drop view if exists public.vw_carteira_locacao;
drop view if exists public.vw_carteira_locacao_mensal;
drop view if exists public.vw_recebimentos_locacao_mensal;

create view public.vw_carteira_locacao
with (security_invoker = true) as
with cob as (
  select codigo_contrato,
         sum(saldo) filter (where not pagamento_informado) as valor,
         min(data_vencimento) filter (where not pagamento_informado) as desde,
         sum(saldo) filter (where pagamento_informado) as sem_baixa_valor,
         count(*) filter (where pagamento_informado) as sem_baixa_n
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
  case when c.data_inicio is null then null
       else (extract(year from age(coalesce(c.data_rescisao, case when c.situacao = 'Ativo' then current_date end, c.data_fim), c.data_inicio)) * 12
           + extract(month from age(coalesce(c.data_rescisao, case when c.situacao = 'Ativo' then current_date end, c.data_fim), c.data_inicio)))::int
  end as meses_de_contrato,
  case when c.situacao <> 'Ativo' then null
       when c.seguro_incendio_fim is null then 'sem_registro'
       when c.seguro_incendio_fim < current_date then 'vencido'
       when c.seguro_incendio_fim <= current_date + 30 then 'vence_30'
       else 'vigente'
  end as seguro_incendio_situacao,
  case when c.situacao <> 'Ativo' or c.garantia_fim is null then null
       when c.garantia_fim < current_date then 'vencida'
       when c.garantia_fim <= current_date + 60 then 'vence_60'
       else 'vigente'
  end as garantia_situacao,
  coalesce(cob.valor, 0) as cobranca_vencida_valor,
  cob.desde as cobranca_vencida_desde,
  coalesce(cob.sem_baixa_valor, 0) as sem_baixa_valor,
  coalesce(cob.sem_baixa_n, 0) as sem_baixa_n,
  case
    when c.situacao = 'Ativo' and c.status = 'Atrasado' then 'inadimplente'
    when c.situacao <> 'Ativo' and c.status = 'Atrasado' then 'encerrado_debito'
    when coalesce(cob.valor, 0) > 0 or coalesce(cob.sem_baixa_n, 0) > 0 then 'atencao'
  end as grupo_cobranca
from public.contratos_locacao c
left join cob on cob.codigo_contrato = c.codigo;

create view public.vw_cobrancas_locacao
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
  v.garantia,
  v.locatario_nome,
  v.imovel_resumo,
  v.bairro,
  v.grupo_cobranca
from public.contratos_locacao_cobrancas b
left join public.vw_carteira_locacao v on v.codigo = b.codigo_contrato;

-- Entradas e saídas por mês (o rescindido sem data usa a data de fim), com o valor dos novos.
create view public.vw_carteira_locacao_mensal
with (security_invoker = true) as
with base as (
  select data_inicio, valor_aluguel,
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
      and (saida is null or saida >= (m.mes + interval '1 month'))) as ativos_fim_mes,
  (select coalesce(sum(valor_aluguel), 0) from base where date_trunc('month', data_inicio) = m.mes) as aluguel_novos
from meses m;

-- O que entrou no caixa, pelo mês do pagamento.
create view public.vw_recebimentos_locacao_mensal
with (security_invoker = true) as
select
  date_trunc('month', data_pagamento)::date as mes,
  count(distinct codigo_contrato) as contratos_pagantes,
  sum(aluguel) as aluguel_recebido,
  sum(taxa_adm) as adm_recebida,
  sum(taxa_intermediacao) as intermediacao_recebida,
  sum(total_cobrado) as total_recebido
from public.contratos_locacao_recebimentos
group by 1;

-- Proprietários dos contratos ativos (participação pelo percentual de cada locador).
create view public.vw_proprietarios_locacao
with (security_invoker = true) as
select
  (l->>'codigo')::int as codigo_proprietario,
  max(l->>'nome') as nome,
  count(*) as contratos,
  round(sum(c.valor_aluguel * coalesce((l->>'percentual')::numeric, 100) / 100), 2) as aluguel_administrado,
  round(sum(c.receita_adm * coalesce((l->>'percentual')::numeric, 100) / 100), 2) as receita_adm
from public.vw_carteira_locacao c
cross join lateral jsonb_array_elements(c.locadores) l
where c.situacao = 'Ativo'
group by 1;

revoke all on public.vw_carteira_locacao, public.vw_cobrancas_locacao, public.vw_carteira_locacao_mensal,
  public.vw_recebimentos_locacao_mensal, public.vw_proprietarios_locacao from anon, authenticated;
grant select on public.vw_carteira_locacao, public.vw_cobrancas_locacao, public.vw_carteira_locacao_mensal,
  public.vw_recebimentos_locacao_mensal, public.vw_proprietarios_locacao to authenticated;

-- Carga --------------------------------------------------------------------------

drop function if exists public.carregar_carteira_locacao(jsonb, jsonb);

create or replace function public.carregar_carteira_locacao(contratos jsonb, cobrancas jsonb, pagas jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_contratos integer;
  n_cobrancas integer;
  n_pagas integer;
  foto record;
begin
  if jsonb_typeof(contratos) <> 'array' or jsonb_array_length(contratos) = 0 then
    raise exception 'carregar_carteira_locacao: lista de contratos vazia';
  end if;
  if jsonb_typeof(cobrancas) <> 'array' then
    raise exception 'carregar_carteira_locacao: cobrancas precisa ser uma lista';
  end if;
  if jsonb_typeof(coalesce(pagas, '[]'::jsonb)) <> 'array' then
    raise exception 'carregar_carteira_locacao: pagas precisa ser uma lista';
  end if;

  insert into contratos_locacao as t (
    codigo, codigo_imovel, imovel_resumo, imovel_tipo, imovel_endereco, destinacao, bairro, cidade, uf,
    locatario_codigo, locatario_nome, locatario_telefone, locatario_email,
    situacao, status, motivo_status,
    valor_aluguel, valor_condominio, taxa_adm, taxa_adm_tipo, taxa_intermediacao, taxa_intermediacao_tipo,
    garantia, garantia_forma, garantia_seguradora, garantia_fim, indice_reajuste,
    seguro_incendio_inicio, seguro_incendio_fim, seguro_incendio_seguradora,
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
    (imoview_endereco_partes(c#>>'{imoveis,0,endereco}'))[1],
    (imoview_endereco_partes(c#>>'{imoveis,0,endereco}'))[2],
    upper((imoview_endereco_partes(c#>>'{imoveis,0,endereco}'))[3]),
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
    nullif(c#>>'{garantialocaticia,forma}', ''),
    nullif(c#>>'{garantialocaticia,seguradora}', ''),
    imoview_data(c#>>'{garantialocaticia,datafim}'),
    nullif(c->>'indicereajuste', ''),
    imoview_data(c#>>'{seguroincendio,datainicio}'),
    imoview_data(c#>>'{seguroincendio,datafim}'),
    nullif(c#>>'{seguroincendio,seguradora}', ''),
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
    -- payload cru sem CPF/CNPJ: tira os campos e mascara o que vier no meio de textos (ex.: resumo do locador)
    mascarar_documentos((c - 'locatariocpf') || jsonb_build_object('imoveis', coalesce((
      select jsonb_agg(i || jsonb_build_object('locadores', coalesce((
        select jsonb_agg(l - 'cpfcnpj' - 'responsavelfiscalcpfcnpj')
        from jsonb_array_elements(coalesce(i->'locadores', '[]'::jsonb)) l
      ), '[]'::jsonb)))
      from jsonb_array_elements(coalesce(c->'imoveis', '[]'::jsonb)) i
    ), '[]'::jsonb))),
    now()
  from jsonb_array_elements(contratos) c
  on conflict (codigo) do update set
    codigo_imovel = excluded.codigo_imovel,
    imovel_resumo = excluded.imovel_resumo,
    imovel_tipo = excluded.imovel_tipo,
    imovel_endereco = excluded.imovel_endereco,
    destinacao = excluded.destinacao,
    bairro = excluded.bairro,
    cidade = excluded.cidade,
    uf = excluded.uf,
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
    garantia_forma = excluded.garantia_forma,
    garantia_seguradora = excluded.garantia_seguradora,
    garantia_fim = excluded.garantia_fim,
    indice_reajuste = excluded.indice_reajuste,
    seguro_incendio_inicio = excluded.seguro_incendio_inicio,
    seguro_incendio_fim = excluded.seguro_incendio_fim,
    seguro_incendio_seguradora = excluded.seguro_incendio_seguradora,
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

  -- Cobranças em aberto e vencidas: a lista é sempre a foto atual. As que já têm
  -- data de pagamento ficam marcadas (pagas e ainda sem baixa no Imoview).
  delete from contratos_locacao_cobrancas where true;
  insert into contratos_locacao_cobrancas (codigo, codigo_contrato, codigo_imovel, historico, data_vencimento, saldo,
                                           pagamento_informado, data_pagamento_informada, lido_em)
  select distinct on ((m->>'codigo')::int)
    (m->>'codigo')::int,
    (m->>'codigocontratoaluguel')::int,
    nullif(m->>'codigoimovel', '')::int,
    nullif(m->>'historico', ''),
    imoview_data(m->>'datavencimento'),
    imoview_numero(m->>'saldo'),
    imoview_data(m->>'datapagamento') is not null,
    imoview_data(m->>'datapagamento'),
    now()
  from jsonb_array_elements(cobrancas) m
  where (m->>'modulo')::int = 2
    and coalesce(nullif(m->>'codigocontratoaluguel', '')::int, 0) > 0
    and imoview_data(m->>'datavencimento') < current_date
  order by (m->>'codigo')::int;
  get diagnostics n_cobrancas = row_count;

  -- Pagas: acumulam (upsert). Aluguel = plano 7.1.1 da cobrança; administração (1.1.1.1)
  -- e intermediação (1.1.1.2) = o que foi retido no repasse ao locador.
  insert into contratos_locacao_recebimentos as r (
    codigo, codigo_contrato, codigo_imovel, data_vencimento, data_pagamento,
    total_cobrado, aluguel, taxa_adm, taxa_intermediacao, lido_em
  )
  select distinct on ((m->>'codigo')::int)
    (m->>'codigo')::int,
    (m->>'codigocontratoaluguel')::int,
    nullif(m->>'codigoimovel', '')::int,
    imoview_data(m->>'datavencimento'),
    imoview_data(m->>'datapagamento'),
    (select coalesce(sum(imoview_numero(d->>'valor')), 0) from jsonb_array_elements(coalesce(m->'detalhes', '[]'::jsonb)) d),
    (select coalesce(sum(imoview_numero(d->>'valor')), 0) from jsonb_array_elements(coalesce(m->'detalhes', '[]'::jsonb)) d
      where d->>'codigocontabilplanoconta' = '7.1.1'),
    (select coalesce(sum(imoview_numero(d->>'valor')), 0)
       from jsonb_array_elements(coalesce(m->'repasses', '[]'::jsonb)) rp
       cross join lateral jsonb_array_elements(coalesce(rp->'detalhes', '[]'::jsonb)) d
      where rp->>'tipocliente' = 'Locador' and d->>'codigocontabilplanoconta' = '1.1.1.1'),
    (select coalesce(sum(imoview_numero(d->>'valor')), 0)
       from jsonb_array_elements(coalesce(m->'repasses', '[]'::jsonb)) rp
       cross join lateral jsonb_array_elements(coalesce(rp->'detalhes', '[]'::jsonb)) d
      where rp->>'tipocliente' = 'Locador' and d->>'codigocontabilplanoconta' = '1.1.1.2'),
    now()
  from jsonb_array_elements(coalesce(pagas, '[]'::jsonb)) m
  where (m->>'modulo')::int = 2
    and coalesce(nullif(m->>'codigocontratoaluguel', '')::int, 0) > 0
    and imoview_data(m->>'datapagamento') is not null
  order by (m->>'codigo')::int
  on conflict (codigo) do update set
    codigo_contrato = excluded.codigo_contrato,
    codigo_imovel = excluded.codigo_imovel,
    data_vencimento = excluded.data_vencimento,
    data_pagamento = excluded.data_pagamento,
    total_cobrado = excluded.total_cobrado,
    aluguel = excluded.aluguel,
    taxa_adm = excluded.taxa_adm,
    taxa_intermediacao = excluded.taxa_intermediacao,
    lido_em = excluded.lido_em;
  get diagnostics n_pagas = row_count;

  select
    count(*) filter (where situacao = 'Ativo') as ativos,
    count(*) filter (where situacao = 'Moderação') as em_ativacao,
    coalesce(sum(valor_aluguel) filter (where situacao = 'Ativo'), 0) as soma_aluguel,
    coalesce(sum(receita_adm), 0) as receita_adm,
    count(*) filter (where grupo_cobranca = 'inadimplente') as inadimplentes,
    coalesce(sum(cobranca_vencida_valor) filter (where grupo_cobranca = 'inadimplente'), 0) as inadimplentes_valor,
    count(*) filter (where grupo_cobranca = 'atencao') as atencao,
    coalesce(sum(cobranca_vencida_valor + sem_baixa_valor) filter (where grupo_cobranca = 'atencao'), 0) as atencao_valor,
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
    'pagas', n_pagas,
    'foto', to_jsonb(foto)
  );
end;
$$;

revoke execute on function public.carregar_carteira_locacao(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.carregar_carteira_locacao(jsonb, jsonb, jsonb) to service_role;
