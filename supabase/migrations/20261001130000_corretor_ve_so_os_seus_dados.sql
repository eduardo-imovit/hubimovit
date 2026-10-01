-- Corretor vê só os próprios dados comerciais (PRD §5.8, pedido do Eduardo em 29/09).
--
-- Antes (desde 20261001120000): `dashboard_atendimentos_crm`, `atividades`,
-- `atividades_notas` e `leads_wpp_gtm` liam com `pode_ler_comercial()` (qualquer
-- nível, inclusive corretor, lia tudo). O Dash
-- Comercial trava o filtro na tela, mas a trava de verdade tem que estar aqui.
--
-- Regra: quem não é corretor continua como antes (pode_ler_comercial). O corretor lê só as
-- linhas ligadas ao nome dele no CRM (colaboradores_raw.email_oficial = e-mail do
-- login). As views vw_* são security_invoker, então herdam a regra.

-- Nome do corretor logado no CRM (ligação por e-mail; null se não achar).
create or replace function public.meu_nome_crm()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.nome_completo
  from perfis p
  join colaboradores_raw c on lower(c.email_oficial) = lower(p.email)
  where p.id = auth.uid() and p.suspenso_em is null
  limit 1;
$$;

revoke execute on function public.meu_nome_crm() from public, anon;
grant execute on function public.meu_nome_crm() to authenticated;

-- Nome do corretor como está no atendimento, com o mesmo ajuste de
-- vw_atendimentos_base ("Gabriel Simon C" é o Gabriel Simon).
create or replace function public.nome_corretor_crm(bruto text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when btrim(bruto) = 'Gabriel Simon C' then 'Gabriel Simon' else btrim(bruto) end;
$$;

-- Atendimentos
drop policy if exists "so quem tem nivel le" on public.dashboard_atendimentos_crm;
create policy "equipe le; corretor so os seus" on public.dashboard_atendimentos_crm
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or lower(nome_corretor_crm(corretor)) = lower((select meu_nome_crm()))
    )
  );

-- Atividades: as dele (usuário) ou de um atendimento dele
drop policy if exists "so quem tem nivel le" on public.atividades;
create policy "equipe le; corretor so os seus" on public.atividades
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or lower(nomeusuario) = lower((select meu_nome_crm()))
      or codigoatendimento in (select codigo from public.dashboard_atendimentos_crm)
    )
  );

-- Notas das atividades: seguem a atividade
drop policy if exists "so quem tem nivel le" on public.atividades_notas;
create policy "equipe le; corretor so os seus" on public.atividades_notas
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or codigo_atividade in (select codigo from public.atividades)
    )
  );

-- Leads do site/WhatsApp (nome e telefone do cliente): só os do atendimento dele
drop policy if exists "so quem tem nivel le" on public.leads_wpp_gtm;
create policy "equipe le; corretor so os seus" on public.leads_wpp_gtm
  for select to authenticated
  using (
    pode_ler_comercial()
    and (
      (select papel_atual()) is distinct from 'corretor'
      or codigo_atendimento in (select codigo::text from public.dashboard_atendimentos_crm)
    )
  );
