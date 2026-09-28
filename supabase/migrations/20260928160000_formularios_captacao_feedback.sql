-- =============================================================================
-- Formulários no Hub — 1ª entrega (RF23, PRD §5.7), 2026-09-28.
--   * captacoes: o PROPRIETÁRIO preenche pelo link fixo do corretor (público,
--     sem login) e assina; substitui o Tally "Acompanhamento personalizado".
--     Só registro: o corretor é o responsável pelo processo (decisão do Eduardo).
--   * feedbacks_visita: o CORRETOR preenche no Hub e gera o PDF para o proprietário.
-- Escrita da captação só pela Edge Function `captacao` (service_role); anon não
-- tem grant nenhum aqui.
-- =============================================================================

create table if not exists captacoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  -- corretor responsável (lista do CRM, colaboradores_raw)
  corretor text not null,
  corretor_crm_id integer,
  corretor_email text,
  -- proprietário
  proprietario_nome text not null,
  proprietario_email text not null,
  proprietario_telefone text not null,
  proprietario_cpf text not null,
  -- natureza
  tipo_imovel text not null,
  finalidade text not null check (finalidade in ('Venda', 'Locação', 'Ambos')),
  exclusividade boolean not null,
  exclusividade_periodo text check (exclusividade_periodo in ('30 dias', '90 dias', '180 dias', '1 ano')),
  -- endereço
  logradouro text not null,
  numero text not null,
  bairro text not null,
  cep text,
  apto_sala text,
  bloco text,
  quadra text,
  -- valores
  valor_locacao numeric,
  valor_venda numeric,
  valor_condominio numeric,
  iptu_mensal numeric,
  -- atributos
  area_interna numeric not null,
  area_terreno numeric,
  quartos text,
  suites text,
  banheiros text,
  salas text,
  vagas text,
  tipo_vaga text,
  lazer text[] not null default '{}',
  observacoes text,
  -- declaração e assinatura (texto gravado junto: vale o que foi assinado)
  declaracao text not null,
  assinatura text not null check (assinatura like 'data:image/png;base64,%' and length(assinatura) < 400000),
  assinado_em timestamptz not null default now(),
  origem_ip text,
  origem_user_agent text
);

create index if not exists captacoes_corretor_email on captacoes (lower(corretor_email));
create index if not exists captacoes_criado_em on captacoes (criado_em desc);

alter table captacoes enable row level security;
revoke all on captacoes from public, anon, authenticated;
grant select on captacoes to authenticated;
grant select, insert, update, delete on captacoes to service_role;

-- Gestão/Admin veem todas; o corretor, as dele (e-mail do login = e-mail oficial no CRM).
drop policy if exists captacoes_select on captacoes;
create policy captacoes_select on captacoes for select to authenticated
  using (
    is_adm_ou_gestao()
    or (auth.jwt() ->> 'email' is not null and lower(corretor_email) = lower(auth.jwt() ->> 'email'))
  );

create table if not exists feedbacks_visita (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid not null default auth.uid() references perfis(id) on delete set null,
  codigo_imovel integer not null,
  imovel_descricao text,
  olhar_visitante text,
  curadoria_ajustes text,
  termometro smallint not null check (termometro between 1 and 5),
  corretor text not null,
  nota_consultor text
);

create index if not exists feedbacks_visita_criado_por on feedbacks_visita (criado_por, criado_em desc);

alter table feedbacks_visita enable row level security;
revoke all on feedbacks_visita from public, anon, authenticated;
grant select, insert on feedbacks_visita to authenticated;
grant select, insert, update, delete on feedbacks_visita to service_role;

drop policy if exists feedbacks_visita_select on feedbacks_visita;
create policy feedbacks_visita_select on feedbacks_visita for select to authenticated
  using (is_adm_ou_gestao() or criado_por = auth.uid());

drop policy if exists feedbacks_visita_insert on feedbacks_visita;
create policy feedbacks_visita_insert on feedbacks_visita for insert to authenticated
  with check (
    criado_por = auth.uid()
    and exists (select 1 from perfis where id = auth.uid() and role in ('gestao', 'adm', 'corretor'))
  );
