-- Mesmo bug de sempre: REVOKE ... FROM PUBLIC não tira o EXECUTE que o
-- Postgres/Supabase concede por padrão a anon/authenticated em função nova
-- no schema public. decidir_aprovacao_interna (criada agora) e
-- confirmar_dados_locatario (recriada via CREATE OR REPLACE na migration
-- anterior) precisam do revoke explícito de novo.
revoke execute on function decidir_aprovacao_interna from anon, authenticated;
revoke execute on function confirmar_dados_locatario from anon, authenticated;
