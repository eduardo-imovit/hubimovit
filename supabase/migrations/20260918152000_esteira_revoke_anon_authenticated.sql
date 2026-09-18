-- Supabase concede EXECUTE em funcoes novas do schema public pra anon/authenticated
-- por padrao (provavelmente via ALTER DEFAULT PRIVILEGES do projeto) -- revogar so
-- de PUBLIC (como as migrations anteriores fizeram) nao remove esse grant direto.
-- Sem isso, qualquer pessoa com a anon key conseguia chamar essas RPCs sensiveis
-- direto (ex: supabase.rpc('decidir_documento', ...)) sem passar pela Edge Function
-- nem provar identidade. Achado ao testar de verdade a esteira nova.

revoke execute on function upsert_proposta_locacao      from anon, authenticated;
revoke execute on function aceitar_proprietario          from anon, authenticated;
revoke execute on function registrar_documento_enviado   from anon, authenticated;
revoke execute on function decidir_documento              from anon, authenticated;
revoke execute on function marcar_sincronizado_imoview    from anon, authenticated;
revoke execute on function confirmar_dados_locatario      from anon, authenticated;
revoke execute on function criar_proposta_locacao         from anon, authenticated;
