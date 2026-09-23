-- =============================================================================
-- Níveis de acesso (Gestão / Admin / Marketing / Corretor), página de perfil,
-- solicitação de troca de nível, e correção das regras de acesso da esteira.
--
-- Níveis (perfis.role):
--   gestao    -- acesso geral; único que troca o nível de alguém
--   adm       -- "Admin": propostas/esteira/processos (todas) + Kanban
--   marketing -- dashboards + metas + conteúdo da Home (avisos, links,
--                banners, plantão, agenda do fotógrafo, datas)
--   corretor  -- propostas/esteira/processos SÓ das propostas que ele criou
--                (cria e acompanha; aprovar/decidir continua com adm/gestão)
--   user      -- sem nível: Home + Perfil, até a Gestão atribuir um nível
--   tvaccess  -- conta da TV Display
--
-- Correção de segurança: as regras antigas comparavam
-- coalesce(proprietario_email, '') com coalesce(email do login, ''). Sem
-- proprietário no sistema (Parte 1, 2026-09-21) o campo fica vazio, e quem
-- acessa sem login também tem e-mail vazio -- '' = '' liberava propostas,
-- documentos, histórico e os ARQUIVOS da esteira para qualquer visitante.
-- As regras novas exigem e-mail de login presente e não olham mais pra
-- proprietario_email.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfis: dados editáveis pelo próprio usuário + níveis novos
-- -----------------------------------------------------------------------------

alter table perfis add column if not exists nome text;
alter table perfis add column if not exists telefone text;
alter table perfis add column if not exists cargo text;
alter table perfis add column if not exists foto_url text;
alter table perfis add column if not exists atualizado_em timestamptz not null default now();

alter table perfis drop constraint if exists perfis_role_check;
alter table perfis add constraint perfis_role_check
  check (role in ('gestao', 'adm', 'marketing', 'corretor', 'user', 'tvaccess'));

create or replace function papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select role from perfis where id = auth.uid();
$$;

create or replace function pode_editar_conteudo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_atual() in ('gestao', 'marketing'), false);
$$;

create or replace function pode_ver_dash() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_atual() in ('gestao', 'marketing'), false);
$$;

-- O próprio usuário edita nome/telefone/cargo/foto; nível e e-mail só a Gestão
-- (ou o servidor) mudam -- garantido pelo trigger abaixo, não só pela tela.
drop policy if exists usuario_edita_proprio_perfil on perfis;
create policy usuario_edita_proprio_perfil on perfis for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function proteger_campos_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email or new.id is distinct from old.id)
     and not is_gestao()
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só a Gestão pode alterar nível de acesso ou e-mail de um perfil';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_perfil on perfis;
create trigger trg_proteger_campos_perfil before update on perfis
  for each row execute function proteger_campos_perfil();

-- -----------------------------------------------------------------------------
-- 2. Solicitação de troca de nível (usuário pede, Gestão decide)
-- -----------------------------------------------------------------------------

create table if not exists solicitacoes_acesso (
  id              uuid primary key default gen_random_uuid(),
  perfil_id       uuid not null references perfis(id) on delete cascade,
  role_atual      text not null,
  role_solicitado text not null check (role_solicitado in ('gestao', 'adm', 'marketing', 'corretor')),
  motivo          text,
  status          text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'cancelada')),
  resposta        text,
  decidido_por    uuid references perfis(id) on delete set null,
  decidido_em     timestamptz,
  criado_em       timestamptz not null default now()
);

-- Uma solicitação pendente por pessoa.
create unique index if not exists solicitacoes_acesso_uma_pendente
  on solicitacoes_acesso (perfil_id) where status = 'pendente';

alter table solicitacoes_acesso enable row level security;

drop policy if exists solicitacoes_select on solicitacoes_acesso;
create policy solicitacoes_select on solicitacoes_acesso for select to authenticated
  using (perfil_id = auth.uid() or is_gestao());

drop policy if exists solicitacoes_insert on solicitacoes_acesso;
create policy solicitacoes_insert on solicitacoes_acesso for insert to authenticated
  with check (
    perfil_id = auth.uid()
    and status = 'pendente'
    and role_atual = papel_atual()
    and role_solicitado <> role_atual
    and decidido_por is null
  );

-- O próprio usuário só pode cancelar a pendente dele; decidir é via RPC.
drop policy if exists solicitacoes_cancela_propria on solicitacoes_acesso;
create policy solicitacoes_cancela_propria on solicitacoes_acesso for update to authenticated
  using (perfil_id = auth.uid() and status = 'pendente')
  with check (perfil_id = auth.uid() and status = 'cancelada');

create or replace function decidir_solicitacao_acesso(p_solicitacao_id uuid, p_aprovar boolean, p_resposta text default null)
returns solicitacoes_acesso
language plpgsql security definer set search_path = public as $$
declare
  v_sol solicitacoes_acesso;
begin
  if not is_gestao() then
    raise exception 'Só a Gestão pode decidir solicitações de acesso';
  end if;

  select * into v_sol from solicitacoes_acesso where id = p_solicitacao_id for update;
  if not found then raise exception 'Solicitação % não encontrada', p_solicitacao_id; end if;
  if v_sol.status <> 'pendente' then raise exception 'Solicitação já foi %', v_sol.status; end if;

  update solicitacoes_acesso
     set status = case when p_aprovar then 'aprovada' else 'recusada' end,
         resposta = p_resposta,
         decidido_por = auth.uid(),
         decidido_em = now()
   where id = p_solicitacao_id
  returning * into v_sol;

  if p_aprovar then
    update perfis set role = v_sol.role_solicitado where id = v_sol.perfil_id;
  end if;

  return v_sol;
end;
$$;

revoke execute on function decidir_solicitacao_acesso(uuid, boolean, text) from public, anon;
grant execute on function decidir_solicitacao_acesso(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Foto de perfil (bucket público de leitura; cada um escreve só na própria pasta)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatares_insert_proprio on storage.objects;
create policy avatares_insert_proprio on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatares_update_proprio on storage.objects;
create policy avatares_update_proprio on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatares_delete_proprio on storage.objects;
create policy avatares_delete_proprio on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and split_part(name, '/', 1) = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 4. Esteira: dono da proposta (corretor) + regras de acesso corrigidas
-- -----------------------------------------------------------------------------

alter table propostas_locacao add column if not exists criado_por uuid references perfis(id) on delete set null;
create index if not exists propostas_locacao_criado_por on propostas_locacao (criado_por);

-- Propostas antigas: o criador é o ator do primeiro registro do histórico.
update propostas_locacao p
   set criado_por = pf.id
  from (
    select distinct on (proposta_id) proposta_id, lower(ator) as ator
      from status_historico
     order by proposta_id, timestamp_registro
  ) h
  join perfis pf on lower(pf.email) = h.ator
 where h.proposta_id = p.id and p.criado_por is null;

-- Quem enxerga uma proposta: Admin/Gestão (todas), o corretor que a criou, e
-- o locatário (e-mail do login -- que precisa existir -- igual ao da proposta).
create or replace function pode_ver_proposta(p_proposta_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from propostas_locacao p
     where p.id = p_proposta_id
       and (
         is_adm_ou_gestao()
         or (p.criado_por = auth.uid() and papel_atual() = 'corretor')
         or (auth.jwt() ->> 'email' is not null and lower(p.email) = lower(auth.jwt() ->> 'email'))
       )
  );
$$;

-- Enviar/substituir arquivo: só o locatário da proposta ou Admin/Gestão.
create or replace function pode_enviar_documento_esteira(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from propostas_locacao p
     where p.id = (split_part(p_name, '/', 1))::uuid
       and (
         is_adm_ou_gestao()
         or (auth.jwt() ->> 'email' is not null and lower(p.email) = lower(auth.jwt() ->> 'email'))
       )
  );
$$;

create or replace function pode_acessar_documento_esteira(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select pode_ver_proposta((split_part(p_name, '/', 1))::uuid);
$$;

drop policy if exists propostas_locacao_select on propostas_locacao;
create policy propostas_locacao_select on propostas_locacao for select
  using (pode_ver_proposta(id));

drop policy if exists documentos_enviados_select on documentos_enviados;
create policy documentos_enviados_select on documentos_enviados for select
  using (pode_ver_proposta(proposta_id));

drop policy if exists status_historico_select on status_historico;
create policy status_historico_select on status_historico for select
  using (pode_ver_proposta(proposta_id));

drop policy if exists esteira_documentos_insert on storage.objects;
create policy esteira_documentos_insert on storage.objects for insert
  with check (bucket_id = 'esteira-documentos' and pode_enviar_documento_esteira(name));

drop policy if exists esteira_documentos_update on storage.objects;
create policy esteira_documentos_update on storage.objects for update
  using (bucket_id = 'esteira-documentos' and pode_enviar_documento_esteira(name));

-- A view passa a respeitar as regras da tabela (antes rodava com o dono e
-- ignorava RLS) e deixa de ser lida sem login.
alter view propostas_ativas set (security_invoker = true);
revoke all on propostas_ativas from anon;

-- Funções que só a Edge Function (service_role) deve chamar.
revoke execute on function completar_cadastro_locatario(uuid, text, boolean, text, text, text, numeric, numeric, text, text, text, text, numeric, text) from public, anon, authenticated;
revoke execute on function confirmar_dados_locatario(uuid, text, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function descartar_proposta_locacao(uuid, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Conteúdo da Home: quem edita passa de Admin/Gestão para Marketing/Gestão
-- -----------------------------------------------------------------------------

alter policy avisos_escrita_admin on avisos using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy biblioteca_links_escrita_admin on biblioteca_links using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy home_banners_escrita_admin on home_banners using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy plantao_escrita_admin on plantao using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy agendamentos_fotografo_escrita_admin on agendamentos_fotografo using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy fotografo_bloqueios_escrita_admin on fotografo_bloqueios using (pode_editar_conteudo()) with check (pode_editar_conteudo());
alter policy datas_comemorativas_escrita_admin on datas_comemorativas using (pode_editar_conteudo()) with check (pode_editar_conteudo());

alter policy banners_escrita_admin on storage.objects with check (bucket_id = 'banners' and pode_editar_conteudo());
alter policy banners_atualiza_admin on storage.objects using (bucket_id = 'banners' and pode_editar_conteudo());
alter policy banners_remove_admin on storage.objects using (bucket_id = 'banners' and pode_editar_conteudo());

-- -----------------------------------------------------------------------------
-- 6. Dashboards: Marketing passa a ler os dados que só a Gestão lia
-- -----------------------------------------------------------------------------

alter policy admin_le_google_ads on dashboard_google_ads using (pode_ver_dash());
alter policy admin_le_meta_ads on dashboard_meta_ads using (pode_ver_dash());
alter policy admin_le_metas_campanhas on metas_campanhas using (pode_ver_dash());
alter policy admin_le_metas_mensais on metas_mensais using (pode_ver_dash());

-- Helpers novos: não expor pra quem não está logado.
revoke execute on function papel_atual() from public, anon;
revoke execute on function pode_editar_conteudo() from public, anon;
revoke execute on function pode_ver_dash() from public, anon;
revoke execute on function pode_ver_proposta(uuid) from public, anon;
revoke execute on function pode_enviar_documento_esteira(text) from public, anon;
grant execute on function papel_atual(), pode_editar_conteudo(), pode_ver_dash(), pode_ver_proposta(uuid), pode_enviar_documento_esteira(text) to authenticated;
