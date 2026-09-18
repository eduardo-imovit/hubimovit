-- Novo nivel "tvaccess": conta dedicada da propria TV, sem acesso a mais nada
-- alem da tela /tv-display (a Home redireciona pra la e o link some da navbar
-- pra "user" -- tvaccess e "adm para cima" continuam vendo/acessando).
alter table perfis drop constraint perfis_role_check;
alter table perfis add constraint perfis_role_check check (role = any (array['gestao','adm','user','tvaccess']));
