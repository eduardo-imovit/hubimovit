-- Distratos (RF29, PRD §5.16, Schema §2.13) — 14/10.
-- O ADM gera um link por contrato; o locatário lê o procedimento, envia o
-- aviso oficial (data do servidor), o motivo e a pesquisa de satisfação.
-- Escrita só pela Edge Function `distrato` (service_role, pula o RLS).
-- Leitura direta: só gestão/adm. Anon: nada (o locatário entra pelo token,
-- via função). Registros antigos das planilhas entram com origem 'planilha'.

create table if not exists public.distratos (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'hub' check (origem in ('hub', 'planilha')),
  token text unique check (token is null or length(token) >= 32),
  contrato_codigo integer,

  -- retrato do contrato no momento (a carteira muda a cada carga)
  imovel_codigo integer,
  imovel_resumo text,
  imovel_endereco text,
  locatario_nome text,
  locatario_email text,
  locatario_telefone text,
  contrato_inicio date,
  contrato_fim date,
  aluguel numeric,

  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  expira_em timestamptz,
  status text not null default 'link_enviado'
    check (status in ('link_enviado', 'aviso_recebido', 'cancelado')),

  ciente_procedimento_em timestamptz,
  aviso_em timestamptz,
  data_prevista_saida date,
  fim_aviso_previo date,
  dentro_prazo boolean,
  contato_telefone text,
  contato_email text,

  motivo text check (motivo is null or motivo in (
    'Mudou de cidade', 'Foi transferido', 'Comprou outro imóvel', 'Alugou outro imóvel',
    'Valor do aluguel', 'Dificuldade financeira', 'Fechou empresa',
    'O proprietário solicitou o imóvel de volta', 'Vencimento do contrato', 'Outro')),
  motivo_detalhe text,
  motivo_com_quem text check (motivo_com_quem is null or motivo_com_quem in ('imovit', 'outra_imobiliaria', 'proprietario_direto')),
  motivo_fator text check (motivo_fator is null or motivo_fator in ('preco', 'tamanho', 'localizacao', 'estado_imovel', 'outro')),

  nps smallint check (nps between 0 and 10),
  notas jsonb,
  alugaria_de_novo text check (alugaria_de_novo is null or alugaria_de_novo in ('sim', 'talvez', 'nao')),
  comentario text,
  respostas_originais jsonb, -- só na origem 'planilha': a linha como veio

  email_ok boolean not null default false,
  cancelado_em timestamptz,
  cancelado_por uuid references public.perfis(id) on delete set null,

  constraint distrato_hub_tem_token check (origem <> 'hub' or (token is not null and expira_em is not null))
);

create index if not exists distratos_created_idx on public.distratos (created_at desc);
create index if not exists distratos_contrato_idx on public.distratos (contrato_codigo);

alter table public.distratos enable row level security;
revoke all on public.distratos from anon;
revoke insert, update, delete on public.distratos from authenticated;

drop policy if exists "gestao e adm leem" on public.distratos;
create policy "gestao e adm leem" on public.distratos
  for select to authenticated using ((select is_adm_ou_gestao()));

-- Busca de contrato ativo para o ADM (que não lê contratos_locacao).
-- Devolve só o mínimo; quem não é gestão/adm recebe zero linhas.
create or replace function public.contratos_para_distrato(busca text default '')
returns table (
  codigo integer, codigo_imovel integer, imovel_resumo text, imovel_endereco text,
  locatario_nome text, locatario_email text, locatario_telefone text,
  data_inicio date, data_fim date, valor_aluguel numeric
)
language sql stable security definer set search_path = public as $$
  select c.codigo, c.codigo_imovel, c.imovel_resumo, c.imovel_endereco,
         c.locatario_nome, c.locatario_email, c.locatario_telefone,
         c.data_inicio, c.data_fim, c.valor_aluguel
  from contratos_locacao c
  where is_adm_ou_gestao()
    and c.situacao = 'Ativo'
    and (
      coalesce(trim(busca), '') = ''
      or c.codigo::text = trim(busca)
      or c.codigo_imovel::text = trim(busca)
      or c.locatario_nome ilike '%' || trim(busca) || '%'
      or c.imovel_endereco ilike '%' || trim(busca) || '%'
    )
  order by c.locatario_nome
  limit 20;
$$;

revoke all on function public.contratos_para_distrato(text) from public, anon;
grant execute on function public.contratos_para_distrato(text) to authenticated;
