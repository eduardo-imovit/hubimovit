# Backend Schema — Hub Imovit
**Base:** PRD v0.1 / TRD v0.1 · **Data:** 2026-09-24 · lido do banco de produção (`vlsrmtryzwddqkwqugfr`)

> Regra do framework: toda migration nova é conferida contra este documento **antes** de ser aplicada,
> e este documento é atualizado no mesmo sprint.

## 0. Avisos de estado (24/09)
- **Divergência repo × banco.** O banco tem 67 migrations registradas; o repo tem 28 (`supabase/migrations/`, a partir de 21/08). Tudo o que veio antes (tabelas do dashboard, views `vw_*`, `perfis`, `colaboradores_raw`, `plantao`, `avisos`…) **não está versionado no repo**. As versões também não batem (ex.: repo `20260923190000_niveis_acesso_perfil` × banco `20260923180414`), porque o MCP grava o horário em que aplicou. Este documento é, hoje, a única descrição completa do schema.
- **Projeto compartilhado.** O mesmo Supabase atende outras automações do n8n (blog, newsletter, repique, campanha de proprietários, base de conhecimento). Elas estão listadas na seção 2.4 só para ninguém apagar por engano.
- ~~🔴 Exposição: `repique_control` e `repique_ponteiro` sem RLS~~ → **resolvido** (auditoria de 26/10, `pg_class`): as 64 tabelas do `public` estão com RLS ligado. As duas do repique têm 0 políticas, então o `anon` não lê nem escreve (só a `service_role` do n8n). **Pendente (defesa em profundidade):** cerca de 39 tabelas antigas ainda têm GRANT para `anon` (o padrão de 22/10 só vale para objetos novos). Falta listar as políticas que valem para `public`/`anon` e dar `revoke` nas tabelas do Hub.
- ~~🟠 Exposição: as 9 views `vw_*` sem `security_invoker` e com SELECT para `anon`~~ → **resolvido**. As 9 foram corrigidas em 28/09 (`20260928180000_seguranca_equipe_registro`), e as 3 do Estoque em 22/10 (`20261022120000_anon_fora_views_estoque_e_padrao`). A auditoria de 22/10 mostrou as 21 views com `security_invoker` e sem SELECT para `anon`. Desde 22/10, o padrão do schema `public` não dá mais grant para `anon` em tabela, view ou sequência nova (ver §6).

## 1. Diagrama de entidades (núcleo do Hub)
```
auth.users 1──1 perfis ──1:N── solicitacoes_acesso
                  │
                  └──1:N── propostas_locacao (criado_por) ──1:N── documentos_enviados N──1 documentos_tipos_obrigatorios
                                                  │
                                                  └──1:N── status_historico

colaboradores_raw (carga manual / onboarding) 1──N plantao
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

**`colaboradores_raw`** (carga **manual**: quase tudo veio numa carga única em 06/08; não há sincronização com o Imoview. Desde a §2.16, entradas novas vêm da aprovação do onboarding): `id_corretor_crm` bigint PK, `nome_completo`!, `email_oficial` unique, `telefone_whats`, `ativo`, `equipe`, `cargo`, `data_nascimento`, `data_admissao`, `atualizado_em`. Base de aniversários e tempo de casa na agenda.

### 2.2 Conteúdo da Home (escrita: gestao/marketing)
| Tabela | Campos principais | Nota |
|---|---|---|
| `avisos` | tipo (`aviso, data_importante, processo, link`), titulo!, corpo, link_url, data_referencia, ativo | soft-delete |
| `biblioteca_links` | titulo!, url!, categoria, descricao, ordem, ativo | |
| `home_banners` | titulo!, subtitulo, imagem_path! (bucket `banners`), link_url, ordem, ativo | |
| `plantao` | corretor_id→colaboradores_raw, corretor_nome!, data!, turno (`manha, tarde, dia_inteiro`), status (`agendado, confirmado, cancelado`), observacao, **tipo!** (`venda, locacao`, default `venda`; 05/11) | índice (data, tipo); `kpis_tv.plantao_hoje` devolve o tipo |
| `agendamentos_fotografo` | corretor_id→colaboradores_raw, corretor_nome!, corretor_email!, dia_semana (0–6, igual a `Date.getDay()`), hora_inicio < hora_fim, observacao, ativo | bloco semanal recorrente |
| `fotografo_bloqueios` | data_hora_inicio!, data_hora_fim!, motivo | ⚠ sem uso aparente no front |
| `datas_comemorativas` | nome!, data!, recorrente_anual!, categoria, observacao, ativo | |

### 2.3 Esteira de locação
**`propostas_locacao`**
| Grupo | Campos |
|---|---|
| Identidade | id uuid PK · codigo_imovel int! · email! (formato validado) · **unique (email, codigo_imovel)** · criado_por→perfis (set null) |
| Link | token_link! unique · link_expira_em! |
| Status | status! (`aguardando_locatario, correcao_solicitada, criada, aguardando_docs, docs_em_analise, docs_aprovados, sincronizada, rejeitada, expirada`) · motivo_correcao |
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

**Esteira v4 (RF22, PRD §5.6) — migration `20260928140000_esteira_v4_validacao_locatario`:**
- `status`: entra `correcao_solicitada`; sai `aguardando_aprovacao_interna` (check atualizado; o histórico antigo continua com o valor).
- Coluna `motivo_correcao text` (último motivo do locatário). Termos da negociação, preenchidos pelo gestor: `tel`, `valor`, `valor_oferta` (valor da locação negociado), `corretor_responsavel` (nome, lista `colaboradores_raw`), `garantia` (check: Seguro-fiança, Fiador, Caução, Título de capitalização, Outra), `data_posse`, `prazo_meses` (1–360), `dia_vencimento` (1–31), `clausula_rescisao`, `negociacao_especifica`, `observacoes` (= outros combinados e benfeitorias).
- **`propostas_locacao_interno`** (nova): `proposta_id` PK→propostas (cascade), `taxa_administracao` (0–100), `atualizado_em`. RLS: leitura para adm/gestao e o corretor dono; escrita só service_role. Existe porque o portal lê `propostas_locacao` inteira e RLS não esconde coluna: a taxa (acordo com o proprietário) não pode chegar ao locatário. A view `propostas_ativas` traz `taxa_administracao` por left join (quem não pode ler recebe null).
- RPCs (só `service_role`; a Edge Function passa a identidade): `criar_proposta_locacao(p_criado_por, p_nome_cliente, p_email, p_codigo_imovel, p_termos jsonb, p_imovel_titulo, p_imovel_endereco, p_ator)` e `editar_proposta_locacao(p_proposta_id, p_ator_id, p_ator, p_nome_cliente, p_termos jsonb, …)` validam os termos em `validar_termos_locacao(jsonb)`; criar grava `criado_por` e recusa sobrescrever proposta em andamento/concluída; `editar_proposta_locacao` (dono corretor ou adm/gestao, só antes da validação, renova +7 dias); `validar_proposta_locatario` (→ `aguardando_docs`, prazo +30 dias); `pedir_correcao_proposta` (→ `correcao_solicitada`). Removidos: `confirmar_dados_locatario`, `decidir_aprovacao_interna`.
- `bloquear_avanco_expirado` passa a olhar o prazo novo (`new.link_expira_em`), para renovar destravar, e não expira `correcao_solicitada`.
- View `propostas_ativas`: + `motivo_correcao`, `criado_por`, termos e `taxa_administracao`; `status_efetivo` não expira `correcao_solicitada`.

### 2.3b Proposta de venda (RF21) — migration `20260925130000_propostas_venda`, aplicada em 28/09
**`propostas_venda`**: id uuid PK · criado_por→perfis (set null) · codigo_imovel int! · imovel_titulo, imovel_endereco · nome_cliente!, email!, telefone · valor_referencia, valor_proposta, descricao_proposta · assinatura_path, documento_path (bucket `propostas-venda`) · status! (`aguardando_cliente, confirmada, descartada, expirada`) · link_expira_em! (+7 dias) · motivo · timestamp_criacao, atualizado_em (trigger `tocar_venda_updated_at`).

**`propostas_venda_historico`**: proposta_id→propostas_venda (cascade), status_anterior, status_novo!, ator (e-mail), motivo, timestamp_registro.

**View `propostas_venda_ativas`** (`security_invoker`): `aguardando_cliente` + `confirmada`, com `status_efetivo` (expiração).

**Permissões:** `authenticated` só tem SELECT (RLS por `pode_ver_proposta_venda`: adm/gestao tudo, corretor as que criou, proponente pelo e-mail do JWT); anon nada. Toda escrita passa pelos RPCs, que só a `service_role` executa: `criar_proposta_venda(p_criado_por, …)`, `confirmar_proposta_venda(p_proposta_id, p_email_chamador, …)`, `descartar_proposta_venda`. A Edge Function valida o JWT e o papel e passa a identidade como parâmetro (com a service role, `auth.uid()`/`auth.jwt()` no banco não são do usuário). Única escrita do navegador: `registrar_documento_venda(p_proposta_id)` (authenticated; só o proponente, uma vez, com o PDF já no Storage).

### 2.5b Formulários (RF23, PRD §5.7) — migration `20260928160000_formularios_captacao_feedback`
**`captacoes`**: id uuid PK · criado_em · corretor (nome) · corretor_crm_id int (colaboradores_raw.id_corretor_crm, opcional) · proprietário (nome!, email!, telefone!, cpf!) · tipo_imovel, finalidade (`Venda, Locação, Ambos`), exclusividade bool, exclusividade_periodo (`30 dias, 90 dias, 180 dias, 1 ano`) · endereço (logradouro!, numero!, bairro!, cep, complemento_apto, bloco, quadra) · valores (valor_locacao, valor_venda, condominio, iptu_mensal) · área_interna!, area_terreno, quartos, suites, banheiros, salas, vagas (texto, aceitam "5 ou mais"), tipo_vaga · lazer text[] · observacoes · declaracao (texto exato exibido e assinado, vindo da função e montado pela finalidade desde 09/10) · assinatura (data URL PNG, até 400 KB, check no banco) · assinado_em · origem_ip/origem_user_agent (auditoria). Sem status: só registro.
- **Escrita:** só pela Edge Function `captacao` (service_role), chamada pelo formulário público: valida (zod), limita tamanho da assinatura, honeypot anti-robô. `anon` não tem grant na tabela.
- **Leitura:** gestao/adm todas; corretor as dele (`corretor_email`, copiado de `colaboradores_raw.email_oficial` na gravação, = e-mail do login).

**`captacao_links`** (migration `20260928170000`): token (PK, 12 caracteres aleatórios url-safe) · corretor_crm_id (unique) · criado_em. Sem policies: ninguém lê pela API. O corretor recebe o próprio link pelo RPC `meu_link_captacao()` (authenticated; e-mail do JWT = `colaboradores_raw.email_oficial`; cria o token na primeira vez). A função `captacao` resolve o corretor pelo token. Os links no formato antigo (`/captacao/<id do CRM>`) deixaram de funcionar em 28/09.

**`feedbacks_visita`**: id · criado_em · criado_por→perfis · codigo_imovel! · olhar_visitante · curadoria_ajustes · termometro (1–5)! · corretor! · nota_consultor. RLS: insert pelo próprio usuário (gestao/adm/corretor); leitura gestao/adm todas, corretor as dele.

### 2.4 Dados comerciais e de mídia (escrita: n8n com service role)
| Tabela | Origem | Nota |
|---|---|---|
| `dashboard_atendimentos_crm` | Imoview | codigo unique; corretor, datas de entrada/fechamento, fase/fase_nome, funil, campanha, midia, situacao, finalidade. Hoje: lista de leads da `vw_atendimentos_base` (a fase vem da jornada desde 15/10, §2.15) e fonte direta do Kanban e de Dados de Atendimento. **Vai virar arquivo morto (§2.17, Fase 24)**; não desligar o fluxo `crm_atendimentos` antes disso |
| `atividades` / `atividades_notas` | Imoview | upsert por trigger (`fn_upsert_atividades*`) |
| `dashboard_meta_ads` | Meta | 1 linha por dia+campanha+anúncio; trigger `meta_ads_upsert` transforma insert repetido em update (23/09). Mai–ago/26 regravados a partir da Graph API em 24/09, todos no nível campanha (`anuncio = 'N/A'`). Coluna `campaign_id` (migration `20260924120000_meta_ads_campaign_id`, aplicada em 24/09): a trigger casa por id quando ele vem preenchido (renomear só troca o nome) e por nome quando não vem; índices únicos parciais (data, campaign_id, anuncio) com id e (data, campanha, anuncio) sem id |
| `dashboard_google_ads` | Google Ads | sem duplicados |
| `leads_wpp_gtm` | GTM `wpp_gtm` e bot `wpp_entrada` | UTMs, gclid/gbraid/wbraid/fbclid, origem_registro (`site_gtm`, `bot_severino`); trigger descarta linha vazia. `imovel_titulo` nunca gravado. No `bot_severino`, `utm_campaign` guarda a mídia decidida pelo nó "extrair IDs" do `wpp_entrada` (regra do COD, 23/11: código do nó em `docs/n8n/wpp_entrada__extrair_ids.js`): `campanha_*` só com "COD <nº>" + palavra; o campo `midia` do Severino é ignorado. **Conciliação com o clique (migration `20261123140000_concilia_clique_site`, 23/11):** colunas `clique_lead_id` (linha `site_gtm` com o mesmo `codigo_atendimento`) e `imoview_atendimento` (nº do atendimento no Imoview, gravado pelo n8n); trigger `trg_leads_wpp_gtm_e_concilia_clique` troca a mídia por `site_google_ads` (gclid/gbraid/wbraid ou google+cpc) ou `site_meta_ads` (fbclid ou facebook/instagram) via função `midia_do_clique()`; sem identificador de anúncio, fica a mídia do n8n (Site orgânico). **Conserto 29b (migration `20261124170000_backfill_imoview_atendimento`, APLICADA 25/11, no banco como versão `20261125121533`):** coluna `imoview_vinculo` (`n8n` · `backfill_entrada` · `backfill_atividade`) e backfill do histórico por horário, só leads com `created_at >= 2026-10-19` (32 ligados: 21 `backfill_entrada` + 11 `backfill_atividade`; os atendimentos 6374 e 6482 têm 2 leads cada, conhecidos; os 41 leads de 24/09 a 18/10 ficaram sem ligação, para revisão futura) (vizinho mútuo, ±2/+5 min; regra 1: atendimento novo com mídia `campanha_*`/`wpp_*`/`site_*`; regra 2: atividade tipo 1 no atendimento existente com o 1º nome igual). `imoview_atendimento` só vale para `bot_severino`; o clique (`site_gtm`) liga pelo `clique_lead_id`. Conserto do n8n em `docs/n8n/wpp_entrada__v2_29b.md` |
| `metas_campanhas`, `campanha_metas`, `metas_atividades_tipo` | manual/n8n | Tabelas de metas que ficam (PRD §5.23, pendência 4); `metas_atividades_tipo` alimenta o e-mail de terça. **`metas_mensais` removida (migration `20261123160000_kpis_tv_sem_metas_mensais`, 23/11):** a `kpis_tv()` perdeu o campo `comercial.meta_leads` (já vinha null; a TV usa `meta_leads_90d`); backups `bkp_20261123_metas_mensais` e a saída da função antes da mudança em `bkp_20261123_kpis_tv_saida`; código anterior da função em `bkp_20261123_kpis_tv_def`. Conferido em 23/11: saída nova = foto, exceto `meta_leads`. **Removidas em 23/11** (migration `20261123150000_remove_metas_sem_uso`, decisão do Eduardo: apagar já, com backup): `metas` (18 linhas), `kpi_baselines` (24) e `campanhas_metas` (9); backups `bkp_20261123_metas`, `bkp_20261123_kpi_baselines`, `bkp_20261123_campanhas_metas`. Sem uso em código, views, funções ou policies; ⚠ `campanhas_metas` tinha 229 leituras de origem não identificada (provável fluxo n8n não legível pelo conector): se algo quebrar, restaurar do backup |
| `imoveis_locados`, `proprietarios_locacao`, `envios_proprietarios` | Imoview/n8n | `imoveis_locados` vazia |

**Fora do Hub (não mexer sem olhar o n8n):** `imoview_sessao` e `wpp_entrada_reserva` (§2.24, aplicada 26/11), `blog_posts`, `blog_temas`, `blog_pautas`, `newsletter_contacts`, `newsletter_contatos`, `knowledge_base` (pgvector), `pilares`, `campanha_entreverdes_05-2026`, `fila_repique_site`, `repique_control`, `repique_ponteiro`, `repique_tentativas`.

**`newsletter_contatos`** (09/11): pertence ao projeto `newsletters-imovit` (schema e migration lá, em `newsletters-imovit/docs/05-backend-schema.md`). Contatos de proprietários e locatários dos contratos ativos; só a Gestão lê. Não confundir com `newsletter_contacts`.

**`blog_pautas`** (09/11): pertence ao blog, que mora no projeto `newsletters-imovit` (plano em `docs/blog-pautas.md` e migration lá). Fila de pautas do fluxo n8n `conteúdo`; só gestão/marketing leem. Em `blog_posts`, o status `descartado` tira um rascunho da fila sem apagar. **Revisão no Hub (Fase 28, 09/11):** `blog_posts` ganhou `decidido_por`, `decidido_em`, `observacao_revisao` e a policy "conteudo le todos os posts" (gestão/marketing leem rascunhos); a decisão é só pela função `blog_decidir(post_id, acao, observacao)` (`pode_editar_conteudo()`). Migration `20261109220000_blog_revisao_hub.sql` no `newsletters-imovit`.

**`repique_tentativas`** (migration `20261103180000_repique_tentativas`, Repique 3.0 do n8n): é o registro de quantas vezes cada lead foi repicado. `atendimento_id` bigint PK (código do atendimento no Imoview) · `tipo_operacao` text! (`venda`/`locacao`) · `tentativas` int! (1–3) · `ultimo_repique_em` timestamptz! · `ultimo_corretor` int! (código CRM) · `criado_em` timestamptz!. Regra: no máximo 3 repiques por lead. O prazo (locação 5 min, venda 30 min) conta da entrada quando não há linha e do `ultimo_repique_em` quando há. Depois da 3ª tentativa o lead fica com o último corretor. `repique_control` (vazia, de gerações antigas) não é usada.

**Backups temporários (apagar depois de validar os números):** `dashboard_meta_ads_backup_20260923`, `dashboard_meta_ads_backup_20260924`, `leads_wpp_gtm_backup_20260923`.

### 2.5 Integrações
`spotify_auth`: linha única (`id = 1`), refresh token do Spotify da TV.

### 2.6 Histórico do funil (RF24, PRD §5.8) — **PROPOSTA, não aplicada**
Princípio: o n8n **só insere**. Nada de *upsert* nem de *update* em dado comercial. O "estado atual" passa a ser derivado do histórico.

**`crm_atendimentos_captura`** (append-only): uma linha por atendimento por captura.
| Campo | Tipo | Nota |
|---|---|---|
| id | bigint identity PK | |
| capturado_em | timestamptz! default now() | momento da leitura no Imoview |
| dia_captura | date! | dia (America/Sao_Paulo); **unique (codigo, dia_captura)** para o reprocessamento do mesmo dia não duplicar |
| codigo | bigint! | código do atendimento no Imoview |
| fase_crm | smallint! | número da fase no Imoview (1–7) |
| situacao | text! | Em atendimento / Descartado / Negócio realizado |
| finalidade, corretor, midia, campanha, funil | text | como vêm do CRM |
| data_entrada | date | `datahoraentradalead` |
| data_encerramento | date | descarte ou negócio |
| payload | jsonb | resposta bruta do Imoview, para reprocessar sem nova chamada |

**`crm_funil_etapas`** (mapeamento, editável pela Gestão): `fase_crm` PK → `posicao` (1–8), `nome`. Hoje: 1 Pré-atendimento→1, 2 Seleção de perfil→2, 3 Seleção de imóveis→3, 7 Lead qualificado→4, 4 Visita→5, 5 Proposta→6, 6 Negócio→7 (sem "Agendamento", decisão de 29/09).

**`crm_atendimento_transicoes`** (gerada por gatilho, nunca escrita pelo n8n): `codigo`, `fase_anterior`, `fase_nova`, `situacao_anterior`, `situacao_nova`, `detectado_em` (dia da captura em que a mudança apareceu). O gatilho `AFTER INSERT` em `crm_atendimentos_captura` compara com a última captura do mesmo código e grava uma linha só quando fase ou situação mudou. A primeira captura de um código grava a entrada (`fase_anterior = null`).

**Estado atual:** `dashboard_atendimentos_crm` continua existindo (Kanban, TV, views `vw_*` e painéis leem dela), mas é **mantida pelo gatilho** a partir da última captura, e não mais pelo n8n. Assim nada que já existe quebra na virada.

**RLS:** as três tabelas com leitura `is_team()` e sem escrita pela API (o n8n usa service role). Mapeamento: escrita só Gestão.

**Métricas (camada única, SQL):** funções/views com parâmetros (`de`, `ate`, `finalidade`, `corretor`, `midia`) que todas as páginas usam. **Filtro geral embutido:** toda função parte de uma view `vw_corretores_comerciais_ativos` (`equipe = 'comercial' and ativo`) e liga o atendimento ao corretor por `lower(trim(nome))`; não há como pedir os inativos pela API do painel. Assim o front não recalcula e cada card tem uma consulta de conferência.
- Tempo na etapa = `detectado_em` da saída − `detectado_em` da entrada, por etapa, média e mediana.
- Visitas por região e tipo: `atividades` com `nometipo = 'Visita'`, com bairro e tipo tirados do imóvel (`resumoimovel` hoje; o ideal é a API de imóveis do Imoview).

**Volume esperado:** cerca de 230 atendimentos ativos por dia mais os encerrados recentes, ou seja, dezenas de milhares de linhas por ano. Não pesa no Pro. Se crescer, a captura pode gravar só quando algo mudou.

**APLICADO em 01/10** (migration `20261001160000_crm_jornada`): `crm_leituras`, `crm_atendimento_jornada` (RLS: só quem tem nível; corretor só o dele; sem escrita pela API) e `registrar_atendimentos_crm(jsonb)` (execução só `service_role`). Teste antes (transação desfeita, 4 leituras simuladas): entrada, primeira_leitura, mudanca_etapa, lead novo que já andou (entrada + mudança), encerramento, reabertura, leitura repetida sem linha nova e item sem fase ignorado; a Gestão não executa nem grava, e o anon lê 0. Nesta etapa a RPC **não** escreve em `dashboard_atendimentos_crm`; isso fica para a virada, depois dos 3 dias em paralelo.

**Foto atual (migration `20261019160000_jornada_payload_atual`, APLICADA em 19/10):**
- quando a leitura não traz mudança de fase nem de situação, a RPC atualiza o `payload` da **última linha** do código (só se mudou). Não cria linha nova, e tipo, fase, situação e `data_evento` não mudam;
- motivo: o status das propostas (`imoveisproposta[].negociacoes[]`) e a última interação mudam dentro da mesma fase. Antes, a foto ficava congelada no dia da mudança de fase (6182 Cancelado e 6383 Reservado no CRM seguiam "Em análise" no Km 32);
- efeito colateral bom: descartes antigos lidos de novo (encerrados de 60 dias na diária; todos no domingo) ganham `interacoes` no payload, e a `vw_atendimentos_base` passa a ter a data do descarte deles;
- testado numa transação abortada antes de aplicar: payload atualizado, 0 linhas novas e contadores zerados.

**Revisão do desenho (01/10, conversa com o Eduardo).** Para não guardar ~2.800 linhas por dia, o n8n não grava a foto inteira. O fluxo `crm_jornada_diaria` (n8n `4tzh8UFpxciJOYiY`, criado **desligado**) lê todos os atendimentos e chama a RPC `registrar_atendimentos_crm(itens jsonb)` (security definer, só `service_role`). A RPC:
- grava em **`crm_atendimento_jornada`** (append-only) 1 linha quando o código aparece pela primeira vez e 1 linha a cada mudança de fase ou situação. Campos: `codigo`, `fase_crm`, `situacao`, `data_evento`, `tipo` (`entrada` | `primeira_leitura` | `mudanca_etapa` | `encerramento`), `origem_data` (`crm` | `captura`), `finalidade`, `corretor`, `midia`, `campanha`, `funil`, `detectado_em`, `payload`;
- mantém `dashboard_atendimentos_crm` como estado atual, para Kanban, TV e views continuarem iguais e o `crm_atendimentos` antigo poder ser desligado depois;
- grava 1 linha por execução em `crm_leituras` (lidos, novos, mudanças), para auditoria;
- devolve `{lidos, novos, mudancas_etapa, encerramentos}`.

Na primeira leitura, um código que já está além do Pré-atendimento vira `primeira_leitura`, com a data de chegada na etapa desconhecida, e fica fora da média de tempo. A `entrada` usa `datahoraentradalead`. As mudanças usam o dia da leitura (precisão de 1 dia).

**Carga inicial e leitura diária enxuta (06/10, decisão do Eduardo: "o foco é daqui para frente").**
- Migration `20261006180000_crm_jornada_carga_inicial`, **aplicada**: a jornada parte de `dashboard_atendimentos_crm`, sem chamar o Imoview. Foram 2.831 linhas (5 `entrada` + 2.826 `primeira_leitura`; 247 em atendimento), com `crm_leituras.origem = 'carga_base'` (coluna nova).
- Migration `20261006160000_service_role_timeout`, **aplicada**: `service_role` com `statement_timeout = 120s` (herdava 8s do `authenticator`; a 1ª leitura com 26,5 MB deu timeout). anon e authenticated sem mudança.
- Fluxo `crm_jornada_diaria v3` (n8n `OrueN2tGYYqploMp`, desligado):
  - dia a dia: situação 1 (em atendimento) em todas as fases + situações 2 e 3 com `dataInicial` de 60 dias;
  - domingo: leitura completa;
  - 50 por página, payload enxuto (só campos simples + o tamanho das listas internas);
  - trava se a situação 1 não vier como "Em atendimento".
- A v1 (`4tzh8UFpxciJOYiY`) e a v2 (`NLDrm0WTWkYdz3ge`) ficam obsoletas: arquivar.

### 2.6b "Sem nível" não lê dados comerciais — migration `20261001120000_sem_nivel_nao_le_dados_comerciais`, **APLICADA em 01/10**
- Função `pode_ler_comercial()`: perfil ativo com nível `gestao, adm, marketing, corretor, tvaccess`.
- Policy "so quem tem nivel le" no lugar de "so equipe le" (is_team) em `dashboard_atendimentos_crm`, `atividades`, `atividades_notas`, `leads_wpp_gtm`, `metas`, `metas_atividades_tipo` e `campanhas_metas`.
- Continuam com `is_team()`, porque a Home é de todos os perfis: `avisos`, `biblioteca_links`, `home_banners`, `plantao`, `agendamentos_fotografo`, `fotografo_bloqueios`, `datas_comemorativas` e `colaboradores_raw`.
- Teste antes de aplicar (transação desfeita):
  - "Sem nível" lê 0 nas 7 tabelas e nas views `vw_*`, mas lê avisos e plantão; `kpis_tv` já o barrava;
  - TV e Gestão sem mudança.

### 2.7 Corretor só lê o que é dele — migration `20261001130000_corretor_ve_so_os_seus_dados` (era `20260929150000`), **APLICADA em 01/10**
- Funções: `meu_nome_crm()` (security definer; nome no CRM pelo e-mail do login) e `nome_corretor_crm(bruto)` (mesmo ajuste de nome da `vw_atendimentos_base`).
- Policies "equipe le; corretor so os seus" substituem "so quem tem nivel le" (2.6b) em `dashboard_atendimentos_crm`, `atividades`, `atividades_notas` e `leads_wpp_gtm`. Quem não é corretor segue com `pode_ler_comercial()`. Retestada em 01/10 sobre a 2.6b: corretora 398 atendimentos, 0 de outros; Gestão sem mudança.
- Teste (29/09, transação desfeita, corretora simulada com o e-mail da Sandra):
  - corretora: 397 atendimentos, 0 de outros, 49 atividades, 0 leads do site;
  - Gestão: sem mudança (2.788 atendimentos / 2.112 atividades / 824 leads);
  - anon: 0.
- ~~Achado: "Sem nível" lia os dados comerciais~~ fechado em 01/10 (2.6b).

### 2.8 Campanhas (RF25, PRD §5.9) — aplicada (06/10; `em_proposta` em 13/10)
**`campanhas`**: `id` bigint identity PK, `slug` text unique (ex.: `km32-4tri-2026`), `nome` text!, `inicio` date!, `fim` date! (check `fim >= inicio`), `ativa` bool default true, `criado_em` timestamptz.

**`campanha_metas`**: `campanha_id` → campanhas (cascade), `finalidade` text check (`Venda`, `Aluguel`), `meta_valor` numeric!, `meta_negocios` int!, PK (`campanha_id`, `finalidade`).

Carga inicial: Km 32, de 06/10 a 31/12/2026. Venda: R$ 28.000.000 / 14. Aluguel: R$ 160.000 / 18.

**Locação = contratos iniciados (migration `20261019180000_km32_locacao_contratos`, 19/10):** desde então, a finalidade `Aluguel` sai de `contratos_locacao`, e não mais dos negócios do CRM:
- conta o contrato com `data_inicio` do 1º dia do mês do início da campanha (01/10) até `least(fim, hoje)`, com `situacao <> 'Cancelado'`. A data do contrato no cálculo do mês é `data_inicio`;
- valor = `valor_aluguel`;
- `campanha_resumo` devolve também `ativos` (`situacao = 'Ativo'`) e `em_ativacao` (`'Moderação'`);
- a função é security definer e só devolve somas: quem lê a campanha não lê os contratos (RLS só Gestão).

**Negócios da campanha (derivados, nada é digitado; desde 19/10, só venda):** vêm de `crm_atendimento_jornada`, nas linhas com `situacao = 'Negócio realizado'` e payload completo (gravado pelo `crm_jornada_diaria v3`):
- **data** = maior `datahora` entre as `payload.interacoes` cuja descrição começa com "NEGÓCIO REALIZADO";
- **valor** = soma de `payload.imoveisnegocio[].valornegocio`;
- 1 negócio por código de atendimento: vale o registro mais recente (por exemplo, reaberto e fechado de novo).

**Função `campanha_resumo(p_slug text)`** (security definer, só para quem `pode_ler_comercial()`): devolve o período e, por finalidade, `valor`, `negocios`, `valor_mes` e `negocios_mes` (negócios do mês corrente dentro da campanha, migration `20261016140000`), `ticket`, `sem_valor`, `meta_valor`, `meta_negocios`, `em_proposta` e `propostas`, além de `ultima_leitura` (`crm_leituras`). `em_proposta` (migration `20261013120000`) soma `imoveisproposta[].negociacoes[]` (a mais recente de cada imóvel, situação "Em análise", `valorproposta`) dos atendimentos em atendimento com `fase_crm = 5` (Proposta) e `datahoraultimainteracao` nos últimos 30 dias (migration `20261013130000`; a 1ª versão usava 15). A tabela `crm_funil_etapas` citada acima não existe no banco (conferido em 13/10): o 5 está fixo na função. Devolve só agregados, nunca linhas: assim o corretor vê o total da imobiliária (C3) sem ler atendimentos de outros.

**RLS:** `campanhas` e `campanha_metas` com leitura por `pode_ler_comercial()` e escrita só pela Gestão.

### 2.9 Jornada para análise (RF/PRD §5.12) — migration `20261019140000_vw_jornada`, **APLICADA em 19/10**
- **View `vw_jornada_etapas`** (security_invoker, herda a RLS da jornada: o corretor vê só a dele): uma linha por passagem por etapa, com `codigo`, `finalidade`, `corretor`, `midia`, `fase_crm`, `posicao` (1–7 no funil do Hub), `entrou_em`, `saiu_em` (próximo evento do mesmo código), `dias_na_etapa`, `como_saiu` (`avancou` | `voltou` | `descartado` | `negocio` | `em_aberto`) e `entrada_conhecida` (false quando a passagem começa numa `primeira_leitura`).
- **View `vw_jornada_descartes`** (security_invoker): descartes da jornada, com a etapa em que estavam, a data e o **motivo**, lido de `payload.interacoes` (a interação de descarte; o padrão exato do texto vai ser conferido no primeiro descarte capturado com a v5).
- **Como ficou (19/10):**
  - `vw_jornada_etapas` tem `codigo`, `posicao`, `entrou_em`, `saiu_em`, `dias`, `como_saiu` e `entrada_conhecida`. Descartes não viram etapa.
  - `entrada_conhecida` vale para `entrada`, `mudanca_etapa`, `reabertura` e `encerramento`, e para `primeira_leitura` só quando o lead entrou no CRM até 2 dias antes (outbound que nasce qualificado).
  - `vw_jornada_descartes` tem `codigo`, `posicao`, `descartado_em`, `motivo` e `observacao`. Só entram os `encerramento` Descartado. O Imoview grava "ATENDIMENTO descartado motivo: <motivo padrão>, <observação>"; `motivo` é o texto antes da 1ª vírgula, e sem texto vira "Sem motivo registrado".
  - Sem `payload` nas views; finalidade, canal e corretor vêm da `vw_atendimentos_base` no front, pelo código.
  - Grants: só SELECT para `authenticated`; `anon` sem acesso.
- O front lê as views no Painel da Gestão (capítulos 3 e 4) e aplica os filtros da página.

### 2.10 Carteira de locação (RF26, PRD §5.13) — migrations `20261007200000_carteira_locacao` e `20261007220000_carteira_locacao_v2`, **APLICADAS em 07/10**
Escrita só pela RPC `carregar_carteira_locacao` (service role: n8n `carteira_locacao_diaria` e Edge Function `carteira-locacao`). Leitura: **só `is_gestao()`** (migration `20261007233000_adm_locacao_so_gestao`, 07/10; antes Gestão e ADM). Sem grant para `anon`; o `authenticated` só tem SELECT; views com `security_invoker`.
- **`contratos_locacao`**: 1 linha por contrato (todos, inclusive rescindidos), upsert por `codigo` (= `atividades.codigocontratoaluguel`).
  - Imóvel: código, resumo, tipo, endereço, `bairro`/`cidade`/`uf` (do endereço, `imoview_endereco_partes`), destinação.
  - Locatário: código, nome, telefone, e-mail.
  - `situacao` (Ativo | Rescindido | Cancelado | Moderação), `status` (Saudável | Atrasado), `motivo_status`.
  - Valores: aluguel, condomínio, taxa de administração e de intermediação (valor + tipo % ou R$).
  - Garantia: `garantia`, `garantia_forma`, `garantia_seguradora`, `garantia_fim`; `indice_reajuste`.
  - Seguro incêndio: início, fim, seguradora.
  - Datas: início, fim, próximo reajuste, aviso de desocupação, previsão de rescisão, rescisão; `motivo_rescisao`; `dia_vencimento`.
  - `locadores` jsonb `[{codigo, nome, percentual}]`.
  - `payload` cru **sem CPF/CNPJ** (campos removidos + `mascarar_documentos`).
- **`contratos_locacao_cobrancas`**: cobranças de locação em aberto e vencidas, **substituída a cada carga**. `pagamento_informado` / `data_pagamento_informada` marcam as já pagas e ainda sem baixa no Imoview.
- **`contratos_locacao_recebimentos`**: cobranças **pagas** (upsert; acumulam). Campos: `data_pagamento`, `total_cobrado`, `aluguel` (plano 7.1.1), `taxa_adm` (repasse ao Locador, 1.1.1.1), `taxa_intermediacao` (1.1.1.2).
- **`contratos_locacao_fotos`**: foto diária dos totais (tendência de inadimplência).
- **RPC `carregar_carteira_locacao(contratos, cobrancas, pagas default '[]')`**: converte `dd/MM/yyyy` e `1.234,56`, mascara documentos, faz upsert dos contratos, substitui as em aberto, acumula as pagas e grava a foto do dia. Tudo numa transação.
- **Views:**
  - `vw_carteira_locacao`: contrato + `receita_adm`, `dias_para_fim`, `prazo_indeterminado`, `com_aviso`, `reajuste_atrasado`, `meses_de_contrato`, `seguro_incendio_situacao`, `garantia_situacao`, valor vencido, `sem_baixa_*`, `grupo_cobranca` (inadimplente | encerrado_debito | atencao);
  - `vw_cobrancas_locacao` (dias de atraso e faixa);
  - `vw_carteira_locacao_mensal` (novos pela data de início, encerrados pela data de rescisão, como no CRM; ativos no fim do mês, em que o rescindido sem data sai na data de fim; aluguel dos novos; desde 2014; migration `20261008000000_carteira_mensal_regra_crm`);
  - `vw_recebimentos_locacao_mensal` (pelo mês do pagamento);
  - `vw_proprietarios_locacao` (pelo percentual de cada locador).
- **Agendador da receita — migration `20261029140000_agendador_carteira_locacao`, APLICADA em 29/10:**
  - `pg_cron` às 09h45 UTC (6h45 em São Paulo) chama a Edge Function `carteira-locacao` por `pg_net`, com `x-agendador` (secret `AGENDADOR_CHAVE` da função = `carteira_agendador_chave` no Vault) e a anon key do Vault (`supabase_anon_key`);
  - antes disso os pagamentos só eram lidos com o botão "Atualizar" (o n8n das 6h30 grava só contratos e cobranças, e a regra das 12 h da função olhava a foto dele). Última leitura até então: 19/10;
  - teste em 29/10: status 200, 51 pagamentos de 20 a 28/10 gravados;
  - resposta de cada chamada em `net._http_response`.
- `imoveis_locados` e `proprietarios_locacao` **não são usadas**. Achado: `proprietarios_locacao` tem grant total para `anon` (sem policy) → Fase 1.

### 2.11 Estoque de imóveis (RF27, PRD §5.14) — **tabelas, carga e views APLICADAS em 09/10** (migration `20261009120000_estoque_imoveis`); `buscar_imoveis` ainda é proposta
Escrita só pela RPC `carregar_estoque_imoveis` (service role). Leitura direta das tabelas: **só `is_gestao()`**. O corretor (futuro) nunca lê a tabela: só a RPC `buscar_imoveis`, que devolve as colunas liberadas.
- **`imoveis_estoque`** (todo o cadastro, ~11 mil linhas; PK `(codigo, finalidade)`):
  - finalidade, situação, tipo, destinação;
  - bairro, cidade, uf, nome do condomínio;
  - latitude, longitude (só no servidor);
  - valor (null quando "Sob consulta"), valor/m², condomínio, IPTU;
  - quartos, suítes, banheiros, vagas, área principal, área do lote;
  - `caracteristicas text[]` (os booleanos verdadeiros: piscina, varanda gourmet, mobiliado…);
  - título, descrição curta, `fotos_qtd`, `foto_principal_url`, `tem_video`;
  - `exclusivo`, `placa`, `destaque`, `tem_proposta`, `tem_reserva`, `no_site`;
  - `captadores text[]` (nomes, principal primeiro) e `captadores_lido_em` (16/10): a lista não traz o captador; vem do detalhe (`App_RetornarDetalhesImovel`) e a carga diária não o apaga;
  - datas: `cadastrado_em`, `alterado_em`, `validado_em`, `situacao_em`, `vago_desde`;
  - `lido_em`.
  - **Endereço (revisto em 09/10, para achar duplicados):** `logradouro`, `numero`, `complemento`, `bloco`, `cep` e `endereco_chave`. A chave é gerada (rua sem acento, abreviação ou pontuação + número + complemento só com dígitos). Só a Gestão lê; a RPC `buscar_imoveis` continua sem devolver esses campos.
  - **Não guarda:** proprietário, anotações.
- **`estoque_cargas`**: id, finalidade, `quantidade_api`, `quantidade_lida`, iniciada_em, terminada_em. Uma linha por carga, para conferir se veio tudo. Só a Gestão lê.
- **Views** (security_invoker):
  - `vw_estoque_imoveis`: só as situações negociáveis, com `atualizado_em = greatest(alterado_em, validado_em)`, `dias_sem_atualizar`, `desatualizado` (> 45), `dias_em_estoque`;
  - `vw_estoque_captacoes_mensal`: captações por mês, finalidade e bairro;
  - `vw_estoque_duplicados` (09/10): grupos de imóveis da mesma finalidade com o mesmo `endereco_chave`, com pelo menos 1 negociável. Traz o grau de certeza: **alta** quando tipo, área (±5%) e quartos batem; **revisar** quando só o endereço bate. Base da planilha para o time.
- **RPC `carregar_estoque_imoveis(finalidade text, quantidade_api int, imoveis jsonb, publicados int[])`** (só service_role): recusa leitura incompleta (lidos ≠ `quantidade_api`), faz o upsert dos imóveis da finalidade (`'Aluguel'`/`'Venda'`, como vem da API), marca `no_site` pelos códigos publicados, guarda o `payload` (só campos simples, sem proprietários/anotações/descrição) e registra a carga em `estoque_cargas`. Auxiliares: `imoview_moeda`, `imoview_datahora`, `imoview_coordenada`, `endereco_tokens`, `endereco_chave`. Imóvel que sumiu da API fica com `lido_em` antigo e sai do estoque na view.
- **RPCs do captador** (migration `20261016120000_estoque_captadores`, aplicada em 16/10; só service_role):
  - `estoque_captadores_pendentes(limite)`: códigos em estoque com `captadores_lido_em` nulo ou anterior a `alterado_em`;
  - `gravar_captadores_estoque(itens jsonb)`: `[{codigo, captadores[]}]`, até 500; grava nas duas finalidades do código e marca `captadores_lido_em`;
  - `carregar_estoque_imoveis` passou a manter `captadores` quando a lista vem sem ele.
- **Busca do estoque** (migration `20261016150000_estoque_busca`, 16/10; substitui a `buscar_imoveis` planejada): duas funções `security definer` que conferem `papel_atual()` em (`corretor`, `gestao`) e dão erro 42501 para os outros papéis; `execute` só para `authenticated`.
  - `estoque_busca()`: a **ficha comercial** de todo o estoque (`vw_estoque_imoveis`, ~1.300 linhas): código, finalidade, situação, tipo, título, rua (sem número), bairro, cidade, condomínio, valores, áreas, quartos/suítes/banheiros/vagas, `caracteristicas text[]` (lista fechada de marcações do `payload` + `extra:<nome>` dos extras marcados), captadores, foto principal, `no_site`, `tem_video`, dias sem atualizar, `desatualizado`, `cadastrado_em`. **Nunca** devolve número, complemento, CEP, coordenadas, chaves, taxas, cartório nem o `payload`.
  - `estoque_bairros()`: bairro, cidade, quantidade e `vizinhos text[]` a até 2 km (pelo centro dos imóveis de cada bairro). Serve à "região" e à margem de 2 km sem expor coordenadas.
  - O filtro, as margens ("quase lá") e "o que mais restringe" rodam no navegador sobre essa ficha (`src/lib/buscaImoveis.js`): com ~1.300 imóveis a resposta é instantânea e as regras ficam testáveis.
- **Índices:** `(finalidade, situacao)`, `bairro`, `valor`, `quartos`.

### 2.12 Cadastros de locador (RF28, PRD §5.15) — **PROPOSTA, não aplicada**
Escrita só pela Edge Function `cadastro-locador` (service role). Leitura direta: **só `is_adm_ou_gestao()`**. Anon não lê nem escreve.
- **`cadastros_locador`**: `email` (locador), `locador jsonb` (nome, cpf, rg, nascimento, estado_civil, nacionalidade, profissao, celular, telefone, endereco completo), `conjuge jsonb` (nullable), `banco jsonb` (favorecido, cpf, banco, agencia, tipo_conta, numero_conta), `imovel jsonb` (endereco completo + administradora + telefone), `email_ok bool default false`, `created_at`.
- **Sem CPF em coluna própria:** fica dentro do jsonb (mesmo padrão dos locadores da carteira); nada de dado pessoal em índice ou view.
- **Edge Function `cadastro-locador`** (eventos `enviar`): valida obrigatórios + e-mail, insere, chama `notificar(['administrativo3@imovit.com.br'])` com o resumo e cópia ao locador, marca `email_ok`.

### 2.13 Distratos (RF29, PRD §5.16) — migration `20261014120000_distratos`, **APLICADA em 14/10**; Edge Function `distrato` v2 publicada; **só Gestão** desde `20261014130000_distratos_so_gestao` (policy "gestao le" e RPC com `is_gestao()`)
A escrita é feita só pela Edge Function `distrato` (service role). A leitura direta fica restrita a `is_adm_ou_gestao()`. O anon não lê nem escreve: o locatário só acessa pelo token, via função.

**Tabela `distratos`**
- Identificação: `id` uuid, `origem` (`hub` | `planilha`), `token` text unique (aleatório, 48 hex; obrigatório na origem `hub`, nulo nas importadas) e `contrato_codigo` (= `contratos_locacao.codigo`).
- `respostas_originais` jsonb: só na origem `planilha`, a linha da planilha como veio (os cadastros antigos, pedido de 14/10).
- Retrato do contrato no momento da criação:
  - `imovel_resumo`, `imovel_endereco`;
  - `locatario_nome`, `locatario_email`, `locatario_telefone`;
  - `contrato_inicio`, `contrato_fim`, `aluguel`.
- Controle: `criado_por` uuid (perfis), `created_at`, `expira_em` (created_at + 15 dias) e `status` (`link_enviado` | `aviso_recebido` | `cancelado`). "Expirado" é calculado.
- Ciência: `ciente_procedimento_em`.
- Aviso:
  - `aviso_em`: data e hora do servidor; é o aviso oficial;
  - `data_prevista_saida` (date);
  - `fim_aviso_previo` (aviso_em + 30 dias);
  - `dentro_prazo` (bool);
  - `contato_telefone`, `contato_email`.
- Motivo: `motivo` (lista do PRD §5.16, check), `motivo_detalhe` (text), `motivo_com_quem` (`imovit` | `outra_imobiliaria` | `proprietario_direto`, null; obrigatório em "Alugou/Comprou outro imóvel") e `motivo_fator` (text, null).
- Pesquisa:
  - `nps` (smallint 0–10, null);
  - `notas` (jsonb `{atendimento, manutencao, financeiro, comunicacao, estado_entrada}`, de 1 a 5);
  - `alugaria_de_novo` (`sim` | `talvez` | `nao`);
  - `comentario`.
- E-mail e cancelamento: `email_ok` (bool), `cancelado_em`, `cancelado_por`.
- Não guarda CPF.

**RPC `contratos_para_distrato(busca text)`**
- `security definer`. Exige `is_gestao()` (desde `20261014130000`); sem isso, devolve zero linhas.
- Devolve código, imóvel, endereço, locatário (nome, e-mail, telefone), início, fim e aluguel.
- Só contratos com `situacao = 'Ativo'`, até 20 linhas.

**Edge Function `distrato`**, eventos:
- `criar` (JWT gestão): copia o contrato e gera o token.
- `abrir` (token): devolve os dados do passo 1 ou o comprovante.
- `enviar` (token): valida, grava, manda e-mail **só** a `administrativo@` e o comprovante ao locatário, e marca `email_ok`. O proprietário não recebe nada.
- `cancelar` (JWT).
- `reenviar_email` (JWT, opcional).

### 2.14 Central de Cadastros (RF30, PRD §5.17) — **PROPOSTA, não aplicada**
Generaliza a §2.12: em vez de 1 tabela por formulário, **1 tabela `cadastros`** com `tipo` e jsonbs de papel genérico. Escrita só pela Edge Function `cadastro-locador` (service role, com o parâmetro `tipo`). Leitura direta: **só `is_adm_ou_gestao()`**. Anon não lê nem escreve.

- **`cadastros`**: `tipo` (check: `locador-pf`, `locador-pj`, `locatario-pf`, `locatario-pj`, `fiador-pf`, `fiadora-pj`), `email` (quem preenche), `pessoa jsonb` (PF: os 14 campos do locador; PJ: razão, cnpj, inscrições, contato + endereço), `acompanhante jsonb` nullable (cônjuge no PF; sócio administrador no PJ; representante na fiadora), `financeiro jsonb` nullable (banco no locador; empresa + salário + referências no fiador), `imovel jsonb` nullable (só locador), `destino text` (e-mail da equipe que recebeu), `origem` (`hub` | `planilha`, default `hub`), `email_ok bool default false`, `created_at`.
- **Sem CPF/CNPJ em coluna própria:** ficam dentro dos jsonbs (mesmo padrão da §2.12); nada de dado pessoal em índice ou view.
- **Migração da `cadastros_locador`:** as linhas existentes viram `tipo = 'locador-pf'` (`locador→pessoa`, `conjuge→acompanhante`, `banco→financeiro`, `destino = 'administrativo3@imovit.com.br'`, `origem = 'hub'`). A tabela antiga **não é apagada nem recebe escrita nova** (a função passa a gravar só em `cadastros`).
- **Importe do histórico:** script local (`scripts/importar_cadastros_planilha.mjs`) lê os CSVs exportados das planilhas e insere com `origem = 'planilha'` e `email_ok = true` (e-mail já foi pelo Google; não reenvia). O mapa de colunas fica no topo do script, ajustável por planilha. Roda com a service_role local do Eduardo; nada de chave no repo.
- **Edge Function `cadastro-locador`** (evento `enviar` + `tipo`): valida por tipo (zod discriminated union; sem `tipo` = locador-pf, compatível com o front já publicado), insere em `cadastros`, chama `notificar([destino_do_tipo, email_de_quem_preencheu])` com o resumo e o link de `/admin/cadastros`, marca `email_ok`. Destinos: locador-pf/pj → `administrativo3@`; fiador-pf → `administrativo@`; fiadora-pj → `pamela@`; locatários → a confirmar.

### 2.15 `vw_atendimentos_base` lê o estado da jornada — migration `20261015120000_vw_base_estado_jornada`, **APLICADA em 15/10**
- **Problema:** `dashboard_atendimentos_crm` não recebe mais as mudanças de fase e situação dos atendimentos já existentes. Em 15/10 eram 57 divergentes, e os painéis mostravam a fase antiga. Exemplos: 3 propostas do Gabriel Betti apareciam como Visita/Seleção; 2 negócios e 3 reaberturas não apareciam.
- **Correção (só a view):** `fase`, `situacao` e `data_encerramento` vêm da última linha de `crm_atendimento_jornada` de cada código (`order by codigo, id desc`, índice `crm_jornada_codigo_id`). Detalhes:
  - sem linha na jornada, vale a tabela (o mesmo vale para quem não lê a jornada, porque a view é `security_invoker`);
  - `data_encerramento` = `data_fechamento` da tabela ou `data_evento` da jornada; fica nula quando o atendimento está "Em atendimento";
  - mesmas colunas e ordem, então as `vw_*` dependentes seguem iguais.
- **Efeito em 15/10:** em atendimento de Qualificado a Proposta passou de 118 para 136.
- **Ainda lendo a tabela direto:** Kanban e TV continuam com a fase antiga. A correção definitiva é a RPC `registrar_atendimentos_crm` atualizar `dashboard_atendimentos_crm` (a "virada" do §2.6c), que ainda não foi feita.
- **Data dos descartes — migration `20261019120000_vw_base_data_descarte`, APLICADA em 19/10:** `data_encerramento` passou a seguir esta ordem:
  1. `data_fechamento` da tabela;
  2. se descartado, a data mais recente da interação "ATENDIMENTO descartado" em `payload.interacoes`;
  3. `data_evento` da jornada, só quando a última linha não é `primeira_leitura`;
  4. senão, nula (data desconhecida).
  - Antes, 2.493 descartes antigos ficavam com 06/10 (dia da carga) e outubro somava 2.635 descartes. Depois: 145 em outubro e 2.490 sem data. Negócios não mudaram (89; 3 em outubro).
  - Em 19/10, nenhum painel nem a `kpis_tv` usa `data_encerramento` dos descartes (só a dos negócios), então não muda nada na tela. A data vale para a análise de perdas (Fase 16).
- **Canais depois da limpeza de mídias do CRM — migration `20261027120000_vw_base_midias_crm_limpas`, **APLICADA em 27/10** pelo Eduardo no SQL Editor (antes: conferido que o banco tinha a versão de 19/10):** o Eduardo juntou as mídias no Imoview (67 → 19). As novas `Meta Ads` e `Lançamentos` caíam em "Outros" e entram em **"Campanhas pagas"**, para onde iam as mídias que elas absorveram (mantém o CPL de `performance_leads_pagos` comparável). Os nomes antigos continuam no `case`, porque o histórico segue gravado com eles. Única mudança: a linha de "Campanhas pagas".
  - ⚠ O mapa de canais é **por nome**: renomear mídia no CRM exige atualizar este `case` antes ou junto.
- **Furos do mapa de canais — migration `20261027130000_vw_base_furos_canal`, **APLICADA em 27/10** pelo Eduardo:** "Outros" foi de 111 para 57 (54 atendimentos; total antes = 3.034). Caíam em "Outros" sem ser. Site ganha `wpp_pag_imovel`, `site-wpp`, `site pagina imovel`, `site_imovel`; WhatsApp ganha `wpp_nao_identificado`, `severino`, `severino_desconhecido`, `chatbot imoview`; Indicacao ganha `indicação banco pine`. Continuam "Outros" de propósito: telefone, placas/faixas, stand, visita espontânea, tik tok, ca5083, vagas.
- **Mídias do site pago (migration `20261123140000_concilia_clique_site`, 23/11):** `site_google_ads` e `site_meta_ads` entram em "Campanhas pagas" no `canal` da `vw_atendimentos_base` (decisão do Eduardo: mesmo balde das campanhas; separar por plataforma fica para depois).

### 2.16 Onboarding de colaboradores (RF32, PRD §5.18) — migration `20261019200000_onboarding_colaboradores`, **APLICADA em 19/10**; Edge Function `onboarding` v1 publicada (`verify_jwt` desligado: a função confere o login sozinha)
A escrita é feita só pela Edge Function `onboarding` (service role). A leitura direta é **só `is_gestao()`**. O anon não lê nem escreve: o colaborador só acessa pelo token, via função. Mesmo padrão da §2.13 (Distratos).

**Tabela `onboarding_colaboradores`**
- Identificação: `id` uuid PK, `token` text unique (aleatório, 48 hex), `criado_por` uuid→perfis, `created_at`, `expira_em` (created_at + 15 dias).
- `status` check: `link_enviado` | `dados_recebidos` | `aprovado` | `concluido` | `cancelado`. "Expirado" é calculado (`expira_em < now()` e ainda `link_enviado`).
- Dados enviados pelo colaborador:
  - `nome_completo`, `telefone`;
  - `cpf`: text, só dígitos, com dígito verificador validado na função;
  - `creci_numero`, `creci_uf`;
  - `equipe`: check `locacao` | `venda`;
  - `endereco` jsonb `{cep, logradouro, numero, complemento, bairro, cidade, uf}`;
  - `data_nascimento` date, nula (só entra no formulário se a P1 for "sim");
  - `aceite_lgpd_em`, `enviado_em`.
- Aprovação: `email_imovit` (check `like '%@imovit.com.br'`), `id_corretor_crm` bigint, `aprovado_por` uuid→perfis, `aprovado_em`.
- Checklist manual: `marcacoes` jsonb, `{crm, repique, plantao, acesso_enviado}` → `{em, por}`. "Acesso enviado" é gravado pelo botão.
- `email_ok` (bool), `cancelado_em`, `cancelado_por`.
- **CPF e endereço só existem aqui.** Nada de view, índice ou cópia em `colaboradores_raw`.

**RLS e grants**
- RLS ligada; policy de SELECT `is_gestao()`. Sem policy de escrita: todo insert e update passa pela função.
- `revoke all on onboarding_colaboradores from anon, authenticated`; `grant select to authenticated` (a policy filtra).

**Aprovar → `colaboradores_raw`** (evento `aprovar` da função: primeiro o upsert, depois o status; não é uma transação única, mas o upsert é idempotente e pode ser repetido)
- Recusa se `id_corretor_crm` já existe com outro `email_oficial`, ou se `email_imovit` já existe com outro código.
- Upsert por `id_corretor_crm`:
  - `nome_completo`, `email_oficial = email_imovit`;
  - `telefone_whats` formatado `(DD) 9XXXX-XXXX`;
  - `equipe = 'comercial'`, `cargo` = `locação` | `vendas`;
  - `data_nascimento`;
  - `data_admissao = aprovado_em::date`; não sobrescreve se já houver data;
  - `ativo = true`, `atualizado_em = now()`.

**Checklist calculado na leitura** (front, só gestão): junta `onboarding_colaboradores` com `colaboradores_raw` (por `id_corretor_crm`) e `perfis` (por `lower(email)`). Login = existe perfil. Nível = `perfis.role = 'corretor'`. Nada disso é gravado.

**Edge Function `onboarding`**, eventos:
- `criar` (JWT gestão): gera o token e devolve o link.
- `abrir` (token): diz se o link vale (ou se já foi enviado, expirou ou foi cancelado). Não devolve dados.
- `enviar` (token): valida (CPF, CEP, telefone, equipe, aceite), grava, muda para `dados_recebidos` e manda e-mail para `eduardo@imovit.com.br` (quem cria o e-mail e o Imoview) via `notificar`: só o nome e o link da ficha, **sem CPF no e-mail**.
- `aprovar` (JWT gestão): e-mail @imovit + código → upsert em `colaboradores_raw` → `aprovado`.
- `marcar` (JWT gestão): liga ou desliga uma marcação manual. "Concluído" é calculado na tela (todas as 10 etapas feitas); o status `concluido` fica reservado e não é gravado na v1.
- `cancelar` (JWT gestão).

**Em aberto (PRD P3):** prazo para apagar CPF e endereço depois do desligamento.

### 2.16b Fase 8 (Agendamento) nas views do funil — migration `20261028120000_fase_8_agendamento`, **APLICADA em 28/10** pelo Eduardo no SQL Editor (antes: teste em `BEGIN … ROLLBACK`; depois: 5735 e 6483 com `fase_ordem` 4 na view base)
- O Imoview tem **8 = Agendamento** (doc da API). Desde 28/10 a jornada lê a fase 8 (nó "Montar consultas" v2, `docs/n8n/crm_jornada_diaria_v3__montar_consultas_v2.js`). Em 28/10: 5 ativos (6462, 6465, 6483 aluguel; 5735, 6127 venda) e 25 descartados.
- `vw_atendimentos_base`, `vw_jornada_etapas` e `vw_jornada_descartes` ganham `when 8 then 4`: no Hub, Agendamento = etapa **"Lead qualificado"** (decisão do Eduardo, 28/10). O código cru 8 fica em `fase_crm` e na coluna `fase`.
- Efeito conhecido: a passagem 7 → 8 divide o tempo em "Lead qualificado" em duas linhas na `vw_jornada_etapas`.
- Ainda sem a fase 8: `FASES_FUNIL` do Kanban (`src/lib/atendimentos.js`). Hoje não importa, porque o Kanban lê a tabela antiga, que não tem a 8; entra na Fase 24, S3.

### 2.17 Jornada vira a fonte única dos atendimentos (Fase 24, achados A1/A5/A7) — migration `20261029130000_fonte_unica_jornada`, **APLICADA em 29/10**
- **Aplicado:**
  - `meus_codigos_crm()` (security definer): códigos cuja **última** linha na jornada é do corretor logado;
  - policies "equipe le; corretor so os seus" de `crm_atendimento_jornada`, `atividades` e `leads_wpp_gtm` por essa função (o dono atual vê o lead e o histórico; o anterior, nada);
  - `vw_atendimentos_base` com a lista de leads da jornada;
  - `vw_jornada_etapas` com a data de entrada pelo payload;
  - `kpis_tv` com `crm_atualizado_ate` = `max(crm_leituras.dia)`.
- **Teste antes de aplicar (BEGIN … ROLLBACK):** total 5.194, ativos 218; corretor simulado (Patrícia Macedo) vê 564 = os dela e 0 de outros; TV com a data de hoje.
- `dashboard_atendimentos_crm` fica só como **reserva** (data de entrada, data de fechamento e `id` dos leads antigos). Nenhuma tela a lê.
- **Só leitura desde 09/11** (Fase 24 E5, migration `20261109120000_crm_antigo_somente_leitura`): `revoke insert, update, delete, truncate` de `anon`, `authenticated` e `service_role`; `select` mantido (a view ainda lê). Só o `postgres` (dono) escreve. Desfazer: `grant ... to service_role`.
- Texto da proposta (28/10):
- **Problema (auditoria de 27/10, `07-mapa-de-dados.md` §6.1):** `vw_atendimentos_base` tira *quais leads existem* (código, entrada, corretor, mídia, finalidade, data do negócio) de `dashboard_atendimentos_crm` e *em que fase estão* de `crm_atendimento_jornada`. O fluxo antigo só busca "o que mudou desde ontem" e não recupera o que perdeu:
  - **14 clientes ativos** estão só na jornada e somem de painéis e Kanban (A7);
  - **47 leads** têm a fase errada no Kanban e em Dados de Atendimento, que leem a tabela antiga direto (A1). Dos 8 conferidos no CRM, a jornada acertou os 8.
- **Decisão (Eduardo, 28/10):** a jornada passa a ser a **fonte única**. A tabela antiga vira arquivo morto (não é apagada).
- **De onde vem cada coluna na view nova:**

  | Coluna | Hoje | Proposta |
  |---|---|---|
  | lista de leads | tabela antiga | `distinct codigo` da jornada |
  | fase, situação | jornada (desde 15/10) | jornada (igual). **Agendamento** (fase criada no Imoview depois de 29/09, código a confirmar) entra na etapa "Lead qualificado" do Hub (Eduardo, 28/10) |
  | corretor, mídia, finalidade, funil, campanha | tabela antiga | última linha da jornada (a foto mais recente do CRM) |
  | data de entrada | tabela antiga | `payload->>'datahoraentradalead'` da última linha com payload — **a confirmar (Fase 24, S1)** |
  | data do negócio | `data_fechamento` da tabela | interação "NEGÓCIO REALIZADO … datahora" em `payload.interacoes` (o campo `datafechamento` do payload vem sempre vazio); reserva: `data_fechamento` da tabela antiga, depois `data_evento` quando não for `primeira_leitura` |
  | `id` | `dashboard_atendimentos_crm.id` | a confirmar quem usa; se ninguém, `codigo` |

- **Como trocar sem risco:**
  1. criar `vw_atendimentos_base_v2` ao lado da atual;
  2. comparar as duas número a número;
  3. `create or replace` da oficial com as mesmas colunas e a mesma ordem (as `vw_*` dependentes e a `kpis_tv` seguem iguais);
  4. Kanban e Dados de Atendimento passam a ler a view;
  5. pausar o `crm_atendimentos` por alguns dias e então desligar.
- ⚠ O mapa mídia → canal continua **por nome** (§2.15). Com a jornada, a mídia é a do CRM de hoje (nomes já limpos em 27/10). O `case` mantém os nomes antigos para o histórico.

### 2.18 Alerta de leitura que falhou — migration `20261029150000_alerta_leituras`, **APLICADA em 29/10**; Edge Function `alerta-leituras` publicada
- **`saude_leituras()`** (security definer, só `service_role`): uma linha por leitura com `fonte`, `ultima`, `ok` e `o_que_fazer`. Tolerâncias:
  - CRM (`crm_leituras.dia`), carteira (`contratos_locacao_fotos.lido_em`) e receita (`net._http_response` 200 com `"atualizado":true`): hoje;
  - atividades: desde ontem;
  - Meta e Google: hoje − 2.
- **`pg_cron` "alerta-leituras"** às 10h15 UTC (7h15 SP), todos os dias. Chama a função com os segredos do agendador da carteira (Vault).
- A função manda e-mail pelo Brevo **só para eduardo@** e **só quando há falha**; `{ "teste": true }` envia sempre. Teste em 29/10: e-mail recebido.
- ⚠ `net._http_response` guarda ~6 h: a checagem da receita depende de rodar até ~12h45 (SP).
- Reaproveitada no aviso do topo do e-mail diário da Diretoria (v1, PRD §5.19).

### 2.19 E-mail diário da Diretoria, v1 (PRD §5.19) — migration `20261029160000_boletim_diretoria`, **APLICADA em 29/10**; Edge Function "boletim-diretoria" (**endereço `rapid-worker`**) publicada
- **`boletim_diretoria(p_hoje)`** (definer, só `service_role`): placar do mês até ontem × mês anterior até o mesmo dia (investido Meta+Google, leads, negócios, administração + intermediação recebidas), em atendimento agora, ontem (na segunda: sexta a domingo), atenção (esquecidos 🔴 e perto do dinheiro) e `saude_leituras()`. Sem ruído e sem captação.
- **Esquecido 🔴:** ativo além do prazo na etapa (locação 3, venda 7; dias desde o último evento de etapa `entrada`/`mudanca_etapa`/`reabertura`), sem atividade realizada no prazo e sem atividade agendada.
- **`boletim_diretoria_fotos`** (dia, dados): o que foi enviado; base da variação "vs ontem". Só `service_role`.
- **`pg_cron` "boletim-diretoria"** `30 10 * * 1-5` (7h30 SP, seg–sex) chama `/functions/v1/rapid-worker`.
- Conferido em 29/10 com a prévia: leads 200, em atendimento 182, perto do dinheiro 34 e receita R$ 141 mil batem. **Esquecidos 143 × 142 da página de Atendimento: falta alinhar a regra de borda com o SQL do Pareto.**
- E-mail `{ "teste": true }` recebido por eduardo@ em 29/10.

### 2.20 Processo de Locação (RF33, PRD §5.20, aprovado 30/10) — tabelas criadas fora do repo em 30/10 e **regularizadas pela migration `20261103120000_processo_locacao`, APLICADA em 03/11**. Passou no teste `BEGIN … ROLLBACK` (32/32), está registrada em `schema_migrations` e os dados foram mantidos (9 papéis, 42 etapas).
As 3 tabelas foram criadas pela página HTML da Direção, sem migration. A migration `2026110xxxxxxx_processo_locacao` só **regulariza**: usa `create table if not exists`/`alter`, nunca drop, e mantém os dados.

**Inventário real (03/11, SQL de leitura rodado pelo Eduardo no SQL Editor).** Dados existentes: 9 papéis, 42 etapas e 0 casos. Ainda **não conferidos**: FKs, checks e índices (próxima consulta).
- **`locacao_papeis`:**
  - `id` text, padrão `gen_random_uuid()::text`;
  - `nome` text;
  - `cor` text, padrão `'#7a8a99'`;
  - `externo` bool, padrão false;
  - `responsaveis` text, padrão `''`;
  - `ordem` numeric, padrão 0;
  - `atualizado_em` timestamptz, padrão now().
- **`locacao_etapas`:**
  - `id` text, padrão uuid::text;
  - `processo` text (`contrato` | `adm`);
  - `grupo` text, padrão `'Sem fase'`: fase, ou fluxo quando `adm`;
  - `titulo` text;
  - `papel` text, nulo → `locacao_papeis.id`;
  - `canal` text, padrão `''`;
  - `prazo` int, nulo (dias úteis);
  - `detalhes`, `decisao` e `melhoria`: text, padrão `''`;
  - `checklist` jsonb, padrão `[]`;
  - `ordem` numeric, padrão 0 (aceita meio-termo);
  - `atualizado_em`.
- **`locacao_casos`:**
  - `id` **uuid**;
  - `processo` text;
  - `fluxo` text, nulo;
  - `imovel` text;
  - `partes` e `esteira`: text, padrão `''`;
  - `etapa_id` **text**, nulo → `locacao_etapas.id`;
  - `status` text, padrão `'andamento'` (`andamento` | `concluido` | `cancelado`);
  - `inicio` e `desde`: timestamptz, padrão now();
  - `fim` e `motivo`: nulo;
  - `feitos` jsonb, padrão `{}` (`{etapa_id: [índices]}`);
  - `historico` jsonb, padrão `[]` (`[{em, texto}]`);
  - `criado_por` uuid, padrão `auth.uid()`;
  - `atualizado_em`.

**Segurança atual (03/11):**
- RLS ligada nas 3 (não forçada).
- anon sem grant: a REST responde `42501`.
- `authenticated` tem **todos** os privilégios de tabela, inclusive TRUNCATE, TRIGGER e REFERENCES.
- Realtime ligado nas 3.
- Policies:
  - papéis e etapas: SELECT com `is_team()`; ALL com `is_adm_ou_gestao()`;
  - casos: SELECT, INSERT e UPDATE com `is_team()`; DELETE com `is_adm_ou_gestao()`.
- `is_team()` (repo `20260928180000`): tem perfil e `suspenso_em is null`, **qualquer role**, inclusive `user` e `tvaccess`.

**Diferenças para a RLS desejada (todas corrigidas em 03/11 pela `20261103120000`):**
1. A leitura de papéis e etapas usa `is_team()`, que deixa `user` e `tvaccess` lerem. Deve ser só gestão, adm, corretor e marketing.
2. Em `locacao_casos`, o time inteiro cria e edita. Deve ser só `is_adm_ou_gestao()`. São 0 linhas, então não há dado afetado. Porém, um corretor que tentar abrir um caso na página da Direção passará a receber erro.
3. Revogar TRUNCATE, TRIGGER e REFERENCES do `authenticated`. TRUNCATE ignora a RLS. Hoje não é alcançável pela API, e a revogação é defesa em profundidade.

RLS desejada (decisão de 30/10, PRD §5.20 D3/D5):
- `locacao_papeis` e `locacao_etapas`: leitura pelo time ativo (gestão, adm, corretor, marketing); escrita só `is_adm_ou_gestao()`.
- `locacao_casos`: só `is_adm_ou_gestao()`. Não tem tela na v1; na v2 os casos serão abertos pela aprovação da proposta na Esteira.
- `user`, `tvaccess` e anon: nada.
- Realtime ligado em papéis e etapas (a página da Direção e o Hub dependem disso).

### 2.21 Dados bancários do onboarding (RF32.7–10, PRD §5.18b) — migration `20261104120000_onboarding_dados_bancarios`, **APLICADA em 04/11** (antes: `BEGIN … ROLLBACK` 21/21); Edge Function `onboarding` v3 publicada
Tabela à parte da §2.16 porque a RLS é por linha: o ADM precisa ler os dados bancários e não pode ler o CPF e o endereço.

**Tabela `onboarding_dados_bancarios`** (0 ou 1 linha por onboarding)
- `onboarding_id` uuid PK → `onboarding_colaboradores(id)` on delete cascade.
- Conta (os 4 juntos, ou nenhum):
  - `banco` text (código COMPE de 3 dígitos + nome, ex.: `341 · Itaú`);
  - `agencia` text, check `^\d{1,5}(-[0-9Xx])?$`;
  - `conta` text, check `^\d{1,13}-[0-9Xx]$` (com dígito);
  - `tipo_conta` text, check `corrente` | `poupanca`.
- PIX (os 2 juntos, ou nenhum):
  - `pix_tipo` text, check `cpf` | `celular` | `email` | `aleatoria`;
  - `pix_chave` text.
- `informado_em` timestamptz default now().
- Checks: conta completa ou vazia; PIX completo ou vazio; pelo menos um dos dois (linha vazia não é gravada).

**RLS e grants**
- RLS ligada; policy de SELECT `is_adm_ou_gestao()`. Sem policy de escrita: só a função `onboarding` (service role) grava.
- `revoke all … from anon, authenticated`; `grant select to authenticated` (a policy filtra).

**RPC `dados_bancarios_colaboradores()`** (security definer, `search_path = public`)
- Recusa (42501) quem não é `is_adm_ou_gestao()`.
- Devolve: `onboarding_id`, `nome_completo`, `equipe`, `status`, `email_imovit` e os campos bancários. **Sem CPF nem endereço.**
- Só onboardings não cancelados que têm linha bancária. `grant execute` só para `authenticated`.

**Edge Function `onboarding`** (v2)
- `enviar`: aceita `dados_bancarios` opcional. Com ele, grava a linha na mesma chamada, depois do update do onboarding.
- `enviar_bancarios` (token, novo): só quando o status é `dados_recebidos` ou `aprovado`, o link não venceu e ainda não existe linha bancária. Insere e pronto (uso único).
- `abrir`: devolve também `falta_bancario` (bool), para a página mostrar só a seção bancária. Sem devolver dado nenhum.
- A chave PIX do tipo `cpf` tem de ser igual ao `cpf` do onboarding. Celular → `+55DDXXXXXXXXX`; e-mail em minúsculas; aleatória = UUID.
- Dado bancário nunca vai para e-mail nem para `console.log`.

**Edição (PRD §5.18b B7–B8)**: migration `20261104170000_dados_bancarios_edicao`, testada em `BEGIN … ROLLBACK`.
- Colunas novas: `atualizado_em` timestamptz e `atualizado_por` uuid → perfis (on delete set null).
- A RPC foi recriada com `atualizado_em` e `atualizado_por_nome`.
- Função `onboarding` v4: `editar_bancarios` (JWT gestão/adm; mesmas regras do `normalizarBancario`; grava quem e quando) e `excluir_bancarios` (JWT gestão/adm; apaga só a linha bancária).
- Continua sem policy de escrita: no teste, o ADM recebeu 42501 ao alterar ou apagar direto na tabela.


### 2.22 Saúde Imovit — fonte, cálculo e régua de cada número (Fase 29a S1, PRD §5.23) — **DOCUMENTO 23/11; v2 período livre 24/11 — APLICADA em 24/11 (valor fechado)**
Queries de conferência (só leitura, numeradas Q1–Q12): `docs/sql/saude_semanal_gabarito_2026-11-23.sql`. Conferidas pelo Asimov em 23/11 nas 2 semanas fechadas: **S−2 = 09–15/11** e **S−1 = 16–22/11**.

**Convenções**
- **Quem vê (Eduardo, 23/11):** só **Gestão e Marketing**, pela função nova `pode_ver_saude()` (a `pode_ver_dash()` inclui corretor, não serve). O Marketing vê a página inteira, inclusive os **totais** da Carteira e a receita: a função devolve só somas, nunca contrato, inquilino ou lead. A RLS das tabelas da Carteira continua só Gestão (decisão de 07/10 vale para o detalhe).
- **Semana** = segunda a domingo, fuso America/Sao_Paulo. A página abre na última semana fechada.
- **Régua:** **entrada** = leads que entraram no período (coorte); **evento** = o que aconteceu no período, pela data do fato; **agora** = foto do momento (para semana passada, a foto do domingo).
- **Referência:** a semana anterior e a **média das N semanas anteriores** (até 8; rótulo "média de N semanas"; a semana atual não entra na média). Com menos de 5 casos no número → **"acumulando"**, sem sinal.
- **Decisões D1–D12 fechadas pelo Eduardo em 23/11** (lista no `handoff.md`): `datanegocio` + "semana revisada"; por negócio; receita com intermediação; qualificados em 7 dias; custo por qualificado em 4 semanas; visitas de `atividades`; gargalo = mais parados agora; dinheiro na mesa só Proposta, locação = 1 aluguel; adm do mês × mês anterior até o mesmo dia; sinal invertido para atraso e saídas; foto semanal; cor só com média ≥ 5.
- **Sinal:** verde = na média ou acima · amarelo = até 15% abaixo · vermelho = mais de 15% abaixo. **Só quando a média for ≥ 5** (D12); abaixo disso, número + média + "⚪ poucos casos". **Invertido** (mais = pior) para custo por qualificado, R$ em atraso e saídas avisadas (D10, decidido 23/11).
- Sempre `not is_ruido and not is_interno` nos números de atendimento.

**Números**

| # | Número | Régua | Fonte e cálculo | S−2 (09–15/11) | S−1 (16–22/11) |
|---|---|---|---|---|---|
| P1 | Negócios fechados | evento | `crm_atendimento_jornada.payload→imoveisnegocio` da última linha de cada atendimento; 1 por `codigonegocio`, `situacaonegocio = 'Realizado'`, pela `datanegocio` (Q1). **D1 (23/11):** quando um negócio é lançado depois do fim da sua semana, a semana aparece com o aviso "semana revisada" (compara com a foto semanal do S2) | **1** (locação) · ant 3 · média 1,50 → 🔴 | **1** (venda) · ant 1 · média 1,25 → 🔴 |
| P2 | Receita da semana | evento | comissão bruta (`valorcomissao`) das **vendas** de P1 + `contratos_locacao_recebimentos.taxa_adm` + **`taxa_intermediacao`** (D3, 23/11), por `data_pagamento`, com as 3 partes visíveis (Q2) | **R$ 11.814,33** (adm 5.064,33 + intermediação 6.750) | **R$ 90.833,81** (venda 73.000 + adm 17.833,81) |
| A1 | Leads que chegaram ao CRM | entrada | `vw_atendimentos_base` por `data_entrada` (Q3) | **18** · ant 31 · média 41,0 → 🔴 | **33** · ant 18 · média 38,5 → 🟡 |
| A2 | % qualificados | entrada (coorte) | qualificou (1ª passagem com `posicao ≥ 4` em `vw_jornada_etapas`) **em até 7 dias** da entrada ÷ leads da semana (Q4). Média só com coortes desde 12/10 | **22,2%** (4/18) · média 41,2% (N=4) → 🔴 | **33,3%** (11/33) **parcial até 29/11** · média 37,4% (N=5) → 🟡 |
| A3 | Custo por qualificado | evento ÷ entrada | gasto `dashboard_meta_ads` + `dashboard_google_ads` ÷ qualificados em 7 dias de `canal = 'Campanhas pagas'` (Q5) | R$ 1.282,13 ÷ 0 → **acumulando** · 4 semanas: R$ 876,86 | R$ 1.360,90 ÷ 3 → **acumulando** · 4 semanas: R$ 857,63 |
| C1 | Visitas | evento | `atividades`: `nometipo = 'Visita'`, `realizada`, por `datahorainicio` (Q6) | **6** · ant 8 · média 7,1 → 🔴 (−16%) | **2** · ant 6 · média 7,6 → 🔴 |
| C2 | Etapa gargalo + parados | agora | `vw_jornada_etapas`: mediana de dias por etapa (passagens que entraram nas últimas 8 semanas; abertas contam até hoje); gargalo = etapa com mais ativos acima da mediana (Q7) | não reconstruível (sem foto) | **23/11:** Lead qualificado, **83 de 98** acima de 16 dias |
| C3 | Dinheiro na mesa (receita Imovit) | agora | ativos em Proposta (`fase_ordem = 6`) com `payload→imoveisproposta`: venda = proposta aberta (ou valor do imóvel) × 4,68%; locação = **1 mês de aluguel** (valor da intermediação; D8, 23/11; depois transicionar para taxa de adm) (Q8) | não reconstruível | **23/11: R$ 363.803** em 7 propostas (venda 347.303 + locação 16.500; R$ 281.903 sem o 5716, ver alertas) |
| K1 | Taxa de adm recebida no mês | evento | `contratos_locacao_recebimentos.taxa_adm`, do dia 1 até o domingo; referência proposta = mês anterior até o mesmo dia (Q9) | **R$ 26.737,30** × out R$ 59.292,81 → 🔴 | **R$ 44.571,11** × out R$ 70.674,33 → 🔴 |
| K2 | R$ em atraso | agora (foto do domingo) | `contratos_locacao_fotos.inadimplentes_valor` (regra do Imoview; foto desde 11/10) (Q10) | **R$ 431.881,32** (9) · média 286.459,85 (N=5) → 🔴 invertido | **R$ 476.838,52** (18) · média 310.696,76 (N=6) → 🔴 invertido |
| K3 | Saídas avisadas | agora (reconstruído no domingo) | `contratos_locacao`: `data_aviso_desocupacao ≤ domingo` e não rescindido até o domingo, sem cancelados (Q11) | **10** (0 novos) · média 10,8 → 🟢 invertido | **9** (1 novo) · média 10,8 → 🟢 invertido |

**Detalhe granular (formato decidido em 23/11, PRD §5.23)** — mesmas convenções; queries Q13–Q17 no gabarito.

| Bloco | Régua | Fonte e cálculo | S−1 (16–22/11) |
|---|---|---|---|
| 1.1 Por campanha | evento | `dashboard_meta_ads` + `dashboard_google_ads` por `campanha`: investimento, impressões, cliques, CTR, CPC, `leads_conversoes`, custo por lead na plataforma (Q13) | Google Locação R$ 1.024,80 / 9,7 · Meta Locação R$ 303,80 / 20 · Brand R$ 32,30 / 20,7 ⚠ |
| 1.2 Plataforma → CRM | evento → entrada | soma de `leads_conversoes` → leads `canal = 'Campanhas pagas'` → qualificados em 7 dias (Q14) | 50,4 → 8 → 3 · custo por lead no CRM R$ 170,11 |
| 1.3 Por canal e mídia | entrada | `vw_atendimentos_base` por `canal`, `midia_raw`, `finalidade` + qualificados em 7 dias (Q15) | OLX 10 · Pagos 8 · Indicação 7 · Site 5 · WhatsApp 2 · Instagram 1 |
| 1.4 Orgânico | evento | **fase 29e**: tabelas novas `organico_diario` (data × rede × métrica, upsert) e `organico_posts`, ao lado dos leads orgânicos do CRM por rede | — (até a 29e, só leads do CRM) |
| 2.1 Entrada × saída | entrada / evento | leads (Q3), qualificados (Q4), visitas (Q6), descartados da semana (`vw_jornada_descartes.descartado_em`), negócios (Q1) | 33 · 11 · 2 · **3** (corrigido 24/11; o 12 era de 13/11) · 1 |
| 2.2 Funil agora | agora | Q7, todas as etapas | gargalo Lead qualificado 83/98 |
| 2.3 Ativos por canal | agora | `is_ativo` e `dias_parado > 30` por `canal` (Q16) | Indicação 60 (46) · Site 39 (26) · Portais 26 (10)… |
| 2.4 Canais que descartam | entrada (coorte 8 semanas) | dos leads que **entraram** em 8 semanas: descartados, % descarte, qualificados, perdidos após qualificar, motivo principal (Q17). ⚠ Não misturar com descartes **da** janela (evento): passa de 100% | Pagos 76%, 15 de 20 qualificados perdidos (não responde) · Indicação 25% |
| 2.5 Dinheiro na mesa | agora | Q8 | R$ 363.803 |

**Alertas de dado (23/11)**
- **Plataforma × CRM:** 50,4 leads nas plataformas × 8 pagos no CRM (16%). O Brand (Google) marca 20,7 conversões com R$ 32: provável conversão que não é lead. Conferir a ação de conversão no Google Ads.
- **Repique como motivo de descarte** (8 no Site em 8 semanas): repassar o lead não deveria virar descarte; conferir o fluxo de repique.
- **`campanha_locacao` com finalidade Venda** (3 em S−1): classificação antiga pela palavra; corrigida para os leads novos desde 23/11 (§29b).
- **Captura do CRM com buracos:** sem leitura em 10–12/11 e 18–22/11. Entradas usam a data real (`datahoraentradalead`), mas **mudanças de etapa caem no dia em que a leitura volta** (13/11 = 17; 23/11 = 23). Por isso as visitas vêm de `atividades`, e o A2 de S−1 pode subir quando as datas forem 23/11.
- **`datanegocio` × base:** a `vw_atendimentos_base` usa a data do **registro** do negócio (interação) e conta 1 por atendimento. Casos: 6383 negócio de 19/10 registrado em 10/11; 6427 com 2 negócios. O placar usa `datanegocio` e conta por negócio.
- **Jornada antes de 06/10:** coortes anteriores saem com 0% em A2 e não entram na média.
- **Leads pagos subcontados até 23/11:** os leads do Google pelo site entravam como "Site" (conciliação no ar desde 23/11, §29b); A3 histórico fica alto.
- **C3:** o atendimento 5716 está em Proposta com imóvel "Vendido" e negociação cancelada (R$ 81.900 na conta).
- **K1:** novembro bem abaixo de outubro; dias sem pagamento em 14–15 e 20–22/11 (fim de semana e feriado de 20/11). Parece real, conferir com o financeiro.
- **A1 de S−2 = 18** é o menor da série (média 41): conferir no CRM.

**S2 v2 — período livre (Eduardo, 24/11). Migration `20261123170000_saude_imovit` REESCRITA, testada em `BEGIN … ROLLBACK` e APLICADA em 24/11** (registrada no banco como `20261124110548 saude_imovit`; aplicada sem os comentários de linha, mesmo SQL). Substitui a versão de semana fixa (`saude_semanal(p_semana)` e `saude_serie()` deixam de existir; nunca foram aplicadas).
- **Convenções novas:** período = `p_inicio`…`p_fim` (padrão 30 dias até ontem; máx. 366); **anterior = mesmo nº de dias logo antes**; `p_finalidade` = `todas` | `locacao` | `venda`. Números de período comparam com o anterior; números "agora" comparam com a semana anterior e a média de 8 semanas. A tabela de números acima continua válida como fonte e cálculo; a coluna "régua" também.
- **Finalidade:** atendimentos por `vw_atendimentos_base.finalidade` ('Aluguel'/'Venda'); negócios pela finalidade do negócio no CRM; mídia paga pelo nome da campanha (`~* 'loca'` → locação, `~* 'vend'` → venda; Brand e Engajamento só em "todas"); taxa de adm e intermediação só em locação; Carteira some em "venda". Visita sem atendimento só conta em "todas".
- **Peças:**
  - `pode_ver_saude()` (Gestão + Marketing).
  - `saude_sinal(v, ref, invertido, minimo, casos)` e `saude_num(v, ant, regua, invertido, minimo, media, n, casos)`: ref = média quando houver, senão o anterior; `invertido = null` → "neutro" (investimento); cor só com base ≥ `minimo` (D12; contagens 5, valores em R$ 0).
  - `saude_negocios()` (D1/D2, igual).
  - **`saude_linhas(p_ini, p_fim, p_fin)`** (interna): 1 linha por `nivel` × `pai` × `chave` com investimento, impressões, cliques, conversões na plataforma, leads, qualificados (7 dias, D4), visitas (`atividades`, D6), **propostas** (1ª entrada na posição 6), descartados, negócios (venda do CRM + **contratos de locação iniciados**, desde a migration `20261124120000`, aplicada em 24/11), comissão de venda, taxa de adm, intermediação, **`vgv_venda`** (soma de `valornegocio` das vendas, por canal), **`aluguel_locacao`** e **`contratos_locacao`** (contratos iniciados no período, sem canal). Níveis: `total`, `finalidade`, `canal`, `midia` (pai = canal), `plataforma`, `campanha` (pai = plataforma), `anuncio` (pai = campanha, só Meta). O total e o canal "Campanhas pagas" recebem os números das plataformas.
  - `saude_linha(a, b, parcial)`: junta atual × anterior de uma linha em jsonb (cada número com valor, anterior, variação, sinal) + derivados: CTR, CPC, custo por conversão na plataforma, % qualificados, **`valor_fechado`** (venda + locação, partes e anteriores, com a `regra`) e **`receita_referencia`** (comissão de venda · adm · intermediação + anteriores, fora da manchete); custo por lead no CRM e por qualificado só na linha "Campanhas pagas".
  - `saude_agora(p_fin)`: atendimentos em aberto, funil, gargalo (D7), ativos por canal, dinheiro na mesa (D8), por finalidade. **Mesa desde 24/11 em valor fechado:** `total`/`venda`/`locacao` = proposta (ou imóvel) e 1 aluguel; `receita_referencia` guarda a conta antiga (venda × 4,68% + 1 aluguel).
  - `saude_carteira_em(d)`: contratos ativos, R$ em atraso (foto diária `contratos_locacao_fotos`) e saídas avisadas (reconstruídas) numa data.
  - Tabela `saude_fotos` (semana, `agora` = {todas, locacao, venda}, `placar`; RLS sem policy) + `saude_tirar_foto()` + `pg_cron` "saude-foto-semanal" `30 2 * * 1` (domingo 23h30 SP). Foto inicial de 16/11 tirada na aplicação.
  - **`saude_imovit(p_inicio, p_fim, p_finalidade)`** → jsonb: `periodo`, `revisadas` (D1), `cabecalho` (negócios, **`valor_fechado`** = manchete, `receita_referencia`, investimento, atendimentos em aberto), `performance` (total pago, por plataforma/campanha/anúncio/mídia paga), `comercial` (total, por finalidade/canal/mídia, `agora` com referência das fotos), `carteira` (taxa adm, intermediação, contratos ativos, atraso, saídas, contratos do trimestre), `midias_sociais` e `ga4` = "aguardando captura", `leituras`.
  - Só `saude_imovit` e `pode_ver_saude` têm execute para `authenticated`; as internas e `saude_fotos` não.
- **Contrato no último trimestre (CONFIRMADO, Eduardo 24/11):** contratos com `data_inicio` nos 3 meses até a data fim × os 3 meses anteriores, sem cancelados; também devolve os novos dentro do período.
- **Custo por qualificado (CONFIRMADO, Eduardo 24/11):** investimento do período ÷ qualificados pagos do período (só na linha "Campanhas pagas").
- **Valor fechado (Eduardo, 24/11, padrão do Km 32):** venda = `valornegocio` (VGV) dos negócios do CRM pela `datanegocio` (D1/D2); locação = `contratos_locacao.valor_aluguel` dos contratos com `data_inicio` no período e `situacao <> 'Cancelado'` (igual ao `campanha_resumo`, migration `20261019180000`). Taxa de adm do bloco Carteira continua igual. A `foto` semanal guarda `valor_fechado`, `vgv_venda`, `aluguel_locacao`, `contratos_locacao` e a receita; `revisadas` compara valor fechado, negócios e receita.
  - **Divergências com o Km 32 (registradas, 24/11):** (1) data da venda: Km 32 usa a interação "NEGÓCIO REALIZADO"; a Saúde usa `datanegocio` (D1). (2) ~~Contagem de negócios de locação do CRM~~ **RESOLVIDA (Eduardo, 24/11): a locação conta por contratos iniciados, igual ao Km 32.** Era: contagem do CRM e valor dos contratos, eventos diferentes (09–15/11: CRM 6538, R$ 6.800, 09/11 × contrato 1825, R$ 7.200, 10/11; 16–22/11: 0 no CRM × contrato 1829, R$ 9.000, Moderação).
  - **Migration `20261124120000_saude_negocios_locacao_por_contrato` (testada em `BEGIN … ROLLBACK` e APLICADA em 24/11 como `20261124151431`, com a correção do placar da foto de 16/11):** só `create or replace` de `saude_linhas()`. O evento `negocio` (CRM) fica só com `finalidade <> 'Aluguel'`, e `negocios = count(negocio) + count(contrato)`. `saude_tirar_foto()` e `revisadas` leem `l.negocios`, então foto e comparação seguem sem outra mudança. Contrato não tem canal: a locação entra no total e na finalidade "Aluguel" e sai das linhas por canal/mídia (antes o 6538 contava no canal "Site" em 09–15/11).
  - **Teste (24/11, antes × depois):** 09–15/11 → locação 1 × 1 (CRM 6538 → contrato 1825) · total 1 × 1 · valor fechado R$ 7.200 × 7.200. 16–22/11 → locação **0 × 1** (contrato 1829) · total **1 × 2** · valor fechado R$ 1.619.000 × 1.619.000. Receita de referência sem mudança (11.814,33 e 90.833,81). Cabeçalho 16–22/11: negócios 2 × anterior 1; filtro locação 1 × 1; venda 1 × 0.
  - **Foto de 16/11 em `saude_fotos`:** gravada com `negocios = 1`. Com a regra nova, `revisadas` acusa 16–22/11 como "revisada" (1 → 2) sem que nada tenha mudado no CRM. Correção proposta (só o placar, sem retirar a foto, porque `saude_tirar_foto()` regravaria o "agora" com o estado de hoje): `update saude_fotos set placar = jsonb_set(placar, '{negocios}', '2') where semana = '2026-11-16';`. Testada na mesma transação: `revisadas` volta vazia.
- **Sem dado na v1:** ~~mídias sociais (29e)~~ (bloco real a partir da `20261124200000`, ver abaixo), GA4 (sem captura), alcance/interação reais (`dashboard_meta_ads.alcance_impressoes` = **impressões**), Evento (sem mídia no CRM). Meta grava `anuncio = 'N/A'` na maior parte das linhas: o nível anúncio sai quase vazio até a captura trazer o nome.
- **Teste do valor fechado (24/11, `BEGIN … ROLLBACK`, depois aplicado):** 16–22/11 → **valor fechado R$ 1.619.000** (venda 1.610.000 [6416] + locação 9.000 [1 contrato]) × anterior R$ 7.200 · negócios 1 · receita de referência R$ 90.833,81 · mesa **R$ 7.437.500** (venda 7.421.000 + locação 16.500; R$ 1.750.000 com imóvel vendido, o 5716) e referência R$ 363.802,80 · custo por qualificado R$ 453,63 (1.360,90 ÷ 3) · contratos do trimestre 15 × 16 · adm R$ 17.833,81. 09–15/11 → **valor fechado R$ 7.200** (venda 0 + locação 7.200) · negócios 1 · receita R$ 11.814,33. 30 dias (25/10–23/11): todas R$ 6.606.000 (venda 6.555.000 + locação 51.000), 100 KB; locação R$ 51.000; venda R$ 6.555.000, Carteira oculta. Gestão e Marketing veem; corretor "Sem acesso"; anon e internas barrados; finalidade inválida recusada (como Gestão).
- **Conferido após aplicar (24/11):** 11 funções `saude_*`/`pode_ver_saude` (a `saude_leituras` já existia); `saude_fotos` com a foto de 16/11 (valor fechado 1.619.000, negócios 1, receita 90.833,81); cron `saude-foto-semanal` `30 2 * * 1` ativo; `saude_imovit('2026-11-16','2026-11-22')` como Gestão em 2,1 s, `revisadas` vazia; anon sem execute; `authenticated` sem execute nas internas nem select em `saude_fotos`.
- **Teste de 24/11, antes do valor fechado (transação desfeita):** 16–22/11 personalizado → negócios 1 · receita R$ 90.833,81 (73.000 + 17.833,81 + 0) · leads 33 · qualificados 12 (36,4%, parcial até 29/11; gabarito de 23/11 = 11) · visitas 2 · propostas 1 · descartados 3 · investimento R$ 1.360,90 · conversões 50,4 · pagos 8 → 3 · custo por lead no CRM R$ 170,11 · atraso R$ 476.838,52 (18) · saídas 10 (9 em 23/11; carteira relida) · mesa R$ 363.802,80 · gargalo Lead qualificado 82. Anterior (09–15/11): receita R$ 11.814,33 · leads 18 · 22,2% · visitas 6. 30 dias (25/10–23/11): 1,9 s, 78 KB. Locação: leads 21, investimento R$ 1.328,60, mesa R$ 16.500, receita = adm. Venda: leads 12, receita R$ 73.000, mesa R$ 347.302,80, Carteira oculta. Marketing vê; corretor "Sem acesso"; anon e `authenticated` nas internas/`saude_fotos` barrados.

**Sprint B — contas da tela levadas para o banco (Fase 29a, 24/11). Migration `20261124150000_saude_contas_no_banco` (testada em transação desfeita e **APLICADA em 24/11** com OK do Eduardo, como `20261124151545`, logo depois da `20261124120000` = `20261124151431`; conferido depois: mesmos números do teste, foto com placar 2, anon barrado).** Nenhuma tabela nova; só funções. Regras iguais às dos hooks da S3 (PRD §5.23 "Sprint B", B1–B6).

| Peça | Tipo | Quem chama | Regra e fonte |
|---|---|---|---|
| `saude_fin(text)` | interna | funções | `todas`/`locacao`/`venda` → `null`/`Aluguel`/`Venda`; recusa outro valor (22023) |
| `saude_respostas(bigint[])` | interna | funções | minutos entre `payload->>datahoraentradalead` e `payload->>datahora1Resposta` (`crm_atendimento_jornada`; iguais em todas as linhas do atendimento, conferido 37/37); resposta antes da entrada = sem registro |
| `saude_serie_conversoes(ini, fim, fin)` | interna | `saude_imovit` | por dia: `meta`, `google` (`leads_conversoes`, finalidade pela campanha `~* 'loca'`/`'vend'`), `plataformas`, `crm` (Campanhas pagas por `data_entrada`, sem ruído/interno, finalidade do atendimento), `investimento`. 2 casas por dia, para a soma fechar com o total |
| `saude_tempo_resposta(ini, fim)` | interna | `saude_imovit` | leads pagos do período, sempre Venda (meta 30) e Aluguel (meta 5): `leads`, `com_registro`, `sem_registro`, `dentro_meta`, `mediana` (percentile_cont). Não segue o filtro de finalidade |
| `saude_coorte(ini, fim, ant_ini, ant_fim, fin)` | interna | `saude_imovit` | por período (atual/anterior) × total/canal: atendimentos (entrada), qualificados (alguma posição ≥ 4, a qualquer momento), visitas (atividade Visita realizada, qualquer data), propostas (posição ≥ 6) |
| `saude_funil_parado(fin)` | interna | `saude_imovit` | `is_ativo`, sem ruído/interno, `fase_ordem` 1–6: `abertos`, `mais_7`, `mais_15`, `mais_30` (`coalesce(dias_parado,0) > N`), total e por canal |
| **`saude_lista(p_inicio, p_fim, p_finalidade, p_etapa, p_canal, p_midia)`** | **pública** (authenticated; confere `pode_ver_saude`) | tela, no clique | `leads` · `qualificados` (1ª posição ≥ 4 em até 7 dias) · `visitas` (atividade realizada no período, com atendimento) · `propostas` (1ª entrada na posição 6 no período) · `descartados` (com `motivo`); `negocios` devolve erro 0A000. Colunas: código, nome (`atividades.nomepessoa` mais recente), `resposta_min`, quando, quem (visita), motivo, corretor, canal, mídia, finalidade, etapa hoje, situação, entrada |
| **`saude_lista_agora(p_finalidade, p_canal, p_posicao, p_parado)`** | **pública** (idem) | tela, no clique | em aberto numa fase, `dias_parado > p_parado`, do mais parado ao menos |
| `saude_imovit(...)` | pública (igual) | tela | ganha 4 blocos: `performance.serie_conversoes`, `performance.tempo_resposta`, `comercial.coorte` {`regra`, `total`, `por_canal`[`chave`]} (cada número = `saude_num(..., 'entrada', false, 5)`) e `comercial.agora.parado` {`regra`, `total`, `por_canal`}. O resto do jsonb não muda |

- **Permissões:** internas com `revoke all` de `public`, `anon` e `authenticated` (o Supabase dá execute por padrão em função nova); as 2 listas com execute só para `authenticated`.
- **A `20261124120000` ganhou a correção do placar da foto de 16/11** (`update saude_fotos set placar = jsonb_set(placar,'{negocios}','2') where semana = '2026-11-16' and placar->>'negocios' = '1'`, idempotente). Continua correta depois do Sprint B, que não mexe em `saude_linhas` nem na foto.
- **Teste (24/11; bloco `DO` terminado em `raise exception`, ou seja, tudo desfeito; banco conferido depois: nenhuma função nova, foto com 1).** 25/10–23/11, como Gestão: conversões **189,4 × 37** · tempo de resposta **locação 4 min, venda 12,5 min** (29 e 8 leads; 27 e 6 com registro) · coorte **133 / 51 / 11 / 8** (anterior 208 / 72 / 12 / 10; vermelho, vermelho, amarelo, vermelho) · funil agora **Todos 4/12/42/99/28/7**, +7 1/6/24/87/28/6, +15 0/5/16/85/25/5, **+30 0/0/11/76/22/3** · em aberto **192** · listas pagas **37 / 9 / 1** (16 com nome, 33 com 1ª resposta) · listas × `saude_linhas`: leads 133 = 133, propostas 9 = 9, descartados 122 = 122 · `saude_lista_agora` fase 4, +30 = 76; todas = 192. Resto do jsonb idêntico ao de antes (performance, carteira, agora; total sem negócios). Negócios 30 dias 6 → **10** (efeito da `20261124120000`: locação por contratos). 16–22/11: negócios 2, `revisadas` vazia, placar da foto 2. Marketing: listas ok (37 e 192). Corretor: página e listas → 42501. Anon: página e listas → 42501. Authenticated nas internas → 42501.
- **Tempo:** `saude_imovit` 30 dias 2,3 s → 2,7 s (110 KB); 90 dias **2,8 s, 172 KB** (a medida de antes, 3,2 s e 157 KB, foi em outro momento). Listas: 0,1–0,6 s.

**Mídias sociais com o orgânico real (Fase 29a × 29e S7, 24/11). Migration `20261124200000_saude_midias_sociais` — testada em transação desfeita e **aplicada em produção em 24/11** (OK do Eduardo; pelo MCP, registrada em `schema_migrations` como `20261124185959 saude_midias_sociais`). Conferido depois como Gestão: 23/11 = alcance 3.601, visualizações 5.972, seguidores 21.555.** Nenhuma tabela nova; só funções. Lê `organico_diario` (§2.23).

| Peça | Tipo | Regra |
|---|---|---|
| `saude_midia_num(v, dias, ant, dias_ant, por_dia default true, regua default 'evento')` | interna (immutable) | 1 número no formato da `saude_num` (`valor`, `anterior`, `variacao`, `sinal`, `regua`) + `por_dia`, `por_dia_anterior`, `compara`, `dias`, `dias_anterior`. `por_dia = true`: `valor`/`anterior` são as **somas**, mas variação e sinal usam a **média por dia capturado** (buraco de captura não vira "queda"). `least(dias, dias_ant) < 5` → `sinal = 'acumulando'` |
| `saude_midias_sociais(p_ini, p_fim)` | interna (security definer) | redes sociais = `instagram`, `facebook`, `tiktok`; contas da mesma rede somam. Devolve `status` (`capturando` / `aguardando captura`), `fase`, `filtros` (não segue finalidade nem canal), `regra`, `periodo` (+ anterior de mesmo tamanho), `ultima_captura`, `redes` (métricas de cada rede no dicionário), **`total`** e **`por_rede`[`rede`]** com `dias_com_dado`, `dias_com_dado_anterior`, `ultima_data`, `alcance`, `visualizacoes`, `interacoes`, `visitas_perfil`, `cliques_site`, `seguidores_novos` (somas), `seguidores` (último dia capturado, régua `último dia`), `engajamento` (interações ÷ alcance × 100); **`serie`** = 1 item por dia do período (`data`, `redes`, as 7 métricas; dia sem captura = null). Métrica que a rede não tem no dicionário = null, não zero |
| `saude_imovit(...)` | pública (igual) | `midias_sociais` = `saude_midias_sociais(v_ini, v_fim)` (antes: `{status: 'aguardando captura'}`); `leituras.organico` = última data do orgânico. O resto do jsonb não muda |

- **Permissões:** as 2 internas com `revoke all` de `public`, `anon` e `authenticated`; quem vê o bloco é quem vê a página (`pode_ver_saude`).
- **Limites conhecidos:** o alcance somado não é alcance único do período; no `total`, uma rede que começa a gravar no meio infla a comparação (ver `por_rede`).
- **Teste (24/11; `begin` + bloco `DO` terminado em `raise exception`, tudo desfeito; conferido depois: 0 funções novas, 7 linhas no orgânico, `saude_imovit` sem mudança).** 23/11 como Gestão: alcance **3.601**, visualizações **5.972**, interações **140**, visitas ao perfil **48**, cliques no site **13**, seguidores novos **5**, seguidores **21.555**, engajamento **3,89%**, todos ⚪ acumulando (0 dias no anterior). 25/10–23/11 (filtro venda): **1 de 30 dias**, série com 30 dias (1 com dado), `leituras.organico` = 23/11, página em 2,1 s. Marketing lê (filtro locação, mesmos números). Corretor: `saude_imovit` barrada (42501 "Sem acesso") e interna barrada (permission denied). Anon: `saude_imovit`, interna e `organico_diario` barrados. Dados fictícios (desfeitos), 09–15/11 × 02–08/11: total 6 × 7 dias, alcance 170 × 70 (28,33 × 10 por dia → verde, +183,3%), seguidores 1.015 × 1.008 (verde), engajamento 38,24% × 100% (vermelho), Facebook com 1 dia → acumulando; dia 09/11 sem captura sai como null na série.

**Decisões pendentes (Eduardo)** — D1 a D12 no `handoff.md` (sprint 2026-11-23, Fase 29a S1).

### 2.23 Orgânico: redes sociais, Search Console e Perfil do Google (Fase 29e, PRD §5.23 pendência 8) — **Instagram APLICADO (24/11); GA4 + Search Console PROPOSTO e testado (25/11), não aplicado**
Métricas aprovadas pelo Eduardo em 23/11 ("pode seguir o seu schema"). Uso: bloco **1.4 Orgânico** da Saúde Imovit e capítulo "Orgânico" da Aquisição, sempre com os leads orgânicos da rede ao lado.

**Decisão de formato: tabela "longa" (1 linha por data × rede × conta × métrica), não "larga" (1 coluna por métrica).** Cada rede tem métricas diferentes e a Meta muda nomes (em 2025 trocou `impressions` por `views` no Instagram). No formato longo, métrica nova é linha nova, sem migration.

- **`organico_metricas`** (dicionário; escrita só Gestão/migration): `rede` text, `metrica` text, `rotulo` text (como aparece na tela), `descricao` text, `ordem` int; PK (`rede`, `metrica`). Carga inicial:

  | Rede (`rede`) | Métricas diárias (`metrica`) |
  |---|---|
  | `instagram` | `alcance`, `visualizacoes`, `interacoes`, `seguidores`, `seguidores_novos`, `visitas_perfil`, `cliques_site` |
  | `facebook` | `alcance`, `visualizacoes`, `interacoes`, `seguidores_novos`, `cliques_site` |
  | `tiktok` | `visualizacoes`, `interacoes`, `seguidores_novos`, `visitas_perfil` |
  | `search_console` | `cliques`, `impressoes`, `ctr`, `posicao_media` (site inteiro) |
  | `google_perfil` | `visualizacoes`, `ligacoes`, `rotas`, `cliques_site` |

  Nome exato de cada métrica na API: conferir na doc oficial quando cada fluxo for montado.

- **`organico_diario`**: `id` bigint identity PK, `data` date!, `rede` text!, `conta` text! (id da página/perfil/site), `metrica` text!, `valor` numeric!, `atualizado_em` timestamptz default now(). **Unique (`data`, `rede`, `conta`, `metrica`)** + FK (`rede`, `metrica`) → `organico_metricas`. Releitura do mesmo dia **atualiza** (as APIs consolidam os números com 1–3 dias de atraso). O fluxo Instagram lê a janela de **ontem** com `metric_type=total_value`: `views` rejeita `time_series` na Graph API v27.0.
- **`organico_posts`** (1 linha por post, valores acumulados da vida do post, atualizados a cada leitura): `id` bigint identity PK, `rede`, `conta`, `post_id` text, `publicado_em` timestamptz, `tipo` (reels | carrossel | imagem | video | story), `legenda` (primeiros 280 caracteres), `url`, `miniatura_url`, `alcance`, `visualizacoes`, `curtidas`, `comentarios`, `compartilhamentos`, `salvamentos`, `interacoes`, `atualizado_em`. **Unique (`rede`, `post_id`)**. O fluxo relê os posts dos últimos 30 dias.
- **RPC `carregar_organico(p_diario jsonb, p_posts jsonb default '[]')`** (security definer, só `service_role`): valida rede/métrica pelo dicionário, faz upsert nas duas tabelas numa transação e devolve quantas linhas entraram/atualizaram. Mesmo padrão da `carregar_carteira_locacao` (§2.10): o n8n não escreve direto na tabela. `seguidores` guarda o total de `followers_count`; `seguidores_novos` vem de `follows_and_unfollows` com `breakdown=follow_type` (valor `FOLLOWER`). shortcut: nesta sprint `p_posts` é aceito e ignorado porque `organico_posts` ainda não existe; atualizar quando o fluxo de posts for montado.
- **View `vw_organico_semana`** (security_invoker): soma por semana (seg–dom) × rede × métrica (para `ctr` e `posicao_media`, média ponderada pelas impressões) + **leads orgânicos do CRM** da rede na semana.
- **Leads orgânicos por rede (CRM):** `instagram` = mídia "Instagram" (375 leads até 23/11); `tiktok` = mídia "Tik Tok" (2, hoje no canal "Outros"); `search_console` = canal "Site" **sem** clique pago (depois da conciliação de 23/11). ⚠ **Facebook orgânico e Perfil do Google não têm mídia no Imoview**: sem cadastrar essas mídias (e o Severino/corretor usá-las), o bloco mostra alcance sem lead. Encaixa na tarefa de enxugar as mídias do Imoview.
- **RLS:** leitura por `pode_ver_dash()`; escrita só pela RPC; `anon` sem acesso. ⚠ **Conferido em 24/11: em produção `pode_ver_dash()` = gestão, marketing e corretor** (não só Gestão e Marketing, como o resto deste documento diz): o corretor lê `organico_diario` direto pela API (7 linhas no teste). A Saúde não é afetada (usa `pode_ver_saude`). Decisão pendente do Eduardo: trocar a policy para `pode_ver_saude()` ou aceitar.
- **Uso na Saúde (24/11):** `saude_midias_sociais(p_ini, p_fim)`, §2.22 "Mídias sociais com o orgânico real".
- **Fluxos n8n (um por fonte, diário):** `organico_meta` (Instagram + Facebook, Graph API), `organico_search_console`, `organico_google_perfil`, `organico_tiktok`. Token/credenciais sempre em credencial do n8n, nunca no nó.
- **Acessos necessários (Eduardo):** Meta: token do usuário do sistema com `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `read_insights`; Google: conta de serviço com leitura no Search Console + **pedido de acesso à API do Business Profile** (aprovação do Google); TikTok: app no TikTok for Business (aprovação do TikTok).

**Estado 24/11 (OpenCode/Asimov, Sprint Instagram):** migration `supabase/migrations/20261124190000_organico_meta.sql` escrita com `organico_metricas` (inclui `seguidores`), `organico_diario` e `carregar_organico`, e **aplicada pelo Eduardo no Supabase** (o teste em `BEGIN … ROLLBACK` não foi feito — aplicação direta). RLS: leitura por `pode_ver_dash()` (Gestão e Marketing), escrita só pela RPC, `anon` sem acesso. Fluxo `docs/n8n/organico_meta.json` (somente Instagram, 3h30, criado desligado) usa credencial Query Auth `access_token` e um nó `Merge 3 respostas` antes do Code; rodou 1× e gravou em 2026-11-23: alcance 3601, visualizações 5972, interações 140, seguidores 21555, novos 5, visitas ao perfil 48, cliques no site 13. Falta conferir contra o Business Suite. ⚠ No n8n o `organico_meta` está **desligado** (`active: false`, 24/11): a captura diária ainda não roda sozinha.

**Origem do histórico (backfill, 24/11, OK do Eduardo: "vamos colocar algum dado lá, só para comparação inicial"):** fluxo separado **`organico_meta_backfill`** (n8n id `MI1VL7iIDx5DS2Qy`, desligado, para rodar 1× à mão e depois arquivar). Datas **fixas 24/09 a 22/11/2026** (60 dias; 23/11 em diante é do `organico_meta` e o Code tem trava para nunca gravar depois de 22/11). Para cada dia: a mesma chamada do `organico_meta` (`total_value` com `since`/`until` = início/fim do dia em Brasília) para `reach`, `views`, `total_interactions`, `profile_views`, `website_clicks`, e `follows_and_unfollows` com `breakdown=follow_type`; mesmo mapeamento e mesma RPC `carregar_organico` (upsert por `data, rede, conta, metrica`, sem duplicar). **`seguidores` (total) não tem histórico**: a API só devolve o `followers_count` de hoje, então fica só a partir de 23/11 (não inventado). Só dado real da API; nada fictício. Estado e dias carregados por métrica: ver `handoff.md` (sprint 24/11 "backfill").

**GA4 e Search Console (25/11, Asimov; briefing `docs/briefing-ga4.md`) — migrations `20261125120000_organico_google` e `20261125130000_saude_ga4`, testadas em `BEGIN … ROLLBACK`, NÃO aplicadas.**
- **Reaproveita o orgânico.** Totais do dia em `organico_diario` com `rede = 'ga4'` (`conta` = `320331795`) e `rede = 'search_console'` (`conta` = o `siteUrl` que a API devolver, ex.: `sc-domain:imovit.com.br`). Dicionário ganha 8 métricas `ga4`: `usuarios` (totalUsers), `usuarios_novos` (newUsers), `sessoes` (sessions), `sessoes_engajadas` (engagedSessions), `taxa_engajamento` (engagementRate, em %), `visualizacoes` (screenPageViews), `eventos_chave` (keyEvents, o antigo "conversões"), `eventos` (eventCount, só na dimensão evento). As 4 do `search_console` já existiam (`ctr` gravado em %, `posicao_media` como vem).
- **Tabela nova `organico_dimensao`** (a dimensão não cabe na chave de `organico_diario`): `id`, `data`!, `rede`!, `conta`!, `dimensao`! (`canal` | `origem_midia` | `campanha` | `evento` | `pagina` | `consulta`, por check), `chave`! (até 500 caracteres: o canal, "google / cpc", o nome da campanha, o evento, o caminho da página, a consulta), `metrica`!, `valor`!, `atualizado_em`. **Unique (`data`, `rede`, `conta`, `dimensao`, `chave`, `metrica`)** + FK (`rede`, `metrica`) → dicionário. Guarda o **top N do dia**: GA4 = todos os canais, 25 origens/mídias, 25 campanhas, 100 eventos, 20 páginas; Search Console = 50 consultas e 20 páginas.
- **Foto do dia:** cada leitura substitui, por (`data`, `rede`, `conta`, `dimensao`), as linhas anteriores (uma página que saiu do top no reprocesso some). Os totais seguem o upsert normal.
- **RPC `carregar_organico_web(p_diario jsonb, p_dimensao jsonb)`** (security definer, só `service_role`): valida as dimensões pelo dicionário e pela lista; manda `p_diario` para a `carregar_organico` (a mesma do Instagram, sem mudança); substitui a foto das dimensões; numa transação. Devolve `{diario, dimensao, dimensao_substituidas}`. Chave repetida no mesmo lote vira 1 linha (soma; média para taxa e posição).
- **RLS:** igual à do orgânico (`pode_ver_dash()`, que em produção inclui o corretor: mesma decisão pendente); `anon` sem acesso; escrita só pela RPC.
- **Fluxos n8n (DESLIGADOS):** `ga4_diario` (4h; D-3 a D-1, porque o GA4 consolida com atraso; 1 `batchRunReports` com 5 relatórios: totais, canal, origem/mídia × campanha, eventos, páginas), `search_console_diario` (4h15; D-5 a D-3, por dia: totais, 50 consultas, 20 páginas; o formato da propriedade sai da lista `sites` da conta de serviço, preferindo `sc-domain:imovit.com.br`), `organico_google_backfill` (manual; GA4 90 dias até ontem e Search Console D-92 a D-3; arquivar depois). Credencial Google Service Account só no n8n; os fluxos não salvam dados de execuções que dão certo.
- **Uso na Saúde:** `saude_ga4(p_ini, p_fim)` → chave `ga4` da `saude_imovit` com `site`, `busca` e `serie` (regras no PRD §5.23); `leituras` ganha `ga4` e `search_console`.
- **Limites conhecidos:** usuários somados dia a dia não são únicos; listas somam fotos diárias do top N (item fora do top num dia conta zero naquele dia); a soma das 50 consultas é menor que o total do site (o Google anonimiza consultas raras); o Search Console usa o fuso do Pacífico na data.

### 2.24 Imoview: sessão do login de integração + reserva de telefone do `wpp_entrada` — migration `20261126122845_imoview_sessao`, **APLICADA 26/11** (versão no banco `20261126122845`; testada antes em `BEGIN … ROLLBACK`)

Por quê: a API do Imoview mudou em 24–25/11. Clientes, Contratos e Financeiro exigem o login de integração (`/Usuario/Integracao_ValidarAcesso`, usuário 111 "Marketing Integração"), e a sessão é **uma por usuário**: um login novo derruba o `codigoacesso` anterior. Então só um lugar pode fazer login (o sub-fluxo n8n "Imoview: obter sessão", `BN7laXW9hnzNt0xq`) e todos reaproveitam a mesma sessão. Os static data do n8n não servem (por fluxo, gravados só no fim, sem trava). Plano: `docs/n8n/imoview-auth-arquitetura.md` §4.3 e §8.

- **`imoview_sessao`** (fora do Hub; só o n8n): `perfil` text PK (hoje só `integracao`) · `codigousuario` bigint · `codigoacesso` text (token de sessão, expira com 10 min sem uso) · `obtido_em` · `usado_em` · `renovando_ate` (trava de login, 30 s) · `renovando_dono` uuid (quem pegou a trava) · `logins` int (contador, para conferir "1 login só") · `atualizado_em`. Nunca guarda chave nem senha.
- **RPCs (todas `security definer`, `search_path = public`, só `service_role`):**
  - `imoview_sessao_obter(p_perfil, p_forcar, p_recusado, p_ocioso_seg = 480)` → `{acao: 'usar', codigousuario, codigoacesso}` (sessão usada há < 8 min; atualiza `usado_em`) · `{acao: 'esperar', segundos}` (outro chamador está logando) · `{acao: 'login', dono}` (pegou a trava). Com `p_forcar` (depois de um 401 `sessaoinvalida`), só faz login se a sessão guardada ainda for a recusada (`p_recusado`); se já é outra, alguém renovou antes e ela é devolvida. Linha travada com `select … for update`: dois chamadores simultâneos não logam os dois.
  - `imoview_sessao_gravar(p_perfil, p_dono, p_codigousuario, p_codigoacesso)` → `{gravado}`; só grava quem tem a trava.
  - `imoview_sessao_liberar(p_perfil, p_dono)` → `{liberado}`; solta a trava quando o login falha.
- **`wpp_entrada_reserva`** (dedup do webhook do Severino no `wpp_entrada v4`): `telefone` text PK · `status` (`processando` | `ok`) · `tentativas` · `atualizado_em`. Substitui o "Deduplicar telefone" (static data, 30 min marcados na **chegada**, que jogava fora a nova tentativa de um lead que falhou no Imoview).
  - `wpp_entrada_reservar(p_telefone, p_janela_ok_seg = 1800, p_janela_pr_seg = 300)` → `{reservado}`. Insert atômico com `on conflict … where`: reserva se não há linha, se o `ok` tem mais de 30 min ou se o `processando` tem mais de 5 min (execução que falhou). Sem telefone → passa.
  - `wpp_entrada_concluir(p_telefone)` → `{concluido}`; chamado no fim, depois do Imoview e do `Gravar atendimento`.
  - Uma linha por telefone (não cresce por lead). Sem limpeza automática.
- **RLS:** ligada nas 2 tabelas, 0 policies, `revoke all` de anon/authenticated; `revoke execute` de public/anon/authenticated nas 5 funções; `grant execute` só para `service_role`.
- **Teste (26/11, `BEGIN … ROLLBACK` em produção, 22 checagens, todas OK):** sem sessão → login; durante a trava → esperar; dono errado não grava; grava e reaproveita; `forcar` com o código atual → login; `forcar` com código velho → usa o novo sem login; ociosa > 8 min → login; liberar; trava vencida é tomada e o dono antigo não grava; contador = 2; `p_ocioso_seg` fora de 30..590 recusado; reserva: duplicado bloqueado, `processando` libera depois de 5 min, `ok` bloqueia 20 min e libera depois de 31, sem telefone passa, tentativas = 3; `authenticated` não lê a tabela nem executa a RPC; `service_role` executa. Depois do rollback: nenhuma tabela nem função nova no banco.

### 2.25 Vigia de dados (Fase 31) — migration `20261127134546_vigia_fontes`, **APLICADA 27/11** (OK do Eduardo; conferido: EXECUTE anon ✗, authenticated ✗, service_role ✓; 9 linhas, atrasadas = `carteira_receita` e `estoque`)

Por quê: a jornada do CRM ficou sem rodar de 18 a 22/11 e ninguém percebeu; as fotos daqueles dias se perderam. Nenhuma tabela nova; só uma função de leitura.

- **`vigia_fontes(p_desligar text[] default '{organico_instagram}')`** (`security definer`, `stable`, `search_path = public`; `revoke execute` de public/anon/authenticated, `grant` só para `service_role`). Devolve uma linha por fonte: `chave` · `fonte` · `ligada` · `ultimo_dado` timestamptz · `esperado_ate` timestamptz · `atrasada` bool (`ligada` e (`ultimo_dado` nulo ou < `esperado_ate`)) · `detalhe` (texto pronto para o e-mail, datas em Brasília) · `onde_olhar`. Só lê.
- **Régua (calibrada pelo histórico de 01/09 a 27/11):**

| chave | Fonte (coluna) | Esperado a partir de | Por quê |
|---|---|---|---|
| `crm` | `crm_leituras.dia` | hoje | diária, inclusive fim de semana (6h) |
| `atividades` | `max(atividades.data_referencia)` | 2º dia útil (seg–sex) antes de hoje | sábado/domingo/feriado têm 0–3 atividades (21/11 e 07/09 tiveram 0). Régua de 1 dia útil daria alarme falso depois de feriado. A falha do Imoview aparece antes no `crm` |
| `carteira_fotos` | `contratos_locacao_fotos.data` | hoje | diária (n8n 6h30) |
| `carteira_receita` | `max(contratos_locacao_recebimentos.lido_em)` | hoje 00h (SP) | Edge 6h45; o upsert regrava o `lido_em` da janela, então o máximo = última leitura boa |
| `estoque` | `max(estoque_cargas.feita_em)` | hoje 00h (SP) | diária, ~1h40 SP. Atrasada desde 24/11 (fluxo não migrado) |
| `leads_severino` | `max(leads_wpp_gtm.created_at)` | agora − 60 h | maior intervalo real em 120 dias = 52h44 (p99 47 h); 48 h teria dado alarme falso |
| `google_ads`, `meta_ads` | `dashboard_*_ads.data` | hoje − 2 | o dia de ontem chega de madrugada; nenhum buraco desde 01/09 |
| `organico_instagram` | `organico_diario.data` (`rede = 'instagram'`) | hoje − 2 | **desligada** por padrão (fluxo pausado por decisão) |

- `imoview_sessao` ficou de fora: não tem campo de erro (só `obtido_em`, `usado_em`, `logins`).
- Ligar/desligar fonte **sem migration**: o n8n manda `{"p_desligar": [...]}` (nó "Configuração" do "Vigia de dados · 7h30"). Lista vazia = todas ligadas.
- Consumidor: n8n "Vigia de dados · 7h30" (`kfY7G154RvvgXykm`), por `POST /rest/v1/rpc/vigia_fontes` com a credencial Supabase (service_role).
- **Teste (27/11, ~10h20 SP, em transação desfeita):** 9 linhas; atrasadas = `carteira_receita` (último 24/11 06:45) e `estoque` (último 24/11 01:39), as duas reais; as outras OK; `organico_instagram` desligada (último 26/11). Com `p_desligar = '{}'` continuam 2 atrasadas. EXECUTE: anon ✗, authenticated ✗, service_role ✓. Depois do ROLLBACK a função não existe.
- **Sobreposição com §2.18:** `saude_leituras` + `alerta-leituras` (7h15, Brevo, só eduardo@) cobrem 6 destas fontes desde 29/10 e **não avisaram** a falha de 18–22/11 (causa não investigada). Quando o vigia estiver validado, decidir se o `pg_cron` "alerta-leituras" sai.

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
| locacao_papeis, locacao_etapas (§2.20) | `pode_ler_processo_locacao()` = gestao, adm, corretor, marketing, sem suspensão | `is_adm_ou_gestao()` |
| locacao_casos (§2.20) | `is_adm_ou_gestao()` | `is_adm_ou_gestao()` |
| blog_posts | anon: só `status = 'publicado'` | — |
| pilares | público | — |
| repique_control, repique_ponteiro | RLS ligado, 0 políticas: só `service_role` (conferido em 26/10) | — |
| repique_tentativas | RLS ligado, 0 políticas, sem grant para anon/authenticated: só `service_role` (n8n) | — |
| imoview_sessao, wpp_entrada_reserva (§2.24, aplicada 26/11) | RLS ligado, 0 políticas, sem grant para anon/authenticated: só `service_role` (n8n) | — |
| vw_* (21 views, auditoria de 22/10) | só `authenticated`, com `security_invoker` (seguem a RLS das tabelas); anon sem acesso | — |

⚠ `leads_wpp_gtm` (telefone e nome de lead) e `atividades` são legíveis por qualquer usuário logado, inclusive "Sem nível". Rever se isso é intencional.

### Storage
- `avatares` (público para exibir): cada usuário lê, grava, atualiza e apaga só a própria pasta (`<uid>/...`). A policy de SELECT foi adicionada em 06/10 (`20261006210000`): sem ela o upload falhava com erro de RLS.
| Bucket | Público | Regras |
|---|---|---|
| `esteira-documentos` | não | ler: `pode_acessar_documento_esteira(name)`; enviar/atualizar: `pode_enviar_documento_esteira(name)` (locatário da proposta ou adm/gestao) |
| `propostas-venda` | não | ler: `pode_ler_arquivo_venda(name)`; enviar/atualizar: `pode_enviar_arquivo_venda(name)`: só o proponente, `assinatura.png` enquanto `aguardando_cliente` e no prazo, `documento.pdf` uma vez depois de `confirmada` |
| `banners` | sim | escrever/remover: `pode_editar_conteudo()` |
| `avatares` | sim | cada um só escreve na pasta `<uid>/` |
| `videos` | sim | ⚠ sem uso no Hub |

## 4. Funções, triggers e views
| Nome | Tipo | O que faz | Chamado por |
|---|---|---|---|
| `pode_ler_processo_locacao` | função definer (authenticated) | leitura do guia de locação: gestão, adm, corretor e marketing sem suspensão (§2.20) | RLS de `locacao_papeis` e `locacao_etapas` |
| `is_team` | função definer | tem perfil e não está suspenso (**qualquer role**) | RLS, página HTML da Direção |
| `handle_new_user` | trigger em auth.users | cria perfil `user` para `@imovit.com.br` | Auth |
| `saude_leituras` | função definer (só service_role) | confere as 6 leituras automáticas (§2.18) | Edge `alerta-leituras` |
| `vigia_fontes(p_desligar)` | função definer (só service_role) — **aplicada 27/11** (`20261127134546`) | uma linha por fonte automática com `ultimo_dado`, `esperado_ate`, `atrasada` (§2.25) | n8n "Vigia de dados · 7h30" |
| `meus_codigos_crm` | função definer | leads cujo dono **atual** é o corretor logado (§2.17) | RLS da jornada, `atividades`, `leads_wpp_gtm` |
| Edge `carteira-locacao` | Edge Function | lê contratos, cobranças e **pagamentos** do Imoview e grava pela RPC `carregar_carteira_locacao` (§2.10). Desde 27/11 (código no repo, deploy pendente): sessão pelas RPCs `imoview_sessao_*` (§2.24), nunca login próprio | painel Adm locação ("Atualizar") e `pg_cron` 6h45 |
| `boletim_diretoria` | função definer (só service_role) | números do e-mail diário (§2.19) | Edge "boletim-diretoria" |
| Edge "boletim-diretoria" (slug `rapid-worker`) | Edge Function | e-mail diário da Diretoria seg–sex 7h30 (§2.19) | `pg_cron` |
| Edge `alerta-leituras` | Edge Function | e-mail para eduardo@ quando alguma leitura falha (§2.18) | `pg_cron` 7h15 |
| `proteger_campos_perfil` | trigger | impede mudar o próprio role, e-mail e suspensão | update em perfis |
| `decidir_solicitacao_acesso` | RPC definer | aprova/recusa pedido (só gestao) | Configurações |
| `upsert_proposta_locacao`, `criar_proposta_locacao` | RPC definer | cria ou reinicia a proposta | Edge Function |
| `validar_proposta_locatario`, `pedir_correcao_proposta`, `completar_cadastro_locatario` | RPC definer | etapas do locatário (só service_role) | Edge Function |
| `editar_proposta_locacao` | RPC definer | gestor corrige e reenvia antes da validação | Edge Function |
| `decidir_documento`, `descartar_proposta_locacao`, `marcar_sincronizado_imoview`, `registrar_documento_enviado(_arquivo)` | RPC definer | decisões da esteira | Edge Function |
| `aceitar_proprietario` | RPC definer | ⚠ legado (proprietário saiu do fluxo) | — |
| `fn_atualiza_status` | função | muda status + histórico | RPCs |
| `recalcular_status_proposta`, `bloquear_avanco_expirado`, `log_status_historico`, `tocar_updated_at` | triggers da esteira | | |
| `kpis_tv` | RPC definer | JSON só com agregados para a TV (gestao/adm/marketing/tvaccess). Desde 24/09 (migration `20260924140000_kpis_tv_alinhado_paineis`) traz também os campos com as definições do Painel da Gestão: `leads_mes`, `ritmo_dia`, `projecao_mes`, `leads_media_3m`, `negocios_fechados_mes`, `negocios_media_3m`, `conversao_safra(_anterior)`, `ciclo_mediano_12m`, `sem_contato`, `abertos_30d`, `atividades_vencidas_30d`, `crm_atualizado_ate`; os campos de 23/09 continuam. Desde 25/09 (migration `20260925120000_kpis_tv_meta_90d`): `meta_leads_90d` (leads dos últimos 90 dias ÷ 3), a meta da barra de ritmo na TV. ⚠ Essa foi aplicada pelo SQL Editor e não consta em `schema_migrations` | `useKpisTV` |
| `meta_ads_upsert`, `leads_wpp_gtm_descarta_vazia` | triggers | higiene dos dados do n8n | n8n |
| `leads_wpp_gtm_concilia_clique` + `midia_do_clique(leads_wpp_gtm)` | trigger + função | lead do Severino com código do site herda a origem paga do clique (23/11) | n8n `wpp_entrada` (lê a mídia do retorno do insert) |
| `fn_upsert_atividades`, `fn_upsert_atividades_notas` | triggers | upsert | n8n |
| `imoview_sessao_obter/gravar/liberar`, `wpp_entrada_reservar/concluir` (§2.24, aplicada 26/11) | RPC definer (só service_role) | sessão única do login de integração do Imoview, com trava; dedup do webhook do Severino | n8n "Imoview: obter sessão" e "wpp_entrada v4" |
| `match_documents` | função | busca vetorial em `knowledge_base` | fora do Hub |
| `vw_atendimentos_base` | view | normaliza atendimentos (canal, fase, flags ruído/interno/negócio, dias) | base das outras |
| `vw_kpis_mensais`, `vw_funil_acumulado`, `vw_aging_ativos`, `vw_cobertura_atividades`, `vw_corretores`, `vw_descartes`, `vw_origem_performance`, `vw_tempo_resposta` | views | agregados dos dashboards | dashboards |

Edge Functions: `esteira-locacao` (eventos `nova_proposta, editar_proposta, validar_proposta, pedir_correcao, completar_cadastro, descartar_proposta, docs_enviados, decisao_adm, solicitar_ajustes, sincronizar_imoview`), `gestao-colaboradores` (`suspender, reativar, excluir`), `spotify-auth`, `proposta-venda` (`nova_proposta, confirmar_proposta, descartar_proposta`; v1 em 28/09).

## 5. Migrations
- Repo: `supabase/migrations/` (28 arquivos, de `20260821140000` a `20260923233000`).
- Banco: 67 registradas em `supabase_migrations.schema_migrations`, desde `20260508150403`.
- **Pendência:** gerar uma migration-base (dump do schema atual) para o repo voltar a ser a fonte da verdade. Ver o plano, Fase 2.

## 6. Convenções para mudanças novas
- **Equipe × logado:** dado interno usa `is_team()` (tem perfil e não está suspenso) ou papéis; nunca `true` para `authenticated`, porque cliente do portal também é `authenticated`.
- **Gatilhos SECURITY DEFINER:** nunca decidir permissão por `current_user` (é sempre o dono da função); usar `auth.role()`/`auth.uid()`.
- **Mudança pelo SQL Editor vira migration no repo no mesmo dia.**
- Tabela nova: RLS ligada na mesma migration, policies explícitas e grants revistos.
- **Padrão sem anon (desde 22/10, `20261022120000`):** tabela, view e sequência novas criadas pelo `postgres` **não** ganham grant para `anon`. Se algo precisar mesmo de leitura sem login, use um `grant select ... to anon` explícito, com o motivo no comentário da migration. Funções ficaram fora: o EXECUTE vem do PUBLIC, então continue com `revoke execute ... from public, anon` função a função.
- Auditoria rápida de views abertas: `select relname, has_table_privilege('anon', oid, 'SELECT') from pg_class where relnamespace = 'public'::regnamespace and relkind in ('v','m')`.
- View nova: `with (security_invoker = true)`.
- Função `security definer`: `set search_path = public` e `revoke execute ... from anon` quando não for pública.
- Testar a migration inteira dentro de `BEGIN … ROLLBACK` em produção antes de aplicar (não há ambiente de teste).
- Soft-delete (`ativo`) em tabelas de conteúdo; nunca `DELETE` sem `WHERE` (não há backup).
