-- =============================================================================
-- Esteira de locação — trazendo o fluxo pro Hub (login real de locatário e
-- proprietário via magic link, em vez de token_link anônimo).
--
-- Não remove nada do schema existente (ver 20260821140000_esteira_locacao_ajustes.sql).
-- token_link/link_expira_em continuam controlando o prazo de 7 dias do
-- processo -- isso é uma regra de negócio (o processo expira), independente
-- de como a pessoa se autentica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. propostas_locacao: identidade do proprietário (não existia) + dados do
--    imóvel pra exibição (sem Imoview nesta fase, o corretor digita à mão) +
--    novo status inicial (locatário ainda não confirmou os próprios dados).
-- -----------------------------------------------------------------------------

alter table propostas_locacao
  add column if not exists proprietario_nome text,
  add column if not exists proprietario_email text,
  add column if not exists imovel_titulo text,
  add column if not exists imovel_endereco text;

alter table propostas_locacao
  add constraint propostas_locacao_proprietario_email_formato
  check (proprietario_email is null or proprietario_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Agora quem cria a proposta (corretor) só informa email do locatário +
-- imóvel; nome/telefone/tipo de pessoa ficam pro locatário preencher depois.
alter table propostas_locacao alter column nome_cliente drop not null;
alter table propostas_locacao alter column tel drop not null;
alter table propostas_locacao alter column tipo_pessoa drop not null;

alter table propostas_locacao drop constraint propostas_locacao_status_valido;
alter table propostas_locacao add constraint propostas_locacao_status_valido
  check (status in ('aguardando_locatario','criada','aguardando_docs','docs_em_analise','docs_aprovados','sincronizada','rejeitada','expirada'));

alter table propostas_locacao alter column status set default 'aguardando_locatario';

-- -----------------------------------------------------------------------------
-- 2. documentos_enviados: upload direto no Storage em vez de link do Drive.
--    url_gdrive fica como legado (coluna e dado existente intocados; a
--    constraint já aceitava null, então documentos novos simplesmente não a
--    usam).
-- -----------------------------------------------------------------------------

alter table documentos_enviados add column if not exists arquivo_path text;

-- -----------------------------------------------------------------------------
-- 3. Bucket privado pra documentos da esteira (ao contrário de "banners",
--    que é público -- aqui são RG, comprovante de renda etc.).
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('esteira-documentos', 'esteira-documentos', false)
on conflict (id) do nothing;

-- Convenção de path: "{proposta_id}/{documento_codigo}.{ext}". Confere se
-- quem está autenticado é o locatário/proprietário dono dessa proposta, ou
-- alguém interno (adm/gestão) revisando.
create or replace function pode_acessar_documento_esteira(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from propostas_locacao p
    where p.id = (split_part(p_name, '/', 1))::uuid
      and (
        is_adm_ou_gestao()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(p.proprietario_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create policy esteira_documentos_select on storage.objects
  for select using (bucket_id = 'esteira-documentos' and pode_acessar_documento_esteira(name));

create policy esteira_documentos_insert on storage.objects
  for insert with check (bucket_id = 'esteira-documentos' and pode_acessar_documento_esteira(name));

create policy esteira_documentos_update on storage.objects
  for update using (bucket_id = 'esteira-documentos' and pode_acessar_documento_esteira(name));

-- -----------------------------------------------------------------------------
-- 4. RLS das 4 tabelas: hoje é só "auth.role() = 'authenticated'" (qualquer
--    logado lê tudo) -- era seguro enquanto só existiam contas internas; a
--    partir de agora locatário/proprietário também autenticam, então isso
--    vira vazamento de dado entre clientes diferentes. Escopo por dono.
-- -----------------------------------------------------------------------------

drop policy if exists "leitura autenticada" on propostas_locacao;
create policy propostas_locacao_select on propostas_locacao for select using (
  is_adm_ou_gestao()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(proprietario_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "leitura autenticada" on documentos_enviados;
create policy documentos_enviados_select on documentos_enviados for select using (
  is_adm_ou_gestao()
  or exists (
    select 1 from propostas_locacao p where p.id = documentos_enviados.proposta_id
      and (lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(p.proprietario_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy if exists "leitura autenticada" on status_historico;
create policy status_historico_select on status_historico for select using (
  is_adm_ou_gestao()
  or exists (
    select 1 from propostas_locacao p where p.id = status_historico.proposta_id
      and (lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(p.proprietario_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

-- documentos_tipos_obrigatorios é só o catálogo de tipos de documento (sem
-- dado sensível) -- continua liberado pra qualquer autenticado, cliente
-- precisa dele pra montar o checklist.

-- -----------------------------------------------------------------------------
-- 5. Locatário confirma/completa os próprios dados (preenche o que o
--    corretor não preencheu na criação) e a proposta avança pra "criada".
-- -----------------------------------------------------------------------------

create or replace function confirmar_dados_locatario(
  p_proposta_id uuid,
  p_nome text,
  p_tel text,
  p_tipo_pessoa text,
  p_tem_conjuge boolean,
  p_ator text default 'locatario'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  if p_tipo_pessoa not in ('Física', 'Jurídica') then
    raise exception 'tipo_pessoa inválido: %. Use Física ou Jurídica.', p_tipo_pessoa;
  end if;

  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Prazo da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if v_proposta.status <> 'aguardando_locatario' then
    raise exception 'Proposta % está em status %, esperado "aguardando_locatario"', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  update propostas_locacao
     set nome_cliente = trim(p_nome), tel = p_tel, tipo_pessoa = p_tipo_pessoa, tem_conjuge = p_tem_conjuge, status = 'criada'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

revoke execute on function confirmar_dados_locatario from public;
grant execute on function confirmar_dados_locatario to service_role;

-- -----------------------------------------------------------------------------
-- 6. Criação da proposta pelo corretor: só email do locatário + imóvel +
--    identidade do proprietário (não existe no Imoview nesta fase -- o
--    corretor digita). Mesma deduplicação por (email, codigo_imovel) que já
--    existia em upsert_proposta_locacao, mas sem exigir nome/tel/tipo_pessoa
--    (upsert_proposta_locacao fica intacta, só não é mais chamada).
-- -----------------------------------------------------------------------------

create or replace function criar_proposta_locacao(
  p_email             text,
  p_codigo_imovel     integer,
  p_proprietario_nome text,
  p_proprietario_email text,
  p_imovel_titulo     text default null,
  p_imovel_endereco   text default null,
  p_ator              text default 'corretor'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare
  v_proposta propostas_locacao;
  v_token text;
begin
  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into propostas_locacao (
    email, codigo_imovel, proprietario_nome, proprietario_email,
    imovel_titulo, imovel_endereco, token_link, link_expira_em, status
  )
  values (
    lower(trim(p_email)), p_codigo_imovel, trim(p_proprietario_nome), lower(trim(p_proprietario_email)),
    p_imovel_titulo, p_imovel_endereco, v_token, now() + interval '7 days', 'aguardando_locatario'
  )
  on conflict (email, codigo_imovel) do update set
    proprietario_nome  = excluded.proprietario_nome,
    proprietario_email = excluded.proprietario_email,
    imovel_titulo      = coalesce(excluded.imovel_titulo, propostas_locacao.imovel_titulo),
    imovel_endereco    = coalesce(excluded.imovel_endereco, propostas_locacao.imovel_endereco),
    token_link      = case when propostas_locacao.link_expira_em < now() then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em  = case when propostas_locacao.link_expira_em < now() then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status          = case when propostas_locacao.link_expira_em < now() then 'aguardando_locatario' else propostas_locacao.status end
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function criar_proposta_locacao is 'Corretor cria a proposta só com email do locatário + imóvel + identidade do proprietário; locatário completa o resto ao logar (ver confirmar_dados_locatario).';

revoke execute on function criar_proposta_locacao from public;
grant execute on function criar_proposta_locacao to service_role;

-- -----------------------------------------------------------------------------
-- 7. handle_new_user: hoje bloqueia (raise exception) qualquer e-mail fora
--    de @imovit.com.br -- isso quebraria o magic link de locatário/
--    proprietário. Passa a só pular a criação do perfil interno pra esses
--    e-mails, sem bloquear o login. perfil === null já é tratado em vários
--    pontos do front como "sem acesso interno" -- vira o sinal de "é cliente".
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.email ~* '@imovit\.com\.br$' then
    insert into public.perfis (id, email, role) values (new.id, new.email, 'user');
  end if;
  return new;
end;
$$;
