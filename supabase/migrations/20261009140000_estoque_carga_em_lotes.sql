-- Carga do estoque em lotes (09/10). A 1ª carga mandou ~4.450 imóveis numa chamada
-- só e travou o banco do plano Free por ~30 min (Hub e TV fora do ar até o restart).
-- Agora o n8n manda lotes de 250 imóveis; todos os lotes de uma execução levam o
-- mesmo `iniciada_em`, e só o último (`finalizar`) confere o total e registra a carga.

drop function if exists public.carregar_estoque_imoveis(text, integer, jsonb, integer[]);

create or replace function public.carregar_estoque_imoveis(
  finalidade text,
  quantidade_api integer,
  imoveis jsonb,
  publicados integer[] default '{}',
  iniciada_em timestamptz default null,
  finalizar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  n integer;
  lidos integer;
  inicio timestamptz := coalesce(iniciada_em, now());
begin
  if finalidade not in ('Aluguel', 'Venda') then
    raise exception 'carregar_estoque_imoveis: finalidade precisa ser Aluguel ou Venda';
  end if;
  if jsonb_typeof(imoveis) <> 'array' or jsonb_array_length(imoveis) = 0 then
    raise exception 'carregar_estoque_imoveis: lista de imóveis vazia';
  end if;
  if jsonb_array_length(imoveis) > 500 then
    raise exception 'carregar_estoque_imoveis: lote grande demais (% imóveis, máx. 500)', jsonb_array_length(imoveis);
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

  if not finalizar then
    return jsonb_build_object('finalidade', finalidade, 'gravados_no_lote', n);
  end if;

  -- Último lote: confere o total desta execução e registra a carga.
  select count(*) into lidos from imoveis_estoque t
  -- folga de 10 min: o relógio do n8n pode estar à frente do banco
  where t.finalidade = carregar_estoque_imoveis.finalidade and t.lido_em >= inicio - interval '10 minutes';

  if quantidade_api is not null and lidos < quantidade_api then
    raise exception 'carregar_estoque_imoveis: carga incompleta (% de %). Carga não registrada.', lidos, quantidade_api;
  end if;

  insert into estoque_cargas (finalidade, quantidade_api, quantidade_lida, publicados, feita_em)
  values (finalidade, quantidade_api, lidos, coalesce(cardinality(publicados), 0), now());

  return jsonb_build_object('finalidade', finalidade, 'gravados_no_lote', n, 'lidos_na_carga', lidos,
                            'quantidade_api', quantidade_api, 'publicados', coalesce(cardinality(publicados), 0));
end;
$$;

revoke execute on function public.carregar_estoque_imoveis(text, integer, jsonb, integer[], timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.carregar_estoque_imoveis(text, integer, jsonb, integer[], timestamptz, boolean) to service_role;
