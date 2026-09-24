# TRD — Hub Imovit
**Base:** PRD v0.1 · **Data:** 2026-09-24 · retroativo (descreve o sistema em produção)

## 1. Stack
| Camada | Escolha | Observação |
|---|---|---|
| Front | React 19 + Vite 8 + react-router-dom 7 | SPA; `vercel.json` reescreve tudo para `index.html` |
| Estilo | CSS próprio (`src/styles/tokens.css`, `components.css`, `hub.css`) + Tailwind v4 pontual | O design system mora no CSS, não no Tailwind |
| Gráficos | recharts | |
| Exportação | html2pdf.js (PDF de performance), jszip (`.zip` da esteira) | |
| Banco / Auth / Storage | Supabase `vlsrmtryzwddqkwqugfr` (plano Free) | Projeto compartilhado com outras automações do n8n |
| Funções | Supabase Edge Functions (Deno): `esteira-locacao`, `gestao-colaboradores`, `spotify-auth` | |
| Ingestão de dados | n8n (`n8n.srv1552977.hstgr.cloud`) grava no Supabase com service role | |
| E-mail | Brevo (API) | |
| Hospedagem | Vercel, `https://hub.imovit.com.br` (repo `eduardo-imovit/hubimovit`, branch `main`) | Deploy automático a cada push |
| Qualidade | oxlint (`npm run lint`) | **Não há testes automatizados** |

## 2. Arquitetura
```
 Imoview CRM ─┐                                         ┌─> Brevo (e-mails)
 Meta Ads    ─┼─> n8n ──(service role)──> Supabase ─────┤
 Google Ads  ─┤                           Postgres      └─> Imoview API (sincronizar proposta)
 GTM / site  ─┘                           + RLS
                                          + Storage
 Navegador (React SPA) ──anon key + JWT──> PostgREST (leitura, RPCs)
                        └──────JWT───────> Edge Functions (esteira-locacao, gestao-colaboradores)
```
- **Leitura:** direto do navegador pelo PostgREST; a RLS decide o que cada papel vê.
- **Escrita sensível** (esteira, colaboradores): passa por Edge Function ou por RPC `security definer`, nunca por insert/update direto do front.
- O front repete os papéis em `src/lib/acessos.js` só para montar menu, rotas e botões. A regra de verdade é a RLS.

## 3. Integrações externas
| Serviço | Para quê | Auth | Riscos conhecidos |
|---|---|---|---|
| Imoview | Atendimentos, atividades, colaboradores (via n8n); sincronizar a proposta (via função) | `IMOVIEW_API_KEY` | Senha/chave em texto aberto em fluxos do n8n |
| Meta Ads / Google Ads | Investimento e resultado diários (via n8n) | tokens no n8n | O fluxo `meta_ads` reinseria 14 dias (corrigido com trigger em 23/09) |
| GTM + n8n `wpp_gtm` | Cliques no WhatsApp do site, com UTMs e gclid/fbclid | webhook público | Webhook sem chave; recebia chamadas vazias em massa (bloqueadas por trigger) |
| n8n `wpp_entrada` | Leads do bot Severino | — | Correções publicadas em 24/09; falta ver o primeiro lead real |
| Brevo | E-mails da esteira | `BREVO_API_KEY` | Checagem de IP nas chaves de API |
| Spotify | Música na TV | client id/secret; refresh token em `spotify_auth` | |
| API de clima | Widget de clima | `VITE_WEATHER_API_KEY` (fica exposta no front por natureza) | |

## 4. Autenticação e permissões
- Supabase Auth: e-mail e senha para a equipe, magic link para o locatário. O trigger `handle_new_user` cria `perfis` só para `@imovit.com.br`.
- Funções auxiliares (todas `security definer`, todas ignoram perfil suspenso): `papel_atual()`, `is_gestao()`, `is_adm_ou_gestao()`, `pode_editar_conteudo()` (gestao, marketing), `pode_ver_dash()` (gestao, marketing), `pode_ver_proposta(id)` (adm/gestao, o corretor que criou, ou e-mail do JWT = e-mail da proposta).
- Regra: **nunca** comparar o e-mail do JWT usando `coalesce(..., '')` (foi a causa da falha de 23/09).
- Tabela nova: RLS ligada e grants explícitos (ver a nota "Supabase - Grants explícitos em tabelas novas").

## 5. Requisitos não funcionais
- **Segurança:** dado pessoal do locatário (renda, documentos) só aparece para quem passa em `pode_ver_proposta`. O bucket `esteira-documentos` é privado.
- **LGPD:** os documentos são apagados do Storage ao finalizar o processo. ⚠ Falta a mesma limpeza para descarte e expiração.
- **TV 24/7:** os hooks se atualizam sozinhos (KPIs a cada 5 min, data a cada minuto) e mantêm o último valor se uma atualização falhar.
- **Fuso:** agregados calculados em America/Sao_Paulo.
- **Backup:** nenhum (plano Free). Risco aceito até segunda ordem.
- **Limites do Free:** 1 GB de Storage, 5 GB de egress, 500 MB de banco.

## 6. Ambientes e deploy
- Só existe produção. Para rodar local: `npm run dev`, com `.env` contendo `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEATHER_API_KEY`, `VITE_SPOTIFY_CLIENT_ID` e `VITE_SPOTIFY_PLAYLIST_ID`.
- As mesmas variáveis `VITE_*` precisam estar cadastradas na Vercel. Sem elas, a tela fica branca.
- Secrets das Edge Functions: `APP_URL`, `BREVO_API_KEY`, `IMOVIEW_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (além das padrão do Supabase). Editar Secrets no painel republica a função, por isso os números de versão "pulam".
- **Ordem de deploy** quando o front depende de algo novo no banco: migration → Edge Function → push do front.
- Migrations e funções são aplicadas pelo conector MCP do Supabase (o CLI local não está logado). O push é feito pelo Eduardo, no VS Code.

## 7. Decisões técnicas
| Decisão | Alternativa | Motivo |
|---|---|---|
| Esteira dentro do Hub (18/09) | Fluxo no n8n + Tally | Controle de acesso por RLS e interface própria |
| Documentos no Supabase Storage | Google Drive | Mantém a segurança por RLS (21/09) |
| Escrita da esteira por Edge Function/RPC | Insert direto do front | Validação e e-mail no mesmo lugar |
| Corrigir dados do n8n no banco (triggers) | Editar fluxos pelo MCP | O MCP regrava o fluxo inteiro e troca as credenciais |
| Papéis em `perfis.role` + funções SQL | Claims customizados no JWT | A suspensão vale na hora, sem esperar o token expirar |
