-- Plantão de locação (PRD §5.3, pedido do Eduardo em 05/11).
-- A tabela plantao passa a guardar os dois plantões, separados pela coluna tipo.
-- Tudo o que já existe é de vendas (default 'venda').

alter table public.plantao
  add column if not exists tipo text not null default 'venda';

alter table public.plantao
  drop constraint if exists plantao_tipo_check;
alter table public.plantao
  add constraint plantao_tipo_check check (tipo in ('venda', 'locacao'));

create index if not exists plantao_data_tipo_idx on public.plantao (data, tipo);

-- kpis_tv: o card "Plantão de hoje" da TV passa a receber o tipo de cada plantão.
-- Troca só o trecho do plantão na definição que está no banco (o resto da função
-- não é reescrito) e falha se o trecho não for encontrado.
do $$
declare
  v_def  text := pg_get_functiondef('public.kpis_tv()'::regprocedure);
  v_novo text;
begin
  v_novo := replace(
    v_def,
    $a$jsonb_build_object('nome', corretor_nome, 'turno', turno) order by turno, corretor_nome)$a$,
    $a$jsonb_build_object('nome', corretor_nome, 'turno', turno, 'tipo', tipo) order by tipo desc, turno, corretor_nome)$a$
  );
  if v_novo = v_def then
    raise exception 'kpis_tv: trecho do plantao_hoje não encontrado; nada foi alterado';
  end if;
  execute v_novo;
end
$$;
