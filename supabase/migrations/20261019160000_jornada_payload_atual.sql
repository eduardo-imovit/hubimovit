-- registrar_atendimentos_crm: mantém a foto (payload) atual do atendimento (19/10).
-- Motivo: sem mudança de fase/situação a leitura era ignorada, e o payload ficava com a
-- foto do dia em que o lead entrou na fase. Ex.: 6182 (proposta Cancelada no CRM) e 6383
-- (Reservada) seguiam "Em análise" no Km 32. Agora, sem mudança, o payload da última
-- linha do código é atualizado. Os eventos (tipo, fase, situação, data_evento) não mudam.
-- Igual à versão de 20261001160000_crm_jornada, só com o `else` no fim do loop.

create or replace function public.registrar_atendimentos_crm(itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_primeira_carga boolean := not exists (select 1 from crm_leituras);
  v_inicio_historico date;
  v_leitura bigint;
  it jsonb;
  ult crm_atendimento_jornada;
  v_codigo bigint;
  v_fase smallint;
  v_sit text;
  v_entrada date;
  v_encerrada boolean;
  v_lidos int := 0;
  v_novos int := 0;
  v_mudancas int := 0;
  v_encerramentos int := 0;
  v_reaberturas int := 0;
  v_ignorados int := 0;
begin
  if jsonb_typeof(itens) is distinct from 'array' then
    raise exception 'itens deve ser uma lista';
  end if;

  insert into crm_leituras (dia) values (v_hoje) returning id into v_leitura;
  select coalesce(min(dia), v_hoje) into v_inicio_historico from crm_leituras;

  for it in select * from jsonb_array_elements(itens) loop
    v_codigo := nullif(it ->> 'codigo', '')::bigint;
    v_fase := nullif(it ->> 'fase_crm', '')::smallint;
    v_sit := nullif(btrim(it ->> 'situacao'), '');
    v_entrada := nullif(it ->> 'data_entrada', '')::date;

    if v_codigo is null or v_fase is null or v_sit is null then
      v_ignorados := v_ignorados + 1;
      continue;
    end if;
    v_lidos := v_lidos + 1;
    v_encerrada := v_sit in ('Descartado', 'Negócio realizado');

    select * into ult from crm_atendimento_jornada where codigo = v_codigo order by id desc limit 1;

    if not found then
      v_novos := v_novos + 1;
      if v_fase = 1 and not v_encerrada then
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, 'entrada', v_fase, v_sit, coalesce(v_entrada, v_hoje), case when v_entrada is null then 'captura' else 'crm' end,
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload');
      elsif not v_primeira_carga and v_entrada is not null and v_entrada >= v_inicio_historico then
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, 'entrada', 1, 'Em atendimento', v_entrada, 'crm',
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, null);
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, fase_anterior, situacao, situacao_anterior, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, case when v_encerrada then 'encerramento' else 'mudanca_etapa' end, v_fase, 1, v_sit, 'Em atendimento', v_hoje, 'captura',
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload');
        if v_encerrada then v_encerramentos := v_encerramentos + 1; else v_mudancas := v_mudancas + 1; end if;
      else
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, 'primeira_leitura', v_fase, v_sit, v_hoje, 'captura',
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload');
      end if;

    elsif ult.fase_crm is distinct from v_fase or ult.situacao is distinct from v_sit then
      insert into crm_atendimento_jornada (codigo, tipo, fase_crm, fase_anterior, situacao, situacao_anterior, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
      values (
        v_codigo,
        case
          when v_encerrada and ult.situacao is distinct from v_sit then 'encerramento'
          when not v_encerrada and ult.situacao in ('Descartado', 'Negócio realizado') then 'reabertura'
          else 'mudanca_etapa'
        end,
        v_fase, ult.fase_crm, v_sit, ult.situacao, v_hoje, 'captura',
        it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload'
      );
      if v_encerrada and ult.situacao is distinct from v_sit then
        v_encerramentos := v_encerramentos + 1;
      elsif not v_encerrada and ult.situacao in ('Descartado', 'Negócio realizado') then
        v_reaberturas := v_reaberturas + 1;
      else
        v_mudancas := v_mudancas + 1;
      end if;

    -- sem mudança de fase/situação: só atualiza a foto (status das propostas, última interação…)
    elsif it -> 'payload' is not null then
      update crm_atendimento_jornada set payload = it -> 'payload'
       where id = ult.id and payload is distinct from it -> 'payload';
    end if;
  end loop;

  update crm_leituras
     set lidos = v_lidos, novos = v_novos, mudancas_etapa = v_mudancas,
         encerramentos = v_encerramentos, reaberturas = v_reaberturas, ignorados = v_ignorados
   where id = v_leitura;

  return jsonb_build_object(
    'leitura', v_leitura, 'dia', v_hoje, 'lidos', v_lidos, 'novos', v_novos,
    'mudancas_etapa', v_mudancas, 'encerramentos', v_encerramentos,
    'reaberturas', v_reaberturas, 'ignorados', v_ignorados
  );
end;
$function$;
