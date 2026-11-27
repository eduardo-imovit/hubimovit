-- Fase 29a × 29e S4/S7 · Saúde Imovit — cartão "GA4" com o site (GA4) e a busca do Google (Search Console)
-- 25/11 (Asimov): escrita e testada em BEGIN … ROLLBACK. NÃO aplicada (aguarda OK do Eduardo).
-- Depende de 20261125120000_organico_google (organico_dimensao + métricas ga4) e de 20261124200000 (saude_midia_num).
-- Regra do Sprint B: a conta fica no banco, a tela só mostra.
--
-- O que muda:
--   saude_ga4(ini, fim)  interna: o cartão inteiro (site + busca), no mesmo formato do bloco Mídias sociais
--   saude_imovit(...)    a chave 'ga4' passa a chamar saude_ga4(v_ini, v_fim) e 'leituras' ganha 'ga4' e
--                        'search_console'. O resto do jsonb é idêntico ao de produção (conferido em 25/11).
-- Regras:
--   • Somas do período (usuários, usuários novos, sessões, sessões engajadas, visualizações, eventos-chave; cliques e
--     impressões da busca) × período anterior pela MÉDIA POR DIA CAPTURADO (saude_midia_num, igual às Mídias sociais).
--     Usuários somados dia a dia NÃO são usuários únicos do período (aviso na tela).
--   • Taxas recalculadas das somas: engajamento = sessões engajadas ÷ sessões; CTR = cliques ÷ impressões.
--     Posição média = média ponderada pelas impressões, sinal INVERTIDO (subir de posição 8 para 12 é piorar).
--   • Menos de 5 dias capturados em um dos períodos → sinal 'acumulando' (⚪).
--   • Listas (canal, origem/mídia, campanha, eventos, páginas, consultas): soma das fotos diárias do top N
--     (GA4: 25 origens/campanhas, 20 páginas; Search Console: 50 consultas, 20 páginas). Uma página fora do top
--     de um dia conta zero nesse dia. Valor do período e do anterior, sem sinal (a base por item é pequena).
--   • Eventos: todos os do GA4 com a contagem e quantos foram eventos-chave; serve para o Eduardo decidir quais
--     contam como conversão (clique no WhatsApp, formulário).
--   • Search Console chega com ~3 dias de atraso: o período mostra até a última data capturada (cobertura).
--   • NÃO segue os filtros de finalidade nem de canal.

------------------------------------------------------------------------------------------
-- 1. O cartão: saude_ga4(p_ini, p_fim) → jsonb
------------------------------------------------------------------------------------------
create or replace function public.saude_ga4(p_ini date, p_fim date)
returns jsonb language sql stable security definer set search_path = public as $$
with par as (
  select p_ini as ini, p_fim as fim, (p_fim - p_ini + 1) as dias,
         p_ini - (p_fim - p_ini + 1) as ant_ini, p_ini - 1 as ant_fim
),
-- totais: rede × dia (contas da mesma rede somam; posição é por conta, então média ponderada mais abaixo)
dd as (
  select o.rede, o.data, case when o.data >= par.ini then 'atual' else 'anterior' end as periodo,
         sum(o.valor) filter (where o.metrica = 'usuarios')          as usuarios,
         sum(o.valor) filter (where o.metrica = 'usuarios_novos')    as usuarios_novos,
         sum(o.valor) filter (where o.metrica = 'sessoes')           as sessoes,
         sum(o.valor) filter (where o.metrica = 'sessoes_engajadas') as sessoes_engajadas,
         sum(o.valor) filter (where o.metrica = 'visualizacoes')     as visualizacoes,
         sum(o.valor) filter (where o.metrica = 'eventos_chave')     as eventos_chave,
         sum(o.valor) filter (where o.metrica = 'cliques')           as cliques,
         sum(o.valor) filter (where o.metrica = 'impressoes')        as impressoes,
         max(o.valor) filter (where o.metrica = 'posicao_media')     as posicao
  from organico_diario o cross join par
  where o.rede in ('ga4', 'search_console') and o.data between par.ant_ini and par.fim
  group by o.rede, o.data, par.ini
),
p as (
  select rede, periodo, count(*)::int as dias, max(data) as ultima,
         sum(usuarios) as usuarios, sum(usuarios_novos) as usuarios_novos, sum(sessoes) as sessoes,
         sum(sessoes_engajadas) as sessoes_engajadas, sum(visualizacoes) as visualizacoes,
         sum(eventos_chave) as eventos_chave, sum(cliques) as cliques, sum(impressoes) as impressoes,
         round(sum(posicao * impressoes) / nullif(sum(impressoes) filter (where posicao is not null), 0), 2) as posicao
  from dd group by rede, periodo
),
pa as (select * from p where periodo = 'atual'),
pb as (select * from p where periodo = 'anterior'),
-- dimensões: rede × dimensão × chave × dia, depois × período
dp as (
  select o.rede, o.dimensao, o.chave, o.data, case when o.data >= par.ini then 'atual' else 'anterior' end as periodo,
         sum(o.valor) filter (where o.metrica = 'sessoes')           as sessoes,
         sum(o.valor) filter (where o.metrica = 'sessoes_engajadas') as sessoes_engajadas,
         sum(o.valor) filter (where o.metrica = 'eventos_chave')     as eventos_chave,
         sum(o.valor) filter (where o.metrica = 'usuarios')          as usuarios,
         sum(o.valor) filter (where o.metrica = 'visualizacoes')     as visualizacoes,
         sum(o.valor) filter (where o.metrica = 'eventos')           as eventos,
         sum(o.valor) filter (where o.metrica = 'cliques')           as cliques,
         sum(o.valor) filter (where o.metrica = 'impressoes')        as impressoes,
         max(o.valor) filter (where o.metrica = 'posicao_media')     as posicao
  from organico_dimensao o cross join par
  where o.rede in ('ga4', 'search_console') and o.data between par.ant_ini and par.fim
  group by o.rede, o.dimensao, o.chave, o.data, par.ini
),
da as (
  select rede, dimensao, chave, periodo, count(*)::int as dias,
         sum(sessoes) as sessoes, sum(sessoes_engajadas) as sessoes_engajadas, sum(eventos_chave) as eventos_chave,
         sum(usuarios) as usuarios, sum(visualizacoes) as visualizacoes, sum(eventos) as eventos,
         sum(cliques) as cliques, sum(impressoes) as impressoes,
         round(sum(posicao * impressoes) / nullif(sum(impressoes) filter (where posicao is not null), 0), 2) as posicao
  from dp group by rede, dimensao, chave, periodo
),
dl as (
  select a.rede, a.dimensao,
         jsonb_strip_nulls(jsonb_build_object(
           'chave', a.chave, 'dias', a.dias,
           'sessoes', a.sessoes, 'sessoes_anterior', b.sessoes,
           'sessoes_engajadas', a.sessoes_engajadas,
           'eventos_chave', a.eventos_chave, 'eventos_chave_anterior', b.eventos_chave,
           'usuarios', a.usuarios,
           'visualizacoes', a.visualizacoes, 'visualizacoes_anterior', b.visualizacoes,
           'eventos', a.eventos, 'eventos_anterior', b.eventos,
           'cliques', a.cliques, 'cliques_anterior', b.cliques,
           'impressoes', a.impressoes, 'impressoes_anterior', b.impressoes,
           'ctr', round(a.cliques / nullif(a.impressoes, 0) * 100, 2),
           'posicao_media', a.posicao)) as linha,
         row_number() over (partition by a.rede, a.dimensao
                            order by coalesce(a.sessoes, a.visualizacoes, a.eventos, a.cliques, 0) desc,
                                     coalesce(a.impressoes, 0) desc, a.chave) as pos
  from da a
  left join da b on b.periodo = 'anterior' and b.rede = a.rede and b.dimensao = a.dimensao and b.chave = a.chave
  where a.periodo = 'atual'
),
lista as (
  select rede, dimensao, jsonb_agg(linha order by pos) as itens
  from dl
  where pos <= case when dimensao in ('canal', 'evento') then 50 else 10 end
  group by rede, dimensao
),
serie as (
  select g::date as data,
         s.usuarios, s.sessoes, s.visualizacoes, s.eventos_chave,
         c.cliques, c.impressoes, round(c.cliques / nullif(c.impressoes, 0) * 100, 2) as ctr, c.posicao
  from par, generate_series(par.ini, par.fim, interval '1 day') g
  left join dd s on s.rede = 'ga4' and s.data = g::date
  left join dd c on c.rede = 'search_console' and c.data = g::date
)
select jsonb_build_object(
  'status', case when exists (select 1 from organico_diario where rede in ('ga4', 'search_console'))
                 then 'capturando' else 'aguardando captura' end,
  'fase', '29e',
  'filtros', 'não segue os filtros de finalidade nem de canal',
  'regra', 'somas do período por dia capturado × período anterior (média por dia); usuários somados dia a dia não são '
           || 'únicos; engajamento = sessões engajadas ÷ sessões; CTR = cliques ÷ impressões; posição média ponderada '
           || 'pelas impressões (menor é melhor); listas = soma das fotos diárias do top N; menos de 5 dias = acumulando',
  'periodo', jsonb_build_object('inicio', par.ini, 'fim', par.fim, 'dias', par.dias,
                                'anterior_inicio', par.ant_ini, 'anterior_fim', par.ant_fim),
  'site', jsonb_build_object(
      'fonte', 'GA4',
      'dias_com_dado', coalesce(a.dias, 0), 'dias_com_dado_anterior', coalesce(b.dias, 0),
      'ultima_data', (select max(data) from organico_diario where rede = 'ga4'),
      'usuarios',          saude_midia_num(a.usuarios, a.dias, b.usuarios, b.dias),
      'usuarios_novos',    saude_midia_num(a.usuarios_novos, a.dias, b.usuarios_novos, b.dias),
      'sessoes',           saude_midia_num(a.sessoes, a.dias, b.sessoes, b.dias),
      'sessoes_engajadas', saude_midia_num(a.sessoes_engajadas, a.dias, b.sessoes_engajadas, b.dias),
      'taxa_engajamento',  saude_midia_num(round(a.sessoes_engajadas / nullif(a.sessoes, 0) * 100, 2), a.dias,
                                           round(b.sessoes_engajadas / nullif(b.sessoes, 0) * 100, 2), b.dias, false),
      'visualizacoes',     saude_midia_num(a.visualizacoes, a.dias, b.visualizacoes, b.dias),
      'eventos_chave',     saude_midia_num(a.eventos_chave, a.dias, b.eventos_chave, b.dias),
      'por_canal',         coalesce((select itens from lista where rede = 'ga4' and dimensao = 'canal'), '[]'),
      'por_origem_midia',  coalesce((select itens from lista where rede = 'ga4' and dimensao = 'origem_midia'), '[]'),
      'por_campanha',      coalesce((select itens from lista where rede = 'ga4' and dimensao = 'campanha'), '[]'),
      'paginas',           coalesce((select itens from lista where rede = 'ga4' and dimensao = 'pagina'), '[]'),
      'eventos',           coalesce((select itens from lista where rede = 'ga4' and dimensao = 'evento'), '[]')),
  'busca', jsonb_build_object(
      'fonte', 'Search Console',
      'atraso', 'o Google entrega com ~3 dias de atraso',
      'dias_com_dado', coalesce(c.dias, 0), 'dias_com_dado_anterior', coalesce(e.dias, 0),
      'ultima_data', (select max(data) from organico_diario where rede = 'search_console'),
      'cliques',       saude_midia_num(c.cliques, c.dias, e.cliques, e.dias),
      'impressoes',    saude_midia_num(c.impressoes, c.dias, e.impressoes, e.dias),
      'ctr',           saude_midia_num(round(c.cliques / nullif(c.impressoes, 0) * 100, 2), c.dias,
                                       round(e.cliques / nullif(e.impressoes, 0) * 100, 2), e.dias, false),
      'posicao_media', case when c.posicao is null and e.posicao is null then null else
                         saude_midia_num(c.posicao, c.dias, e.posicao, e.dias, false)
                         || jsonb_build_object('invertido', true)
                         || case when least(coalesce(c.dias, 0), coalesce(e.dias, 0)) >= 5
                                 then jsonb_build_object('sinal', saude_sinal(c.posicao, e.posicao, true, 0, null))
                                 else '{}'::jsonb end end,
      'consultas', coalesce((select itens from lista where rede = 'search_console' and dimensao = 'consulta'), '[]'),
      'paginas',   coalesce((select itens from lista where rede = 'search_console' and dimensao = 'pagina'), '[]')),
  'serie', (select jsonb_agg(jsonb_strip_nulls(to_jsonb(serie)) || jsonb_build_object('data', serie.data)
                             order by serie.data) from serie)
)
from par
left join pa a on a.rede = 'ga4'
left join pb b on b.rede = 'ga4'
left join pa c on c.rede = 'search_console'
left join pb e on e.rede = 'search_console'
$$;

------------------------------------------------------------------------------------------
-- 2. A página: igual à de produção (20261124200000, conferida em 25/11), com 'ga4' real e leituras ga4/search_console.
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
    'midias_sociais', saude_midias_sociais(v_ini, v_fim),                         -- 29e (24/11): não segue finalidade nem canal
    'ga4', saude_ga4(v_ini, v_fim),                                               -- 29e S4 (25/11): site + busca; não segue finalidade nem canal
    'leituras', jsonb_build_object(
        'crm', (select max(dia) from crm_leituras),
        'meta', (select max(data) from dashboard_meta_ads),
        'google', (select max(data) from dashboard_google_ads),
        'atividades', (select max(data_referencia) from atividades),
        'carteira', (select max(data) from contratos_locacao_fotos),
        'organico', (select max(data) from organico_diario where rede in ('instagram', 'facebook', 'tiktok')),
        'ga4', (select max(data) from organico_diario where rede = 'ga4'),
        'search_console', (select max(data) from organico_diario where rede = 'search_console'))
  );
end;
$$;


------------------------------------------------------------------------------------------
-- 3. Permissões: a interna fora do alcance de public/anon/authenticated. saude_imovit mantém o execute que já tinha.
------------------------------------------------------------------------------------------
revoke all on function public.saude_ga4(date, date) from public, anon, authenticated;
