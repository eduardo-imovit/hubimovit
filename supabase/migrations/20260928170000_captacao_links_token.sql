-- =============================================================================
-- Link de captação com código aleatório por corretor (pedido do Eduardo, 28/09).
-- Antes o link era /captacao/<id do CRM>: sequencial, bastava trocar o número
-- para cair no formulário de outro corretor, e /captacao listava todos os nomes.
-- Agora: /captacao/<token>. O token só é lido pelo próprio corretor (RPC
-- meu_link_captacao, pelo e-mail do login) e pela Edge Function `captacao`.
-- =============================================================================

create table if not exists captacao_links (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{10,40}$'),
  corretor_crm_id integer not null unique,
  criado_em timestamptz not null default now()
);

alter table captacao_links enable row level security;
revoke all on captacao_links from public, anon, authenticated;
grant select, insert, update, delete on captacao_links to service_role;
-- sem policies: ninguém lê pela API; o corretor pega o próprio pelo RPC abaixo

create or replace function gerar_token_captacao() returns text
language sql volatile set search_path = public, extensions as $$
  -- 9 bytes aleatórios → 12 caracteres url-safe (72 bits)
  select translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');
$$;

-- Link de quem está logado: e-mail do JWT = colaboradores_raw.email_oficial.
-- Cria o token na primeira vez. Sem corretor com esse e-mail, devolve null.
create or replace function meu_link_captacao() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_crm integer;
  v_token text;
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then return null; end if;
  select id_corretor_crm into v_crm
    from colaboradores_raw
   where ativo and lower(email_oficial) = lower(v_email)
   order by id_corretor_crm
   limit 1;
  if v_crm is null then return null; end if;

  select token into v_token from captacao_links where corretor_crm_id = v_crm;
  if v_token is null then
    insert into captacao_links (token, corretor_crm_id)
    values (gerar_token_captacao(), v_crm)
    on conflict (corretor_crm_id) do nothing;
    select token into v_token from captacao_links where corretor_crm_id = v_crm;
  end if;
  return v_token;
end;
$$;

revoke execute on function gerar_token_captacao() from public, anon, authenticated;
revoke execute on function meu_link_captacao() from public, anon;
grant execute on function meu_link_captacao() to authenticated;

-- Tokens já criados para os corretores ativos (o link existe antes do 1º acesso).
insert into captacao_links (token, corretor_crm_id)
select gerar_token_captacao(), c.id_corretor_crm
  from colaboradores_raw c
 where c.ativo and c.id_corretor_crm is not null
on conflict (corretor_crm_id) do nothing;
