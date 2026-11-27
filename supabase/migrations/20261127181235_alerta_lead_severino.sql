-- Alerta do lead do Severino: ligação corretor → WhatsApp, memória do vigia e relógio de horário útil.
-- 27/11/2026 (Asimov, a pedido do Brooks). Fase 32a do plano. Schema: docs/05-backend-schema.md §2.26.
-- STATUS: APLICADA em 27/11/2026 com OK do Eduardo. Testada antes em BEGIN … ROLLBACK.
-- recebe_alerta_lead nasce FALSE para todos: ninguém recebe alerta até o Eduardo conferir as 23 linhas.
--
-- Por que existe:
--   O wpp_entrada v4 cria o atendimento no Imoview e não avisa ninguém. Para avisar por WhatsApp
--   (Cloud API, canal B), o n8n precisa (1) achar o WhatsApp do corretor pelo código do Imoview e
--   (2) lembrar o que já avisou, para o vigia de 30 min / 2 h úteis não repetir.
--
-- O que faz:
--   A) 3 colunas em colaboradores_raw (sem tabela nova de corretores: "fonte única").
--   B) Tabela alerta_lead_severino: uma linha por entrada do Severino avisada. Nenhum telefone aqui.
--   C) minutos_uteis(p_de, p_ate): minutos entre seg e sáb, 9h–18h, America/Sao_Paulo. Feriado conta (D6).
--   D) alerta_lead_a_vigiar(): entradas abertas com o que venceu (lembrete 30, gestão 120, fechar 2.700).
--
-- Acesso: tabela com RLS ligado e 0 policies, sem grant para anon/authenticated (padrão §2.24).
--   Funções security definer, EXECUTE só para service_role (n8n).
--   colaboradores_raw: RLS/grants não mudam (as colunas novas herdam a leitura de hoje, §3).

-- ── A) colaboradores_raw ────────────────────────────────────────────────────────────────────────
alter table public.colaboradores_raw
  add column if not exists perfil_id uuid null references public.perfis(id) on delete set null,
  add column if not exists recebe_alerta_lead boolean not null default false,
  add column if not exists whatsapp_alerta text null;

alter table public.colaboradores_raw
  drop constraint if exists colaboradores_raw_whatsapp_alerta_e164;
alter table public.colaboradores_raw
  add constraint colaboradores_raw_whatsapp_alerta_e164
  check (whatsapp_alerta is null or whatsapp_alerta ~ '^55[0-9]{10,11}$');

comment on column public.colaboradores_raw.perfil_id is
  'Pessoa no Hub (perfis.id), ligada pelo e-mail. Null = sem login no Hub. Fase 32a.';
comment on column public.colaboradores_raw.recebe_alerta_lead is
  'true = recebe o alerta do lead do Severino. Default false: liga-se um a um, depois da conferência. Fase 32a.';

-- Garantia: ninguém fica ligado na largada (vale mesmo se a coluna já existisse).
update public.colaboradores_raw
   set recebe_alerta_lead = false
 where recebe_alerta_lead is distinct from false;
comment on column public.colaboradores_raw.whatsapp_alerta is
  'Só se o WhatsApp do alerta for diferente de telefone_whats. E.164 sem + (5519…). Fase 32a.';

-- Carga do perfil_id pelo e-mail (idempotente; não sobrescreve o que já foi ligado à mão).
update public.colaboradores_raw c
   set perfil_id = p.id
  from public.perfis p
 where c.perfil_id is null
   and c.email_oficial is not null
   and lower(c.email_oficial) = lower(p.email);

-- ── B) alerta_lead_severino ─────────────────────────────────────────────────────────────────────
create table if not exists public.alerta_lead_severino (
  id               bigint generated always as identity primary key,
  atendimento_id   bigint      not null,
  lead_id          bigint      null references public.leads_wpp_gtm(lead_id) on delete set null,
  codigo_cliente   bigint      not null,
  finalidade       smallint    not null check (finalidade in (1, 2)),
  tipo             text        not null check (tipo in ('novo', 'retorno')),
  entrada_em       timestamptz not null,
  corretor_codigo  bigint      null,
  alerta_em        timestamptz null,
  alerta_para      text        null,
  alerta_erro      text        null,
  lembrete_30_em   timestamptz null,
  lembrete_30_erro text        null,
  gestao_2h_em     timestamptz null,
  gestao_2h_erro   text        null,
  respondido_em    timestamptz null,
  resposta_fonte   text        null check (resposta_fonte in ('datahora1Resposta', 'interacao')),
  fim_em           timestamptz null,
  fim_motivo       text        null check (fim_motivo in ('respondido', 'encerrado_imoview', 'prazo_5_dias_uteis')),
  verificado_em    timestamptz null,
  verificacoes     int         not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint alerta_lead_severino_fim_coerente check ((fim_em is null) = (fim_motivo is null))
);

comment on table public.alerta_lead_severino is
  'Uma linha por entrada do Severino avisada ao corretor (novo ou retorno). Escrita só pelo n8n (service_role). Sem telefone. Fase 32, Schema §2.26 B.';

-- No máximo 1 entrada aberta por atendimento (regra do retorno, D7).
create unique index if not exists alerta_lead_severino_aberto_uk
  on public.alerta_lead_severino (atendimento_id) where fim_em is null;
create index if not exists alerta_lead_severino_lead_idx
  on public.alerta_lead_severino (lead_id);

drop trigger if exists trg_alerta_lead_severino_atualizado on public.alerta_lead_severino;
create trigger trg_alerta_lead_severino_atualizado
  before update on public.alerta_lead_severino
  for each row execute function public.fn_update_atualizado_em();

alter table public.alerta_lead_severino enable row level security;
revoke all on table public.alerta_lead_severino from anon, authenticated;
grant select, insert, update, delete on table public.alerta_lead_severino to service_role;

-- ── C) minutos_uteis ────────────────────────────────────────────────────────────────────────────
-- Soma, dia a dia (no relógio de SP), a interseção de [p_de, p_ate] com a janela 9h–18h de seg a sáb.
-- Domingo fica fora. Feriado conta como dia normal (D6). p_ate <= p_de ou nulo = 0. Arredonda para baixo.
create or replace function public.minutos_uteis(p_de timestamptz, p_ate timestamptz)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_de is null or p_ate is null or p_ate <= p_de then 0
    else coalesce((
      select floor(sum(extract(epoch from (least(p_ate, w.fim) - greatest(p_de, w.ini)))) / 60)::int
        from (
          select (g::date + time '09:00') at time zone 'America/Sao_Paulo' as ini,
                 (g::date + time '18:00') at time zone 'America/Sao_Paulo' as fim
            from generate_series((p_de  at time zone 'America/Sao_Paulo')::date,
                                 (p_ate at time zone 'America/Sao_Paulo')::date,
                                 interval '1 day') g
           where extract(isodow from g) < 7          -- 1 = seg … 6 = sáb; 7 = domingo fora
        ) w
       where least(p_ate, w.fim) > greatest(p_de, w.ini)
    ), 0)
  end
$$;

comment on function public.minutos_uteis(timestamptz, timestamptz) is
  'Minutos em horário útil (seg–sáb, 9h–18h, America/Sao_Paulo; feriado conta) entre p_de e p_ate. Fase 32a.';

revoke all on function public.minutos_uteis(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.minutos_uteis(timestamptz, timestamptz) to service_role;

-- ── D) alerta_lead_a_vigiar ─────────────────────────────────────────────────────────────────────
-- Todas as entradas abertas, com os minutos úteis desde a entrada e o que já venceu.
-- O n8n só consulta o Imoview para as linhas com algo_vencido = true.
create or replace function public.alerta_lead_a_vigiar()
returns table (
  id              bigint,
  atendimento_id  bigint,
  lead_id         bigint,
  codigo_cliente  bigint,
  finalidade      smallint,
  tipo            text,
  entrada_em      timestamptz,
  corretor_codigo bigint,
  minutos         integer,
  deve_lembrete   boolean,
  deve_gestao     boolean,
  deve_fechar     boolean,
  algo_vencido    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.atendimento_id, a.lead_id, a.codigo_cliente, a.finalidade, a.tipo,
         a.entrada_em, a.corretor_codigo, m.minutos,
         (m.minutos >= 30   and a.lembrete_30_em is null) as deve_lembrete,
         (m.minutos >= 120  and a.gestao_2h_em   is null) as deve_gestao,
         (m.minutos >= 2700)                              as deve_fechar,     -- 5 dias úteis × 9 h
         ((m.minutos >= 30  and a.lembrete_30_em is null)
       or (m.minutos >= 120 and a.gestao_2h_em   is null)
       or  m.minutos >= 2700)                             as algo_vencido
    from public.alerta_lead_severino a
    cross join lateral (select public.minutos_uteis(a.entrada_em, now()) as minutos) m
   where a.fim_em is null
   order by a.entrada_em
$$;

comment on function public.alerta_lead_a_vigiar() is
  'Entradas abertas do alerta do Severino com minutos úteis e o que venceu (30 lembrete, 120 gestão, 2.700 fechar). Só service_role. Fase 32a/32c.';

revoke all on function public.alerta_lead_a_vigiar() from public, anon, authenticated;
grant execute on function public.alerta_lead_a_vigiar() to service_role;
