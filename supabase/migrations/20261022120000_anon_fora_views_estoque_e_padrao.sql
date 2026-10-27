-- Acesso sem login (anon): fecha as 3 views do Estoque e muda o padrão do schema public
-- (decisão do Eduardo em 22/10, opção B).
-- Auditoria de 22/10 (has_table_privilege): só estas 3 views ainda tinham SELECT para anon.
-- Na prática já não vazavam (security_invoker + imoveis_estoque sem grant para anon), mas a
-- porta da view ficava aberta.
-- O padrão do Supabase dá tudo para anon em toda tabela/view/sequência NOVA criada pelo
-- postgres; aqui isso deixa de acontecer. Objetos que já existem não mudam (ex.: blog_posts
-- segue lendo os publicados). Funções ficam fora: o EXECUTE delas vem também do PUBLIC e
-- continua sendo revogado função a função.

revoke all on public.vw_estoque_imoveis,
              public.vw_estoque_captacoes_mensal,
              public.vw_estoque_duplicados
  from anon;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
