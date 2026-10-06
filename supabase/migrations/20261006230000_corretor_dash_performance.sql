-- Corretor no Dash (decisão do Eduardo, 06/10): vê a Performance (mídia da
-- imobiliária) e o Kanban/Dados/Relatório só com os dele (a RLS de
-- atendimentos e atividades já restringe). O Painel da Gestão continua só
-- para Gestão e Marketing (tela; os dados de pessoas seguem restritos pela RLS).

-- Mídia (Meta, Google, metas de campanha e mensais) também para o corretor
create or replace function public.pode_ver_dash()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(papel_atual() in ('gestao', 'marketing', 'corretor'), false);
$$;

-- Leads pagos da imobiliária inteira para a cascata da Performance. Sem código,
-- corretor ou contato: só data de entrada, fase e se virou negócio. Sem isto,
-- o corretor veria só os pagos dele (RLS) e o custo por lead sairia errado.
create or replace function public.performance_leads_pagos()
returns table (data_entrada date, fase_ordem integer, is_negocio boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not pode_ver_dash() then
    raise exception 'Sem permissão para ver a Performance' using errcode = '42501';
  end if;
  return query
    select b.data_entrada, b.fase_ordem, b.is_negocio
    from vw_atendimentos_base b
    where b.canal = 'Campanhas pagas' and not b.is_ruido;
end;
$$;

revoke execute on function public.performance_leads_pagos() from public, anon;
grant execute on function public.performance_leads_pagos() to authenticated;
