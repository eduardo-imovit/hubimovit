-- =============================================================================
-- Esteira de locação — ajustes aditivos no schema existente + funções/triggers
--
-- CONTEXTO: as tabelas propostas_locacao, documentos_tipos_obrigatorios,
-- documentos_enviados e status_historico já existiam (criadas via Claude no
-- chat, fora deste repo) antes desta migration. Este arquivo NÃO cria
-- tabelas — só adiciona colunas/constraints/índices que faltavam e a lógica
-- de negócio (funções + triggers) em cima do que já existe.
--
-- Nada aqui remove ou altera dado existente. Só ADD COLUMN, ADD CONSTRAINT,
-- CREATE INDEX/FUNCTION/TRIGGER/VIEW/POLICY.
--
-- Como aplicar: painel do Supabase do projeto "Imovit Database" > SQL Editor
-- > colar este arquivo inteiro > Run.
-- =============================================================================

-- 1. url_gdrive precisa aceitar nulo: status default 'pendente' só faz
--    sentido se a linha puder existir antes do cliente enviar o link.
alter table documentos_enviados alter column url_gdrive drop not null;

-- 2. Onde guardar o motivo de uma rejeição de documento (não existia).
alter table documentos_enviados add column if not exists feedback_adm text;

-- 3. Sinaliza explicitamente quais documentos exigem cônjuge, em vez de
--    inferir isso pelo nome (frágil — quebraria se alguém renomeasse).
alter table documentos_tipos_obrigatorios add column if not exists exige_conjuge boolean not null default false;
update documentos_tipos_obrigatorios set exige_conjuge = true where codigo in (9,10,11,12,13);

-- 4. Deduplicação (pedido original): mesmo e-mail + mesmo imóvel = mesma proposta.
alter table propostas_locacao
  add constraint propostas_locacao_email_imovel_unique unique (email, codigo_imovel);

-- 5. Reenvio de documento deve atualizar a linha, não duplicar.
alter table documentos_enviados
  add constraint documentos_enviados_proposta_documento_unique unique (proposta_id, documento_codigo);

-- 6. Integridade referencial que faltava.
alter table documentos_enviados
  add constraint documentos_enviados_proposta_id_fkey
  foreign key (proposta_id) references propostas_locacao(id) on delete cascade;

alter table status_historico
  add constraint status_historico_proposta_id_fkey
  foreign key (proposta_id) references propostas_locacao(id) on delete cascade;

-- 7. Validação de valores (equivalente a enum, sem migrar o tipo da coluna
--    pra não arriscar a linha que já existe em produção).
alter table propostas_locacao
  add constraint propostas_locacao_status_valido
  check (status in ('criada','aguardando_docs','docs_em_analise','docs_aprovados','sincronizada','rejeitada','expirada'));

alter table propostas_locacao
  add constraint propostas_locacao_tipo_pessoa_valido
  check (tipo_pessoa in ('Física','Jurídica'));

alter table propostas_locacao
  add constraint propostas_locacao_email_formato
  check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table documentos_enviados
  add constraint documentos_enviados_status_valido
  check (status in ('pendente','enviado','aprovado','rejeitado'));

alter table documentos_enviados
  add constraint documentos_enviados_url_formato
  check (url_gdrive is null or url_gdrive ~* '^https://(drive|docs)\.google\.com/');

alter table documentos_tipos_obrigatorios
  add constraint documentos_tipos_obrigatorios_tipo_pessoa_valido
  check (tipo_pessoa in ('Física','Jurídica','Ambos'));

-- 8. Índices pra query rápida (token_link já é indexado pela unique acima).
create index if not exists idx_propostas_locacao_email on propostas_locacao (email);
create index if not exists idx_documentos_enviados_proposta_id on documentos_enviados (proposta_id);
create index if not exists idx_status_historico_proposta_id on status_historico (proposta_id);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------

create or replace function tocar_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_propostas_locacao_updated_at on propostas_locacao;
create trigger trg_propostas_locacao_updated_at
  before update on propostas_locacao
  for each row execute function tocar_updated_at();

-- -----------------------------------------------------------------------------
-- Expiração: bloqueia avanço de status numa proposta com link vencido.
-- A leitura (dashboard) é coberta pela view propostas_ativas mais abaixo,
-- que calcula o status efetivo na hora — não depende de nenhum job/cron
-- (pg_cron está disponível no projeto mas não instalado; não usei porque
-- a checagem "on read" resolve o mesmo problema sem infra extra).
-- -----------------------------------------------------------------------------

create or replace function bloquear_avanco_expirado() returns trigger language plpgsql as $$
begin
  if old.link_expira_em < now() and old.status not in ('sincronizada','rejeitada','expirada') then
    new.status := 'expirada';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propostas_locacao_expira on propostas_locacao;
create trigger trg_propostas_locacao_expira
  before update on propostas_locacao
  for each row execute function bloquear_avanco_expirado();

-- -----------------------------------------------------------------------------
-- Histórico automático — lê app.ator/app.motivo setados pelas funções abaixo.
-- Mesmo padrão que auth.uid() usa: variável de sessão, não coluna transitória.
-- -----------------------------------------------------------------------------

create or replace function log_status_historico() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into status_historico (proposta_id, status_anterior, status_novo, ator, motivo)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      coalesce(nullif(current_setting('app.ator', true), ''), 'sistema'),
      nullif(current_setting('app.motivo', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propostas_locacao_log_status on propostas_locacao;
create trigger trg_propostas_locacao_log_status
  after insert or update of status on propostas_locacao
  for each row execute function log_status_historico();

-- -----------------------------------------------------------------------------
-- Recalcula o status da proposta a cada documento enviado/decidido.
-- -----------------------------------------------------------------------------

create or replace function recalcular_status_proposta() returns trigger language plpgsql as $$
declare
  v_proposta record;
  v_total_obrigatorios int;
  v_aprovados int;
  v_rejeitados int;
  v_pendentes int;
  v_novo_status text;
begin
  select id, tipo_pessoa, tem_conjuge, status into v_proposta
    from propostas_locacao where id = new.proposta_id for update;

  if v_proposta.status not in ('aguardando_docs', 'docs_em_analise') then
    return new;
  end if;

  select
    count(*),
    count(*) filter (where de.status = 'aprovado'),
    count(*) filter (where de.status = 'rejeitado'),
    count(*) filter (where de.status is null or de.status = 'pendente')
    into v_total_obrigatorios, v_aprovados, v_rejeitados, v_pendentes
    from documentos_tipos_obrigatorios dt
    left join documentos_enviados de
      on de.documento_codigo = dt.codigo and de.proposta_id = v_proposta.id
   where (dt.tipo_pessoa = v_proposta.tipo_pessoa or dt.tipo_pessoa = 'Ambos')
     and (not dt.exige_conjuge or v_proposta.tem_conjuge);

  if v_rejeitados > 0 then
    v_novo_status := 'aguardando_docs';
  elsif v_total_obrigatorios > 0 and v_aprovados = v_total_obrigatorios then
    v_novo_status := 'docs_aprovados';
  elsif v_pendentes = 0 then
    v_novo_status := 'docs_em_analise';
  else
    v_novo_status := 'aguardando_docs';
  end if;

  if v_novo_status is distinct from v_proposta.status then
    perform set_config('app.ator', 'sistema', true);
    perform set_config('app.motivo', 'recálculo automático após documento', true);
    update propostas_locacao set status = v_novo_status where id = v_proposta.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documentos_enviados_recalcula on documentos_enviados;
create trigger trg_documentos_enviados_recalcula
  after insert or update of status on documentos_enviados
  for each row execute function recalcular_status_proposta();

-- -----------------------------------------------------------------------------
-- Função: deduplicação (passo 1) — atômica via ON CONFLICT.
-- Reenvio com o link já vencido gera um token novo automaticamente.
-- -----------------------------------------------------------------------------

create or replace function upsert_proposta_locacao(
  p_nome_cliente   text,
  p_email          text,
  p_tel            text,
  p_codigo_imovel  integer,
  p_tipo_pessoa    text,
  p_tem_conjuge    boolean,
  p_ator           text default 'cliente'
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare
  v_proposta propostas_locacao;
  v_token text;
begin
  if p_tipo_pessoa not in ('Física', 'Jurídica') then
    raise exception 'tipo_pessoa inválido: %. Use Física ou Jurídica.', p_tipo_pessoa;
  end if;

  perform set_config('app.ator', p_ator, true);
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into propostas_locacao (nome_cliente, email, tel, codigo_imovel, tipo_pessoa, tem_conjuge, token_link, link_expira_em)
  values (trim(p_nome_cliente), lower(trim(p_email)), p_tel, p_codigo_imovel, p_tipo_pessoa, p_tem_conjuge, v_token, now() + interval '7 days')
  on conflict (email, codigo_imovel) do update set
    nome_cliente   = excluded.nome_cliente,
    tel            = excluded.tel,
    tipo_pessoa    = excluded.tipo_pessoa,
    tem_conjuge    = excluded.tem_conjuge,
    token_link     = case when propostas_locacao.link_expira_em < now() then excluded.token_link else propostas_locacao.token_link end,
    link_expira_em = case when propostas_locacao.link_expira_em < now() then excluded.link_expira_em else propostas_locacao.link_expira_em end,
    status         = case when propostas_locacao.link_expira_em < now() then 'criada' else propostas_locacao.status end
  returning * into v_proposta;

  return v_proposta;
end;
$$;

comment on function upsert_proposta_locacao is 'Se email+imóvel já existe, atualiza os dados do cliente; se o link antigo já expirou, gera um token novo e volta pra "criada".';

-- -----------------------------------------------------------------------------
-- Função: proprietário aceitou (passo 2)
-- -----------------------------------------------------------------------------

create or replace function aceitar_proprietario(p_proposta_id uuid, p_ator text default 'proprietario')
returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Link da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if v_proposta.status <> 'criada' then raise exception 'Proposta % está em status %, esperado "criada"', p_proposta_id, v_proposta.status; end if;

  perform set_config('app.ator', p_ator, true);
  update propostas_locacao set status = 'aguardando_docs' where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

-- -----------------------------------------------------------------------------
-- Função: cliente envia/reenvia documento (passo 3)
-- -----------------------------------------------------------------------------

create or replace function registrar_documento_enviado(
  p_proposta_id uuid, p_documento_codigo integer, p_url_gdrive text, p_ator text default 'cliente'
) returns documentos_enviados
language plpgsql security definer set search_path = public as $$
declare
  v_doc documentos_enviados;
  v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.link_expira_em < now() then raise exception 'Link da proposta % expirou em %', p_proposta_id, v_proposta.link_expira_em; end if;
  if p_url_gdrive is null or p_url_gdrive = '' then raise exception 'url_gdrive não pode ser vazia'; end if;

  perform set_config('app.ator', p_ator, true);

  insert into documentos_enviados (proposta_id, documento_codigo, url_gdrive, status)
  values (p_proposta_id, p_documento_codigo, p_url_gdrive, 'enviado')
  on conflict (proposta_id, documento_codigo) do update set
    url_gdrive   = excluded.url_gdrive,
    status       = 'enviado',
    feedback_adm = null
  returning * into v_doc;

  return v_doc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Função: ADM aprova ou rejeita documento (passo 4)
-- -----------------------------------------------------------------------------

create or replace function decidir_documento(
  p_documento_id uuid, p_decisao text, p_ator text, p_feedback text default null
) returns documentos_enviados
language plpgsql security definer set search_path = public as $$
declare v_doc documentos_enviados;
begin
  if p_decisao not in ('aprovado', 'rejeitado') then
    raise exception 'Decisão inválida: %. Use aprovado ou rejeitado.', p_decisao;
  end if;

  perform set_config('app.ator', p_ator, true);

  update documentos_enviados
     set status = p_decisao, feedback_adm = p_feedback
   where id = p_documento_id
  returning * into v_doc;

  if not found then raise exception 'Documento % não encontrado', p_documento_id; end if;

  return v_doc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Função: marca como sincronizado (passo 5) — chamada HTTP real acontece na
-- Edge Function; esta função só grava o resultado depois de confirmado.
-- -----------------------------------------------------------------------------

create or replace function marcar_sincronizado_imoview(p_proposta_id uuid, p_ator text default null)
returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if v_proposta.status <> 'docs_aprovados' then
    raise exception 'Proposta % está em status %, esperado "docs_aprovados"', p_proposta_id, v_proposta.status;
  end if;

  perform set_config('app.ator', coalesce(p_ator, 'sistema'), true);
  update propostas_locacao set status = 'sincronizada' where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

-- -----------------------------------------------------------------------------
-- View: propostas ativas, com status efetivo considerando expiração na hora
-- da leitura (sem depender de nenhum job em background).
-- -----------------------------------------------------------------------------

create or replace view propostas_ativas as
  select
    p.*,
    case
      when p.link_expira_em < now() and p.status not in ('sincronizada', 'rejeitada', 'expirada')
        then 'expirada'
      else p.status
    end as status_efetivo
  from propostas_locacao p
  where p.status <> 'sincronizada'
  order by p.timestamp_criacao desc;

-- -----------------------------------------------------------------------------
-- Leitura liberada pra autenticados (mesmo padrão do resto do Hub Imovit).
-- RLS já estava habilitado nessas 4 tabelas, mas sem nenhuma policy — ou
-- seja, hoje só service_role/postgres conseguem ler ou escrever.
-- -----------------------------------------------------------------------------

create policy "leitura autenticada" on propostas_locacao for select using (auth.role() = 'authenticated');
create policy "leitura autenticada" on documentos_enviados for select using (auth.role() = 'authenticated');
create policy "leitura autenticada" on status_historico for select using (auth.role() = 'authenticated');
create policy "leitura autenticada" on documentos_tipos_obrigatorios for select using (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- Permissões nas funções — só service_role executa. Por padrão o Postgres
-- libera EXECUTE em função pública pra anon/authenticated; sem isso,
-- qualquer cliente com a anon key poderia chamar supabase.rpc('decidir_documento', ...)
-- direto, sem passar pela Edge Function nem provar que é admin.
-- -----------------------------------------------------------------------------

revoke execute on function upsert_proposta_locacao      from public;
revoke execute on function aceitar_proprietario          from public;
revoke execute on function registrar_documento_enviado   from public;
revoke execute on function decidir_documento              from public;
revoke execute on function marcar_sincronizado_imoview    from public;

grant execute on function upsert_proposta_locacao      to service_role;
grant execute on function aceitar_proprietario          to service_role;
grant execute on function registrar_documento_enviado   to service_role;
grant execute on function decidir_documento              to service_role;
grant execute on function marcar_sincronizado_imoview    to service_role;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table propostas_locacao;
alter publication supabase_realtime add table documentos_enviados;
