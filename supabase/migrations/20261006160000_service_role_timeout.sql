-- Mais tempo para chamadas do service_role pela API (n8n, Edge Functions).
--
-- O service_role não tinha limite próprio e herdava os 8s do authenticator.
-- A 1ª leitura do crm_jornada_diaria manda ~26 MB (2.800 atendimentos com a
-- resposta crua do Imoview) para registrar_atendimentos_crm e passou dos 8s
-- (06/10, erro 57014). A função leva < 1s; o tempo vai em ler o JSON e gravar
-- a 1ª carga. anon (3s) e authenticated (8s), usados pelo Hub, não mudam.
alter role service_role set statement_timeout = '120s';
notify pgrst, 'reload config';
