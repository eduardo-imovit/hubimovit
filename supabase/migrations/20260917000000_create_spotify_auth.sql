-- Guarda o token do app Spotify "Hub_Imovit_Display" (autorizacao unica, conta da empresa).
-- Linha unica (id sempre 1). RLS habilitado sem nenhuma policy: so a service_role
-- (usada pelas Edge Functions) le/escreve aqui -- anon/authenticated nao tem acesso,
-- de proposito, porque refresh_token da acesso de controle a conta Spotify da empresa.
create table if not exists spotify_auth (
  id smallint primary key default 1,
  access_token text,
  refresh_token text not null,
  expires_at timestamptz not null,
  atualizado_em timestamptz not null default now(),
  constraint spotify_auth_singleton check (id = 1)
);

alter table spotify_auth enable row level security;

comment on table spotify_auth is 'Token OAuth do app Spotify Hub_Imovit_Display (Web Playback SDK da TV Display). So Edge Functions (service_role) acessam.';
