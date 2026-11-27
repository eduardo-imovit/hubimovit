-- Imoview: sessão compartilhada do login de integração + reserva de telefone do wpp_entrada.
-- 26/11/2026 (Asimov). APLICADA 26/11 (versão no banco 20261126122845). Plano: docs/n8n/imoview-auth-arquitetura.md §4.3.
-- Schema: docs/05-backend-schema.md §2.24.
--
-- Por que existe:
--   1. A API do Imoview mudou (24-25/11). Clientes/Contratos/Financeiro exigem o login de integração
--      (/Usuario/Integracao_ValidarAcesso). A sessão é UMA por usuário: um login novo derruba o
--      codigoacesso anterior. Então só pode haver um ponto de login, com trava, e todo mundo reaproveita
--      a mesma sessão. Quem faz o login é o sub-fluxo n8n "Imoview: obter sessão"; esta tabela guarda a
--      sessão e a trava. Os static data do n8n não servem: são por fluxo, só salvam no fim da execução
--      e não têm trava (dois leads ao mesmo tempo = dois logins).
--   2. O "Deduplicar telefone" do wpp_entrada marcava o telefone na CHEGADA (static data, 30 min).
--      Se o Imoview falhasse, a nova tentativa do mesmo lead era jogada fora. A reserva abaixo só
--      bloqueia por 30 min depois de CONCLUIR; enquanto está "processando", bloqueia por 5 min.
--
-- Segredos: a tabela guarda o codigoacesso (token de sessão, vale 10 min sem uso). Nunca a chave nem a senha.
-- Acesso: RLS ligada, 0 políticas, sem grant para anon/authenticated; RPCs só para service_role (n8n).

-- ============================================================ 1. Sessão
create table public.imoview_sessao (
  perfil          text        primary key check (perfil ~ '^[a-z_]{3,30}$'),
  codigousuario   bigint,
  codigoacesso    text,
  obtido_em       timestamptz,
  usado_em        timestamptz,
  renovando_ate   timestamptz,
  renovando_dono  uuid,
  logins          int         not null default 0,
  atualizado_em   timestamptz not null default now()
);

comment on table public.imoview_sessao is
  'Sessão do login de integração do Imoview (n8n "Imoview: obter sessão"). Uma linha por perfil. Só service_role.';
comment on column public.imoview_sessao.renovando_ate is
  'Trava de login: enquanto > now(), outro chamador está fazendo login; os demais esperam e releem.';

alter table public.imoview_sessao enable row level security;
revoke all on public.imoview_sessao from anon, authenticated;

insert into public.imoview_sessao (perfil) values ('integracao');

-- Decide o que o chamador faz: 'usar' (devolve a sessão), 'esperar' (outro está logando) ou 'login' (pegou a trava).
--   p_forcar   = true depois de um 401 com sessaoinvalida.
--   p_recusado = o codigoacesso que levou o 401. Se a sessão guardada já é outra, alguém renovou antes: usa a nova.
--   p_ocioso_seg: a API expira com 10 min sem uso; reaproveitamos até 8 min (480 s) de folga.
create or replace function public.imoview_sessao_obter(
  p_perfil     text    default 'integracao',
  p_forcar     boolean default false,
  p_recusado   text    default null,
  p_ocioso_seg int     default 480
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s      public.imoview_sessao;
  v_dono uuid;
begin
  if p_ocioso_seg is null or p_ocioso_seg < 30 or p_ocioso_seg > 590 then
    raise exception 'imoview_sessao_obter: p_ocioso_seg fora de 30..590';
  end if;

  insert into public.imoview_sessao (perfil) values (p_perfil) on conflict (perfil) do nothing;
  select * into s from public.imoview_sessao where perfil = p_perfil for update;

  if s.codigoacesso is not null
     and s.usado_em > now() - make_interval(secs => p_ocioso_seg)
     and (not coalesce(p_forcar, false)
          or (p_recusado is not null and s.codigoacesso is distinct from p_recusado)) then
    update public.imoview_sessao set usado_em = now(), atualizado_em = now() where perfil = p_perfil;
    return jsonb_build_object('acao', 'usar', 'codigousuario', s.codigousuario, 'codigoacesso', s.codigoacesso);
  end if;

  if s.renovando_ate is not null and s.renovando_ate > now() then
    return jsonb_build_object('acao', 'esperar',
                              'segundos', greatest(1, ceil(extract(epoch from s.renovando_ate - now()))::int));
  end if;

  v_dono := gen_random_uuid();
  update public.imoview_sessao
     set renovando_ate = now() + interval '30 seconds', renovando_dono = v_dono, atualizado_em = now()
   where perfil = p_perfil;
  return jsonb_build_object('acao', 'login', 'dono', v_dono);
end;
$$;

-- Grava a sessão nova e solta a trava. Só quem tem a trava (p_dono) grava.
create or replace function public.imoview_sessao_gravar(
  p_perfil        text,
  p_dono          uuid,
  p_codigousuario bigint,
  p_codigoacesso  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_codigousuario is null or coalesce(p_codigoacesso, '') = '' then
    raise exception 'imoview_sessao_gravar: login sem codigousuario/codigoacesso';
  end if;
  update public.imoview_sessao
     set codigousuario = p_codigousuario, codigoacesso = p_codigoacesso,
         obtido_em = now(), usado_em = now(),
         renovando_ate = null, renovando_dono = null,
         logins = logins + 1, atualizado_em = now()
   where perfil = p_perfil and renovando_dono = p_dono;
  return jsonb_build_object('gravado', found);
end;
$$;

-- Solta a trava sem gravar (o login falhou). A sessão guardada fica como está: se ela não valer,
-- o próximo chamador recebe 401 e força outro login.
create or replace function public.imoview_sessao_liberar(p_perfil text, p_dono uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.imoview_sessao
     set renovando_ate = null, renovando_dono = null, atualizado_em = now()
   where perfil = p_perfil and renovando_dono = p_dono;
  return jsonb_build_object('liberado', found);
end;
$$;

-- ============================================================ 2. Reserva de telefone do wpp_entrada
create table public.wpp_entrada_reserva (
  telefone      text        primary key,
  status        text        not null check (status in ('processando', 'ok')),
  tentativas    int         not null default 1,
  atualizado_em timestamptz not null default now()
);

comment on table public.wpp_entrada_reserva is
  'wpp_entrada v4: deduplicação do webhook do Severino. ok bloqueia 30 min; processando bloqueia 5 min (falha libera depois disso). Só service_role.';

alter table public.wpp_entrada_reserva enable row level security;
revoke all on public.wpp_entrada_reserva from anon, authenticated;

-- true = pode processar (reservou); false = duplicado. Atômico: dois webhooks simultâneos, só um reserva.
create or replace function public.wpp_entrada_reservar(
  p_telefone      text,
  p_janela_ok_seg int default 1800,
  p_janela_pr_seg int default 300
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if coalesce(trim(p_telefone), '') = '' then
    return jsonb_build_object('reservado', true, 'motivo', 'sem_telefone');
  end if;

  insert into public.wpp_entrada_reserva as r (telefone, status) values (p_telefone, 'processando')
  on conflict (telefone) do update
     set status = 'processando', tentativas = r.tentativas + 1, atualizado_em = now()
   where (r.status = 'ok'          and r.atualizado_em < now() - make_interval(secs => p_janela_ok_seg))
      or (r.status = 'processando' and r.atualizado_em < now() - make_interval(secs => p_janela_pr_seg))
  returning true into v_ok;

  return jsonb_build_object('reservado', coalesce(v_ok, false));
end;
$$;

-- Marca o lead como concluído (chamado no fim do wpp_entrada, depois do Imoview).
create or replace function public.wpp_entrada_concluir(p_telefone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wpp_entrada_reserva set status = 'ok', atualizado_em = now() where telefone = p_telefone;
  return jsonb_build_object('concluido', found);
end;
$$;

-- ============================================================ 3. Permissões das funções
revoke execute on function public.imoview_sessao_obter(text, boolean, text, int)   from public, anon, authenticated;
revoke execute on function public.imoview_sessao_gravar(text, uuid, bigint, text)  from public, anon, authenticated;
revoke execute on function public.imoview_sessao_liberar(text, uuid)               from public, anon, authenticated;
revoke execute on function public.wpp_entrada_reservar(text, int, int)             from public, anon, authenticated;
revoke execute on function public.wpp_entrada_concluir(text)                       from public, anon, authenticated;
grant  execute on function public.imoview_sessao_obter(text, boolean, text, int)   to service_role;
grant  execute on function public.imoview_sessao_gravar(text, uuid, bigint, text)  to service_role;
grant  execute on function public.imoview_sessao_liberar(text, uuid)               to service_role;
grant  execute on function public.wpp_entrada_reservar(text, int, int)             to service_role;
grant  execute on function public.wpp_entrada_concluir(text)                       to service_role;
