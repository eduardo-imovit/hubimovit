-- =============================================================================
-- Esteira de locação v4 (PRD §5.6, RF22) — 2026-09-28, pedido do Eduardo:
--   locatário negocia → locador aceita → gestor registra a proposta com os
--   termos → sistema envia ao locatário → ele VALIDA ou PEDE CORREÇÃO →
--   validando, entra direto na esteira (aguardando_docs). Sai a aprovação interna.
--
-- Mudanças:
--   * status novo `correcao_solicitada` (bola com o gestor); na limpeza sai
--     `aguardando_aprovacao_interna` (a única proposta nele, de teste, volta
--     para a validação do locatário);
--   * coluna `motivo_correcao`;
--   * termos da negociação em colunas (corretor responsável, garantia, posse,
--     prazo, vencimento, rescisão, negociação específica; observacoes = outros
--     combinados) e a taxa de administração em propostas_locacao_interno (o
--     locatário não lê);
--   * criar_proposta_locacao recebe os termos (jsonb) e grava criado_por; não
--     sobrescreve mais uma proposta em andamento (usar editar);
--   * RPCs novos: editar_proposta_locacao, validar_proposta_locatario,
--     pedir_correcao_proposta. Na limpeza saem confirmar_dados_locatario,
--     decidir_aprovacao_interna e o criar_proposta_locacao antigo;
--   * bloquear_avanco_expirado passa a olhar o prazo NOVO (senão reenviar/renovar
--     uma proposta vencida era marcado como expirada na mesma hora);
--   * validar renova o prazo por 30 dias para a fase de cadastro/documentos
--     (antes os 7 dias da criação valiam para o processo inteiro).
-- Padrão dos RPCs: só a service_role executa (Edge Function esteira-locacao,
-- que valida o JWT e passa a identidade do chamador como parâmetro).
--
-- ETAPA A (aditiva): o site antigo continua funcionando com ela aplicada (RPCs
-- antigos e o status aguardando_aprovacao_interna seguem existindo), o que
-- permite testar a v4 no localhost contra a função paralela esteira-locacao-v4
-- antes de publicar. A limpeza vem em 20260928150000_esteira_v4_limpeza.sql.
-- =============================================================================

alter table propostas_locacao add column if not exists motivo_correcao text;

-- Termos da negociação (modelo do e-mail que o gestor já mandava, 28/09).
-- `observacoes` passa a ser "Outros combinados e benfeitorias".
alter table propostas_locacao
  add column if not exists corretor_responsavel text,        -- nome, da lista colaboradores_raw (CRM)
  add column if not exists garantia text,
  add column if not exists data_posse date,
  add column if not exists prazo_meses smallint,
  add column if not exists dia_vencimento smallint,
  add column if not exists clausula_rescisao text,
  add column if not exists negociacao_especifica text;

alter table propostas_locacao drop constraint if exists propostas_locacao_termos_validos;
alter table propostas_locacao add constraint propostas_locacao_termos_validos check (
  (garantia is null or garantia in ('Seguro-fiança', 'Fiador', 'Caução', 'Título de capitalização', 'Outra'))
  and (prazo_meses is null or prazo_meses between 1 and 360)
  and (dia_vencimento is null or dia_vencimento between 1 and 31)
);

-- Taxa de administração é acordo Imovit × proprietário: fica numa tabela à parte
-- porque o portal do locatário lê propostas_locacao inteira (select *) e a RLS
-- não esconde coluna. Locatário não lê esta tabela; equipe e corretor dono leem.
create table if not exists propostas_locacao_interno (
  proposta_id uuid primary key references propostas_locacao(id) on delete cascade,
  taxa_administracao numeric check (taxa_administracao is null or taxa_administracao between 0 and 100),
  atualizado_em timestamptz not null default now()
);
alter table propostas_locacao_interno enable row level security;
revoke all on propostas_locacao_interno from public, anon, authenticated;
grant select on propostas_locacao_interno to authenticated;
grant select, insert, update, delete on propostas_locacao_interno to service_role;
drop policy if exists propostas_locacao_interno_select on propostas_locacao_interno;
create policy propostas_locacao_interno_select on propostas_locacao_interno for select to authenticated
  using (
    is_adm_ou_gestao()
    or exists (select 1 from propostas_locacao p where p.id = proposta_id and p.criado_por = auth.uid())
  );

-- 2. Status válidos (transição: aguardando_aprovacao_interna sai na etapa de limpeza)
alter table propostas_locacao drop constraint if exists propostas_locacao_status_valido;
alter table propostas_locacao add constraint propostas_locacao_status_valido check (status in (
  'aguardando_locatario', 'correcao_solicitada', 'aguardando_aprovacao_interna', 'criada', 'aguardando_docs',
  'docs_em_analise', 'docs_aprovados', 'sincronizada', 'rejeitada', 'expirada'
));

-- 3. Expiração: pelo prazo que vai ficar gravado (renovar destrava).
--    Correção pedida não expira: a bola está com o gestor.
create or replace function bloquear_avanco_expirado() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.link_expira_em < now()
     and old.status not in ('sincronizada', 'rejeitada', 'expirada', 'correcao_solicitada')
     and new.status not in ('rejeitada', 'correcao_solicitada') then
    new.status := 'expirada';
  end if;
  return new;
end;
$$;

-- 4. View de trabalho (equipe): + correção, dono, termos e a taxa (join com a
--    tabela interna; security_invoker aplica a RLS dela: quem não pode, vê null).
create or replace view propostas_ativas with (security_invoker = true) as
select
  p.id, p.codigo_imovel, p.nome_cliente, p.email, p.tel, p.tipo_pessoa, p.tem_conjuge, p.token_link, p.link_expira_em,
  p.status, p.pasta_gdrive_id, p.timestamp_criacao, p.updated_at, p.proprietario_nome, p.proprietario_email,
  p.imovel_titulo, p.imovel_endereco, p.valor, p.valor_oferta, p.observacoes, p.profissao, p.cargo, p.tipo_renda,
  p.renda_pessoal, p.renda_familiar, p.nome_empresa, p.conjuge_nome, p.conjuge_email, p.conjuge_profissao, p.conjuge_renda,
  case
    when p.link_expira_em < now()
     and p.status not in ('sincronizada', 'rejeitada', 'expirada', 'correcao_solicitada') then 'expirada'::varchar
    else p.status
  end as status_efetivo,
  p.motivo_correcao,
  p.criado_por,
  p.corretor_responsavel, p.garantia, p.data_posse, p.prazo_meses, p.dia_vencimento,
  p.clausula_rescisao, p.negociacao_especifica,
  i.taxa_administracao
from propostas_locacao p
left join propostas_locacao_interno i on i.proposta_id = p.id
where p.status <> 'sincronizada'
order by p.timestamp_criacao desc;

-- 5. RPCs novos (os antigos saem na etapa de limpeza; criar_proposta_locacao
--    convive com a versão antiga por sobrecarga: assinaturas diferentes)

-- Termos da proposta chegam como jsonb (chaves: tel, valor, valor_oferta,
-- corretor_responsavel, garantia, data_posse, prazo_meses, dia_vencimento,
-- clausula_rescisao, negociacao_especifica, observacoes, taxa_administracao).
create or replace function validar_termos_locacao(t jsonb) returns void
language plpgsql immutable set search_path = public as $$
begin
  if nullif(trim(t->>'tel'), '') is null then raise exception 'Informe o telefone do locatário'; end if;
  if coalesce((t->>'valor')::numeric, 0) <= 0 then raise exception 'Informe o valor do anúncio'; end if;
  if coalesce((t->>'valor_oferta')::numeric, 0) <= 0 then raise exception 'Informe o valor negociado'; end if;
  if nullif(trim(t->>'corretor_responsavel'), '') is null then raise exception 'Informe o corretor responsável pela negociação'; end if;
  if coalesce(t->>'garantia', '') not in ('Seguro-fiança', 'Fiador', 'Caução', 'Título de capitalização', 'Outra') then
    raise exception 'Escolha o tipo de garantia';
  end if;
  if nullif(t->>'data_posse', '') is null then raise exception 'Informe a data da posse'; end if;
  if coalesce((t->>'prazo_meses')::int, 0) not between 1 and 360 then raise exception 'Informe o prazo contratual em meses'; end if;
  if coalesce((t->>'dia_vencimento')::int, 0) not between 1 and 31 then raise exception 'Informe o dia de vencimento do aluguel (1 a 31)'; end if;
  if nullif(t->>'taxa_administracao', '') is not null and (t->>'taxa_administracao')::numeric not between 0 and 100 then
    raise exception 'A taxa de administração é um percentual entre 0 e 100';
  end if;
end;
$$;

create or replace function criar_proposta_locacao(
  p_criado_por uuid, p_nome_cliente text, p_email text, p_codigo_imovel integer, p_termos jsonb,
  p_imovel_titulo text, p_imovel_endereco text, p_ator text
) returns propostas_locacao
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proposta propostas_locacao;
  v_existente propostas_locacao;
  t jsonb := coalesce(p_termos, '{}'::jsonb);
begin
  if not exists (select 1 from perfis where id = p_criado_por and role in ('gestao', 'adm', 'corretor')) then
    raise exception 'Só Gestão, Admin e Corretor criam propostas';
  end if;
  perform validar_termos_locacao(t);

  select * into v_existente from propostas_locacao
   where email = lower(trim(p_email)) and codigo_imovel = p_codigo_imovel
   for update;
  -- Recomeçar só a partir de descartada/expirada ou de validação vencida; nunca
  -- sobrescrever um processo na esteira ou concluído (antes, prazo vencido bastava).
  if found and not (
    v_existente.status in ('rejeitada', 'expirada')
    or (v_existente.status = 'aguardando_locatario' and v_existente.link_expira_em < now())
  ) then
    raise exception 'Já existe uma proposta para este e-mail e imóvel (status: %). Edite-a ou descarte-a antes de criar outra.', v_existente.status;
  end if;

  perform set_config('app.ator', p_ator, true);
  perform set_config('app.motivo', '', true);

  insert into propostas_locacao (
    criado_por, nome_cliente, email, codigo_imovel, imovel_titulo, imovel_endereco,
    tel, valor, valor_oferta, observacoes, corretor_responsavel, garantia, data_posse, prazo_meses,
    dia_vencimento, clausula_rescisao, negociacao_especifica,
    token_link, link_expira_em, status
  ) values (
    p_criado_por, trim(p_nome_cliente), lower(trim(p_email)), p_codigo_imovel, p_imovel_titulo, p_imovel_endereco,
    trim(t->>'tel'), (t->>'valor')::numeric, (t->>'valor_oferta')::numeric, nullif(trim(t->>'observacoes'), ''),
    trim(t->>'corretor_responsavel'), t->>'garantia', (t->>'data_posse')::date, (t->>'prazo_meses')::smallint,
    (t->>'dia_vencimento')::smallint, nullif(trim(t->>'clausula_rescisao'), ''), nullif(trim(t->>'negociacao_especifica'), ''),
    encode(gen_random_bytes(24), 'hex'), now() + interval '7 days', 'aguardando_locatario'
  )
  on conflict (email, codigo_imovel) do update set
    criado_por = excluded.criado_por, nome_cliente = excluded.nome_cliente,
    imovel_titulo = coalesce(excluded.imovel_titulo, propostas_locacao.imovel_titulo),
    imovel_endereco = coalesce(excluded.imovel_endereco, propostas_locacao.imovel_endereco),
    tel = excluded.tel, valor = excluded.valor, valor_oferta = excluded.valor_oferta, observacoes = excluded.observacoes,
    corretor_responsavel = excluded.corretor_responsavel, garantia = excluded.garantia, data_posse = excluded.data_posse,
    prazo_meses = excluded.prazo_meses, dia_vencimento = excluded.dia_vencimento,
    clausula_rescisao = excluded.clausula_rescisao, negociacao_especifica = excluded.negociacao_especifica,
    token_link = excluded.token_link, link_expira_em = excluded.link_expira_em,
    status = 'aguardando_locatario', motivo_correcao = null,
    tipo_pessoa = null, tem_conjuge = null, profissao = null, cargo = null, tipo_renda = null,
    renda_pessoal = null, renda_familiar = null, nome_empresa = null,
    conjuge_nome = null, conjuge_email = null, conjuge_profissao = null, conjuge_renda = null
  returning * into v_proposta;

  insert into propostas_locacao_interno (proposta_id, taxa_administracao)
  values (v_proposta.id, nullif(t->>'taxa_administracao', '')::numeric)
  on conflict (proposta_id) do update set taxa_administracao = excluded.taxa_administracao, atualizado_em = now();

  return v_proposta;
end;
$$;

create or replace function editar_proposta_locacao(
  p_proposta_id uuid, p_ator_id uuid, p_ator text, p_nome_cliente text, p_termos jsonb,
  p_imovel_titulo text, p_imovel_endereco text
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare
  v_proposta propostas_locacao;
  v_papel text;
  t jsonb := coalesce(p_termos, '{}'::jsonb);
begin
  select role into v_papel from perfis where id = p_ator_id;
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  -- coalesce: sem perfil (v_papel nulo) a expressão daria NULL e o IF não barraria.
  if not coalesce(v_papel in ('gestao', 'adm') or (v_papel = 'corretor' and v_proposta.criado_por = p_ator_id), false) then
    raise exception 'Você não pode editar esta proposta';
  end if;
  if v_proposta.status not in ('aguardando_locatario', 'correcao_solicitada') then
    raise exception 'Só dá para editar antes da validação do locatário (status atual: %)', v_proposta.status;
  end if;
  perform validar_termos_locacao(t);

  perform set_config('app.ator', p_ator, true);
  perform set_config('app.motivo', 'Proposta editada e reenviada ao locatário', true);
  update propostas_locacao
     set nome_cliente = trim(p_nome_cliente),
         imovel_titulo = coalesce(p_imovel_titulo, imovel_titulo),
         imovel_endereco = coalesce(p_imovel_endereco, imovel_endereco),
         tel = trim(t->>'tel'), valor = (t->>'valor')::numeric, valor_oferta = (t->>'valor_oferta')::numeric,
         observacoes = nullif(trim(t->>'observacoes'), ''),
         corretor_responsavel = trim(t->>'corretor_responsavel'), garantia = t->>'garantia',
         data_posse = (t->>'data_posse')::date, prazo_meses = (t->>'prazo_meses')::smallint,
         dia_vencimento = (t->>'dia_vencimento')::smallint,
         clausula_rescisao = nullif(trim(t->>'clausula_rescisao'), ''),
         negociacao_especifica = nullif(trim(t->>'negociacao_especifica'), ''),
         status = 'aguardando_locatario', motivo_correcao = null,
         link_expira_em = now() + interval '7 days'
   where id = p_proposta_id
  returning * into v_proposta;

  insert into propostas_locacao_interno (proposta_id, taxa_administracao)
  values (v_proposta.id, nullif(t->>'taxa_administracao', '')::numeric)
  on conflict (proposta_id) do update set taxa_administracao = excluded.taxa_administracao, atualizado_em = now();

  return v_proposta;
end;
$$;

create or replace function validar_proposta_locatario(p_proposta_id uuid, p_email_chamador text)
returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if p_email_chamador is null or lower(v_proposta.email) <> lower(p_email_chamador) then
    raise exception 'Você não tem acesso a esta proposta';
  end if;
  if v_proposta.status <> 'aguardando_locatario' then
    raise exception 'Esta proposta não está aguardando validação (status: %)', v_proposta.status;
  end if;
  if v_proposta.link_expira_em < now() then
    raise exception 'O prazo para validar esta proposta venceu. Fale com seu corretor.';
  end if;

  perform set_config('app.ator', p_email_chamador, true);
  perform set_config('app.motivo', 'Proposta validada pelo locatário', true);
  update propostas_locacao
     set status = 'aguardando_docs', link_expira_em = now() + interval '30 days'
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

create or replace function pedir_correcao_proposta(p_proposta_id uuid, p_email_chamador text, p_motivo text)
returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare v_proposta propostas_locacao;
begin
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Conte o que precisa ser corrigido';
  end if;
  select * into v_proposta from propostas_locacao where id = p_proposta_id for update;
  if not found then raise exception 'Proposta % não encontrada', p_proposta_id; end if;
  if p_email_chamador is null or lower(v_proposta.email) <> lower(p_email_chamador) then
    raise exception 'Você não tem acesso a esta proposta';
  end if;
  if v_proposta.status <> 'aguardando_locatario' then
    raise exception 'Esta proposta não está aguardando validação (status: %)', v_proposta.status;
  end if;
  if v_proposta.link_expira_em < now() then
    raise exception 'O prazo desta proposta venceu. Fale com seu corretor.';
  end if;

  perform set_config('app.ator', p_email_chamador, true);
  perform set_config('app.motivo', trim(p_motivo), true);
  update propostas_locacao
     set status = 'correcao_solicitada', motivo_correcao = trim(p_motivo)
   where id = p_proposta_id
  returning * into v_proposta;

  return v_proposta;
end;
$$;

revoke execute on function criar_proposta_locacao(uuid, text, text, integer, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function criar_proposta_locacao(uuid, text, text, integer, jsonb, text, text, text) to service_role;
revoke execute on function editar_proposta_locacao(uuid, uuid, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function editar_proposta_locacao(uuid, uuid, text, text, jsonb, text, text) to service_role;
revoke execute on function validar_termos_locacao(jsonb) from public, anon, authenticated;
grant execute on function validar_termos_locacao(jsonb) to service_role;
revoke execute on function validar_proposta_locatario(uuid, text) from public, anon, authenticated;
grant execute on function validar_proposta_locatario(uuid, text) to service_role;
revoke execute on function pedir_correcao_proposta(uuid, text, text) from public, anon, authenticated;
grant execute on function pedir_correcao_proposta(uuid, text, text) to service_role;
