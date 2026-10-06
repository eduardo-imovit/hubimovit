-- Carga inicial da jornada a partir da base atual (decisão do Eduardo, 06/10:
-- "o foco é daqui para frente"). Não chama o Imoview: copia o estado de
-- dashboard_atendimentos_crm como ponto de partida. Depois disso o n8n só
-- manda o que pode ter mudado (em atendimento + encerrados recentes, e uma
-- leitura completa semanal), e registrar_atendimentos_crm grava as mudanças.
--
-- - Pré-atendimento em atendimento → 'entrada', com a data de entrada do CRM.
-- - Os demais → 'primeira_leitura' (data de chegada na etapa desconhecida).
-- Só roda se a jornada estiver vazia (idempotente).

alter table public.crm_leituras
  add column if not exists origem text not null default 'n8n'
  check (origem in ('n8n', 'carga_base'));

do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_leitura bigint;
  v_entradas int;
  v_primeiras int;
begin
  if exists (select 1 from crm_atendimento_jornada) or exists (select 1 from crm_leituras) then
    raise notice 'Jornada já tem dados; carga inicial ignorada.';
    return;
  end if;

  insert into crm_leituras (dia, origem) values (v_hoje, 'carga_base') returning id into v_leitura;

  insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
  select
    a.codigo,
    case when a.fase = 1 and btrim(a.situacao) = 'Em atendimento' then 'entrada' else 'primeira_leitura' end,
    a.fase,
    btrim(a.situacao),
    case when a.fase = 1 and btrim(a.situacao) = 'Em atendimento' then coalesce(a.data_de_entrada::date, v_hoje) else v_hoje end,
    case when a.fase = 1 and btrim(a.situacao) = 'Em atendimento' and a.data_de_entrada is not null then 'crm' else 'captura' end,
    a.finalidade, a.corretor, a.midia, nullif(btrim(a.campanha), ''), a.funil,
    v_leitura,
    jsonb_build_object('origem', 'dashboard_atendimentos_crm', 'data_fechamento', a.data_fechamento)
  from dashboard_atendimentos_crm a
  where a.codigo is not null and a.fase is not null and nullif(btrim(a.situacao), '') is not null;

  select count(*) filter (where tipo = 'entrada'), count(*) filter (where tipo = 'primeira_leitura')
    into v_entradas, v_primeiras
  from crm_atendimento_jornada where leitura_id = v_leitura;

  update crm_leituras set lidos = v_entradas + v_primeiras, novos = v_entradas + v_primeiras where id = v_leitura;
end
$$;
