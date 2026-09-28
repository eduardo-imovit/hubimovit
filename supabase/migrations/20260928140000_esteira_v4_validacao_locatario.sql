-- =============================================================================
-- Esteira de locação v4 (PRD §5.6, RF22) — 2026-09-28, pedido do Eduardo:
--   locatário negocia → locador aceita → gestor registra a proposta com os
--   termos → sistema envia ao locatário → ele VALIDA ou PEDE CORREÇÃO →
--   validando, entra direto na esteira (aguardando_docs). Sai a aprovação interna.
--
-- Mudanças:
--   * status novo `correcao_solicitada` (bola com o gestor); sai
--     `aguardando_aprovacao_interna` (a única proposta nele, de teste, volta
--     para a validação do locatário);
--   * coluna `motivo_correcao`;
--   * criar_proposta_locacao recebe telefone, valor negociado e observações e
--     grava criado_por; não sobrescreve mais uma proposta em andamento (usar editar);
--   * RPCs novos: editar_proposta_locacao, validar_proposta_locatario,
--     pedir_correcao_proposta. Saem confirmar_dados_locatario e decidir_aprovacao_interna;
--   * bloquear_avanco_expirado passa a olhar o prazo NOVO (senão reenviar/renovar
--     uma proposta vencida era marcado como expirada na mesma hora);
--   * validar renova o prazo por 30 dias para a fase de cadastro/documentos
--     (antes os 7 dias da criação valiam para o processo inteiro).
-- Padrão dos RPCs: só a service_role executa (Edge Function esteira-locacao,
-- que valida o JWT e passa a identidade do chamador como parâmetro).
-- =============================================================================

alter table propostas_locacao add column if not exists motivo_correcao text;

-- 1. Proposta presa na aprovação interna volta para a validação do locatário.
select set_config('app.ator', 'migracao_esteira_v4', true);
select set_config('app.motivo', 'Aprovação interna saiu do fluxo (esteira v4): volta para a validação do locatário', true);
update propostas_locacao set status = 'aguardando_locatario' where status = 'aguardando_aprovacao_interna';
select set_config('app.motivo', '', true);

-- 2. Status válidos
alter table propostas_locacao drop constraint if exists propostas_locacao_status_valido;
alter table propostas_locacao add constraint propostas_locacao_status_valido check (status in (
  'aguardando_locatario', 'correcao_solicitada', 'criada', 'aguardando_docs', 'docs_em_analise',
  'docs_aprovados', 'sincronizada', 'rejeitada', 'expirada'
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

-- 4. View de trabalho: + motivo_correcao e criado_por; correção pedida não expira.
create or replace view propostas_ativas with (security_invoker = true) as
select
  id, codigo_imovel, nome_cliente, email, tel, tipo_pessoa, tem_conjuge, token_link, link_expira_em,
  status, pasta_gdrive_id, timestamp_criacao, updated_at, proprietario_nome, proprietario_email,
  imovel_titulo, imovel_endereco, valor, valor_oferta, observacoes, profissao, cargo, tipo_renda,
  renda_pessoal, renda_familiar, nome_empresa, conjuge_nome, conjuge_email, conjuge_profissao, conjuge_renda,
  case
    when link_expira_em < now()
     and status not in ('sincronizada', 'rejeitada', 'expirada', 'correcao_solicitada') then 'expirada'::varchar
    else status
  end as status_efetivo,
  motivo_correcao,
  criado_por
from propostas_locacao p
where status <> 'sincronizada'
order by timestamp_criacao desc;

-- 5. RPCs
drop function if exists criar_proposta_locacao(text, text, integer, numeric, text, text, text);
drop function if exists confirmar_dados_locatario(uuid, text, text, numeric, text, text);
drop function if exists decidir_aprovacao_interna(uuid, text, text, text);

create or replace function criar_proposta_locacao(
  p_criado_por uuid, p_nome_cliente text, p_email text, p_tel text, p_codigo_imovel integer,
  p_valor numeric, p_valor_oferta numeric, p_observacoes text,
  p_imovel_titulo text, p_imovel_endereco text, p_ator text
) returns propostas_locacao
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proposta propostas_locacao;
  v_existente propostas_locacao;
begin
  if not exists (select 1 from perfis where id = p_criado_por and role in ('gestao', 'adm', 'corretor')) then
    raise exception 'Só Gestão, Admin e Corretor criam propostas';
  end if;
  if p_valor_oferta is null or p_valor_oferta <= 0 then
    raise exception 'Informe o valor negociado';
  end if;

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
    criado_por, nome_cliente, email, tel, codigo_imovel, valor, valor_oferta, observacoes,
    imovel_titulo, imovel_endereco, token_link, link_expira_em, status
  ) values (
    p_criado_por, trim(p_nome_cliente), lower(trim(p_email)), p_tel, p_codigo_imovel, p_valor, p_valor_oferta,
    nullif(trim(p_observacoes), ''), p_imovel_titulo, p_imovel_endereco,
    encode(gen_random_bytes(24), 'hex'), now() + interval '7 days', 'aguardando_locatario'
  )
  on conflict (email, codigo_imovel) do update set
    criado_por = excluded.criado_por,
    nome_cliente = excluded.nome_cliente, tel = excluded.tel, valor = excluded.valor,
    valor_oferta = excluded.valor_oferta, observacoes = excluded.observacoes,
    imovel_titulo = coalesce(excluded.imovel_titulo, propostas_locacao.imovel_titulo),
    imovel_endereco = coalesce(excluded.imovel_endereco, propostas_locacao.imovel_endereco),
    token_link = excluded.token_link, link_expira_em = excluded.link_expira_em,
    status = 'aguardando_locatario', motivo_correcao = null,
    tipo_pessoa = null, tem_conjuge = null, profissao = null, cargo = null, tipo_renda = null,
    renda_pessoal = null, renda_familiar = null, nome_empresa = null,
    conjuge_nome = null, conjuge_email = null, conjuge_profissao = null, conjuge_renda = null
  returning * into v_proposta;

  return v_proposta;
end;
$$;

create or replace function editar_proposta_locacao(
  p_proposta_id uuid, p_ator_id uuid, p_ator text,
  p_nome_cliente text, p_tel text, p_valor numeric, p_valor_oferta numeric, p_observacoes text,
  p_imovel_titulo text, p_imovel_endereco text
) returns propostas_locacao
language plpgsql security definer set search_path = public as $$
declare
  v_proposta propostas_locacao;
  v_papel text;
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
  if p_valor_oferta is null or p_valor_oferta <= 0 then
    raise exception 'Informe o valor negociado';
  end if;

  perform set_config('app.ator', p_ator, true);
  perform set_config('app.motivo', 'Proposta editada e reenviada ao locatário', true);
  update propostas_locacao
     set nome_cliente = trim(p_nome_cliente), tel = p_tel, valor = p_valor, valor_oferta = p_valor_oferta,
         observacoes = nullif(trim(p_observacoes), ''),
         imovel_titulo = coalesce(p_imovel_titulo, imovel_titulo),
         imovel_endereco = coalesce(p_imovel_endereco, imovel_endereco),
         status = 'aguardando_locatario', motivo_correcao = null,
         link_expira_em = now() + interval '7 days'
   where id = p_proposta_id
  returning * into v_proposta;

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

revoke execute on function criar_proposta_locacao(uuid, text, text, text, integer, numeric, numeric, text, text, text, text) from public, anon, authenticated;
grant execute on function criar_proposta_locacao(uuid, text, text, text, integer, numeric, numeric, text, text, text, text) to service_role;
revoke execute on function editar_proposta_locacao(uuid, uuid, text, text, text, numeric, numeric, text, text, text) from public, anon, authenticated;
grant execute on function editar_proposta_locacao(uuid, uuid, text, text, text, numeric, numeric, text, text, text) to service_role;
revoke execute on function validar_proposta_locatario(uuid, text) from public, anon, authenticated;
grant execute on function validar_proposta_locatario(uuid, text) to service_role;
revoke execute on function pedir_correcao_proposta(uuid, text, text) from public, anon, authenticated;
grant execute on function pedir_correcao_proposta(uuid, text, text) to service_role;
