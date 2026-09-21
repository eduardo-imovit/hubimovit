-- =============================================================================
-- Fix: criar_proposta_locacao quebrava com "function gen_random_bytes(integer)
-- does not exist" ao criar uma nova proposta.
--
-- Causa: gen_random_bytes vem da extensão pgcrypto, instalada no schema
-- `extensions` (padrão do Supabase), não em `public`. A migration
-- 20260918184211_esteira_fix_search_path_pgcrypto.sql já tinha corrigido
-- isso incluindo `extensions` no search_path, mas
-- 20260921161214_esteira_v2_corretor_cliente.sql recriou a função com
-- "set search_path = public" (sem extensions), regredindo o fix.
-- =============================================================================

alter function criar_proposta_locacao(text, text, integer, numeric, text, text, text)
  set search_path = public, extensions;
