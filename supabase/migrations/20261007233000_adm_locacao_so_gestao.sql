-- Adm locação: só a Gestão por enquanto (decisão do Eduardo, 07/10).
-- Antes: Gestão e ADM (is_adm_ou_gestao). As views são security_invoker e herdam a regra.

drop policy if exists "gestao e adm leem" on public.contratos_locacao;
drop policy if exists "gestao e adm leem" on public.contratos_locacao_cobrancas;
drop policy if exists "gestao e adm leem" on public.contratos_locacao_fotos;
drop policy if exists "gestao e adm leem" on public.contratos_locacao_recebimentos;

create policy "gestao le" on public.contratos_locacao
  for select to authenticated using ((select is_gestao()));
create policy "gestao le" on public.contratos_locacao_cobrancas
  for select to authenticated using ((select is_gestao()));
create policy "gestao le" on public.contratos_locacao_fotos
  for select to authenticated using ((select is_gestao()));
create policy "gestao le" on public.contratos_locacao_recebimentos
  for select to authenticated using ((select is_gestao()));
