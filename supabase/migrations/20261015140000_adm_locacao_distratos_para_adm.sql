-- Adm locação e Distratos liberados para o ADM (decisão do Eduardo, 15/10).
-- Volta o que era antes de 20261007233000 e 20261014130000: Gestão e ADM
-- (is_adm_ou_gestao). As views da carteira são security_invoker e herdam.
-- Na mesma entrega: funções `carteira-locacao` e `distrato` aceitam o ADM, e
-- ACESSO.dashAdmLocacao / ACESSO.distratos incluem 'adm'.

drop policy if exists "gestao le" on public.contratos_locacao;
drop policy if exists "gestao le" on public.contratos_locacao_cobrancas;
drop policy if exists "gestao le" on public.contratos_locacao_fotos;
drop policy if exists "gestao le" on public.contratos_locacao_recebimentos;
drop policy if exists "gestao le" on public.distratos;

create policy "gestao e adm leem" on public.contratos_locacao
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.contratos_locacao_cobrancas
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.contratos_locacao_fotos
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.contratos_locacao_recebimentos
  for select to authenticated using ((select is_adm_ou_gestao()));
create policy "gestao e adm leem" on public.distratos
  for select to authenticated using ((select is_adm_ou_gestao()));

create or replace function public.contratos_para_distrato(busca text default '')
returns table (
  codigo integer, codigo_imovel integer, imovel_resumo text, imovel_endereco text,
  locatario_nome text, locatario_email text, locatario_telefone text,
  data_inicio date, data_fim date, valor_aluguel numeric
)
language sql stable security definer set search_path = public as $$
  select c.codigo, c.codigo_imovel, c.imovel_resumo, c.imovel_endereco,
         c.locatario_nome, c.locatario_email, c.locatario_telefone,
         c.data_inicio, c.data_fim, c.valor_aluguel
  from contratos_locacao c
  where is_adm_ou_gestao()
    and c.situacao = 'Ativo'
    and (
      coalesce(trim(busca), '') = ''
      or c.codigo::text = trim(busca)
      or c.codigo_imovel::text = trim(busca)
      or c.locatario_nome ilike '%' || trim(busca) || '%'
      or c.imovel_endereco ilike '%' || trim(busca) || '%'
    )
  order by c.locatario_nome
  limit 20;
$$;
