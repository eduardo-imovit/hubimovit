-- Busca do estoque para corretor e Gestão (PRD §5.14, revisão de 16/10; Schema §2.11).
--
-- O corretor não lê `imoveis_estoque` (RLS só da Gestão, e o `payload` guarda chaves,
-- comissão e matrícula). As duas funções abaixo são `security definer`, conferem o papel
-- e devolvem só a ficha comercial: rua sem número; sem número, complemento, CEP,
-- coordenadas, chaves, taxas, cartório, proprietário ou anotações.

-- Ficha comercial de todo o estoque (~1.300 imóveis); a busca e as margens rodam no navegador.
create or replace function public.estoque_busca()
returns table (
  codigo              integer,
  finalidade          text,
  situacao            text,
  tipo                text,
  titulo              text,
  logradouro          text,
  bairro              text,
  cidade              text,
  condominio          text,
  valor               numeric,
  valor_condominio    numeric,
  valor_iptu          numeric,
  area_principal      numeric,
  area_lote           numeric,
  quartos             smallint,
  suites              smallint,
  banheiros           smallint,
  vagas               smallint,
  caracteristicas     text[],
  captadores          text[],
  foto                text,
  no_site             boolean,
  tem_video           boolean,
  dias_sem_atualizar  integer,
  desatualizado       boolean,
  cadastrado_em       timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(papel_atual(), '') not in ('corretor', 'gestao') then
    raise exception 'sem acesso à busca do estoque' using errcode = '42501';
  end if;

  return query
  select
    v.codigo, v.finalidade, v.situacao, v.tipo, v.titulo,
    nullif(v.logradouro, ''), v.bairro, v.cidade, nullif(v.condominio, ''),
    v.valor, v.valor_condominio, v.valor_iptu, v.area_principal, v.area_lote,
    v.quartos, v.suites, v.banheiros, v.vagas,
    -- só as marcações de imóvel/condomínio (lista fechada) + os "extras" marcados
    array(
      select k.key from jsonb_each(v.payload) k
      where k.value = 'true'::jsonb
        and k.key = any (array[
          'academia','aceitafinanciamento','aceitapermuta','aguaindividual','alarme','aquecedoreletrico',
          'aquecedorgas','aquecedorsolar','arcondicionado','areaprivativa','areaservico','armariobanheiro',
          'armariocozinha','armarioquarto','beachtenis','box','boxdespejo','cabeamentoestruturado',
          'cercaeletrica','churrasqueira','circuitotv','closet','conexaointernet','dce','despensa',
          'escritorio','espacogourmet','garageband','gascanalizado','gramado','hidromassagem','homecinema',
          'interfone','jardim','lareira','lavabo','lavanderia','mobiliado','naplanta','permiteanimais',
          'piscina','playground','portaoeletronico','portaria24horas','quadraesportiva','quadrasquash',
          'quadratenis','quintal','rouparia','salamassagem','salaofestas','salaojogos','sauna',
          'seguranca24horas','solmanha','tvacabo','varandagourmet','vistalago','vistamar','vistamontanha','wifi'
        ])
      union
      select 'extra:' || x.key
      from jsonb_array_elements(case when jsonb_typeof(v.payload -> 'extras') = 'array' then v.payload -> 'extras' else '[]'::jsonb end) a,
           jsonb_each_text(case when jsonb_typeof(a) = 'object' then a else '{}'::jsonb end) x
      where x.value = 'true'
    ),
    v.captadores,
    nullif(coalesce(nullif(v.payload ->> 'urlfotoprincipalm', ''), v.payload ->> 'urlfotoprincipal'), ''),
    v.no_site, v.tem_video,
    v.dias_sem_atualizar, v.desatualizado, v.cadastrado_em
  from vw_estoque_imoveis v
  order by v.codigo, v.finalidade;
end;
$$;

-- Bairros do estoque e os vizinhos a até 2 km (pelo centro dos imóveis de cada bairro).
-- Serve à "região" da busca e à margem "outro bairro a até 2 km" sem expor coordenadas.
create or replace function public.estoque_bairros()
returns table (bairro text, cidade text, n integer, vizinhos text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(papel_atual(), '') not in ('corretor', 'gestao') then
    raise exception 'sem acesso à busca do estoque' using errcode = '42501';
  end if;

  return query
  with pontos as (
    select v.bairro, v.cidade, v.latitude::float8 as lat, v.longitude::float8 as lng
    from vw_estoque_imoveis v
    where coalesce(v.bairro, '') <> ''
  ),
  centros as (
    select p.bairro, p.cidade, count(*)::int as n,
           avg(p.lat) filter (where p.lat between -24.5 and -21.5 and p.lng between -48.5 and -45.5) as lat,
           avg(p.lng) filter (where p.lat between -24.5 and -21.5 and p.lng between -48.5 and -45.5) as lng
    from pontos p
    group by p.bairro, p.cidade
  )
  select c.bairro, c.cidade, c.n,
    coalesce(array(
      select o.bairro from centros o
      where o.bairro <> c.bairro and c.lat is not null and o.lat is not null
        and 12742 * asin(sqrt(
              power(sin(radians(o.lat - c.lat) / 2), 2)
              + cos(radians(c.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - c.lng) / 2), 2)
            )) <= 2
      order by o.n desc
    ), '{}')
  from centros c
  order by c.n desc, c.bairro;
end;
$$;

revoke all on function public.estoque_busca(), public.estoque_bairros() from public, anon;
grant execute on function public.estoque_busca(), public.estoque_bairros() to authenticated;
