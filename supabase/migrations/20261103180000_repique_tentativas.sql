-- Repique 3.0: registro de quantas vezes cada lead foi repicado.
-- O n8n lê esta tabela para saber de onde contar o prazo (entrada ou último
-- repique) e para parar depois da 3ª tentativa. Só a service_role acessa.

create table public.repique_tentativas (
  atendimento_id    bigint      primary key,
  tipo_operacao     text        not null check (tipo_operacao in ('venda', 'locacao')),
  tentativas        int         not null default 1 check (tentativas between 1 and 3),
  ultimo_repique_em timestamptz not null default now(),
  ultimo_corretor   int         not null,
  criado_em         timestamptz not null default now()
);

comment on table public.repique_tentativas is
  'Repique 3.0 (n8n): tentativas por atendimento do Imoview; máx. 3, prazo conta do último repique.';

alter table public.repique_tentativas enable row level security;

-- Sem políticas: anon e authenticated não leem nem escrevem.
revoke all on public.repique_tentativas from anon, authenticated;
