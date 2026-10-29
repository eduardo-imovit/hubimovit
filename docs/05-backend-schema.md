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
| `leads_wpp_gtm` | GTM `wpp_gtm` e bot `wpp_entrada` | UTMs, gclid/gbraid/wbraid/fbclid, origem_registro (`site_gtm`, `bot_severino`); trigger descarta linha vazia. `imovel_titulo` nunca gravado |
| `metas`, `metas_mensais`, `metas_campanhas`, `metas_atividades_tipo`, `campanhas_metas`, `kpi_baselines` | manual/n8n | **5 tabelas de metas com formatos diferentes.** ⚠ Unificar antes da tela de metas |
| `imoveis_locados`, `proprietarios_locacao`, `envios_proprietarios` | Imoview/n8n | `imoveis_locados` vazia |

**Fora do Hub (não mexer sem olhar o n8n):** `blog_posts`, `blog_temas`, `newsletter_contacts`, `knowledge_base` (pgvector), `pilares`, `campanha_entreverdes_05-2026`, `fila_repique_site`, `repique_control`, `repique_ponteiro`.

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

### 2.17 Jornada vira a fonte única dos atendimentos (Fase 24, achados A1/A5/A7) — **PROPOSTA (28/10), não aplicada**
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
| repique_control, repique_ponteiro | RLS ligado, 0 políticas: só `service_role` (conferido em 26/10) | — |
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
| `handle_new_user` | trigger em auth.users | cria perfil `user` para `@imovit.com.br` | Auth |
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
| `fn_upsert_atividades`, `fn_upsert_atividades_notas` | triggers | upsert | n8n |
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
