-- Fix de seguranca: o Supabase Security Advisor apontou que criar_proposta_locacao,
-- confirmar_dados_locatario, completar_cadastro_locatario e descartar_proposta_locacao
-- estavam executaveis direto por anon/authenticated via /rest/v1/rpc/..., usando so a
-- anon key publica (embutida no bundle JS) -- sem passar pela Edge Function nem pela
-- checagem de identidade dela (exigirEmailProposta / exigirPerfil).
--
-- Isso ja tinha sido revogado em 2026-09-18 (migration esteira_revoke_anon_authenticated),
-- mas regrediu: sessoes seguintes deram "drop function" + "create function" nessas
-- mesmas funcoes pra mudar assinatura (novos campos financeiro/conjuge, separacao
-- proposta/cadastro, nova funcao de descarte) -- no Postgres, isso reseta os grants
-- pro default, perdendo o revoke anterior silenciosamente.
--
-- NAO revogar is_gestao/is_adm_ou_gestao/pode_acessar_documento_esteira: essas sao
-- helpers chamadas de dentro de RLS policies de outras tabelas/storage -- revogar
-- EXECUTE nelas quebraria o acesso normal de authenticated/anon a essas policies.

revoke execute on function criar_proposta_locacao        from anon, authenticated;
revoke execute on function confirmar_dados_locatario      from anon, authenticated;
revoke execute on function completar_cadastro_locatario   from anon, authenticated;
revoke execute on function descartar_proposta_locacao     from anon, authenticated;
