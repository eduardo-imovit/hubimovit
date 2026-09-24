# Backend Schema — Hub Imovit
**Base:** PRD v0.1 / TRD v0.1 · **Data:** 2026-09-24 · lido do banco de produção (`vlsrmtryzwddqkwqugfr`)

> Regra do framework: toda migration nova é conferida contra este documento **antes** de ser aplicada,
> e este documento é atualizado no mesmo sprint.

## 0. Avisos de estado (24/09)
- **Divergência repo × banco.** O banco tem 67 migrations registradas; o repo tem 28 (`supabase/migrations/`, a partir de 21/08). Tudo o que veio antes (tabelas do dashboard, views `vw_*`, `perfis`, `colaboradores_raw`, `plantao`, `avisos`…) **não está versionado no repo**. As versões também não batem (ex.: repo `20260923190000_niveis_acesso_perfil` × banco `20260923180414`), porque o MCP grava o horário em que aplicou. Este documento é, hoje, a única descrição completa do schema.
- **Projeto compartilhado.** O mesmo Supabase atende outras automações do n8n (blog, newsletter, repique, campanha de proprietários, base de conhecimento). Elas estão listadas na seção 2.4 só para ninguém apagar por engano.
- **🔴 Exposição:** `repique_control` e `repique_ponteiro` estão **sem RLS**, e o papel `anon` tem SELECT, INSERT, UPDATE, DELETE e TRUNCATE nelas. Como a anon key é pública (vai no front), qualquer pessoa na internet pode ler ou zerar essas tabelas.
- **🟠 Exposição:** as 9 views `vw_*` rodam com os direitos do dono (sem `security_invoker`) e têm SELECT para `anon`: dados comerciais (corretores, conversão, carteira) legíveis sem login.

## 1. Diagrama de entidades (núcleo do Hub)
```
auth.users 1──1 perfis ──1:N── solicitacoes_acesso
                  │
                  └──1:N── propostas_locacao (criado_por) ──1:N── documentos_enviados N──1 documentos_tipos_obrigatorios
                                                  │
                                                  └──1:N── status_historico

colaboradores_raw (Imoview, via n8n) 1──N plantao
                                     1──N agendamentos_fotografo

atividades 1──N atividades_notas          (Imoview, via n8n)
dashboard_atendimentos_crm ──> vw_atendimentos_base ──> demais vw_*
imoveis_locados 1──N proprietarios_locacao
```
Não há FK entre `perfis` e `colaboradores_raw` (a ligação é por e-mail, quando existe).

## 2. Tabelas

### 2.1 Acesso e pessoas
**`perfis`**: um por usuário `@imovit.com.br` (criado pelo trigger `handle_new_user` em `auth.users`).
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid PK | FK `auth.users` on delete cascade |
| email | text! | protegido pelo trigger `proteger_campos_perfil` |
| role | text! | check: `gestao, adm, marketing, corretor, user, tvaccess`; protegido |
| nome, telefone, cargo, foto_url | text | editáveis pelo próprio usuário |
| suspenso_em / suspenso_por | timestamptz / uuid→perfis | suspenso = sem papel nas funções auxiliares |
| criado_em, atualizado_em | timestamptz! | |

**`solicitacoes_acesso`**: pedidos de nível. `perfil_id`→perfis (cascade), `role_atual`, `role_solicitado` (check: gestao/adm/marketing/corretor), `motivo`, `status` (`pendente, aprovada, recusada, cancelada`), `resposta`, `decidido_por`→perfis, `decidido_em`, `criado_em`.

**`colaboradores_raw`** (n8n ← Imoview): `id_corretor_crm` bigint PK, `nome_completo`!, `email_oficial` unique, `telefone_whats`, `ativo`, `equipe`, `cargo`, `data_nascimento`, `data_admissao`, `atualizado_em`. Base de aniversários e tempo de casa na agenda.

### 2.2 Conteúdo da Home (escrita: gestao/marketing)
| Tabela | Campos principais | Nota |
|---|---|---|
| `avisos` | tipo (`aviso, data_importante, processo, link`), titulo!, corpo, link_url, data_referencia, ativo | soft-delete |
| `biblioteca_links` | titulo!, url!, categoria, descricao, ordem, ativo | |
| `home_banners` | titulo!, subtitulo, imagem_path! (bucket `banners`), link_url, ordem, ativo | |
| `plantao` | corretor_id→colaboradores_raw, corretor_nome!, data!, turno (`manha, tarde, dia_inteiro`), status (`agendado, confirmado, cancelado`), observacao | |
| `agendamentos_fotografo` | corretor_id→colaboradores_raw, corretor_nome!, corretor_email!, dia_semana (0–6, igual a `Date.getDay()`), hora_inicio < hora_fim, observacao, ativo | bloco semanal recorrente |
| `fotografo_bloqueios` | data_hora_inicio!, data_hora_fim!, motivo | ⚠ sem uso aparente no front |
| `datas_comemorativas` | nome!, data!, recorrente_anual!, categoria, observacao, ativo | |

### 2.3 Esteira de locação
**`propostas_locacao`**
| Grupo | Campos |
|---|---|
| Identidade | id uuid PK · codigo_imovel int! · email! (formato validado) · **unique (email, codigo_imovel)** · criado_por→perfis (set null) |
| Link | token_link! unique · link_expira_em! |
| Status | status! (`aguardando_locatario, aguardando_aprovacao_interna, criada, aguardando_docs, docs_em_analise, docs_aprovados, sincronizada, rejeitada, expirada`) |
| Imóvel | imovel_titulo, imovel_endereco, valor, valor_oferta |
| Locatário | nome_cliente, tel, tipo_pessoa (`Física, Jurídica`), tem_conjuge, observacoes, profissao, cargo, tipo_renda, renda_pessoal, renda_familiar, nome_empresa |
| Cônjuge | conjuge_nome, conjuge_email, conjuge_profissao, conjuge_renda |
| Legado | proprietario_nome, proprietario_email (saiu do fluxo), pasta_gdrive_id (sem uso) |
| Tempo | timestamp_criacao, updated_at (trigger `tocar_updated_at`) |

Triggers: `trg_propostas_locacao_expira` (bloqueia avanço quando expirada), `trg_propostas_locacao_log_status` (grava `status_historico`), `trg_propostas_locacao_updated_at`.

**`documentos_enviados`**: proposta_id→propostas (cascade), documento_codigo→documentos_tipos_obrigatorios, **unique (proposta, documento)**, status (`pendente, enviado, aprovado, rejeitado`), feedback_adm, arquivo_path (bucket `esteira-documentos`), url_gdrive (legado, só `drive/docs.google.com`). Trigger `recalcular_status_proposta` move a proposta entre `aguardando_docs`, `docs_em_analise` e `docs_aprovados`.

**`documentos_tipos_obrigatorios`**: codigo PK, nome!, tipo_pessoa (`Física, Jurídica, Ambos`), descricao, exige_conjuge!.

**`status_historico`**: proposta_id→propostas (cascade), status_anterior, status_novo!, ator, motivo, timestamp_registro. "Solicitar ajustes" não grava aqui (não muda status).

**View `propostas_ativas`** (`security_invoker`): propostas + `status_efetivo` (considera expiração).

### 2.4 Dados comerciais e de mídia (escrita: n8n com service role)
| Tabela | Origem | Nota |
|---|---|---|
| `dashboard_atendimentos_crm` | Imoview | codigo unique; corretor, datas de entrada/fechamento, fase/fase_nome, funil, campanha, midia, situacao, finalidade. Base do Kanban e das `vw_*` |
| `atividades` / `atividades_notas` | Imoview | upsert por trigger (`fn_upsert_atividades*`) |
| `dashboard_meta_ads` | Meta | 1 linha por dia+campanha+anúncio; trigger `meta_ads_upsert` transforma insert repetido em update (23/09). Mai–ago/26 regravados a partir da Graph API em 24/09, todos no nível campanha (`anuncio = 'N/A'`). Coluna `campaign_id` (migration `20260924120000_meta_ads_campaign_id`, aplicada em 24/09): a trigger casa por id quando ele vem preenchido (renomear só troca o nome) e por nome quando não vem; índices únicos parciais (data, campaign_id, anuncio) com id e (data, campanha, anuncio) sem id |
| `dashboard_google_ads` | Google Ads | sem duplicados |
| `leads_wpp_gtm` | GTM `wpp_gtm` e bot `wpp_entrada` | UTMs, gclid/gbraid/wbraid/fbclid, origem_registro (`site_gtm`, `bot_severino`); trigger descarta linha vazia. `imovel_titulo` nunca gravado |
| `metas`, `metas_mensais`, `metas_campanhas`, `metas_atividades_tipo`, `campanhas_metas`, `kpi_baselines` | manual/n8n | **5 tabelas de metas com formatos diferentes.** ⚠ Unificar antes da tela de metas |
| `imoveis_locados`, `proprietarios_locacao`, `envios_proprietarios` | Imoview/n8n | `imoveis_locados` vazia |

**Fora do Hub (não mexer sem olhar o n8n):** `blog_posts`, `blog_temas`, `newsletter_contacts`, `knowledge_base` (pgvector), `pilares`, `campanha_entreverdes_05-2026`, `fila_repique_site`, `repique_control`, `repique_ponteiro`.

**Backups temporários (apagar depois de validar os números):** `dashboard_meta_ads_backup_20260923`, `dashboard_meta_ads_backup_20260924`, `leads_wpp_gtm_backup_20260923`.

### 2.5 Integrações
`spotify_auth`: linha única (`id = 1`), refresh token do Spotify da TV.

## 3. Permissões (RLS) por papel
Funções: `papel_atual()`, `is_gestao()`, `is_adm_ou_gestao()`, `pode_editar_conteudo()` = gestao|marketing, `pode_ver_dash()` = gestao|marketing, `pode_ver_proposta(id)` = adm|gestao, ou corretor que criou, ou e-mail do JWT = e-mail da proposta.

| Tabela | Leitura | Escrita pelo front |
|---|---|---|
| perfis | o próprio; gestao vê todos | o próprio (campos livres); gestao atualiza qualquer um |
| solicitacoes_acesso | o próprio; gestao | insert do próprio (pendente); cancelar o próprio; decidir só via RPC |
| avisos, biblioteca_links, home_banners, plantao, agendamentos_fotografo, fotografo_bloqueios, datas_comemorativas | authenticated | `pode_editar_conteudo()` |
| propostas_locacao, documentos_enviados, status_historico | `pode_ver_proposta` | nenhuma direta (só Edge Function / RPC) |
| documentos_tipos_obrigatorios | authenticated | — |
| dashboard_meta_ads, dashboard_google_ads, metas_campanhas, metas_mensais | `pode_ver_dash()` | — |
| dashboard_atendimentos_crm, atividades, atividades_notas, colaboradores_raw, leads_wpp_gtm, metas, metas_atividades_tipo, campanhas_metas | **qualquer authenticated** (inclui `user` e `tvaccess`) | — |
| blog_posts | anon: só `status = 'publicado'` | — |
| pilares | público | — |
| **repique_control, repique_ponteiro** | **RLS desligada: anon lê e escreve** | 🔴 |
| **vw_*** (9 views) | **anon lê (views sem security_invoker)** | 🟠 |

⚠ `leads_wpp_gtm` (telefone e nome de lead) e `atividades` são legíveis por qualquer usuário logado, inclusive "Sem nível". Rever se isso é intencional.

### Storage
| Bucket | Público | Regras |
|---|---|---|
| `esteira-documentos` | não | ler: `pode_acessar_documento_esteira(name)`; enviar/atualizar: `pode_enviar_documento_esteira(name)` (locatário da proposta ou adm/gestao) |
| `banners` | sim | escrever/remover: `pode_editar_conteudo()` |
| `avatares` | sim | cada um só escreve na pasta `<uid>/` |
| `videos` | sim | ⚠ sem uso no Hub |

## 4. Funções, triggers e views
| Nome | Tipo | O que faz | Chamado por |
|---|---|---|---|
| `handle_new_user` | trigger em auth.users | cria perfil `user` para `@imovit.com.br` | Auth |
| `proteger_campos_perfil` | trigger | impede mudar o próprio role, e-mail e suspensão | update em perfis |
| `decidir_solicitacao_acesso` | RPC definer | aprova/recusa pedido (só gestao) | Configurações |
| `upsert_proposta_locacao`, `criar_proposta_locacao` | RPC definer | cria ou reinicia a proposta | Edge Function |
| `confirmar_dados_locatario`, `completar_cadastro_locatario` | RPC definer | etapas do locatário (revogadas para anon) | Edge Function |
| `decidir_aprovacao_interna`, `decidir_documento`, `descartar_proposta_locacao`, `marcar_sincronizado_imoview`, `registrar_documento_enviado(_arquivo)` | RPC definer | decisões da esteira | Edge Function |
| `aceitar_proprietario` | RPC definer | ⚠ legado (proprietário saiu do fluxo) | — |
| `fn_atualiza_status` | função | muda status + histórico | RPCs |
| `recalcular_status_proposta`, `bloquear_avanco_expirado`, `log_status_historico`, `tocar_updated_at` | triggers da esteira | | |
| `kpis_tv` | RPC definer | JSON só com agregados para a TV (gestao/adm/marketing/tvaccess). Desde 24/09 (migration `20260924140000_kpis_tv_alinhado_paineis`) traz também os campos com as definições do Painel da Gestão: `leads_mes`, `ritmo_dia`, `projecao_mes`, `leads_media_3m`, `negocios_fechados_mes`, `negocios_media_3m`, `conversao_safra(_anterior)`, `ciclo_mediano_12m`, `sem_contato`, `abertos_30d`, `atividades_vencidas_30d`, `crm_atualizado_ate`; os campos de 23/09 continuam | `useKpisTV` |
| `meta_ads_upsert`, `leads_wpp_gtm_descarta_vazia` | triggers | higiene dos dados do n8n | n8n |
| `fn_upsert_atividades`, `fn_upsert_atividades_notas` | triggers | upsert | n8n |
| `match_documents` | função | busca vetorial em `knowledge_base` | fora do Hub |
| `vw_atendimentos_base` | view | normaliza atendimentos (canal, fase, flags ruído/interno/negócio, dias) | base das outras |
| `vw_kpis_mensais`, `vw_funil_acumulado`, `vw_aging_ativos`, `vw_cobertura_atividades`, `vw_corretores`, `vw_descartes`, `vw_origem_performance`, `vw_tempo_resposta` | views | agregados dos dashboards | dashboards |

Edge Functions: `esteira-locacao` (eventos `nova_proposta, confirmar_dados_locatario, completar_cadastro, descartar_proposta, decisao_interna, docs_enviados, decisao_adm, solicitar_ajustes, sincronizar_imoview`), `gestao-colaboradores` (`suspender, reativar, excluir`), `spotify-auth`.

## 5. Migrations
- Repo: `supabase/migrations/` (28 arquivos, de `20260821140000` a `20260923233000`).
- Banco: 67 registradas em `supabase_migrations.schema_migrations`, desde `20260508150403`.
- **Pendência:** gerar uma migration-base (dump do schema atual) para o repo voltar a ser a fonte da verdade. Ver o plano, Fase 2.

## 6. Convenções para mudanças novas
- Tabela nova: RLS ligada na mesma migration, policies explícitas e grants revistos (o Supabase dá tudo para anon por padrão).
- View nova: `with (security_invoker = true)`.
- Função `security definer`: `set search_path = public` e `revoke execute ... from anon` quando não for pública.
- Testar a migration inteira dentro de `BEGIN … ROLLBACK` em produção antes de aplicar (não há ambiente de teste).
- Soft-delete (`ativo`) em tabelas de conteúdo; nunca `DELETE` sem `WHERE` (não há backup).
