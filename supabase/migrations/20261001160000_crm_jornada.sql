-- Jornada do atendimento (PRD §5.8, Schema §2.6 revisto em 01/10).
--
-- O fluxo n8n `crm_jornada_diaria` lê TODOS os atendimentos do Imoview 1x/dia e
-- chama registrar_atendimentos_crm(itens). A função grava em
-- crm_atendimento_jornada (só insere, nunca atualiza nem apaga):
--   - 'entrada'          : 1ª vez que o código aparece e ele está no Pré-atendimento
--                          (ou é um lead novo depois da 1ª leitura); data = entrada do CRM
--   - 'primeira_leitura' : código que já estava além do Pré-atendimento quando o
--                          histórico começou; data de chegada na etapa desconhecida
--   - 'mudanca_etapa'    : a fase mudou desde o último registro
--   - 'encerramento'     : virou Descartado ou Negócio realizado
--   - 'reabertura'       : estava encerrado e voltou para Em atendimento
-- Datas de mudança = dia da leitura (precisão de 1 dia), origem_data = 'captura'.
--
-- Nesta etapa a função NÃO mexe em dashboard_atendimentos_crm: o fluxo antigo
-- continua mantendo o estado atual durante os dias de conferência em paralelo.

create table if not exists public.crm_leituras (
  id bigint generated always as identity primary key,
  lido_em timestamptz not null default now(),
  dia date not null,
  lidos integer not null default 0,
  novos integer not null default 0,
  mudancas_etapa integer not null default 0,
  encerramentos integer not null default 0,
  reaberturas integer not null default 0,
  ignorados integer not null default 0
);

create table if not exists public.crm_atendimento_jornada (
  id bigint generated always as identity primary key,
  codigo bigint not null,
  tipo text not null check (tipo in ('entrada', 'primeira_leitura', 'mudanca_etapa', 'encerramento', 'reabertura')),
  fase_crm smallint not null,
  fase_anterior smallint,
  situacao text not null,
  situacao_anterior text,
  data_evento date not null,
  origem_data text not null check (origem_data in ('crm', 'captura')),
  finalidade text,
  corretor text,
  midia text,
  campanha text,
  funil text,
  leitura_id bigint references public.crm_leituras (id),
  detectado_em timestamptz not null default now(),
  payload jsonb
);

create index if not exists crm_jornada_codigo_id on public.crm_atendimento_jornada (codigo, id desc);
create index if not exists crm_jornada_data_evento on public.crm_atendimento_jornada (data_evento);

-- Leitura: mesma regra das outras tabelas comerciais (só quem tem nível; corretor só o dele)
alter table public.crm_leituras enable row level security;
alter table public.crm_atendimento_jornada enable row level security;

create policy "so quem tem nivel le" on public.crm_leituras
  for select to authenticated using (pode_ler_comercial());

create policy "equipe le; corretor so os seus" on public.crm_atendimento_jornada
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or lower(nome_corretor_crm(corretor)) = lower((select meu_nome_crm()))
    )
  );

revoke insert, update, delete, truncate on public.crm_leituras, public.crm_atendimento_jornada from anon, authenticated;

create or replace function public.registrar_atendimentos_crm(itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
        -- ainda no Pré-atendimento: a entrada é o começo exato da jornada
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, 'entrada', v_fase, v_sit, coalesce(v_entrada, v_hoje), case when v_entrada is null then 'captura' else 'crm' end,
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload');
      elsif not v_primeira_carga and v_entrada is not null and v_entrada >= v_inicio_historico then
        -- lead novo que já andou antes da leitura: entrada no Pré-atendimento + o estado de hoje
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, situacao, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, 'entrada', 1, 'Em atendimento', v_entrada, 'crm',
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, null);
        insert into crm_atendimento_jornada (codigo, tipo, fase_crm, fase_anterior, situacao, situacao_anterior, data_evento, origem_data, finalidade, corretor, midia, campanha, funil, leitura_id, payload)
        values (v_codigo, case when v_encerrada then 'encerramento' else 'mudanca_etapa' end, v_fase, 1, v_sit, 'Em atendimento', v_hoje, 'captura',
                it ->> 'finalidade', it ->> 'corretor', it ->> 'midia', it ->> 'campanha', it ->> 'funil', v_leitura, it -> 'payload');
        if v_encerrada then v_encerramentos := v_encerramentos + 1; else v_mudancas := v_mudancas + 1; end if;
      else
        -- já estava no meio do funil quando o histórico começou
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
$$;

revoke execute on function public.registrar_atendimentos_crm(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_atendimentos_crm(jsonb) to service_role;
