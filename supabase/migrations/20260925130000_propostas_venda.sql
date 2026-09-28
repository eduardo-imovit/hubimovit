-- =============================================================================
-- Propostas de VENDA (compra) — fluxo paralelo ao da locação, sem tocar nela.
-- Pedido da direção (2026-09-25): corretor cria pelo form, proponente valida
-- via e-mail (magic link) e assina; sem etapas de cadastro/documentos/esteira.
-- Inteligência: valor, endereço e condições ficam no banco (propostas_venda).
--
-- Revisão 2026-09-28 (antes de aplicar):
--   * RPCs de estado recebem a identidade do chamador como parâmetro e só a
--     service_role (Edge Function proposta-venda) executa. Antes elas liam
--     auth.uid()/auth.jwt() — que ficam vazios quando a função chama com a
--     service role —, então criar e confirmar falhavam sempre.
--   * authenticated só LÊ as tabelas. Antes a policy de UPDATE deixava o
--     proponente e o corretor alterarem qualquer coluna (status, valores)
--     direto pela API. O único ajuste feito pelo navegador (registrar o PDF)
--     passou para a RPC registrar_documento_venda.
--   * Storage: proponente só grava assinatura.png enquanto a proposta aguarda
--     e documento.pdf uma única vez depois de confirmada.
--   * Descarte grava o status anterior de verdade no histórico.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table if not exists propostas_venda (
  id uuid primary key default gen_random_uuid(),
  timestamp_criacao timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis(id) on delete set null,
  codigo_imovel integer not null,
  imovel_titulo text,
  imovel_endereco text,
  -- proponente (cliente comprador)
  nome_cliente text not null,
  email text not null,
  telefone text,
  -- condições da proposta (inteligência + documento assinado)
  valor_referencia numeric,
  valor_proposta numeric,
  descricao_proposta text,
  assinatura_path text,
  documento_path text,
  status text not null default 'aguardando_cliente'
    check (status in ('aguardando_cliente', 'confirmada', 'descartada', 'expirada')),
  link_expira_em timestamptz not null default (now() + interval '7 days'),
  motivo text
);

create index if not exists propostas_venda_email on propostas_venda (lower(email));
create index if not exists propostas_venda_criado_por on propostas_venda (criado_por);
create index if not exists propostas_venda_status on propostas_venda (status);

create table if not exists propostas_venda_historico (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references propostas_venda(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  ator text,
  motivo text,
  timestamp_registro timestamptz not null default now()
);

create index if not exists propostas_venda_historico_proposta
  on propostas_venda_historico (proposta_id, timestamp_registro);

-- Grants explícitos (regra Supabase pós-30/10/2026): sem grant, tabela nova
-- fica inacessível pela Data API. authenticated só lê; toda escrita passa
-- pelas RPCs abaixo. RLS continua filtrando as linhas.
revoke all on propostas_venda from public, anon, authenticated;
grant select on propostas_venda to authenticated;
grant select, insert, update, delete on propostas_venda to service_role;

revoke all on propostas_venda_historico from public, anon, authenticated;
grant select on propostas_venda_historico to authenticated;
grant select, insert, update, delete on propostas_venda_historico to service_role;

-- -----------------------------------------------------------------------------
-- 2. RLS — leitura espelha a locação: Gestão/Adm (tudo), corretor criador,
--    proponente (e-mail do JWT, mesmo sem linha em perfis). Anon: nada.
--    Sem policies de escrita: authenticated não tem grant de escrita.
-- -----------------------------------------------------------------------------

alter table propostas_venda enable row level security;
alter table propostas_venda_historico enable row level security;

create or replace function pode_ver_proposta_venda(p_proposta_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from propostas_venda p
     where p.id = p_proposta_id
       and (
         is_adm_ou_gestao()
         or (p.criado_por = auth.uid() and papel_atual() = 'corretor')
         or (auth.jwt() ->> 'email' is not null and lower(p.email) = lower(auth.jwt() ->> 'email'))
       )
  );
$$;

drop policy if exists propostas_venda_select on propostas_venda;
create policy propostas_venda_select on propostas_venda for select to authenticated
  using (pode_ver_proposta_venda(id));

drop policy if exists propostas_venda_insert on propostas_venda;
drop policy if exists propostas_venda_update on propostas_venda;

drop policy if exists propostas_venda_historico_select on propostas_venda_historico;
create policy propostas_venda_historico_select on propostas_venda_historico for select to authenticated
  using (pode_ver_proposta_venda(proposta_id));

-- View de trabalho (só o que está em andamento); expiração calculada na leitura.
create or replace view propostas_venda_ativas as
select
  p.*,
  case
    when p.status = 'aguardando_cliente' and p.link_expira_em < now() then 'expirada'::text
    else p.status
  end as status_efetivo
from propostas_venda p
where p.status in ('aguardando_cliente', 'confirmada');

alter view propostas_venda_ativas set (security_invoker = true);

revoke all on propostas_venda_ativas from public, anon;
grant select on propostas_venda_ativas to authenticated;
grant select on propostas_venda_ativas to service_role;

-- -----------------------------------------------------------------------------
-- 3. Storage privado: assinaturas (PNG) + documentos finais (PDF)
--    Layout: propostas-venda/{proposta_id}/assinatura.png|documento.pdf
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('propostas-venda', 'propostas-venda', false)
on conflict (id) do nothing;

-- Leitura: quem vê a proposta vê os arquivos dela.
create or replace function pode_ler_arquivo_venda(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and pode_ver_proposta_venda(split_part(p_name, '/', 1)::uuid);
$$;

-- Escrita: só o proponente, e só no momento certo de cada arquivo.
create or replace function pode_enviar_arquivo_venda(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from propostas_venda p
     where split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and p.id = split_part(p_name, '/', 1)::uuid
       and auth.jwt() ->> 'email' is not null
       and lower(p.email) = lower(auth.jwt() ->> 'email')
       and (
         (p_name = p.id || '/assinatura.png' and p.status = 'aguardando_cliente' and p.link_expira_em >= now())
         or (p_name = p.id || '/documento.pdf' and p.status = 'confirmada' and p.documento_path is null)
       )
  );
$$;

drop function if exists pode_enviar_proposta_venda(text);

drop policy if exists propostas_venda_insert_obj on storage.objects;
create policy propostas_venda_insert_obj on storage.objects for insert to authenticated
  with check (bucket_id = 'propostas-venda' and pode_enviar_arquivo_venda(name));

drop policy if exists propostas_venda_update_obj on storage.objects;
create policy propostas_venda_update_obj on storage.objects for update to authenticated
  using (bucket_id = 'propostas-venda' and pode_enviar_arquivo_venda(name))
  with check (bucket_id = 'propostas-venda' and pode_enviar_arquivo_venda(name));

drop policy if exists propostas_venda_select_obj on storage.objects;
create policy propostas_venda_select_obj on storage.objects for select to authenticated
  using (bucket_id = 'propostas-venda' and pode_ler_arquivo_venda(name));

-- -----------------------------------------------------------------------------
-- 4. RPCs de estado — chamadas só pela Edge Function (service_role), que já
--    validou o JWT e passa a identidade do chamador. A regra de estado mora aqui.
-- -----------------------------------------------------------------------------

drop function if exists criar_proposta_venda(text, text, integer, numeric, text, text, text);
drop function if exists confirmar_proposta_venda(uuid, text, numeric, text, text, text);

create or replace function criar_proposta_venda(
  p_criado_por uuid, p_nome_cliente text, p_email text, p_codigo_imovel integer,
  p_valor numeric, p_imovel_titulo text, p_imovel_endereco text, p_ator text
) returns propostas_venda
language plpgsql security definer set search_path = public as $$
declare
  v_row propostas_venda;
begin
  if not exists (
    select 1 from perfis where id = p_criado_por and role in ('gestao', 'adm', 'corretor')
  ) then
    raise exception 'Só Gestão, Admin e Corretor criam propostas de venda';
  end if;

  insert into propostas_venda
    (criado_por, nome_cliente, email, codigo_imovel, valor_referencia, imovel_titulo, imovel_endereco, status, link_expira_em)
  values
    (p_criado_por, p_nome_cliente, trim(p_email), p_codigo_imovel, p_valor, p_imovel_titulo, p_imovel_endereco,
     'aguardando_cliente', now() + interval '7 days')
  returning * into v_row;

  insert into propostas_venda_historico (proposta_id, status_anterior, status_novo, ator)
  values (v_row.id, null, 'aguardando_cliente', p_ator);

  return v_row;
end;
$$;

create or replace function confirmar_proposta_venda(
  p_proposta_id uuid, p_email_chamador text, p_telefone text,
  p_valor_proposta numeric, p_descricao text
) returns propostas_venda
language plpgsql security definer set search_path = public as $$
declare
  v_row propostas_venda;
begin
  select * into v_row from propostas_venda where id = p_proposta_id for update;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id;
  end if;
  if p_email_chamador is null or lower(v_row.email) <> lower(p_email_chamador) then
    raise exception 'Você não tem acesso a esta proposta';
  end if;
  if v_row.status <> 'aguardando_cliente' then
    raise exception 'Proposta já foi %', v_row.status;
  end if;
  if v_row.link_expira_em < now() then
    raise exception 'Link da proposta expirado';
  end if;
  if p_valor_proposta is null or p_valor_proposta <= 0 then
    raise exception 'Valor da proposta inválido';
  end if;
  if not exists (
    select 1 from storage.objects
     where bucket_id = 'propostas-venda' and name = p_proposta_id || '/assinatura.png'
  ) then
    raise exception 'Assinatura não encontrada. Assine de novo.';
  end if;

  update propostas_venda
     set telefone = p_telefone,
         valor_proposta = p_valor_proposta,
         descricao_proposta = p_descricao,
         assinatura_path = p_proposta_id || '/assinatura.png',
         status = 'confirmada'
   where id = p_proposta_id
  returning * into v_row;

  insert into propostas_venda_historico (proposta_id, status_anterior, status_novo, ator)
  values (p_proposta_id, 'aguardando_cliente', 'confirmada', p_email_chamador);

  return v_row;
end;
$$;

-- Papel (gestao/adm) é conferido na Edge Function antes da chamada.
create or replace function descartar_proposta_venda(
  p_proposta_id uuid, p_motivo text, p_ator text
) returns propostas_venda
language plpgsql security definer set search_path = public as $$
declare
  v_row propostas_venda;
  v_status_anterior text;
begin
  select status into v_status_anterior from propostas_venda where id = p_proposta_id for update;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id;
  end if;
  if v_status_anterior = 'descartada' then
    raise exception 'Proposta já foi descartada';
  end if;

  update propostas_venda
     set status = 'descartada', motivo = p_motivo
   where id = p_proposta_id
  returning * into v_row;

  insert into propostas_venda_historico (proposta_id, status_anterior, status_novo, ator, motivo)
  values (p_proposta_id, v_status_anterior, 'descartada', p_ator, p_motivo);

  return v_row;
end;
$$;

revoke execute on function criar_proposta_venda(uuid, text, text, integer, numeric, text, text, text) from public, anon, authenticated;
grant execute on function criar_proposta_venda(uuid, text, text, integer, numeric, text, text, text) to service_role;

revoke execute on function confirmar_proposta_venda(uuid, text, text, numeric, text) from public, anon, authenticated;
grant execute on function confirmar_proposta_venda(uuid, text, text, numeric, text) to service_role;

revoke execute on function descartar_proposta_venda(uuid, text, text) from public, anon, authenticated;
grant execute on function descartar_proposta_venda(uuid, text, text) to service_role;

-- Único ajuste feito pelo navegador do proponente: registrar o PDF assinado,
-- uma vez, depois de confirmada e com o arquivo já no Storage.
create or replace function registrar_documento_venda(p_proposta_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row propostas_venda;
  v_email_jwt text := auth.jwt() ->> 'email';
  v_path text := p_proposta_id || '/documento.pdf';
begin
  select * into v_row from propostas_venda where id = p_proposta_id for update;
  if not found or v_email_jwt is null or lower(v_row.email) <> lower(v_email_jwt) then
    raise exception 'Você não tem acesso a esta proposta';
  end if;
  if v_row.status <> 'confirmada' or v_row.documento_path is not null then
    return;
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'propostas-venda' and name = v_path) then
    raise exception 'Documento não encontrado no Storage';
  end if;

  update propostas_venda set documento_path = v_path where id = p_proposta_id;
end;
$$;

revoke execute on function registrar_documento_venda(uuid) from public, anon;
grant execute on function registrar_documento_venda(uuid) to authenticated;

-- Funções auxiliares de RLS/Storage: não expor pela API além do necessário.
revoke execute on function pode_ver_proposta_venda(uuid) from public, anon;
revoke execute on function pode_ler_arquivo_venda(text) from public, anon;
revoke execute on function pode_enviar_arquivo_venda(text) from public, anon;

create or replace function tocar_venda_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists propostas_venda_updated_at on propostas_venda;
create trigger propostas_venda_updated_at
  before update on propostas_venda
  for each row execute function tocar_venda_updated_at();
