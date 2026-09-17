-- Agenda do fotógrafo vira recorrente: cada linha é um bloco semanal fixo de um
-- corretor (ex.: toda terça das 12:00 às 14:00), não mais um agendamento pontual.
-- A UI expande esses blocos para todos os dias do mês visível a partir de uma
-- única inserção. Tabela ainda está vazia (0 linhas) — troca de schema direta.

alter table public.agendamentos_fotografo
  drop column tipo_imovel,
  drop column duracao_horas,
  drop column endereco,
  drop column imovel_codigo,
  drop column data_hora_inicio,
  drop column data_hora_fim,
  drop column semana_iso,
  drop column status,
  drop column google_event_id,
  add column dia_semana smallint not null check (dia_semana between 0 and 6),
  add column hora_inicio time not null,
  add column hora_fim time not null,
  add column observacao text,
  add column ativo boolean not null default true;

alter table public.agendamentos_fotografo
  add constraint agendamentos_fotografo_horario_valido check (hora_fim > hora_inicio);

comment on column public.agendamentos_fotografo.dia_semana is '0=domingo … 6=sábado, igual a Date.getDay() em JS';
