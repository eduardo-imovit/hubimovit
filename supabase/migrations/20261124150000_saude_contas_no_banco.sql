-- Fase 29a · Sprint B — Saúde Imovit: as 6 contas que a tela fazia direto nas tabelas passam para o banco
-- (PRD §5.23 "Sprint B", Schema §2.22 "Sprint B"). Objetivo: tela e banco nunca divergirem.
--
-- Antes (S3, 24/11): 6 hooks liam vw_atendimentos_base, vw_jornada_etapas, atividades, crm_atendimento_jornada,
-- dashboard_meta_ads/google_ads e refaziam regras do banco no navegador (finalidade "loca"/"vend", régua de sinal
-- `numeroLocal`, qualificado em 7 dias…). Agora:
--   agregados  → blocos novos no jsonb da saude_imovit():
--     performance.serie_conversoes   (conversões Meta + Google × leads pagos no CRM, por dia)
--     performance.tempo_resposta     (mediana entrada → 1ª resposta do Imoview, % na meta, sem registro)
--     comercial.coorte               (entrou no período → qualificado / visita / proposta até hoje, × coorte anterior;
--                                     total e por canal, com o sinal da saude_num — a régua de sinal fica só no banco)
--     comercial.agora.parado         (funil das 6 fases em aberto, com +7/+15/+30 dias parado; total e por canal)
--   listas     → funções irmãs, chamadas só no clique (são pesadas):
--     saude_lista(p_inicio, p_fim, p_finalidade, p_etapa, p_canal, p_midia)   degraus da escada e fatias das pizzas
--     saude_lista_agora(p_finalidade, p_canal, p_posicao, p_parado)            quem está parado em cada fase
-- Acesso igual ao da página: Gestão e Marketing (pode_ver_saude); corretor e anon barrados.
-- Depende da 20261124120000 (locação por contratos) aplicada antes; não muda saude_linhas() nem a foto semanal.

------------------------------------------------------------------------------------------
-- 1. Finalidade da tela → finalidade do banco (todas | locacao | venda → null | Aluguel | Venda)
------------------------------------------------------------------------------------------
create or replace function public.saude_fin(p_finalidade text)
returns text language plpgsql immutable as $$
begin
  if coalesce(p_finalidade, 'todas') not in ('todas', 'locacao', 'venda') then
    raise exception 'Finalidade inválida: % (use todas, locacao ou venda)', p_finalidade using errcode = '22023';
  end if;
  return case p_finalidade when 'locacao' then 'Aluguel' when 'venda' then 'Venda' end;
end;
$$;

------------------------------------------------------------------------------------------
-- 2. 1ª resposta oficial do Imoview: minutos entre datahoraentradalead e datahora1Resposta (payload da jornada).
--    Os dois campos são iguais em todas as linhas de um atendimento (conferido 24/11); resposta antes da
--    entrada = sem registro.
------------------------------------------------------------------------------------------
create or replace function public.saude_respostas(p_codigos bigint[])
returns table (codigo bigint, minutos numeric)
language sql stable security definer set search_path = public as $$
  with t as (
    select j.codigo,
           min(case when j.payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}'
                    then to_timestamp(left(j.payload->>'datahoraentradalead', 16), 'DD/MM/YYYY HH24:MI') end) as entrada,
           min(case when j.payload->>'datahora1Resposta' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}'
                    then to_timestamp(left(j.payload->>'datahora1Resposta', 16), 'DD/MM/YYYY HH24:MI') end) as resposta
    from crm_atendimento_jornada j
    where j.codigo = any(p_codigos)
    group by j.codigo
  )
  select t.codigo,
         case when t.resposta >= t.entrada then round(extract(epoch from t.resposta - t.entrada) / 60, 1) end
  from t
$$;

------------------------------------------------------------------------------------------
-- 3. Série "ações de conversão × leads no CRM" (antes useSerieConversoes.js)
--    Meta e Google = leads_conversoes das plataformas (finalidade pelo nome da campanha, mesma regra da
--    saude_linhas); CRM = leads do canal "Campanhas pagas" por data_entrada, sem ruído/interno.
------------------------------------------------------------------------------------------
create or replace function public.saude_serie_conversoes(p_ini date, p_fim date, p_fin text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select g::date as dia from generate_series(p_ini, p_fim, interval '1 day') g),
  ads as (
    select 'meta' as plat, data, campanha, leads_conversoes::numeric as conv, investimento::numeric as inv
      from dashboard_meta_ads where data between p_ini and p_fim
    union all
    select 'google', data, campanha, leads_conversoes::numeric, investimento::numeric
      from dashboard_google_ads where data between p_ini and p_fim
  ),
  a as (
    select data as dia,
           coalesce(sum(conv) filter (where plat = 'meta'), 0) as meta,
           coalesce(sum(conv) filter (where plat = 'google'), 0) as google,
           coalesce(sum(inv), 0) as inv
    from ads
    where p_fin is null or (p_fin = 'Aluguel' and campanha ~* 'loca') or (p_fin = 'Venda' and campanha ~* 'vend')
    group by data
  ),
  c as (
    select data_entrada as dia, count(*) as n
    from vw_atendimentos_base
    where canal = 'Campanhas pagas' and data_entrada between p_ini and p_fim
      and not is_ruido and not is_interno and (p_fin is null or finalidade = p_fin)
    group by data_entrada
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia,
           'meta', round(coalesce(a.meta, 0), 2),
           'google', round(coalesce(a.google, 0), 2),
           'plataformas', round(coalesce(a.meta, 0) + coalesce(a.google, 0), 2),   -- 2 casas: a soma do período fecha com o total das plataformas
           'crm', coalesce(c.n, 0),
           'investimento', round(coalesce(a.inv, 0), 2)) order by d.dia), '[]')
  from d left join a using (dia) left join c using (dia)
$$;

------------------------------------------------------------------------------------------
-- 4. Tempo de resposta dos leads pagos (antes useTempoResposta.js). Sempre Venda e Locação, nessa ordem,
--    sem seguir o filtro de finalidade (decisão do Eduardo, 24/11). Metas: locação 5 min, venda 30 min.
------------------------------------------------------------------------------------------
create or replace function public.saude_tempo_resposta(p_ini date, p_fim date)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as materialized (
    select codigo, finalidade from vw_atendimentos_base
    where canal = 'Campanhas pagas' and data_entrada between p_ini and p_fim
      and not is_ruido and not is_interno and finalidade in ('Venda', 'Aluguel')
  ),
  r as (select * from saude_respostas((select coalesce(array_agg(codigo), '{}') from l))),
  g as (
    select f.fin, f.meta, f.ordem,
           count(l.codigo) as leads,
           count(r.minutos) as com_registro,
           count(*) filter (where r.minutos <= f.meta) as dentro_meta,
           percentile_cont(0.5) within group (order by r.minutos) as mediana
    from (values ('Venda', 30, 1), ('Aluguel', 5, 2)) f(fin, meta, ordem)
    left join l on l.finalidade = f.fin
    left join r on r.codigo = l.codigo
    group by f.fin, f.meta, f.ordem
  )
  select jsonb_agg(jsonb_build_object(
           'finalidade', fin, 'meta', meta, 'leads', leads, 'com_registro', com_registro,
           'sem_registro', leads - com_registro, 'dentro_meta', dentro_meta,
           'mediana', round(mediana::numeric, 1),
           'regra', 'minutos entre a entrada do lead e a 1ª resposta gravada pelo Imoview (datahora1Resposta)')
         order by ordem)
  from g
$$;

------------------------------------------------------------------------------------------
-- 5. Coorte do Comercial (antes useCoorteComercial.js): dos atendimentos que ENTRARAM no período,
--    quantos já chegaram até hoje a qualificado (posição ≥ 4, a qualquer momento), visita (atividade
--    "Visita" realizada, qualquer data) e proposta (posição ≥ 6). Atual e anterior numa leitura só.
------------------------------------------------------------------------------------------
create or replace function public.saude_coorte(p_ini date, p_fim date, p_ant_ini date, p_ant_fim date, p_fin text default null)
returns table (periodo text, nivel text, canal text, atendimentos int, qualificados int, visitas int, propostas int)
language sql stable security definer set search_path = public as $$
  with l as materialized (
    select b.codigo, b.canal,
           case when b.data_entrada between p_ini and p_fim then 'atual' else 'anterior' end as periodo
    from vw_atendimentos_base b
    where (b.data_entrada between p_ini and p_fim or b.data_entrada between p_ant_ini and p_ant_fim)
      and not b.is_ruido and not b.is_interno and (p_fin is null or b.finalidade = p_fin)
  ),
  e as (select j.codigo, max(j.posicao) as mx from vw_jornada_etapas j
         where j.posicao >= 4 and j.codigo in (select codigo from l) group by j.codigo),
  v as (select distinct a.codigoatendimento::bigint as codigo from atividades a
         where a.nometipo = 'Visita' and a.realizada and a.codigoatendimento in (select codigo from l))
  select l.periodo,
         case when grouping(l.canal) = 0 then 'canal' else 'total' end,
         l.canal,
         count(*)::int, count(e.codigo)::int, count(v.codigo)::int, count(*) filter (where e.mx >= 6)::int
  from l left join e using (codigo) left join v using (codigo)
  group by grouping sets ((l.periodo), (l.periodo, l.canal))
$$;

------------------------------------------------------------------------------------------
-- 6. Funil agora com tempo parado (antes useFunilAgora.js): em aberto hoje (is_ativo, sem ruído/interno)
--    nas 6 fases do Kanban; "parado há mais de N dias" = dias_parado > N (vazio conta 0). Total e por canal.
--    Mesmo total de atendimentos_abertos da saude_agora().
------------------------------------------------------------------------------------------
create or replace function public.saude_funil_parado(p_fin text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (
    select canal, fase_ordem, coalesce(dias_parado, 0) as dp
    from vw_atendimentos_base
    where is_ativo and not is_ruido and not is_interno and (p_fin is null or finalidade = p_fin)
      and fase_ordem between 1 and 6
  ),
  g as (
    select grouping(canal) = 1 as total, canal, fase_ordem as posicao,
           count(*) as abertos,
           count(*) filter (where dp > 7) as mais_7,
           count(*) filter (where dp > 15) as mais_15,
           count(*) filter (where dp > 30) as mais_30
    from b group by grouping sets ((fase_ordem), (canal, fase_ordem))
  )
  select jsonb_build_object(
    'regra', 'em aberto hoje por fase; parado há mais de N dias = dias_parado > N',
    'total', coalesce((select jsonb_agg(jsonb_build_object('posicao', posicao, 'abertos', abertos, 'mais_7', mais_7,
                                                           'mais_15', mais_15, 'mais_30', mais_30) order by posicao)
                       from g where total), '[]'),
    'por_canal', coalesce((select jsonb_agg(jsonb_build_object('canal', canal, 'posicao', posicao, 'abertos', abertos,
                                                               'mais_7', mais_7, 'mais_15', mais_15, 'mais_30', mais_30)
                                            order by canal, posicao)
                           from g where not total), '[]'))
$$;

------------------------------------------------------------------------------------------
-- 7. Lista de quem está atrás de um número (antes useListaPagos.js): degraus da escada paga e fatias
--    das pizzas. Mesmas regras da saude_linhas():
--      leads        entrada no período
--      qualificados desses, 1ª posição ≥ 4 em até 7 dias da entrada (D4)
--      visitas      atividades "Visita" realizadas no período, com atendimento (D6)
--      propostas    1ª entrada na posição 6 no período
--      descartados  descartes com data no período, com o motivo
--    Recortes: finalidade, canal, mídia (midia_raw; "(sem mídia)" quando vazia). Nome = atividades.nomepessoa
--    mais recente (só existe para quem tem atividade); resposta_min = 1ª resposta do Imoview.
--    Negócios ainda não abrem lista.
------------------------------------------------------------------------------------------
create or replace function public.saude_lista(p_inicio date, p_fim date, p_finalidade text, p_etapa text,
                                              p_canal text default null, p_midia text default null)
returns table (codigo bigint, nome text, resposta_min numeric, quando text, quem text, motivo text,
               corretor text, canal text, midia_raw text, finalidade text, fase_label text, situacao text,
               data_entrada date)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_fin text;
begin
  if not pode_ver_saude() then
    raise exception 'Sem acesso à Saúde Imovit' using errcode = '42501';
  end if;
  v_fin := saude_fin(p_finalidade);
  if p_etapa = 'negocios' then
    raise exception 'a lista de negócios ainda não está disponível' using errcode = '0A000';
  end if;
  if p_etapa is null or p_etapa not in ('leads', 'qualificados', 'visitas', 'propostas', 'descartados') then
    raise exception 'Etapa inválida: % (use leads, qualificados, visitas, propostas ou descartados)', p_etapa using errcode = '22023';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 366 then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  return query
  with b as materialized (
    select x.codigo, x.corretor, x.canal, x.midia_raw, x.finalidade, x.fase_label, x.situacao, x.data_entrada
    from vw_atendimentos_base x
    where not x.is_ruido and not x.is_interno
      and (v_fin is null or x.finalidade = v_fin)
      and (p_canal is null or x.canal = p_canal)
      and (p_midia is null or coalesce(x.midia_raw, '(sem mídia)') = p_midia)
  ),
  ev as (
    select b.codigo, null::text as quando, null::text as quem, null::text as motivo, b.data_entrada::text as ordem
      from b where p_etapa = 'leads' and b.data_entrada between p_inicio and p_fim
    union all
    select b.codigo, q.quando::text, null, null, q.quando::text
      from b join (select j.codigo, min(j.entrou_em) as quando from vw_jornada_etapas j where j.posicao >= 4 group by j.codigo) q
           on q.codigo = b.codigo
     where p_etapa = 'qualificados' and b.data_entrada between p_inicio and p_fim and q.quando <= b.data_entrada + 7
    union all
    select b.codigo, to_char(a.datahorainicio, 'YYYY-MM-DD HH24:MI'), a.nomeusuario, null, a.datahorainicio::text
      from atividades a join b on b.codigo = a.codigoatendimento
     where p_etapa = 'visitas' and a.nometipo = 'Visita' and a.realizada
       and a.datahorainicio >= p_inicio and a.datahorainicio < p_fim + 1
    union all
    select b.codigo, p6.quando::text, null, null, p6.quando::text
      from b join (select j.codigo, min(j.entrou_em) as quando from vw_jornada_etapas j where j.posicao = 6 group by j.codigo) p6
           on p6.codigo = b.codigo
     where p_etapa = 'propostas' and p6.quando between p_inicio and p_fim
    union all
    select b.codigo, d.descartado_em::text, null, d.motivo, d.descartado_em::text
      from vw_jornada_descartes d join b on b.codigo = d.codigo
     where p_etapa = 'descartados' and d.descartado_em between p_inicio and p_fim
  ),
  r as (select * from saude_respostas((select coalesce(array_agg(distinct ev.codigo), '{}') from ev)))
  select ev.codigo,
         (select a.nomepessoa from atividades a
           where a.codigoatendimento = ev.codigo and a.nomepessoa is not null
           order by a.datahorainicio desc nulls last limit 1),
         r.minutos, ev.quando, ev.quem, ev.motivo,
         b.corretor, b.canal, b.midia_raw, b.finalidade, b.fase_label, b.situacao, b.data_entrada
  from ev join b on b.codigo = ev.codigo left join r on r.codigo = ev.codigo
  order by ev.ordem, ev.codigo;
end;
$$;

------------------------------------------------------------------------------------------
-- 8. Lista do funil agora (antes feita na tela): quem está em aberto numa fase, parado há mais de N dias,
--    do mais parado para o menos. Mesma base do bloco comercial.agora.parado.
------------------------------------------------------------------------------------------
create or replace function public.saude_lista_agora(p_finalidade text, p_canal text default null,
                                                    p_posicao int default null, p_parado int default 0)
returns table (codigo bigint, dias_parado int, posicao int, fase_label text, corretor text, canal text,
               midia_raw text, finalidade text, data_entrada date)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_fin text;
begin
  if not pode_ver_saude() then
    raise exception 'Sem acesso à Saúde Imovit' using errcode = '42501';
  end if;
  v_fin := saude_fin(p_finalidade);
  return query
  select x.codigo, x.dias_parado, x.fase_ordem, x.fase_label, x.corretor, x.canal, x.midia_raw, x.finalidade, x.data_entrada
  from vw_atendimentos_base x
  where x.is_ativo and not x.is_ruido and not x.is_interno
    and x.fase_ordem between 1 and 6
    and (v_fin is null or x.finalidade = v_fin)
    and (p_canal is null or x.canal = p_canal)
    and (p_posicao is null or x.fase_ordem = p_posicao)
    and coalesce(x.dias_parado, 0) > coalesce(p_parado, 0)
  order by coalesce(x.dias_parado, 0) desc, x.codigo;
end;
$$;

------------------------------------------------------------------------------------------
-- 9. A página: saude_imovit(p_inicio, p_fim, p_finalidade) → jsonb
--    Igual à 20261123170000 (aplicada como 20261124110548) + 4 blocos novos (Sprint B):
--    performance.serie_conversoes, performance.tempo_resposta, comercial.coorte, comercial.agora.parado.
------------------------------------------------------------------------------------------
create or replace function public.saude_imovit(p_inicio date default null, p_fim date default null,
                                               p_finalidade text default 'todas')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_fim date := coalesce(p_fim, (now() at time zone 'America/Sao_Paulo')::date - 1);
  v_ini date;
  v_len int;
  v_ant_ini date;
  v_ant_fim date;
  v_fin text;
  v_chave text := coalesce(p_finalidade, 'todas');
  v_parcial boolean;
  v_linhas jsonb;
  v_total jsonb;
  v_pagos jsonb;
  v_agora jsonb;
  v_ref jsonb;
  v_cart jsonb;
  v_revisadas jsonb;
  v_coorte jsonb;
begin
  if not pode_ver_saude() then
    raise exception 'Sem acesso à Saúde Imovit' using errcode = '42501';
  end if;
  if v_chave not in ('todas', 'locacao', 'venda') then
    raise exception 'Finalidade inválida: % (use todas, locacao ou venda)', p_finalidade using errcode = '22023';
  end if;
  v_ini := coalesce(p_inicio, v_fim - 29);
  if v_fim < v_ini then raise exception 'Fim antes do início' using errcode = '22023'; end if;
  v_len := v_fim - v_ini + 1;
  if v_len > 366 then raise exception 'Período máximo: 366 dias' using errcode = '22023'; end if;
  v_ant_fim := v_ini - 1;
  v_ant_ini := v_ini - v_len;
  v_fin := case v_chave when 'locacao' then 'Aluguel' when 'venda' then 'Venda' end;
  v_parcial := v_fim + 7 >= v_hoje;                                   -- D4: coorte só fecha 7 dias depois

  -- 9.1 Todas as linhas: atual × anterior
  with a as (select * from saude_linhas(v_ini, v_fim, v_fin)),
       b as (select * from saude_linhas(v_ant_ini, v_ant_fim, v_fin)),
       j as (
         select coalesce(a.nivel, b.nivel) as nivel, coalesce(a.pai, b.pai) as pai, coalesce(a.chave, b.chave) as chave,
                saude_linha(coalesce(to_jsonb(a), to_jsonb(b) - array['investimento','impressoes','cliques','conv_plataforma','leads',
                                       'qualificados','visitas','propostas','descartados','negocios']
                                       || jsonb_build_object('comissao_venda', 0, 'taxa_adm', 0, 'intermediacao', 0,
                                                             'vgv_venda', 0, 'aluguel_locacao', 0, 'contratos_locacao', 0)
                                       || case when b.leads is not null then jsonb_build_object('leads', 0, 'qualificados', 0, 'visitas', 0,
                                              'propostas', 0, 'descartados', 0, 'negocios', 0) else '{}' end
                                       || case when b.investimento is not null then jsonb_build_object('investimento', 0, 'impressoes', 0,
                                              'cliques', 0, 'conv_plataforma', 0) else '{}' end),
                            to_jsonb(b), v_parcial) as linha
         from a full join b
           on a.nivel = b.nivel and coalesce(a.pai, '') = coalesce(b.pai, '') and coalesce(a.chave, '') = coalesce(b.chave, '')
       )
  select jsonb_object_agg(nivel, linhas) into v_linhas
  from (select nivel, jsonb_agg(linha order by coalesce((linha->'investimento'->>'valor')::numeric, 0) desc,
                                         coalesce((linha->'leads'->>'valor')::numeric, 0) desc, chave) as linhas
        from j group by nivel) z;

  v_total := v_linhas->'total'->0;
  v_pagos := (select l from jsonb_array_elements(v_linhas->'canal') l where l->>'chave' = 'Campanhas pagas');

  -- 9.2 "Agora": ao vivo; referência = foto da semana anterior e média das até 8 fotos semanais (D11)
  v_agora := saude_agora(v_fin);
  select jsonb_build_object(
    'atendimentos_abertos', saude_num((v_agora->>'atendimentos_abertos')::numeric,
        (array_agg((f.agora->v_chave->>'atendimentos_abertos')::numeric order by f.semana desc))[1], 'agora', false, 5,
        avg((f.agora->v_chave->>'atendimentos_abertos')::numeric), count(*)::int),
    'parados_gargalo', saude_num((v_agora->'gargalo'->>'parados')::numeric,
        (array_agg((f.agora->v_chave->'gargalo'->>'parados')::numeric order by f.semana desc))[1], 'agora', true, 5,
        avg((f.agora->v_chave->'gargalo'->>'parados')::numeric), count(*)::int),
    'dinheiro_mesa', saude_num((v_agora->'dinheiro_mesa'->>'total')::numeric,
        (array_agg((f.agora->v_chave->'dinheiro_mesa'->>'total')::numeric order by f.semana desc))[1], 'agora', false, 0,
        avg((f.agora->v_chave->'dinheiro_mesa'->>'total')::numeric), count(*)::int))
    into v_ref
    from (select * from saude_fotos where semana < date_trunc('week', v_hoje)::date order by semana desc limit 8) f;

  -- 9.3 Carteira (só locação): taxa adm do período × anterior; ativos, atraso e saídas na data fim × semana anterior
  --     × média das 8 semanas anteriores (reconstruído); contratos novos no último trimestre
  if v_chave in ('todas', 'locacao') then
    with c as (select * from saude_carteira_em(v_fim)),
         h as (select k, s.* from generate_series(1, 8) k, lateral saude_carteira_em(v_fim - 7 * k) s),
         tri as (select
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio > (v_fim - interval '3 months')::date and data_inicio <= v_fim) as atual,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio > (v_fim - interval '6 months')::date and data_inicio <= (v_fim - interval '3 months')::date) as anterior,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio between v_ini and v_fim) as no_periodo,
                   (select count(*) from contratos_locacao where situacao <> 'Cancelado'
                      and data_inicio between v_ant_ini and v_ant_fim) as no_periodo_anterior)
    select jsonb_build_object(
      'taxa_adm', saude_num((v_total->'receita_referencia'->>'adm')::numeric, (v_total->'receita_referencia'->>'anterior_adm')::numeric, 'evento'),
      'intermediacao', saude_num((v_total->'receita_referencia'->>'intermediacao')::numeric,
                                 (v_total->'receita_referencia'->>'anterior_intermediacao')::numeric, 'evento', null),
      'em', (select dia from c),
      'contratos_ativos', saude_num((select contratos_ativos from c), (select contratos_ativos from h where k = 1), 'agora', false, 5,
                                    (select avg(contratos_ativos) from h), (select count(contratos_ativos) from h)::int),
      'atraso', saude_num((select atraso from c), (select atraso from h where k = 1), 'agora', true, 0,
                          (select avg(atraso) from h), (select count(atraso) from h)::int)
                || jsonb_build_object('contratos', (select atraso_contratos from c)),
      'saidas_avisadas', saude_num((select saidas_avisadas from c), (select saidas_avisadas from h where k = 1), 'agora', true, 5,
                                   (select avg(saidas_avisadas) from h), (select count(saidas_avisadas) from h)::int),
      'contratos_trimestre', saude_num(tri.atual, tri.anterior, 'evento', false, 5)
                || jsonb_build_object('regra', 'contratos novos (data de início) nos 3 meses até a data fim × 3 meses antes',
                                      'no_periodo', tri.no_periodo, 'no_periodo_anterior', tri.no_periodo_anterior))
      into v_cart from tri;
  end if;

  -- 9.4 D1 "revisada": semanas com foto dentro do período cujo placar mudou depois da foto
  select coalesce(jsonb_agg(jsonb_build_object('semana', f.semana, 'foto_em', f.tirada_em,
                                               'negocios_antes', f.placar->'negocios', 'negocios_agora', l.negocios,
                                               'valor_fechado_antes', f.placar->'valor_fechado',
                                               'valor_fechado_agora', l.vgv_venda + l.aluguel_locacao,
                                               'receita_antes', f.placar->'receita',
                                               'receita_agora', l.comissao_venda + l.taxa_adm + l.intermediacao) order by f.semana), '[]')
    into v_revisadas
    from saude_fotos f, lateral saude_linhas(f.semana, f.semana + 6, null) l
   where l.nivel = 'total' and f.semana >= v_ini and f.semana + 6 <= v_fim
     and ((f.placar->>'negocios')::int is distinct from l.negocios
          or round((f.placar->>'valor_fechado')::numeric, 2) is distinct from round(l.vgv_venda + l.aluguel_locacao, 2)
          or round((f.placar->>'receita')::numeric, 2) is distinct from round(l.comissao_venda + l.taxa_adm + l.intermediacao, 2));

  -- 9.5 Coorte do Comercial (Sprint B, 24/11): entrou no período → qualificado / visita / proposta até hoje,
  --     × coorte anterior de mesmo tamanho; total e por canal; sinal pela saude_num (base ≥ 5, D12)
  with c as (select * from saude_coorte(v_ini, v_fim, v_ant_ini, v_ant_fim, v_fin)),
       k as (select 'total' as nivel, null::text as canal union select distinct nivel, canal from c where nivel = 'canal'),
       j as (
         select k.nivel, k.canal,
                jsonb_strip_nulls(jsonb_build_object('chave', k.canal)) || jsonb_build_object(
                  'atendimentos', saude_num(coalesce(a.atendimentos, 0), coalesce(b.atendimentos, 0), 'entrada', false, 5),
                  'qualificados', saude_num(coalesce(a.qualificados, 0), coalesce(b.qualificados, 0), 'entrada', false, 5),
                  'visitas', saude_num(coalesce(a.visitas, 0), coalesce(b.visitas, 0), 'entrada', false, 5),
                  'propostas', saude_num(coalesce(a.propostas, 0), coalesce(b.propostas, 0), 'entrada', false, 5)) as linha
         from k
         left join c a on a.periodo = 'atual' and a.nivel = k.nivel and coalesce(a.canal, '') = coalesce(k.canal, '')
         left join c b on b.periodo = 'anterior' and b.nivel = k.nivel and coalesce(b.canal, '') = coalesce(k.canal, '')
       )
  select jsonb_build_object(
           'regra', 'dos atendimentos que entraram no período: quantos chegaram até hoje a qualificado (posição ≥ 4), '
                    || 'visita (atividade Visita realizada) e proposta (posição ≥ 6); anterior = coorte do período anterior',
           'total', (select linha from j where nivel = 'total'),
           'por_canal', coalesce((select jsonb_agg(linha order by (linha->'atendimentos'->>'valor')::numeric desc, canal)
                                  from j where nivel = 'canal'), '[]'))
    into v_coorte;

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_ini, 'fim', v_fim, 'dias', v_len, 'finalidade', v_chave,
                                  'anterior_inicio', v_ant_ini, 'anterior_fim', v_ant_fim,
                                  'qualificados_parcial', v_parcial, 'qualificados_fecha_em', v_fim + 7),
    'revisadas', v_revisadas,
    'cabecalho', jsonb_build_object(
        'negocios', v_total->'negocios', 'valor_fechado', v_total->'valor_fechado',   -- manchete (24/11)
        'receita_referencia', v_total->'receita_referencia',                           -- fora da manchete, para religar depois
        'investimento', v_total->'investimento',
        'atendimentos_abertos', v_ref->'atendimentos_abertos'),
    'performance', jsonb_build_object(
        'total', coalesce(v_pagos, '{}') || jsonb_build_object('conv_plataforma', v_total->'conv_plataforma',
                                                              'impressoes', v_total->'impressoes', 'cliques', v_total->'cliques',
                                                              'ctr', v_total->'ctr', 'cpc', v_total->'cpc',
                                                              'custo_conv_plataforma', v_total->'custo_conv_plataforma'),
        'nota_impressoes', 'dashboard_meta_ads.alcance_impressoes guarda impressões, não alcance',
        'por_plataforma', coalesce(v_linhas->'plataforma', '[]'),
        'por_campanha', coalesce(v_linhas->'campanha', '[]'),
        'por_anuncio', coalesce(v_linhas->'anuncio', '[]'),            -- só Meta
        'por_midia', coalesce((select jsonb_agg(l) from jsonb_array_elements(v_linhas->'midia') l
                                where l->>'pai' = 'Campanhas pagas'), '[]'),
        'serie_conversoes', saude_serie_conversoes(v_ini, v_fim, v_fin),         -- Sprint B (24/11)
        'tempo_resposta', saude_tempo_resposta(v_ini, v_fim)),                    -- Sprint B: sempre venda e locação
    'comercial', jsonb_build_object(
        'total', v_total,
        'por_finalidade', coalesce(v_linhas->'finalidade', '[]'),
        'por_canal', coalesce(v_linhas->'canal', '[]'),
        'por_midia', coalesce(v_linhas->'midia', '[]'),
        'coorte', v_coorte,                                                          -- Sprint B (24/11)
        'agora', v_agora || jsonb_build_object('referencia', v_ref, 'parado', saude_funil_parado(v_fin))),
    'carteira', coalesce(v_cart, jsonb_build_object('oculta', 'finalidade venda')),
    'midias_sociais', jsonb_build_object('status', 'aguardando captura', 'fase', '29e'),
    'ga4', jsonb_build_object('status', 'aguardando captura', 'blocos', jsonb_build_array('acessos', 'melhores páginas')),
    'leituras', jsonb_build_object(
        'crm', (select max(dia) from crm_leituras),
        'meta', (select max(data) from dashboard_meta_ads),
        'google', (select max(data) from dashboard_google_ads),
        'atividades', (select max(data_referencia) from atividades),
        'carteira', (select max(data) from contratos_locacao_fotos))
  );
end;
$$;

------------------------------------------------------------------------------------------
-- 10. Permissões: as listas e a página são chamáveis por authenticated (cada uma confere pode_ver_saude);
--     as peças internas não. O Supabase dá execute a anon/authenticated por padrão em funções novas.
------------------------------------------------------------------------------------------
revoke all on function public.saude_respostas(bigint[]) from public, anon, authenticated;
revoke all on function public.saude_serie_conversoes(date, date, text) from public, anon, authenticated;
revoke all on function public.saude_tempo_resposta(date, date) from public, anon, authenticated;
revoke all on function public.saude_coorte(date, date, date, date, text) from public, anon, authenticated;
revoke all on function public.saude_funil_parado(text) from public, anon, authenticated;
revoke all on function public.saude_fin(text) from public, anon, authenticated;
revoke all on function public.saude_lista(date, date, text, text, text, text) from public, anon;
revoke all on function public.saude_lista_agora(text, text, int, int) from public, anon;
grant execute on function public.saude_lista(date, date, text, text, text, text) to authenticated;
grant execute on function public.saude_lista_agora(text, text, int, int) to authenticated;
