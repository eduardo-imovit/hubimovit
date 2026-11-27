# Plano de Implementação — Hub Imovit (a partir de 24/09/2026)
**Base:** PRD / TRD / App Flow / DS / Schema v0.1 · **Data:** 2026-09-24

> O Hub já está em produção. Este plano não recomeça o projeto: ordena o que está aberto
> (handoff, notas 🟡 do Obsidian e achados do levantamento de 24/09) em fases pequenas,
> com a segurança e a base primeiro. **Nenhuma fase começa sem o Eduardo aprovar o escopo dela.**

## Fase 0 — Aprovar os documentos
- **Entrega:** PRD, TRD, Flow, DS e Schema revisados pelo Eduardo; respostas para os itens ⚠.
- **Tarefas:**
  - [ ] Revisar os 6 documentos e responder às perguntas marcadas com ⚠
  - [ ] Decidir: `leads_wpp_gtm` e `atividades` devem ser legíveis por qualquer logado?
  - [ ] Decidir: cor dos e-mails (template do Obsidian × tokens do DS)
- **Pronto quando:** Status do PRD = aprovado.

## Fase 1 — Segurança: fechar as exposições de dados 🔴 (roadmap revisto em 28/09)
**Diagnóstico de 28/09** (leitura real como anônimo e contagem de policies, não só permissões):
- **Aberto a qualquer pessoa, sem login:** 9 views `vw_*` (dados do CRM: corretor, campanha, datas, situação, tempo de resposta; ex. `vw_atendimentos_base` = 2.771 linhas) e o backup `dashboard_meta_ads_backup_20260924` (698 linhas, sem RLS, anon pode até gravar).
- **Aberto a qualquer usuário logado, inclusive cliente do portal:** 16 tabelas com policy `true` para `authenticated`: `leads_wpp_gtm`, `colaboradores_raw` (e-mail, telefone, nascimento da equipe), `dashboard_atendimentos_crm`, `atividades`, `atividades_notas`, conteúdo da Home etc. Locatários e proponentes entram por magic link e viram `authenticated`, sem perfil. Como o login do portal cria conta para qualquer e-mail digitado, na prática "logado" ≈ público.
- **Já fechado (corrigindo o diagnóstico anterior):** `colaboradores_raw`, `repique_*`, `perfis` e `dashboard_atendimentos_crm` devolvem 0 linhas para anônimo; `repique_*` já estão com RLS ligada.
- **Endurecimento:** 7 funções SECURITY DEFINER executáveis sem login; 10 funções sem `search_path` fixo; proteção contra senha vazada desligada.

**S1 — Fechar o que está aberto a qualquer pessoa** (curto, prioridade máxima)
- [x] 9 views `vw_*`: `security_invoker = true` + revogar anon (feito pelo Eduardo com o OpenCode no SQL Editor, 28/09; registrado em `20260928180000_seguranca_equipe_registro.sql`)
- [x] `dashboard_meta_ads_backup_20260924`: RLS ligada e anon/authenticated revogados (28/09). [x] Backups de 23–24/09 apagados (autorizado pelo Eduardo, migration `20260928200000`).
- **Pronto quando:** `curl` com a anon key nas 9 views e no backup → vazio ou 401; Painel da Gestão, Painel de Performance, Home (pendências do corretor) e TV abrem iguais.

**S2 — "Logado" passa a ser "da equipe"** (o item de maior impacto)
- [x] Função `is_team()` (= `e_equipe` do plano): perfil existe e `suspenso_em is null` (Eduardo + OpenCode, 28/09; registrada na mesma migration)
- [x] Policy "so equipe le" com `is_team()` em 12 tabelas (leads, colaboradores, CRM, atividades, metas, plantão, fotógrafo, datas). Testado: anon e cliente do portal leem 0 linhas.
- [x] `avisos`, `biblioteca_links`, `home_banners` também só para a equipe (28/09). `pilares`/`blog_posts` seguem públicas de propósito (blog).
- [ ] Revogar grants de escrita de `anon`/`authenticated` onde só a service role (n8n) grava.
- **Pronto quando:** um cliente do portal (JWT sem perfil) lê 0 linhas nessas tabelas e continua vendo só a própria proposta; a equipe (todos os níveis, inclusive "Sem nível" e TV) vê o mesmo de antes.
- **Como testar:** em `BEGIN … ROLLBACK`, simular os papéis anon, cliente do portal, sem nível, corretor, marketing, adm, gestão e tvaccess; depois, login real como Marketing e Corretor.

**S3 — Endurecer funções e autenticação**
- [x] Revogado `EXECUTE` de anon/authenticated nas 4 funções de gatilho (28/09). Ficam executáveis por anon, de propósito, `is_gestao`, `is_adm_ou_gestao`, `pode_acessar_documento_esteira` e `is_team`: são usadas em policies avaliadas para anon e devolvem false (sem EXECUTE a consulta daria erro em vez de vazio).
- [x] **CRÍTICO corrigido (28/09):** `proteger_campos_perfil` não barrava ninguém (usava `current_user`, que dentro de SECURITY DEFINER é sempre o dono); qualquer perfil podia se promover a Gestão pela API. Agora barra por token (`authenticated`/`anon` sem ser Gestão).
- [x] `search_path` fixo nas 10 funções (28/09).
- [ ] Proteção contra senha vazada: o Eduardo não achou "Passwords" no painel. Fica em Authentication → Sign In / Providers → Email → "Prevent use of leaked passwords", e **exige plano Pro** (o projeto é Free). Mitigação no Free: senha mínima maior e exigência de caracteres no mesmo lugar.
- **Pronto quando:** o Security Advisor não mostra nenhum ERROR, e os WARN restantes estão justificados (ex.: `vector` no schema public). **Atingido em 28/09**: 0 ERROR; WARN restantes: 4 helpers de RLS executáveis por anon (justificado acima), funções que o app chama logado (intencional), `vector` no public e a senha vazada (Eduardo liga no painel).

**S4 — Rotina para não voltar**
- [ ] Rodar o Security Advisor ao fim de todo sprint que mexer no banco (registrar no handoff).
- [ ] Convenção do schema §6 valendo para tudo: policy nunca `true` para `authenticated` em dado interno; usar `e_equipe()` ou papéis.
- [ ] Migration-base do schema (Fase 2) para o repo voltar a ser a fonte da verdade.
- Fora de segurança, mas vale rever antes de "liberar": o projeto está no plano Free, **sem backup** (decisão consciente de 22/09).

## Fase 2 — Base do repositório
- **Entrega:** o repo volta a descrever o banco inteiro.
- **Tarefas:**
  - [ ] Gerar uma migration-base com o schema atual (dump só de estrutura) e guardar em `supabase/migrations/`
  - [ ] Documentar no TRD como aplicar migrations (MCP) e manter os nomes alinhados
  - [ ] Trocar o `README.md` padrão do Vite por um README do Hub que aponte para `docs/`
- **Pronto quando:** um banco vazio + as migrations do repo = o schema de produção (comparar as listas de tabelas, policies e funções).

## Fase 3 — Validar os níveis ao vivo
- **Entrega:** cada papel testado com login real.
- **Depende de:** push do front (Eduardo, VS Code).
- **Tarefas:**
  - [ ] Criar contas de teste: Corretor, Marketing, Admin, Sem nível
  - [ ] Conferir menu, rotas e dados de cada um contra o App Flow §2
  - [ ] Suspender, reativar e excluir uma conta de teste
  - [ ] Revisar o lado admin da esteira logado como ADM
- **Pronto quando:** checklist do App Flow §2 marcado para os 4 papéis.

## Fase 4 — Fechar a esteira de locação
- **Entrega:** esteira pronta para volume real.
- **Tarefas:**
  - [ ] Brevo: liberar a checagem de IP das chaves de API
  - [ ] Descartar, rejeitar e expirar proposta também limpam o Storage (RF14)
  - [ ] "Finalizar processo": só apagar depois de confirmar que o `.zip` foi gerado (ou guardar cópia)
  - [ ] Limpar o registro órfão de 21/08 e os 11 arquivos de teste
  - [ ] Arquivar os fluxos antigos da esteira no n8n (Tally)
  - [ ] Testar ao vivo a jornada do portal destravando sozinha
  - [ ] Revisar o dashboard e os dados da esteira
- **Pronto quando:** uma proposta de teste vai de `nova_proposta` a `sincronizada` e, no fim, o Storage não tem arquivo dela.

## Fase 5 — Dados de performance confiáveis
- **Entrega:** números de mídia e leads que batem com as plataformas.
- **Tarefas:**
  - [ ] Acompanhar leads do Google chegando com `gclid`; primeiro lead real do bot com mídia inferida
  - [ ] Proteger o webhook do `wpp_gtm` com chave no cabeçalho
  - [ ] Corrigir `imovel_titulo` (mapeamento no n8n / variável no GTM) e usar os cookies de UTM como reserva
  - [ ] Mover o token da Meta e a senha do Imoview para as credenciais do n8n
  - [ ] Validar os números contra o Gerenciador de Anúncios e apagar os backups de 23/09
  - [ ] Conversões offline de volta ao Google Ads (precisa de developer token)
- **Pronto quando:** investimento e leads de agosto e setembro no dashboard = plataformas (±2%).

## Fase 5b — Painéis Comercial e Operacional (RF16, RF17; catálogo no PRD §5.1)
- **Entrega:** duas páginas novas, `/dashboard/comercial` e `/dashboard/operacional`, ao lado das atuais (nenhuma página existente é removida nesta fase).
- **Depende de:** dados da Fase 5 (Meta já corrigida em 24/09). Sem mudança de banco: lê tabelas e views que já existem.
- **Tarefas:**
  - [x] Protótipo por catálogo de cards (24/09) — reprovado: "só números, sem história"
  - [x] **Painel da Gestão** (`/dashboard/gestao`, PRD §5.0): filtros na URL, capítulos 0–5 com gráficos, saúde dos dados — primeira versão no localhost (24/09)
  - [x] **Painel de Performance** (`/dashboard/performance`, PRD §5.0b) — primeira versão no localhost (24/09)
  - [ ] Ajustes de conteúdo e visual depois da revisão
  - [x] Páginas antigas do Dash e protótipos removidos; endereços antigos redirecionam (24/09)
- **Pronto quando:** cada card bate com uma consulta SQL de conferência e o Eduardo aprova os dois painéis.

## Fase 6 — Metas (nova feature: aplicar o framework completo)
- **Entrega:** tela de metas para o Marketing e calculadora de funil.
- **Depende de:** Fase 5.
- **Antes de codar:** seção nova no PRD, fluxo no App Flow, e **decidir no Schema qual das 5 tabelas de metas fica** (`metas`, `metas_mensais`, `metas_campanhas`, `metas_atividades_tipo`, `campanhas_metas`), com migração das outras.
- **Tarefas:** a detalhar depois da especificação.
- **Pronto quando:** o Marketing cadastra a meta do mês e a TV e os dashboards passam a usar essa meta.

## Fase 7 — TV Display, Sprint 3
- [x] Importar a escala de plantão (PDF) + painel "Plantão da semana" na TV (PRD §5.3, RF19) — no localhost (24/09); falta importar outubro e o push
- [x] KPIs da TV com as mesmas definições do Painel da Gestão (ritmo 30 dias, negócios pela data de fechamento, conversão da safra madura, sem contato, atividades vencidas) — 24/09
- [ ] Teste e ajuste na TV real (tempos, legibilidade a distância, 24/7)
- [ ] Escala de plantão em dia; sincronizar `imoveis_locados` com o Imoview

## Fase 8 — Home por nível (RF20, PRD §5.4)
- [x] Home nova no localhost para o Eduardo conferir (24/09)
- [x] Ajustes da revisão: agenda da semana (eventos + fotógrafo), banner fora da Home (24/09)
- [ ] Confirmar formulários/eventos nos links e o que mais entra na Home
- **Pronto quando:** cada nível entra e acha o próprio trabalho em um clique; nenhum bloco é só leitura.

## Fase 9 — Proposta de venda (RF21, PRD §5.5)
Código feito pelo OpenCode em 25/09 sem os docs; revisado e corrigido em 28/09 (RPCs falhavam sempre chamadas pela função; UPDATE direto liberado para proponente/corretor; histórico do descarte errado). Migration testada em produção com `BEGIN … ROLLBACK` (20 cenários de papel/permissão passando).
- [x] Eduardo aprova o PRD §5.5 e responde as perguntas em aberto (28/09)
- [x] Aplicar a migration `20260925130000_propostas_venda` (conector MCP) — 28/09
- [x] Publicar a Edge Function `proposta-venda` — v1 em 28/09
- [x] Commit do frontend (`fde1332`) — [ ] push (Eduardo)
- [ ] Roteiro `docs/proposta-venda-teste.md` com um e-mail de teste (conferir também se o magic link volta para `/venda` — Redirect URLs do Supabase) de ponta a ponta
- **Pronto quando:** uma proposta real vai do corretor à assinatura e o PDF abre em `/admin/vendas`; proponente e corretor não conseguem alterar nada fora do fluxo.

## Fase 10 — Esteira de locação v4 (RF22, PRD §5.6)
- [x] Eduardo definiu o fluxo (28/09): gestor registra os termos, locatário valida ou pede correção, validar abre a esteira
- [x] 10.1 Banco: migration `20260928140000_esteira_v4_validacao_locatario`, testada em `BEGIN … ROLLBACK` (criar, duplicada, sem papel, sem valor, RPC pela API, correção, correção vencida, editar sem permissão, reenviar renovando prazo, validar, validar 2×, editar depois de validar, recriar por cima da esteira). O teste pegou um bug de NULL na permissão de editar, corrigido.
- [x] 10.2 `esteira-locacao`: eventos `editar_proposta`, `validar_proposta`, `pedir_correcao`; saem `confirmar_dados_locatario` e `decisao_interna`; e-mails novos
- [x] 10.2b Condições negociadas (modelo do e-mail da equipe): colunas novas + `propostas_locacao_interno` para a taxa; testado em transação (termos obrigatórios, taxa invisível ao locatário, visível à gestão, editar atualiza tudo)
- [x] 10.3 Frontend: Propostas (form completo, correções pedidas, editar/reenviar), detalhe, portal (validação + pedir correção, 4 etapas), pendências da Home
- [x] 10.4 Teste antes da produção (28/09): etapa A aditiva no banco + função paralela `esteira-locacao-v4` (links para localhost, avisos só para o Eduardo) + localhost via `VITE_FUNCAO_ESTEIRA`. O Eduardo validou "Gabriel Teste" com as condições e a taxa, e ela entrou na esteira
- [x] 10.5 Publicado (28/09): etapa B (limpeza) → `esteira-locacao` v20 → push `62c6113` (Vercel `index-6tlexV5k.js`); função de teste desativada (responde 410)
- [ ] 10.6 Ciclo de correção ("Algo está errado" → corrigir e reenviar) com uma proposta real (coberto nos testes do banco, não no navegador)
- **Pronto quando:** uma proposta vai do gestor à esteira aberta só com a validação do locatário, e a correção volta ao gestor e retorna validada.

## Fase 11 — Formulários no Hub (RF23, PRD §5.7) — 1ª entrega no ar
- [x] Eduardo aprovou (28/09): aviso só ao corretor; só registro
- [x] 11.1 Banco: migration `20260928160000`, testada em `BEGIN … ROLLBACK` (12 cenários de permissão)
- [x] 11.2 Edge Function `captacao` (pública com JWT anon: validação, honeypot, e-mail à equipe)
- [x] 11.3 Front: `/captacao/:corretor` (público, em etapas, assinatura, PDF no navegador), `/captacoes` (lista + PDF + links dos corretores), `/feedback-visita` (form + PDF) e histórico, bloco "Ferramentas" na Home
- [x] 11.4a Publicado (28/09): migration, função `captacao` v1, push `687a800` (Vercel `index-CMo3-Uqs.js`); página pública conferida em produção
- [ ] 11.4 Teste com um envio real (ficou para o fim, junto da bateria final)
- [x] 11.5 Links do Tally de Captação e Feedback desativados em `biblioteca_links` (`ativo=false`, reversível)
- [x] 11.6 Apresentação Imovit (`/apresentacao/:token`, evento `consultor` na função `captacao`) + Materiais para clientes (`/materiais`) + link da CasaDezoito — código pronto (28/09)
- [ ] 11.7 Eduardo revisar o texto da apresentação → publicar
- Depois: Avaliação; Guia de visita; Relatório do imóvel.

## Fase 12 — Dados confiáveis e dashboards v2 (RF24, PRD §5.8) — PROPOSTA (29/09)
Ordem pensada para a precisão: primeiro o dado acumula certo, depois as métricas, e só então as telas. O relógio do histórico só começa quando o S2 estiver no ar, então vale fazer S0–S2 o quanto antes.

**S0 — Base e decisões (Eduardo + eu, ~meio dia)**
- [ ] Eduardo aprova PRD §5.8, Schema §2.6 e este plano, e responde às perguntas em aberto (PRD §8: P2, P4, P6). P1, P3 e P5 decididos em 29/09
- [x] Supabase Pro assinado (01/10; plano `pro` confirmado na organização). Backup diário: o 1º ainda não foi verificado no painel
- [ ] Verificar na API do Imoview se existe histórico de fases por atendimento (se existir, dá para recuperar parte do passado)
- **Pronto quando:** docs aprovados e backup confirmado.

**S1 — Banco acumulativo (eu)**
- [x] Migration `20261001160000_crm_jornada` aplicada (01/10): RPC + `crm_atendimento_jornada` + `crm_leituras` (desenho revisto, Schema §2.6)
- [ ] (original) Migration: `crm_atendimentos_captura`, `crm_funil_etapas`, `crm_atendimento_transicoes`, gatilhos e RLS (Schema §2.6)
- [ ] `dashboard_atendimentos_crm` passa a ser mantida pelo gatilho; a escrita direta do n8n continua aceita até a virada (convivência)
- [ ] Teste em `BEGIN … ROLLBACK`: capturas repetidas no mesmo dia não duplicam; mudança de fase gera 1 transição; sem mudança, 0 transições; estado atual igual à última captura
- **Pronto quando:** os testes passam e a migration está no repo e em `schema_migrations`.

**S2 — Novo fluxo no n8n (eu escrevo, Eduardo importa e liga as credenciais)**
- [x] **`crm_jornada_diaria v3` ATIVO (06/10, n8n `OrueN2tGYYqploMp`)**: base carregada por SQL, 1ª leitura OK (677 lidos, 21 mudanças), valor e data do negócio achados no payload. v1/v2 arquivadas.
- [x] Fluxo `crm_jornada_diaria` criado no n8n **desligado** (01/10, id `4tzh8UFpxciJOYiY`); faltam credenciais (Eduardo) e a RPC no banco
- [ ] (original) Fluxo novo `crm_captura_diaria`: roda 1×/dia e busca **todos** os atendimentos em atendimento + os encerrados nos últimos N dias, **sem** `dataInicial = ontem`, e só **insere** em `crm_atendimentos_captura` (com `payload`)
- [ ] Senha do Imoview sai do parâmetro da URL e vai para uma credencial
- [ ] Carga inicial: a primeira captura vira a "foto" de partida de cada lead
- [ ] Rodar em paralelo com o `crm_atendimentos` atual por 3 dias; conferir contagens por fase × Imoview; depois desligar o antigo
- **Pronto quando:** 3 dias seguidos com a contagem por fase igual à do Imoview e transições aparecendo.

**Adiantado em 29/09 (pedido do Eduardo: "começar pela página de dados do comercial"):** S3 e S4 na primeira versão, sobre os dados de hoje (fase atual), em `/dashboard/comercial`. Os cálculos ficam num módulo único, `src/lib/painelComercial.js`, e não em funções SQL: mesmo padrão dos outros painéis, sem migration antes do Pro. Conferência por SQL feita em 2 recortes (setembro sem filtros; 90 dias · Venda · Site): todos os índices batem. Quando o S1/S2 entrar, as funções de etapa trocam de "coorte pela fase atual" para "evento de chegada na etapa", e aparece o tempo por etapa.

**S3 — Camada de métricas (eu)**
- [x] 1ª versão em `src/lib/painelComercial.js` (29/09); falta a versão com histórico
- [ ] Funções SQL com os filtros (`de`, `ate`, `finalidade`, `corretor`, `midia`) e o **filtro geral** (só equipe comercial ativa) para: índices comerciais, funil de 7 etapas com taxas, tempo por etapa, visitas por região e tipo, canais, propostas e valor na mesa, ritmo, perdas e custo da perda
- [ ] Uma consulta de conferência por métrica (documentada no PRD §5.1)
- [ ] Revisar o dicionário do PRD §5.1: sai a "safra madura" fixa; toda métrica segue o período escolhido
- **Pronto quando:** cada métrica bate com a consulta de conferência em 3 recortes diferentes.

**S4 — Página Comercial (eu → revisão do Eduardo)**
- [x] Barra de filtros com período, finalidade, corretor e mídia (na URL); a lista de corretores só mostra a equipe comercial ativa (29/09, localhost)
- [x] 1ª versão no localhost (29/09): 4 índices, funil de 7 etapas (coluna de tempo reservada), ritmo, descartes + simulação, mídias, bairros e tipos visitados, em atendimento e valor na mesa, com subtexto de recorte em cada gráfico
- [x] Corretor vê só os próprios dados: tela travada ("Meus números") + migration RLS testada em transação (29/09)
- [x] "Sem nível" não lê dados comerciais: migration `20261001120000` aplicada (01/10)
- [x] Trava do corretor `20261001130000` aplicada; push `cd36fdd` (01/10)
- [ ] Revisão do Eduardo; depois push
- [ ] 4 índices, funil com tempo por etapa, regiões e tipos no tempo, e os gráficos mantidos, todos com subtexto de filtro
- **Pronto quando:** trocar qualquer filtro muda todos os gráficos, e o Eduardo aprova.

**S5 — Página Performance (eu → revisão)**
- [ ] 5 índices (investido, alcance, engajamento médio, conversões, CPL) com os filtros; o resto da página como está
- **Pronto quando:** investido e conversões batem com Meta/Google no mesmo período (±2%).

**S6 — Página Geral** — depende da resposta P2.

**S7 — Kanban (pode ir a qualquer momento, é independente)**
- [x] Código do atendimento em cada card; filtro por etapa; abre com "Últimos 7 dias" + em atendimento (29/09, localhost)

**S8 — Virada e validação**
- [ ] TV e Home passam a usar a mesma camada de métricas
- [ ] Bateria de conferência com o Eduardo; push; handoff

## Fase 13 — Campanha Km 32 na Home (RF25, PRD §5.9) — **NO AR (06/10)**
Depende de: jornada ativa (Fase 12, `crm_jornada_diaria v3`, ok em 06/10).

**Ajuste de 19/10 (PRD §5.9):** a locação passa a contar contratos iniciados (`contratos_locacao.data_inicio` de 01/10 até hoje, sem cancelados). Migration `20261019180000_km32_locacao_contratos`, testada numa transação abortada: 3 contratos e R$ 39.450, igual ao número do Eduardo. Telas: `TrilhaKm32.jsx` e `Km32TV.jsx` (quebra entre ativos e em ativação, rodapé com a regra). A migration e o deploy saem juntos.

**S1 — Banco**
- [x] Migration: `campanhas`, `campanha_metas` (com a carga do Km 32), RLS e `campanha_resumo()` (Schema §2.8)
- [x] Teste em transação desfeita, com negócio simulado (venda e locação, com e sem valor, antes e depois de 06/10, reaberto) e permissões (corretor recebe o total; "Sem nível" e anon não recebem nada)
- **Pronto quando:** o resumo bate com uma consulta de conferência na jornada.

**S2 — Tela**
- [x] `TrilhaKm32.jsx` lê `campanha_resumo('km32-4tri-2026')`; sai a constante fictícia
- [x] 4 números (valor, negócios, ticket, ritmo), rodapé com a regra e a atualização, e os estados do App Flow
- [x] 13/10: meta total de volta no banco; quadros = valor/% da meta, ticket, próxima parada (urgência) e em proposta (migrations `20261013120000_campanha_resumo_em_proposta` e `20261013130000_campanha_resumo_proposta_30_dias`, verde = interação em até 30 dias); sai o quadro de volume
- [x] 16/10: 1º quadro = realizado no mês × meta do mês (régua diária); 3º quadro = esperado até hoje, acima/abaixo. `campanha_resumo` devolve `valor_mes`/`negocios_mes` (migration `20261016140000_campanha_resumo_valor_mes`)
- [x] 16/10: painel Km 32 no rodapé da TV Display (Venda e Locação lado a lado, relê a cada 5 min) e barrinhas do carrossel do rodapé clicáveis. A régua saiu do `TrilhaKm32` para `src/lib/campanhaKm32.js` + `src/hooks/useCampanha.js`
- [x] Bloco só para quem tem nível; "hoje" a partir de 06/10
- **Pronto quando:** com dados reais, a tela mostra o mesmo que a consulta de conferência; build ok.

**S3 — Preview e produção**
- [x] Branch `campanha-km32` → preview na Vercel; conferir as envs de Preview e a Deployment Protection
- [x] O Eduardo e o gestor aprovam o preview → merge na `main` (produção)
- **Pronto quando:** no ar em hub.imovit.com.br, conferido logado. ✅ 06/10, merge `4497583`, bundle `index-C_5R_s4l.js`.

**Depois:** conciliação com contratos e financeiro; comemoração ao bater a parada.

## Fase 14 — Lançamento para o time sem Propostas (PRD §5.10) — 06/10
- [x] Chave `VITE_MODULO_PROPOSTAS` (produção desligada; teste ligada), atalhos do corretor (Meus números, Captações) e pendência de leads apontando para "Meus números"
- [ ] Eduardo: env de Preview na Vercel + branch `teste` no ar + URL do teste nas Redirect URLs do Supabase
- [ ] Bateria de aceite das Propostas no teste (roteiro na Fase 11/handoff)
- [ ] Liberar contas de corretor em produção (Home, Dash, Ferramentas) e piloto

## Fase 15 — Corretor no Dash + "Ver como" (PRD §5.11) — 06/10
- [x] Migration `20261006230000_corretor_dash_performance` aplicada (teste: o corretor recebe os 508 pagos pela função × 85 lendo direto; 0 atendimentos de outros; "Sem nível" negado)
- [x] Menu do Dash por nível; Kanban/Dados/Relatório com o filtro "só o meu"; atalho "Meus atendimentos"
- [x] "Ver o Hub como" (Gestão) — testado em localhost como Gabriel Simon: menu, Meus números, Kanban (13 cards, só dele), Relatório, Performance, pendências (33 leads sem contato)
- [ ] Conferir com o primeiro corretor real logado

## Fase 16 — Jornada do lead: tempos, perdas e motivos (PRD §5.12) — aprovada (19/10); no localhost
- **S0:** o Eduardo cola a v5 do "Marcar fase" (interações dos descartados), e eu confiro o primeiro descarte e o padrão do texto do motivo.
- **S1:** views `vw_jornada_etapas` e `vw_jornada_descartes` (Schema §2.9), testadas em transação e com consulta de conferência.
- **S1 feito (19/10):** views aplicadas (`20261019140000_vw_jornada`); números de outubro conferidos em SQL.
- **S2 (revisto em 19/10):** vai para o **Painel da Gestão**, como capítulo 3 ("Quanto tempo o lead leva em cada etapa?", jornada em linha da maquete v4) e capítulo 4 ("Por que os leads são descartados?", motivos; clicar num descarte do capítulo 3 filtra a etapa). Os dois seguem período, finalidade, canal e corretor. Os capítulos seguintes passam a ser 5 a 8. Sem os cartões de tempo até o negócio e de parados, que saíram na v4.
  - Código: `usePaineis.js` (carga), `painelGestao.js` (`jornadaLead`, `motivosDescarte`), `Graficos.jsx` (`JornadaLinha`, `MotivosDescarte`), `hub.css` (`.jl-*`) e `PainelGestao.jsx`.
- **S3:** publicar e acompanhar; os tempos ganham amostra com as semanas.

## Fase 17 — Carteira de locação: contratos ativos (RF26, PRD §5.13) — proposta (07/10)
- **S0 Descoberta — FEITA (07/10):**
  - contratos em `ContratoAluguel/RetornarContratos` (só `chave`, 50 por página, 17 páginas);
  - cobranças em `Movimento/RetornarMovimentos` (módulo 2);
  - L3 respondida pelos dados; Schema §2.10 e PRD §5.13 ajustados aos campos reais;
  - `crm_adm_contratos` (endpoint `App_`, limite 100) descartado.
- **S1 Banco — FEITO (07/10):**
  - migrations `20261007200000_carteira_locacao` e `20261007220000_carteira_locacao_v2`, testadas em transação e aplicadas;
  - RLS testado: Gestão e ADM leem; corretor 0 linhas e sem RPC; anon negado.
- **S2 Carga — FEITO (07/10):**
  - n8n `carteira_locacao_diaria` (`5fGPj1tBxlqbB0N2`) com as credenciais do Eduardo; 3 rodadas manuais OK;
  - **ainda não ativado.**
  - Edge Function `carteira-locacao` v1 (lê tudo, inclusive as pagas; chamada pelo painel).
  - **Falta a secret `IMOVIEW_API_KEY`** nas Edge Functions; sem ela os recebimentos não carregam.
- **S3 Tela — FEITA no localhost (07/10):**
  - `/dashboard/adm-locacao`: manchete + 8 capítulos, filtros, listas;
  - conferida com dados reais logado como Gestão; `npm run build` ok.
  - `oxlint` não roda nesta máquina (binário nativo ausente).
- **S4 Publicar:**
  - [ ] secret `IMOVIEW_API_KEY` no Supabase (Edge Functions → Secrets);
  - [ ] ativar o n8n;
  - [ ] commit + push na `main` + `main:teste`;
  - [ ] conferir com a ADM na 1ª semana (atenção, reajustes vencidos, seguros).

## Fase 18 — Estoque de imóveis: painel + busca (RF27, PRD §5.14) — **aprovada como construída em 23/10**; falta a S5 (adoção)
- **S0 Captador (E4) — feito em 16/10:** `App_RetornarDetalhesImovel` traz o captador (10 de 10). Migration `20261016120000_estoque_captadores` + sub-fluxo n8n `estoque_captadores_bloco` (100 por bloco), chamado depois da carga diária só para os pendentes. 1ª leitura: ~1.300 imóveis.
- **S0b Card da carteira na Gestão (pedido de 16/10):** capítulo 4 do Painel da Gestão (PRD §5.0c), por captador, atualizados × desatualizados, mais o valor desatualizado (venda em R$, locação em R$/mês). **Pronto quando:** os números batem com o banco, testado no localhost como Gestão, `npm run build` passa.
- **Revisão de 16/10 (PRD §5.14, "Revisão de 16/10") — aprovada, feita e publicada em 16/10 (S0c e S4', commit `dfe1c5d`).** Ordem:
  - **S0c Card "Quanto temos disponível?" + mapa de calor** no Painel da Gestão: Vago/Disponível por finalidade e tipo, valor e ticket; mapa Leaflet + `leaflet.heat` com o estoque atual. Dados da `vw_estoque_imoveis` (já liberada para a Gestão). **Pronto quando:** os números batem com o SQL, o mapa mostra Campinas com o calor nos bairros certos (conferir 3 imóveis), testado no localhost como Gestão, `npm run build` passa.
  - **S4' Busca para corretor e Gestão** (`/dashboard/estoque`):
    - migration `20261016150000_estoque_busca` (aplicada): RPCs `estoque_busca()` e `estoque_bairros()` `security definer`, que conferem o papel e só devolvem a ficha comercial; a busca e as margens rodam no navegador (~1.300 imóveis), sem índice de texto. Testado: corretor lê 1.308 pela RPC e 0 na tabela; marketing e ADM recebem 42501; anon sem `execute`;
    - interpretador da frase em `src/lib/buscaImoveis.js` com testes de frases reais;
    - tela com caixa de busca, chips, filtros, os três blocos de resultado, ordenação (6 opções, na URL) e a ficha; item "Estoque" no Dash para corretor e Gestão;
    - **pronto quando:** 10 frases de teste viram os chips certos, os resultados batem com o SQL, testado no localhost como corretor e como Gestão, `npm run build` passa.
    - [x] 16/10: busca tolera erros de português (correção pelo som + 1 letra, protegendo as palavras do estoque e dos bairros) e avisa o que corrigiu (PRD §5.14).
- **S1 Banco:** migration do Schema §2.11 (tabela, views, RPC de carga), testada em transação. RLS: Gestão lê; corretor, ADM e anon recebem zero.
- **S2 Carga (revista em 09/10, vem antes do resto):**
  - fluxo n8n `estoque_imoveis_diario` que lê o Imoview direto (sem Edge Function) e grava pela RPC. Criado desligado; o Eduardo liga as credenciais Imoview e Supabase, roda uma vez e ativa às 5h30;
  - a 1ª execução também mostra os nomes exatos dos campos de endereço; a RPC é ajustada se preciso;
  - **pronto quando:** `estoque_cargas` mostra quantidade lida = quantidade da API nas duas finalidades.
  - **15/10, feito:** reestruturado em blocos de 12 páginas via sub-fluxo `estoque_imoveis_bloco`, porque a carga numa execução só passava de 250 MB e travava. 1ª carga completa OK em 9 min: Aluguel 4.460/4.453, Venda 6.760/6.754. Falta ativar às 5h30.
- **S2b Planilha de duplicados (pedido do Eduardo, 09/10):** `vw_estoque_duplicados` → `.xlsx` para o time (aba de grupos com certeza e "o que fazer" + aba de resumo por bairro/captador).
- **S3 Painel:** maquete com o CSS do Hub → `/dashboard/estoque` (6 capítulos, lista de trabalho); testado no localhost como Gestão; publicar.
- ~~**S4 Busca por regras:** RPC `buscar_imoveis`, `/imoveis/buscar`, só Gestão.~~ **Substituída pela S4'** (revisão de 16/10). Não construir a `buscar_imoveis`.
- **S5 Adoção (reescrita em 23/10):** a busca está no ar desde 16/10 para corretor e Gestão, mas a adesão do time ainda é fraca, e a implantação é gradual, sem forçar.
  - **Pronto quando:** um número mínimo de corretores (a definir pelo Eduardo) usou a busca para atender um cliente real, e o Eduardo ouviu o retorno deles e ajustou margens e ordenação.
  - Sem data fixa; conferir a adesão uma vez por mês.
  - Ideia, não aprovada: registrar quantas buscas cada pessoa faz, para medir a adesão sem perguntar.
- ~~**S6:** liberar para o corretor.~~ **Feito dentro da S4'** (16/10).
- **Depois:** texto livre com o Claude (S7, B3), só depois da S5.

## Fase 19 — Cadastro Locador PF no Hub (RF28, PRD §5.15) — aprovado (09/10)
- **S1 Banco:** migration §2.12 (tabela + RLS), testada em transação. RLS: gestão/adm leem; anon zero.
- **S2 Função:** `cadastro-locador` (evento `enviar`: valida → insere → Brevo para `administrativo3@` + cópia ao locador). Deploy pelo MCP.
- **S3 Form público:** `/cadastro-locador` no padrão `CaptacaoPublica` (5 blocos, CSS do Hub), testado no localhost.
- **S4 Produção Propostas:** `acessos.js` (gestão+adm, sem gate) + lista `/admin/cadastros-locador` + item no menu Propostas. Push `main`; conferir como gestão e como corretor.
- **Depois:** upload de documentos no Hub (RF28.5); corretor nas Propostas; token por corretor/imóvel se o link fixo gerar ruído.

## Fase 20 — Distratos (RF29, PRD §5.16) — **NO AR em 14/10** (commit 4c64908, só Gestão); falta importar as planilhas (S5)
- **S0 Aprovação:** P1–P3 respondidas e "pode construir" em 14/10; só Gestão (D8).
- **S1 Banco:** migration §2.13 (tabela `distratos` + RLS + RPC `contratos_para_distrato`). Testar em transação desfeita: gestão e adm veem; corretor e anon recebem zero.
- **S2 Função:** `distrato` (criar/abrir/enviar/cancelar), com os e-mails pelo Brevo (`notificar` da `cadastro-locador`). Deploy pelo MCP.
- **S3 Link público:** `/distrato/<token>`, com 3 passos + comprovante, no padrão `CadastroLocador`/`CaptacaoPublica`. Testar no localhost e no celular (375 px).
- **S4 Lista ADM:**
  - `/admin/distratos` com novo distrato, lista, detalhe e resumo de motivos/NPS;
  - item no menu Propostas (`acessos.js`);
  - push `main` + `main:teste`;
  - conferir como gestão e como corretor.
- **S5 Importar o histórico:** as 2 planilhas do Google (respostas antigas) → `distratos` com `origem = planilha`. Bloqueado: o conector do Drive não acha os arquivos (outra conta); precisa de compartilhamento ou CSV.
- **Pronto quando:** os critérios do PRD §5.16 forem atendidos, com um distrato de teste ponta a ponta e os 2 e-mails recebidos. Apagar o teste depois.
- **Depois:**
  - etapas após o aviso (vistoria, aprovação do proprietário, chaves, documentos);
  - motivos e NPS no capítulo 4 do Adm locação;
  - upload de contas e CND.

## Fase 21 — Central de Cadastros (RF30, PRD §5.17) — aprovada (14/10, pode construir)
- **S1 Banco:** migration §2.14 (tabela `cadastros` + RLS + migração das linhas de `cadastros_locador`), testada em transação desfeita. RLS: gestão/adm leem; anon zero.
- **S2 Função:** estender `cadastro-locador` (parâmetro `tipo` + destinos por tipo + validação PJ), mantendo compat com o payload sem `tipo`. Deploy pelo MCP.
- **S3 Front (piloto Locador PJ):** `src/lib/cadastros.js` (config dos tipos + links) + blocos compartilhados + rota dinâmica `/cadastro/:tipo` + `/cadastros` (seletor) + redirect de `/cadastro-locador`; lista `/admin/cadastros` com filtro (redirect da antiga); Ferramentas ▸ Cadastros com os links. Só `locador-pf` e `locador-pj` habilitados.
- **S4 Histórico:** `scripts/importar_cadastros_planilha.mjs` (CSV → `cadastros`, `origem = 'planilha'`, sem e-mail). Eduardo exporta as 2 planilhas em CSV e roda local; conferir contagem × linhas na lista.
- **S5 Publicar:** push `main` + `main:teste`; teste ponta a ponta de um Locador PJ (tabela, lista, 2 e-mails); conferir como corretor (só links, sem lista).
- **Pronto quando:** os critérios do PRD §5.17 forem atendidos.
- **Depois:** habilitar fiador-pf → fiadora-pj → locatários na mesma estrutura (S2/S3 por tipo, sem migração nova); upload de documentos (RF28.5).

## Fase 22 — Painel da Gestão v2: foco no atendimento (RF31, PRD §5.0c) — aprovada (15/10)
- **S0 Aprovação:** "pode construir" em 15/10; equipe = `colaboradores_raw.cargo`; na média = ±10%; Canais sai.
- **S1 Dados (sem migration):**
  - incluir `funil` em `COLUNAS_BASE` (`usePaineis.js`);
  - carregar as atividades realizadas do período, com `nomeusuario` e `nometipo`, sem as "Anotações";
  - carregar as propostas de venda e locação em andamento.
- **S2 Cálculo (`painelGestao.js`):**
  - `emAtendimento` (fase 4–6, ativos, por finalidade × funil);
  - `funilPorOrigem` (ativos por etapa + passagem da safra madura, inbound × outbound);
  - `perdaPorCorretor` (a passagem mais fraca, corretor × equipe);
  - `atividadesVsEquipe` (com o selo);
  - `equipeDoCorretor` (de `colaboradores_raw.cargo`);
  - sai `ritmo`/`serieMensal`/`simularGanho` da página.
- **S3 Tela (`PainelGestao.jsx` + componentes):**
  - manchete nova;
  - capítulos 1 a 3 novos;
  - o mapa de pessoas fica como capítulo 5;
  - sai Canais;
  - componentes só com tokens/hub.css.
- **S4 Carteira de imóveis (capítulo 4):** primeiro corrigir o estoque (`vw_estoque_imoveis` = 0 e `estoque_cargas` vazio), depois o capítulo. Pode ir num segundo deploy.
- **S5 Publicar:**
  - conferir os números contra SQL direto;
  - `npm run build`;
  - push `main` + `main:teste`;
  - olhar como gestão e no celular.
- **Pronto quando:** os critérios do PRD §5.0c forem atendidos.
- **Depois:** vendas em R$, quando houver fonte de valor.

## Fase 23 — Onboarding de colaboradores (RF32, PRD §5.18) — **NO AR em 19/10** (commit 0cfd8d2, produção); falta o push na `teste`
- **S0 Aprovação:** PRD aprovado em 19/10. Faltam a aprovação deste plano e as respostas P1 (data de nascimento no formulário?) e P3 (retenção do CPF). Sem a P1, a coluna existe e o campo fica fora.
- **S1 Banco:** migration da §2.16 (tabela `onboarding_colaboradores`, RLS só gestão, grants). Testar em transação desfeita: gestão lê; adm, corretor e anon recebem zero.
- **S2 Função:** `onboarding` (criar, abrir, enviar, aprovar, marcar, cancelar), com `notificar` (Brevo) no `enviar`. Testar o `aprovar` contra um código de teste e conferir a recusa por código ou e-mail duplicado. Deploy pelo MCP.
- **S3 Link público:** `/onboarding/<token>`, no padrão `CadastroLocador`/`Distrato` (validação de CPF, busca de CEP). Testar no localhost e a 375 px.
- **S4 Gestão:**
  - aba Configurações ▸ **Onboarding** (lista, ficha, aprovação, enviar acesso, checklist calculado);
  - "Definir nível" reaproveita a troca de role de Usuários & Acessos;
  - `acessos.js` só gestão.
- **S5 Publicar e testar ponta a ponta:**
  - push `main` + `main:teste`;
  - colaborador de teste: link → envio → e-mail → aprovação → linha em `colaboradores_raw` → checklist;
  - conferir como corretor (sem aba, RLS zero);
  - **apagar o teste** de `onboarding_colaboradores` **e** de `colaboradores_raw`.
- **Pronto quando:** os critérios do PRD §5.18 forem atendidos.
- **Depois:**
  - P2: fila de repique lida de `colaboradores_raw.no_repique` (mudança no n8n pelo Eduardo + botão no Hub);
  - upload de documentos;
  - desligamento (fluxo inverso);
  - outras funções além de corretor (P4).

## Fase 24 — Uma fonte só para os atendimentos (Schema §2.17, achados A1/A7) — **aprovada (28/10)**
- **Por quê:** a mesma pergunta tem duas respostas no Hub. Kanban (tabela antiga) e painéis (jornada) divergem, e 14 leads ativos não aparecem em lugar nenhum além do Km 32.
- **S1 Conferir a jornada (só leitura, o Eduardo roda):** queries da Fonte 4 em `07-mapa-de-dados.md` §6.1b. Elas respondem:
  - a jornada tem data de entrada para todos?
  - corretor, mídia e finalidade batem com a tabela antiga? Quando não batem, quem está certo no CRM?
  - de onde tirar a data do negócio?
- **S1b Ponto cego da jornada (achado em 28/10):** o 5735 está ativo no CRM e a leitura de domingo não o devolve. **FEITA em 28/10:** a fase **8 = Agendamento** (doc da API) não estava nas consultas do "Montar consultas". Nó v2 no ar (fases 1–8) e migration `20261028120000` aplicada (Agendamento = "Lead qualificado"). Texto original do passo: Corrigir no n8n (o Eduardo cola) e decidir a etapa do Hub em que ela aparece (proposta: Lead qualificado) **antes da S3**. Verificar também a fase 1 (nenhum ativo na jornada).
- **S2 View nova ao lado:** migration com `vw_atendimentos_base_v2` (mesmas colunas e ordem). Comparar com a atual: total, por mês de entrada, por fase, por canal, negócios por mês.
  - Diferença esperada: os 14 ativos, os 47 de fase e o histórico de `primeira_leitura`. Qualquer outra precisa de explicação.
- **S3 Trocar:**
  - `create or replace view vw_atendimentos_base` com o corpo da v2 (testar em `BEGIN … ROLLBACK`);
  - Kanban e Dados de Atendimento passam a ler a view;
  - o selo "Saúde dos dados" passa a olhar `crm_leituras`;
  - conferir os painéis no ar (desktop e celular) e o gabarito do CRM.
- **S4 Aposentar:** o Eduardo pausa o `crm_atendimentos` no n8n por 7 dias. Se nada quebrar, desligar. A tabela fica como arquivo morto.
- **Pronto quando:** Kanban, painéis e Km 32 dão o mesmo número para a mesma pergunta, os 14 leads aparecem e nenhuma tela lê `dashboard_atendimentos_crm`.
- **Inventário no banco (E0, 28/10)**, objetos que citam `dashboard_atendimentos_crm`:
  - `kpis_tv` (função, fora do repo);
  - `vw_atendimentos_base` e `vw_jornada_etapas` (views);
  - policies **"equipe le; corretor so os seus"** de `atividades` e `leads_wpp_gtm` (RLS).
  - Correção: `meu_nome_crm()` e `nome_corretor_crm()` **não** leem a tabela antiga (leem `perfis` e `colaboradores_raw`). As views de 14/09 não aparecem.
- ⚠ **Achado de segurança (RLS do corretor):**
  - **Hoje:** atividades e leads do WhatsApp (nome e telefone do cliente) aparecem para o corretor se o código estiver na tabela antiga, que tem a própria RLS por corretor. Como a tabela antiga não atualiza leads antigos, num lead **transferido** o corretor anterior pode continuar vendo o telefone e o novo não ver (a Q3 mede com `corretor_diferente`).
  - **Ao parar o fluxo antigo:** os leads novos ficariam sem atividades e telefone para o corretor.
  - **Armadilha:** trocar por `codigo in (select codigo from crm_atendimento_jornada)` não serve. A policy da jornada é por linha (corretor *daquele* evento), então o corretor anterior continua vendo as linhas antigas. Pelo mesmo motivo, uma view `security_invoker` com `distinct on` na jornada mostraria ao corretor anterior a última linha *visível para ele* como se o lead ainda fosse dele.
  - **Solução (E2):** uma função `security definer` `meus_codigos_crm()` (códigos cuja **última** linha na jornada tem o corretor = `meu_nome_crm()`). As policies da jornada, de `atividades` e de `leads_wpp_gtm` passam a usá-la: o dono atual vê o lead e o histórico inteiro, o anterior não vê nada. Testar simulando um corretor (`set local role authenticated` + `request.jwt.claims`).
- **Etapas:**
  - **E0 Inventário:** feito no banco (acima); faltam o corpo da `kpis_tv` e os fluxos do n8n.
  - **E1 = S1:** Q3 e o uso da coluna `id`.
  - **E2 = S2:** `meus_codigos_crm()`, view v2 ao lado, comparação número a número e teste da RLS simulando um corretor (dono atual × anterior).
  - **E3 = S3:**
    - 3a (**APLICADA em 29/10**, migration `20261029130000`), banco: view oficial, `vw_jornada_etapas`, `kpis_tv` e policies (jornada, `atividades`, `leads_wpp_gtm`) por `meus_codigos_crm()`;
    - 3b (**feita em 28–29/10**; selo de saúde por `crm_leituras` e chave do Kanban por `codigo` em 29/10), telas: `useAtendimentos` lendo a view (**adiantado e feito em 28/10**, pedido do Eduardo depois da reunião: Kanban = painéis; fase 8 → coluna Lead qualificado no adaptador); colunas do Kanban por `fase_ordem` (a fase 8 entra em Lead qualificado); selo de saúde por `crm_leituras`;
    - 3c: localhost → `teste` → `main` e conferir o deploy de produção.
  - **E4 Gabarito final:** a mesma pergunta em Kanban, painéis, Km 32 e CRM.
  - **E5 = S4 (FEITA em 09/11):** fluxo desligado em 29/10, auditoria de 06/11 sem ninguém gravando, escrita bloqueada pela migration `20261109120000` (select mantido; view com 5.399 leads antes e depois).
  - **E6 Fechamento:** docs (A1/A5/A7) e vault ✅. Depois, opcional: sentinela "visto por último em".

## Fase 25 — Processo de Locação no Hub, v1 = guia (RF33, PRD §5.20, Schema §2.20) — **APROVADA (30/10)**
Estimativa da v1: **M–G, ~1,5 a 2 dias** (sem a aba "Em andamento"), contando teste e deploy.
- **S0 Aprovação:** ✅ escopo aprovado em 30/10 (D1–D7). A página HTML da Direção fica até a ADM validar o guia (D7).
- **Andamento (03/11):**
  - S1 ✅: migration `20261103120000` aplicada, 32/32 no teste e commit `25fd624`.
  - S2 ✅: conferido visualmente pelo Eduardo; commit `f9d827c`.
  - S3 e S4 ✅: conferidos pelo Eduardo no localhost (edição, tempo real com 2 abas, "ver como" corretor); commit `b19861b`.
  - S5 ✅ **PUBLICADO em 03/11**: push `main` (Vercel ok, hub.imovit.com.br) + merge na `teste` (`748622f`, Vercel ok). Falta só uma olhada rápida no ar.
  - Próximo: S6 (validação da ADM, depois desligar a página da Direção com o Daniel).
    - O Eduardo pediu (03/11) o Hub autossuficiente: ele não tem acesso à página da Direção.
    - O item do menu se chama **"Guia do processo"**, para não confundir com "Processos" (linha do tempo das propostas).
    - Corretor e marketing veem o menu "Locação" só com esse item; o link "Propostas" vira texto para eles.
- **S1 Banco (P–M, ~2h), precisa de sessão com o MCP do Supabase:**
  - inventário real das 3 tabelas: colunas, `pg_policies`, grants, publicação realtime e corpo de `is_team()`;
  - corrigir o Schema §2.20 com o que for encontrado;
  - migration de regularização sem drop: RLS de leitura para o time ativo, escrita `is_adm_ou_gestao()` em papéis e etapas, `locacao_casos` só gestão/adm (sem tela na v1), revoke do anon;
  - testar em `BEGIN … ROLLBACK` simulando gestão, adm, corretor, `user` e anon;
  - **conferir que a página da Direção continua funcionando.**
- **S2 Leitura (M, ~3–4h):**
  - página `/admin/processo-locacao` com as abas Contrato, Administração e Equipe;
  - hook `useProcessoLocacao` (leitura + realtime);
  - mapa de raias, lista por fase e filtro por papel;
  - só componentes e tokens do Hub.
- **S3 Edição gestão/ADM (M, ~3h):** editor de etapa (criar, editar, subir/descer, excluir com aviso) e de papel. Os botões só aparecem para `is_adm_ou_gestao`.
- **S4 Menu e acesso (P, ~1h):**
  - `ACESSO.processoLocacao = ['gestao','adm','corretor','marketing']`;
  - item em `propostasNav.js` › Locação, com `acesso: 'processoLocacao'`;
  - o grupo aparece para o corretor só com esse item (RF33.4);
  - rota em `App.jsx`.
- **S5 Publicar e testar (P–M, ~2h):**
  - push `main` + `main:teste`;
  - edição cruzada Hub ↔ página da Direção;
  - como corretor: lê, não edita (tela e API) e não vê Propostas/Esteira;
  - 375 px.
- **S6 Validação da ADM:** a ADM confere o guia no Hub; depois, combinar com o Daniel o desligamento da página HTML (D7).
- **Pronto quando:** os critérios de aceite do PRD §5.20 forem atendidos.
- **v2 (quando a Esteira estiver ativa e estável):** proposta aprovada abre o caso em `locacao_casos` sozinha (trigger ou Edge Function na aprovação), e a aba "Em andamento" é ligada. Sem caso digitado à mão. Atualizar o PRD, o Schema e uma fase nova antes.

## Fase 26 — Dados bancários no onboarding (RF32.7–10, PRD §5.18b, Schema §2.21) — **NO AR em 04/11**
- **S0 Aprovação:** ✅ 04/11. B5 = Configurações ▸ Usuários & Acessos (o ADM vê só essa aba; `configuracoes` ganhou `adm`).
- Feito em 04/11: S1 testado em `BEGIN … ROLLBACK` (21/21: gestão e adm leem; adm com 0 em `onboarding_colaboradores`; corretor, marketing e anon zero; ninguém escreve direto; checks de tudo-ou-nada). S2–S4 no código, `npm run build` ok. S5: migration aplicada, função `onboarding` v3 publicada, ponta a ponta com 10 casos pela função (PIX CPF de outra pessoa e conta incompleta recusados; "mandar depois" de uso único) e tela conferida no localhost; testes apagados; push na `main` e na `teste`. **Falta:** conferir no navegador logado como ADM e como Marketing.
- **S1 Banco:** migration da §2.21 (tabela, checks, RLS `is_adm_ou_gestao()`, RPC). Testar em `BEGIN … ROLLBACK`: gestão e adm leem; corretor, marketing e anon recebem zero; o adm continua com zero em `onboarding_colaboradores`. Aplicar pelo MCP só depois do OK.
- **S2 Função `onboarding` v2:** `dados_bancarios` opcional no `enviar`, evento `enviar_bancarios`, `falta_bancario` no `abrir`, regra da chave PIX CPF. Testar com um onboarding de teste.
- **S3 Link público:** seção "Dados bancários (opcional)" + o modo "só bancário" depois do envio; aceite LGPD novo. Testar no localhost e a 375 px.
- **S4 Telas:** bloco bancário na ficha da Gestão (com copiar) e lista do ADM (lugar da B5); `acessos.js` ganha `dadosBancarios: ['gestao', 'adm']`.
- **S5 Publicar:** migration → função → push `main` + `main:teste` (ordem do Schema). Ponta a ponta com um colaborador de teste, conferir como ADM e como corretor e **apagar o teste**.
- **Pronto quando:** os critérios do PRD §5.18b forem atendidos.
- **26b Editar e excluir (B7–B8, 04/11):** migration `20261104170000` (quem editou), função v4 (`editar_bancarios`, `excluir_bancarios`), botões na lista e `SecaoBancaria` em componente próprio (`src/components/onboarding/`). Migration testada em `BEGIN … ROLLBACK`; build ok. **NO AR em 04/11:** migration aplicada, função v4 (anon recusado em editar e excluir) e push.
## Fase 27 — Plantão de locação (PRD §5.3, RF19) — aprovado (05/11)
- **S1 Banco:** migration `20261105120000_plantao_locacao` (coluna `tipo`, check, índice; `kpis_tv` devolve o tipo).
- **S2 Configurações:** seletor Vendas | Locação; cadastro à mão e importação PDF por tipo (substitui só o mesmo tipo).
- **S3 Exibição:** etiqueta cor + ícone + rótulo na Home, TV (painel e card) e no admin; pendência por tipo.
- **S4:** importar a 1ª escala de locação com o PDF real e conferir a leitura.

## Fase 28 — Blog: revisão no Hub (RF35, PRD §5.22) — **APROVADA (09/11)**
Depende do motor de pauta (`newsletters-imovit/docs/blog-pautas.md`, S1 e S2a feitas). Estimativa: **P–M, ~meio dia** com teste.
- **S1 Banco (FEITA 09/11, migration `20261109220000`, 13 passos ok em ROLLBACK):** migration (no `newsletters-imovit`, dono do blog) com a policy de leitura dos rascunhos, `decidido_por`/`decidido_em`, `blog_decidir(post_id, acao)` por `pode_editar_conteudo()`; sai `token_aprovacao`. Conferir contra este Schema; testar em BEGIN…ROLLBACK simulando gestão, marketing e corretor (corretor não lê rascunho nem decide).
- **S1b Limpeza (FEITA 09/11):** dos 46 rascunhos antigos, 7 ficam e 39 → `descartado` (lista em `newsletters-imovit/handoff.md`).
- **S2 Tela:** `/blog/revisar` (lista + leitura renderizada + Aprovar/Rejeitar com confirmação), só com tokens do design system; item no menu de Gestão/Marketing.
- **S3 Home:** pendência "N posts do blog para revisar" em `usePendenciasHome` (Gestão e Marketing).
- **S4 n8n:** `conteúdo v2` (próxima pauta → pesquisa → títulos existentes → artigo → `blog_salvar_rascunho` → e-mail curto). Dois gatilhos: **segunda 8h** (pauta nova) e **a cada 15 min** (só reescreve pauta devolvida com "o que mudar"; sem devolução, não faz nada), criado ao lado e testado com 1 execução manual; depois desligar `aprovacao_blog`.
- **Pronto quando:** um post gerado pelo v2 aparece na Home e em `/blog/revisar`, é aprovado pelo Hub e aparece no site; um rejeitado devolve a pauta para `pendente`; corretor não vê nada.
- localhost → `teste` → `main`.

## Fase 29 — Dados para a reunião (PRD §5.23) — **APROVADA (23/11)**; começa pela Saúde Imovit
Estimativa do que falta: **GG, ~6 a 8 dias**, quebrada em 29a–29f. Cada parte é publicada sozinha. Feitos em 23/11: pendência 4 (migrations `20261123150000` e `20261123160000`), 5 e 6 (29b) e as capturas (S0).

### 29a — Saúde Imovit v1 (G, ~2 dias). Placar + blocos Aquisição, Comercial e Carteira; Decisões fica para a 29f
- **S0 Capturas no ar — FEITO (23/11):** CRM religado (leitura de 23/11) e `meta_ads` com credencial nova (14–22/11 recuperados).
- **S1 Schema (doc, P) — ESCRITO (23/11), aguardando as decisões D1–D12 do Eduardo (handoff):** §2.22 + gabarito `docs/sql/saude_semanal_gabarito_2026-11-23.sql`. Seção nova §2.22 no `05-backend-schema.md` com a fonte e a régua (entrada / evento / agora) do placar e dos 9 números:
  - **Placar no topo (23/11):** negócios fechados na semana (venda + locação, pela data do negócio no CRM) e receita da semana = comissão bruta de venda (`valorcomissao`) dos negócios fechados + taxa de administração recebida na semana. Régua: **evento**.
  - Aquisição: leads que chegaram ao CRM e % de qualificados (fase ≥ 4), por **entrada**, de `vw_atendimentos_base`. Custo por qualificado: gasto de `dashboard_meta_ads` + `dashboard_google_ads` ÷ qualificados de "Campanhas pagas".
  - Comercial: visitas por **evento** (fonte a confirmar no S1: jornada ou `atividades`). Etapa gargalo e quantos estão parados acima da mediana: **agora**. Dinheiro na mesa em receita da Imovit: **agora**.
  - Carteira: taxa de administração recebida no mês (`contratos_locacao_recebimentos.taxa_adm`), por **evento**. R$ em atraso (`vw_cobrancas_locacao`) e saídas avisadas: **agora**.
  - Referência: a semana anterior e a média das últimas N semanas (até 8, rotulada "média de N semanas"). Etapa com menos de 5 casos aparece como "acumulando". O prazo de cada etapa é a mediana (pendência 7).
  - **Sinal (decidido 23/11):** verde = na média ou acima · amarelo = até 15% abaixo · vermelho = mais de 15% abaixo. Invertido para custo (custo por qualificado): verde = na média ou abaixo · amarelo = até 15% acima · vermelho = mais de 15% acima.
- **Formato granular (Eduardo, 23/11):** BLUF + detalhe por bloco (PRD §5.23, blocos 1.1–1.4 e 2.1–2.5; Schema §2.22, Q13–Q17). A estimativa da 29a sobe de G (~2 dias) para **G+ (~3 dias)**. A 29d (Aquisição e Comercial) passa a reaproveitar os blocos da Saúde Imovit em vez de construir do zero.
- **S2 v2 — PERÍODO LIVRE: APLICADO EM 24/11** (OK do Eduardo; registrado como `20261124110548 saude_imovit`). Antes de aplicar, a **manchete virou valor fechado** (Eduardo, 24/11, padrão do Km 32): venda = `valornegocio` (VGV), locação = aluguel mensal dos contratos iniciados; dinheiro na mesa = proposta/imóvel e 1 aluguel; a receita (comissão + adm + intermediação) fica em `receita_referencia`, fora da manchete. 16–22/11: valor fechado R$ 1.619.000 (1.610.000 + 9.000) × 09–15/11 R$ 7.200. Conferido no banco: funções, `saude_fotos` com a foto de 16/11, cron de domingo ativo, `saude_imovit()` como Gestão em 2,1 s. Confirmados pelo Eduardo: contratos do trimestre (início nos 3 meses até a data fim × 3 meses antes) e custo por qualificado (investimento ÷ qualificados pagos do período). **Locação contada por contratos (Eduardo, 24/11, resolve D2):** migration `20261124120000_saude_negocios_locacao_por_contrato` (só `saude_linhas()`) escrita e testada em `BEGIN … ROLLBACK`, **aguardando OK para aplicar**. 16–22/11: negócios 1 → 2 (locação 0 → 1); 09–15/11: 1 → 1; valor fechado igual. Junto com a aplicação, corrigir o placar da foto de 16/11 (`negocios` 1 → 2) para não aparecer como "revisada" (Schema §2.22). Histórico do teste antes do ajuste: Eduardo (24/11): filtros 7/14/30/60/90 dias + personalizado e finalidade todas/locação/venda; comparação = período anterior de mesmo tamanho; média de 8 semanas e foto semanal só para os "agora"; mídias sociais e GA4 como "aguardando captura"; sem Evento. `supabase/migrations/20261123170000_saude_imovit.sql` reescrita: `saude_imovit(p_inicio, p_fim, p_finalidade)` + `saude_linhas()` (total/finalidade/canal/mídia/plataforma/campanha/anúncio) + `saude_agora(p_fin)` + `saude_carteira_em()` + foto semanal (Schema §2.22 "S2 v2"). Teste em transação desfeita: 16–22/11 bate com o gabarito (diferenças só por dado novo: qualificados 11 → 12, saídas 9 → 10); 30 dias, locação e venda conferidos; gestão/marketing veem, corretor/anon barrados; banco limpo. Suposição a confirmar: contratos do trimestre = novos com início nos 3 meses até a data fim.
- *(Histórico)* S2 v1 (23/11, semana fixa, `saude_semanal(p_semana)`): escrita e testada, nunca aplicada; substituída pela v2.
- **S2 Banco (M):** migration com `saude_semanal(p_semana date)`, que devolve o placar, os alertas do BLUF e os blocos granulares, cada número com (semana, semana anterior, média, N, régua, sinal); a função da mediana por etapa; e a **foto semanal** dos números "agora" (D11). Acesso por função nova **`pode_ver_saude()` = Gestão + Marketing** (Eduardo, 23/11; a `pode_ver_dash()` inclui corretor). O Marketing vê os **totais** da Carteira e a receita (só somas; muda a regra de 07/10 só para totais). O bloco 1.4 Orgânico entra vazio até a 29e.
  - Testar em `BEGIN … ROLLBACK` simulando gestão, corretor e anon.
  - **Gabarito:** cada número bate com a página de hoje (Performance, Comercial, Adm locação) e com o CRM em 2 semanas fechadas.
- **S3 Tela (M, ~1,5 dia) — reescrito 24/11:** página Saúde Imovit chamando `rpc('saude_imovit', {p_inicio, p_fim, p_finalidade})`. Filtros no topo: chips 7/14/30/60/90 dias + "personalizado" (2 datas) e finalidade todas/locação/venda (padrão 30 dias, todas). Blocos: **Cabeçalho** (negócios, **valor fechado** venda · locação como manchete, investimento, atendimentos em aberto; receita de referência não aparece) · **Performance** (total pago; tabelas por plataforma, campanha e anúncio) · **Comercial** (totais + tabela por canal com o período anterior, finalidade e mídia; funil agora e gargalo) · **Carteira** (some no filtro venda) · **Mídias sociais** e **GA4** como cartão "aguardando captura". Cada número: valor, anterior, variação, sinal (⚪ poucos casos) e etiqueta da régua com hover; "parcial até dd/mm" nos qualificados. Aviso "semana revisada" quando `revisadas` vier preenchido. Base visual: maquete de 23/11. Só tokens e componentes do Hub. Testar a 375 px e com período de 90 dias (tempo de resposta).
  - **FEITA no localhost (24/11, Asimov), aguardando conferência do Eduardo logado:** `src/pages/SaudeImovit.jsx` + `src/hooks/useSaudeImovit.js` + `src/lib/saudeImovit.js`, rota `/dashboard/saude`. Filtros na URL (link copiável); blocos Performance, Comercial e Carteira recolhíveis (`<details>`), **fechados ao abrir** (a decidir), com botão "Abrir todos"; cabeçalho na `pg-manchete`; mídias sociais/GA4 "aguardando captura"; rodapé com a saúde das leituras. Só classes do Hub; a única regra de CSS nova generaliza o campo de data do Estoque para `.pg-campo input[type=date]`. Conferido: cabeçalho 16–22/11 = Q2b (valor fechado R$ 1.619.000 = 1.610.000 + 9.000; 1 contrato), Performance (R$ 1.360,90, 50,4 conversões, 8 → 3, R$ 170 por lead no CRM), funil (gargalo Lead qualificado 82/99), mesa R$ 7,44 mi; chips 7/30/90 e personalizado mandam as datas certas (até ontem); venda esconde a Carteira; aviso "semana revisada" e "parcial até 29/11" aparecem; 375 px sem rolagem lateral (tabelas rolam na caixa). 90 dias no banco: 3,2 s, 157 KB. Tela conferida com o JSON real injetado (sem login, ver handoff); falta o Eduardo abrir logado como Gestão. **Versão visual (24/11, pedido do Eduardo):** KPIs em `stat-card` com hover, cascata do dinheiro (`CascataDinheiro`), funil por finalidade (`FunilCascata`), gráficos de campanhas, canais (× anterior), funil agora e ativos por canal (`src/components/painel/GraficosSaude.jsx`); tabelas em "Ver tabelas"; blocos abertos.
- **Sprint B — contas da tela no banco (M, 24/11, Asimov). **APLICADO EM 24/11** (OK do Eduardo; `20261124151431` + `20261124151545`).** Decisão do Eduardo: "vamos acertar tudo e depois publicar"; a 29b vem logo depois, antes da publicação. As 6 leituras diretas da S3 (conversões, tempo de resposta, listas, coorte, funil agora e lista do funil) viram funções (PRD §5.23 "Sprint B", Schema §2.22 "Sprint B"); `numeroLocal` e `FunilVisual` saem da tela.
  - Migrations, nesta ordem: `20261124120000` (locação por contratos + correção do placar da foto de 16/11) → `20261124150000_saude_contas_no_banco`.
  - Pronto quando: os números de 25/10–23/11 batem com os da S3 (conversões 189,4 × 37; resposta 4 e 12,5 min; coorte 133/51/11/8; funil 4/12/42/99/28/7 e +30 0/0/11/76/22/3; listas 37/9/1; 192 em aberto), Gestão e Marketing leem, corretor e anon barrados, `npm run build` ok. **Aplicado e conferido no banco em 24/11; falta abrir logado.**
  - Como testar depois de aplicar: `saude_imovit('2026-10-25','2026-11-23','todas')` como Gestão → `comercial.coorte.total`, `comercial.agora.parado.total`, `performance.tempo_resposta`; na tela, clicar num degrau, numa fatia e numa fase do funil agora.
- **Mídias sociais com dado real (P, 24/11, Asimov) — testada, NÃO aplicada:** o cartão "aguardando captura" vira o bloco 4 com o orgânico do Instagram (ver 29e S7). Migration `20261124200000_saude_midias_sociais` (depois de `20261124150000` e `20261124190000`).
- **S4 Menu (P):** Saúde Imovit como 1º item de Dados ▾. A rota e quem vê seguem o fechamento da navegação (`03-app-flow.md`, "Menu Dados"). Até lá, só Gestão. **Provisório feito (24/11):** `ACESSO.saude = ['gestao']` e item "Saúde Imovit" em 1º no menu Painéis (o menu Dados ainda não existe); Marketing entra quando a navegação fechar (a função já libera).
- **S5 Publicar (P):** localhost → `teste` → `main`. Validar na reunião semanal seguinte, com o diretor abrindo só essa página.
- **Pronto quando:** a reunião roda com uma aba só e o placar e os 9 números batem com o gabarito do S2.
- **Custo por qualificado:** a conciliação (29b) já está no ar. Conferir no gabarito do S2 se os leads pagos do site aparecem como "Campanhas pagas".

### 29b — Conciliação da origem (pendências 5 e 6) — **NO AR (23/11)**
- Regra do COD no `wpp_entrada`, migration `20261123140000` e nós do n8n publicados (commit `2f79cb5`).
- **Falta:** validar com o 1º lead real (`imoview_atendimento` preenchido, mídia `site_*` no Imoview) e alinhar a mensagem padrão por campanha com a agência.
- **Conserto (24/11, Asimov) — aguarda OK do Eduardo.** Validação falhou: 0 leads ligados. Causa: ramos paralelos no `wpp_entrada` (o nó que grava o atendimento não enxerga o `lead_id`; o Imoview recebe a mídia bruta; `campanha` não é enviada). Passos, nesta ordem: (1) publicar o `wpp_entrada` com os 4 pontos de `docs/n8n/wpp_entrada__v2_29b.md`; (2) ~~aplicar a migration `20261124170000_backfill_imoview_atendimento`~~ **feito 25/11** (com filtro `created_at >= 2026-10-19`: 32 ligados, 21 entrada + 11 atividade; os ~20 candidatos de antes de 19/10 ficam para revisão futura); (3) conferir o 1º lead novo (`imoview_vinculo = 'n8n'`) e, no dia seguinte, `campanha` no CRM. **Pronto quando:** 3 leads novos seguidos com `imoview_atendimento` e os pagos com `campanha` na `vw_atendimentos_base`. Depois (decisão separada): a Saúde usar a mídia conciliada do `leads_wpp_gtm` para os leads antigos, já que o Imoview não muda o passado.

### 29c — Entrada por nível (M–G)
- Até 6 cartões por nível (Gestão, ADM, Corretor, Marketing), conforme o PRD §5.23. Os cartões reaproveitam as funções da 29a. Número sem comparação não entra.

### 29d — Aquisição e Comercial como relatórios (G)
- Performance vira Aquisição e Comercial é reorganizada pela divisão do PRD: até o qualificado/descartado é Aquisição, dali em diante é Comercial, e nenhum número aparece nas duas. Aplicar a régua de data em todos os números.

### 29e — Orgânico (pendência 8, G)
- Ponte de Instagram/Facebook, TikTok, Search Console e Google Maps via n8n, com o capítulo "Orgânico" da Aquisição. Começa só depois da 29b.
- **S0 Acessos (Eduardo, começar já, em paralelo):** pedir a API do Business Profile (Google) e o app do TikTok for Business, que dependem de aprovação externa; token Meta com as permissões de orgânico; conta de serviço no Search Console.
- **S1 Schema (doc) — PROPOSTA ESCRITA (23/11):** Schema §2.23 (`organico_metricas`, `organico_diario` longo com upsert, `organico_posts`, RPC `carregar_organico`, `vw_organico_semana`). Falta o OK para a migration.
- **S2 Banco (P) — APLICADA (24/11):** `20261124190000_organico_meta.sql` escrita (dicionário com `seguidores`, tabela longa e RPC) e aplicada pelo Eduardo. **Não passou pelo `BEGIN … ROLLBACK`**; ainda vale conferir upsert sem duplicidade, rede/métrica fora do dicionário e `anon` sem leitura.
- **S3 Instagram + Facebook (M) — 1 execução OK (24/11):** `docs/n8n/organico_meta.json` rodou só com Instagram (3h30, desligado, Query Auth, `Merge 3 respostas`, `total_value` de ontem, grava via RPC) e gravou as 7 métricas de 2026-11-23. Falta comparar com o Meta Business Suite; Facebook entra depois.
- **S4 GA4 + Search Console (M) — PREPARADO (25/11, Asimov), nada aplicado nem ligado** (briefing `docs/briefing-ga4.md`, Schema §2.23 "GA4 e Search Console"):
  - Banco: `20261125120000_organico_google` (8 métricas `ga4`, tabela `organico_dimensao`, RPC `carregar_organico_web`) e `20261125130000_saude_ga4` (cartão da Saúde). Testadas juntas em transação desfeita (dados fictícios): upsert sem duplicar, foto do dia substituída, validações, Gestão lê o cartão, corretor barrado na Saúde, anon e authenticated sem a RPC; banco conferido intacto depois.
  - n8n (todos DESLIGADOS, sem credencial ligada): `ga4_diario` (id `0kkd886fEPtpdrnU`, 4h, D-3 a D-1 por `batchRunReports`), `search_console_diario` (id `zPdpglfYYDkSHOOj`, 4h15, D-5 a D-3, descobre o formato da propriedade pela lista de sites), `organico_google_backfill` (id `xW32cqeLjDrCMILP`, manual, 90 dias; arquivar depois). Configurados para não salvar os dados das execuções que dão certo. Fonte SDK em `docs/n8n/ga4_diario.sdk.js` e `docs/n8n/search_console_diario.sdk.js`.
  - Ordem para ligar (cada passo com OK do Eduardo): (1) aplicar `20261125120000`; (2) Eduardo seleciona as credenciais nos nós (handoff); (3) 1 execução manual do `ga4_diario` e do `search_console_diario` → ler só o nó `Resumo`; comparar 3 dias com a interface do GA4 (diferença < 2%) e do Search Console; (4) backfill 1× e arquivar; (5) aplicar `20261125130000`; (6) ligar os 2 diários; (7) tela do bloco "Site e busca do Google".
  - Pronto quando: 3 dias batem com as interfaces, 90 dias carregados, os 2 diários rodando e o cartão abre logado como Gestão.
- **S5 Perfil do Google (M) → S6 TikTok (M):** conforme os acessos saírem.
- **S7 Tela:** bloco 1.4 da Saúde Imovit e capítulo Orgânico da Aquisição.
  - **Saúde Imovit — bloco "Mídias sociais" FEITO no localhost (24/11, Asimov), migration `20261124200000_saude_midias_sociais` testada em transação desfeita e NÃO aplicada (aguarda OK).** Conta no banco (`saude_midias_sociais`, Schema §2.22); tela em `src/pages/SaudeImovit.jsx` (bloco 4, ou 3 no filtro venda) + `GraficoOrganico` em `GraficosSaude.jsx`. Pronto quando: aplicada, os números de 23/11 batem (3.601 / 5.972 / 140 / 48 / 13 / 5 / 21.555) e o bloco abre logado como Gestão. Falta: leads orgânicos por rede ao lado; capítulo Orgânico da Aquisição.
- **Dependência de dado:** cadastrar no Imoview as mídias "Facebook" e "Google Perfil" (e mapear "Tik Tok"), senão essas redes aparecem sem leads.

### 29f — Decisões do micro ciclo (pendência 9, M)
- Tabela nova (Schema antes): 3 ações por semana, cada uma com dono e a métrica que deve mexer. Na semana seguinte, a página abre mostrando se a métrica mexeu.

## Fase 30 — Imoview: login de integração no n8n (Schema §2.24; plano em `docs/n8n/imoview-auth-arquitetura.md` §5, §7, §8) — **EM ANDAMENTO (26/11)**
Contexto: em 24–25/11 o Imoview mudou a API; o login App_ do usuário 79 responde "Atualize o aplicativo" e a chave antiga está desativada, então todos os fluxos com Imoview pararam. Decisão do Eduardo: 1 chave geral de Integração + usuário 111.
- **S1 — Sessão compartilhada + `wpp_entrada v4` (feito em rascunho, 26/11):** migration `20261126122845_imoview_sessao` (aplicada 26/11); sub-fluxos "Imoview: obter sessão" (`BN7laXW9hnzNt0xq`) e "Imoview: requisição" (`eeBeBvPVCwnm3XWU`); `wpp_entrada v4 (integração)` (`TQ1EWzw1e2lAfvjT`), tudo desligado. **Pronto quando:** migration aplicada (OK), credenciais selecionadas, roteiro de teste de `docs/n8n/wpp_entrada__v4_integracao.md` passando (lead novo, duplicado, lead quente, 401 forçado) e o Eduardo autorizar a troca do v3 pelo v4.
- **S2 — Jornada + Coletor (P) — cópias montadas em 26/11, DESLIGADAS:** `crm_jornada_diaria v4 (integração)` (`0RMD68fMzVNqLRl5`) e `Coletor atividades v2 (integração)` (`X5XEBWjRrwu8Am2N`). Login App_ removido; `RetornarAtendimentos` e `Agenda/RetornarAtividades` são "só chave" no Swagger, então HTTP direto com `Imoview · chave` (sem sessão); paginação 20/pág em laço próprio com 404 = vazio, 429 com `segundosparaliberar`, 5xx 2× e o resto como erro visível. Gravação no Supabase idêntica aos originais. Fonte: `docs/n8n/crm_jornada_diaria_v4_integracao.sdk.js`, `docs/n8n/coletor_atividades_v2_integracao.sdk.js`. **Pronto quando:** credencial selecionada nos 2 nós HTTP do Imoview (+ Supabase na jornada); 1 execução manual de cada uma sem erro; `crm_leituras` de hoje com `lidos` ≈ 890–900 (dia útil); `atividades` com 24–26/11 preenchidos (a carga manual cobre 7 dias); Eduardo publica as cópias e despublica os originais. Roteiro em `docs/n8n/imoview-auth-arquitetura.md` §7.1.
- **S3 — Carteira (M) — cópia montada em 26/11, DESLIGADA:** `carteira_locacao_diaria v2 (integração)` (`hIWkwG3XVB2gDb7d`). Login App_ removido (não era usado). `RetornarContratos` e `RetornarMovimentos` exigem o login de integração, então chamam o sub-fluxo "Imoview: requisição": contar, gerar páginas e 1 chamada por página. Trava de volume antes da RPC: contratos ≥ 780, ativos ≥ 140, cobranças ≥ 30. A gravação é igual (`carregar_carteira_locacao`). Fonte: `docs/n8n/carteira_locacao_v2_integracao.sdk.js`. **Pronto quando:** credencial Supabase selecionada; 1 execução manual antes das 21h sem erro; foto de 26/11 em `contratos_locacao_fotos` com ≈ 155 ativos; Eduardo publica a cópia e despublica o original. A foto de 25/11 não volta. **Pendente à parte:** a Edge `carteira-locacao` (6h45, lê as pagas) também dá 401 desde 26/11. Roteiro em §7.2.
- **S3b — Edge `carteira-locacao` (M) — código no repo em 27/11, deploy PENDENTE:** sessão pelas RPCs `imoview_sessao_obter/gravar/liberar` (a mesma do n8n; nunca login próprio), §4.4 (404/429/5xx/401 `sessaoinvalida` 1×), trava de volume antes da RPC (contratos ≥ 780, ativos ≥ 140, cobranças ≥ 30, pagas ≥ 80 % do banco na janela), modo `seco`. Secrets `IMOVIEW_CHAVE`, `IMOVIEW_EMAIL`, `IMOVIEW_SENHA`. Simulado localmente (32 checagens); não rodou no Deno nem no Imoview real. **Pronto quando:** Eduardo cadastra as 3 secrets; deploy com OK; chamada `seco` + `completo` com 200 e volumes ≈ banco; chamada `completo` grava; `contratos_locacao_recebimentos` com `lido_em` de hoje e pagamentos desde 24/11; `imoview_sessao.logins` sobe ≤ 1; o pg_cron das 6h45 do dia seguinte sem erro. Roteiro em `docs/n8n/imoview-auth-arquitetura.md` §7.3.
- **S3 — Carteira (M):** Contratos/Financeiro pelo sub-fluxo "Imoview: requisição". Testa: contratos ≈ ontem, `carregar_carteira_locacao` sem erro.
- **S4 + S5 — Estoque diário + bloco + captadores + Severino — cópias montadas em 27/11, DESLIGADAS:** sub-fluxo novo `Imoview: requisição só chave` (`9sxhfVRXgq8uDMJT`, §4.4 sem sessão); `estoque_imoveis_diario v2` (`MZcO2kmCN3omMAtS`), `estoque_imoveis_bloco v2` (`axXr4o8WRNyk3uhb`), `estoque_captadores_bloco v2` (`NswAbJHUREIsIfPP`), `severino_database_crm_imoveis v2` (`mlTfZ7ZFxkMumrmB`). Logins App_ removidos (o código ia sem necessidade); `App_RetornarDetalhesImovel` → `Imovel/RetornarImoveis` com `codigosimoveis` + `exibircaptadores` (10 chamadas por 100 imóveis). Travas antes de gravar: cadastro ≥ 4.000 / 6.000, site ≥ 60 / 230, site completo, página do meio vazia = erro, captadores < 50 % do bloco = erro; Severino confere **antes** de limpar o Baserow. Gravação igual (RPCs, tabelas, Baserow 835). Error workflow = Alerta n8n nas 5. Fonte: `docs/n8n/imoview_requisicao_so_chave.sdk.js`, `estoque_imoveis_diario_v2_integracao.sdk.js`, `estoque_imoveis_bloco_v2_integracao.sdk.js`, `estoque_captadores_bloco_v2_integracao.sdk.js`, `severino_database_crm_imoveis_v2_integracao.sdk.js`. Simulado localmente (47 checagens); **nenhuma execução no n8n**. **Pronto quando:** credenciais selecionadas (tabela do §7.4); teste à mão do §7.4 nos 5 passos; `estoque_cargas` com 2 linhas de hoje (≈ 4.500 / 6.830, publicados ≈ 118 / 461); `vigia_fontes()` com estoque OK; Baserow com ~579 linhas; Eduardo publica as cópias e despublica os originais. Roteiro em `docs/n8n/imoview-auth-arquitetura.md` §7.4.
- **Depois:** Repique 3.0 / Distribuição dependem de um substituto do `App_Transferir` (perguntar ao suporte); arquivar os inativos com segredo em texto.

## Fase 31 — Alertas por e-mail de fluxo parado (Schema §2.25) — **PREPARADA (27/11); migration aplicada, fluxos ainda desligados**
Contexto: a jornada do CRM ficou sem rodar de 18 a 22/11 e ninguém percebeu; as fotos daqueles dias se perderam. Canal decidido pelo Eduardo: **e-mail** (Gmail, nó nativo do n8n; a credencial OAuth "Gmail account" já existe e foi pré-selecionada nos 2 fluxos).
- **S1 — Alerta de erro (P):** n8n "Alerta n8n · erro" (`LvLQxnx28JDM7fB9`, desligado). Error Trigger → Configuração (`ALERTA_PARA`, silêncio 60 min) → Code (fluxo, nó, mensagem, link da execução, hora de Brasília; mesmo fluxo + nó + mensagem = 1 e-mail por hora) → Gmail. Fonte: `docs/n8n/alerta_n8n_erro.sdk.js` + `alerta_n8n_erro__montar.code.js`. **Pronto quando:** `ALERTA_PARA` trocado; credencial Gmail conferida; fluxo publicado; **Settings ▸ Error workflow** apontando para ele nos fluxos ativos (lista no `handoff.md`); teste: um fluxo de teste com nó "Stop and Error", publicado com o Error workflow, roda 1× → e-mail chega com o link; 2ª execução em < 60 min não manda outro.
- **S2 — Vigia diário (P):** migration `20261127134546_vigia_fontes` (função `vigia_fontes`, **APLICADA 27/11**) + n8n "Vigia de dados · 7h30" (`kfY7G154RvvgXykm`, desligado, Error workflow = Alerta n8n). Schedule 7h30 SP → Configuração (`ALERTA_PARA`, `tudo_ok_semanal` = false, `tudo_ok_dia_semana` = 1, `desligar` = `["organico_instagram"]`) → `POST /rest/v1/rpc/vigia_fontes` (Supabase, 3 tentativas) → Code (só atrasadas; nenhuma = nenhum e-mail) → Gmail. **Pronto quando:** Eduardo dá OK e a migration é aplicada; credencial Supabase selecionada no nó HTTP; execução manual manda 1 e-mail com as atrasadas reais do dia (em 27/11 seriam Receita e Estoque); com tudo em dia, a execução termina sem e-mail; publicado; 1ª execução agendada (7h30 do dia seguinte) sem erro.
- **Depois:** decidir se o `pg_cron` "alerta-leituras" (§2.18, 7h15) sai, porque o vigia cobre as mesmas fontes e ele não avisou 18–22/11; ligar o "tudo ok" semanal se o Eduardo quiser; religar `organico_instagram` quando o fluxo voltar.

## Fase 32 — Alerta ao corretor por WhatsApp quando o lead do Severino entra (PRD §5.24, Schema §2.26, Fluxo "Alerta do lead do Severino") — **PROPOSTA (27/11, revista: só WhatsApp), aguardando aprovação do PRD e do plano**
Contexto: o Severino responde em 8 s, mas ninguém avisa o corretor; 6 de 30 atendimentos rastreáveis sem 1ª resposta, dois há 1 mês. O `wpp_entrada v4` (`TQ1EWzw1e2lAfvjT`) está ativo desde 26/11 e grava o atendimento, mas não notifica. Repiques desligados. Depende da Fase 31 S1 ("Alerta n8n · erro" publicado; o v4 já aponta para ele em Settings ▸ Error workflow).
Decisões do Eduardo (27/11): **só WhatsApp** (o Imoview já manda e-mail e notificação no app), feriado conta como horário útil, lead que voltou entra no vigia, 3 colunas em `colaboradores_raw`, gestão = códigos 6 e 24.
Ordem: 32a → 32b → 32c. **⛔ 32b e 32c dependem do canal de envio (A ou B, abaixo).** A 32a não depende e pode ir antes. Nada vai ao ar sem o OK do Eduardo.

### O bloqueio: como o n8n manda WhatsApp
As 3 mensagens (alerta, lembrete, aviso à gestão) são **iniciadas pela empresa** para um número que, em geral, não falou com ela nas últimas 24 h. Na plataforma oficial do WhatsApp, isso só sai como **modelo de mensagem (template) aprovado pela Meta**; mensagem livre só dentro da "janela de atendimento" de 24 h, que abre quando a pessoa escreve para o número. Vale para as duas opções, se o prestador usar a API oficial.

| | **A) Pelo prestador / número do Severino** | **B) Número próprio de alertas, WhatsApp Cloud API da Meta direto do n8n** |
|---|---|---|
| Como | O n8n chama a API do prestador (HTTP) e ele envia pelo número do bot | O n8n chama `POST https://graph.facebook.com/<versão>/<phone_number_id>/messages` com o template |
| Setup | O prestador dá endpoint, credencial e cadastra os 3 templates na conta dele | 1) Meta Business (portfólio da Imovit) + app no developers.facebook.com com o produto WhatsApp; 2) conta WhatsApp Business (WABA); 3) **número novo** que não esteja em uso no app do WhatsApp (chip ou fixo; recebe o código por SMS/ligação) + nome de exibição ("Imovit Alertas"); 4) **usuário do sistema** com token permanente (vira credencial do n8n); 5) forma de pagamento na WABA; 6) 3 templates categoria **utilidade**, em pt_BR, com variáveis (`{{1}}` nome do lead etc.); 7) verificação da empresa (recomendada; sem ela há limites menores de envio, folgados para ~25 destinatários) |
| Custo | O que o prestador cobrar (pode ter margem sobre a Meta; desconhecido) | Por mensagem entregue, por categoria e país. Utilidade no Brasil ≈ **US$ 0,0068** (~R$ 0,04). Volume estimado ~10 entradas/dia × até 3 mensagens ≈ 600–900/mês ≈ **US$ 4–6/mês** (~R$ 25–35). Desde 01/10/2026 a utilidade é cobrada também dentro da janela de 24 h. Cobrança em BRL em transição (até 30/06/2027) |
| Prazo típico | Depende só da resposta do prestador (hoje sem resposta) | Trabalho: ~2–4 h (Eduardo + Asimov). Espera: templates revisados automaticamente, **até 24 h**; verificação da empresa, alguns dias (pode começar sem ela). Realista: **1–3 dias úteis** até a 1ª mensagem |
| Prós | Sem número novo, sem conta na Meta; um fornecedor só | Independe do prestador; custo conhecido e baixo; a Imovit é dona do número e dos templates; reaproveitável para outros alertas (Fase 31) |
| Contras | Depende de um terceiro lento; custo e limites desconhecidos; **o corretor que responder ao alerta cai no Severino**, que vai tratá-lo como lead (risco de sujar o funil e o Imoview); se o prestador usar API não oficial, risco de banimento do número do bot | Mais um número e uma conta para manter; setup na Meta tem várias telas; o corretor precisa salvar o número e aceitar receber (opt-in simples, é colaborador); mensagens de resposta ao número de alertas não são lidas por ninguém (dizer isso no texto) |

Recomendação: perguntar ao prestador hoje (endpoint? API oficial? custo? dá para usar um número separado do bot?). **Se a resposta não vier até 02/12 ou se ele só tiver o número do bot, ir de B.** O risco do corretor responder ao Severino pesa contra A mesmo que o prestador responda rápido.
Fonte (consultada em 27/11): Meta, "Pricing on the WhatsApp Business Platform" (`developers.facebook.com/docs/whatsapp/pricing`: cobrança por mensagem desde 01/07/2025, janela de 24 h, só template fora dela, utilidade cobrada na janela desde 01/10/2026, ~0,68 centavo de dólar a utilidade no Brasil) e "Message templates" (`developers.facebook.com/docs/whatsapp/business-management-api/message-templates`: revisão automática, "pode levar até 24 horas"; categorias autenticação/marketing/utilidade). Conferir a tabela de preços em CSV no dia de ligar.

**Os 3 templates (rascunho, categoria utilidade, pt_BR):**
- `imovit_alerta_lead`: "Lead do Severino para você: {{1}} ({{2}}), {{3}}. Atendimento {{4}}. Mensagem: "{{5}}". Responda pelo Imoview; a gestão é avisada com 2 h úteis sem resposta."
- `imovit_lembrete_30`: "Lembrete: o lead {{1}} (atendimento {{2}}) está há {{3}} min úteis sem resposta no Imoview."
- `imovit_gestao_2h`: "Atraso: {{1}} (atendimento {{2}}) está há {{3}} sem resposta. Corretor: {{4}}. Entrou em {{5}}."
- Todos com a linha final "Mensagem automática; este número não lê respostas." (opção B).

### Peças

- **32a — Colunas + conferência das 23 linhas + tabela do vigia (P, ~1 h de trabalho + ~20 min do Eduardo).** Não depende do canal. Migration única: 3 colunas em `colaboradores_raw` (`perfil_id`, `recebe_alerta_lead`, `whatsapp_alerta`), tabela `alerta_lead_severino` (uma linha por entrada, índice único parcial por atendimento aberto), funções `minutos_uteis` e `alerta_lead_a_vigiar` (Schema §2.26). Carga = o Eduardo confere as 23 linhas ativas (o `telefone_whats` é o WhatsApp? quem sai do alerta? Daniel e Gabriel com número certo?) + `update` do `perfil_id` pelo e-mail.
  **Pronto quando:** migration testada em `BEGIN … ROLLBACK` e aplicada com OK; `select id_corretor_crm, nome_completo, coalesce(whatsapp_alerta, telefone_whats) is not null, recebe_alerta_lead from colaboradores_raw where ativo` conferido pelo Eduardo; EXECUTE anon ✗ / authenticated ✗ / service_role ✓.
  **Como testar (no rollback):** `minutos_uteis` em 6 casos: seg 10h → 10h30 = 30; sáb 17h50 → seg 9h20 = 30; dom inteiro = 0; 18h01 → 8h59 do dia seguinte = 0; feriado em dia de semana conta normal (ex.: 25/12 10h → 11h = 60); `p_ate < p_de` = 0. `alerta_lead_a_vigiar` com 3 linhas falsas (15 min, 40 min, 3 h úteis) → só a 2ª deve lembrete; a 3ª deve lembrete e gestão. Índice: 2ª linha aberta para o mesmo atendimento falha; com a 1ª fechada, entra. `authenticated` não lê a tabela.

- **32b — Alerta na entrada por WhatsApp, nos 2 caminhos do `wpp_entrada v4` (P–M, ~3 h depois do canal pronto; + setup do canal: A ~1–2 h se o prestador tiver API, B ~2–4 h + espera de 1–3 dias úteis). ⛔ Canal A ou B. ⭐ Rep do Eduardo.** Fazer numa **cópia desligada** do v4 (o v4 está no ar; nada de `update_workflow` nele, porque apaga as credenciais). Depois de `Gravar atendimento Imoview`, antes de `Concluir reserva`:
  1. Caminho da atividade (retorno): o corretor já vem do `Analisar atendimento` (`codigoCorretor`, `nomeCorretor`, `lead`).
  2. Caminho do lead novo: o `RetornarDadosCliente` não traz o corretor; 1 chamada a mais a `RetornarAtendimentos` (`codigoCliente`, finalidade do lead) pelo sub-fluxo "Imoview: requisição" para pegar `corretorcodigo`. Sem corretor ainda → alerta à gestão (RF36.3).
  3. Nó "Configuração" (`GESTAO_CODIGOS`, nomes dos templates) → Supabase lê `colaboradores_raw` pelo código (e a gestão pelos códigos 6 e 24) → Supabase olha se há linha aberta em `alerta_lead_severino` para o atendimento (regra do retorno, Schema §2.26 B) → Code monta os parâmetros do template → **HTTP Request "Enviar WhatsApp"** (credencial do canal, `onError: continueRegularOutput`, para o lead nunca travar) → insert/update em `alerta_lead_severino` com `alerta_em` ou `alerta_erro`.
  - **Rep do Eduardo:** ele monta o nó **HTTP Request "Enviar WhatsApp"** à mão com o Asimov guiando: escolher a credencial (nunca token colado no nó), método e URL do canal, corpo JSON do template (`to` com a expressão do número, `template.name`, `language = pt_BR`, `components[].parameters` vindos do Code), e ligar o "continuar em erro". Depois explica de volta por que a falha do WhatsApp não pode parar o fluxo, e onde ver o `id` da mensagem na resposta para saber que a Meta aceitou.
  **Pronto quando:** templates aprovados (B) ou confirmados pelo prestador (A); os 4 testes abaixo passam na cópia; o Eduardo autoriza trocar o v4 pela cópia (mesmo caminho do webhook, como no "Para pôr no ar" do `wpp_entrada__v4_integracao.md`).
  **Como testar:** com o lead de teste do roteiro do v4 e o número de destino forçado para o WhatsApp do Eduardo no Configuração: (1) lead novo → WhatsApp chega em < 1 min com nome, telefone, trecho da mensagem e código; linha em `alerta_lead_severino` com `tipo = novo`; (2) mesmo lead de novo, com a 1ª ainda aberta → WhatsApp "escreveu de novo", nenhuma linha nova, prazos iguais; fechar a 1ª à mão e repetir → linha nova `tipo = retorno` com `entrada_em` nova; (3) código de corretor sem WhatsApp (forçar no Configuração) → mensagem vai para a gestão com o motivo; (4) credencial inválida → o lead entra no Imoview, a reserva conclui, `alerta_erro` preenchido e o "Alerta n8n · erro" avisa.

- **32c — Vigia da 1ª resposta, 30 min / 2 h por WhatsApp (M, ~4 h; usa o canal e o nó da 32b). ⛔ Canal A ou B.** Fluxo novo "Vigia 1ª resposta · Severino", desligado, Error workflow = "Alerta n8n · erro". Schedule a cada 5 min (o tempo todo; quem decide se é horário útil é a `minutos_uteis`) → Configuração (`GESTAO_CODIGOS`, `USUARIOS_IGNORADOS`, `REPIQUE_LIGADO = false`) → RPC `alerta_lead_a_vigiar` → para cada linha com algo vencido: `RetornarAtendimentos` pelo sub-fluxo (codigoCliente + finalidade) → Code decide (respondido / encerrado / lembrete / gestão / fechar por 5 dias úteis; regra do Schema §2.26 C, novo × retorno) → "Enviar WhatsApp" (mesmo desenho da 32b) ao corretor atual ou aos 2 da gestão → update da linha (`*_em` ou `*_erro`). **Repique desenhado, desligado:** um IF `REPIQUE_LIGADO` com a saída "verdadeiro" ligada a um nó desabilitado ("Repique · desligado (D5)"), sem transferir ninguém.
  **Pronto quando:** os testes passam com o fluxo rodando à mão; publicado com OK; 1 semana sem alerta duplicado e com toda entrada > 2 h úteis sem resposta tendo `gestao_2h_em`.
  **Como testar:** com linhas de teste em `alerta_lead_severino` apontando para o atendimento de teste, `entrada_em` recuada e destino = WhatsApp do Eduardo: (1) 40 min úteis, sem resposta → 1 lembrete; rodar de novo → nada; (2) 3 h úteis → aviso à gestão; (3) responder o lead no Imoview → `respondido_em` preenchido, `fim_motivo = respondido`, nenhuma mensagem; (4) linha `retorno` com `datahora1Resposta` antigo e sem interação nova → conta como sem resposta e lembra; (5) domingo / fora do horário → nada vence; (6) `REPIQUE_LIGADO = true` no teste → o caminho chega no nó desabilitado e para; (7) a atividade do usuário 111 não marca como respondido (§2.26 C).

- **Depois:** cartão "sem resposta" no Hub (Gestão); medir com o Pareto a queda dos "sem 1ª resposta" em 2 semanas; se for B, avaliar mandar os alertas da Fase 31 pelo mesmo número.

## Adiado conscientemente (rever quando o volume real crescer)
- ~~Backup: upgrade para o plano Pro~~ decidido em 29/09: o Eduardo vai assinar o Pro (Fase 12, S0).
- Ambiente de teste separado (hoje as migrations são testadas com `BEGIN … ROLLBACK` em produção).
- Testes automatizados.

## Riscos e mitigação
| Risco | Impacto | Mitigação |
|---|---|---|
| Sem backup + `DELETE` errado | Perda irrecuperável | Testar sempre em transação; soft-delete; rever o plano Pro |
| Mexer em tabela do n8n e quebrar uma automação | Dados param de chegar | Ler o fluxo pelo MCP antes; nunca editar fluxo pelo MCP |
| Schema fora do repo | Ninguém consegue reconstruir o banco | Fase 2 |
| Anon key pública + grants padrão | Exposição de dados | Fase 1 e a convenção do Schema §6 |

## Registro de mudanças no plano
| Data | Mudança | Motivo |
|---|---|---|
| 2026-09-24 | Plano criado (retroativo) | Adoção do framework de documentação |
| 2026-09-24 | Fase 5b (painéis Comercial e Operacional) | Cards atuais com rótulos e fórmulas enganosos; catálogo alinhado com o Eduardo |
| 2026-09-28 | Fase 9 (proposta de venda) | Pedido da direção em 25/09, feito sem docs; documentado e corrigido antes de aplicar |
| 2026-09-28 | Fase 10 (esteira v4) | Eduardo: negociação acontece antes, com o corretor; o locatário só valida; sai a aprovação interna |
| 2026-09-29 | Fase 12 (dados acumulados + dashboards v2) | Filtro de período não mudava os gráficos (safra fixa) e o banco sobrescrevia a fase do lead; Eduardo decidiu acumular histórico e assinar o Pro |
| 2026-09-29 | Fase 12 ajustada | Eduardo: sem etapa Agendamento (funil de 7), sem filtro de time, captura 1×/dia, filtro geral só equipe comercial ativa |
| 2026-10-06 | Fase 13 (campanha Km 32) | Pedido da direção; fonte = CRM via jornada; decisões C1–C6 do Eduardo |
| 2026-10-08 | Fase 18 (estoque + busca) | Pedido do Eduardo: controle de estoque pelo Imoview e busca "mais de conversa" com alternativas com margem; só Gestão; texto livre depois |
| 2026-10-07 | Fase 17 v2 | Eduardo: painel pela ótica do gestor (8 capítulos), manchete = administração recebida; "Atenção" virou "pagamento informado sem baixa" depois da 1ª carga |
| 2026-10-07 | Fase 17 aprovada | Eduardo: receita = só administração; menu Dash ▸ Adm locação; "Moderação" = em ativação; inadimplência pela regra do Imoview + capítulo "Atenção" para cobranças vencidas fora da régua |
| 2026-10-07 | Fase 17 (carteira de locação) | Pedido do Eduardo: visão gerencial dos contratos ativos para Gestão e ADM, fonte Imoview; começa por descoberta porque o endpoint de contratos não está confirmado |
| 2026-10-09 | Fase 19 (cadastro locador PF) | Eduardo: Google Form vira rota pública de link fixo (grava + e-mail a administrativo3); Propostas em produção só gestão/adm; documentos seguem por e-mail |
| 2026-10-14 | Fase 20 (distratos) | Pedido do Eduardo: procedimento de desocupação + motivo + pesquisa de satisfação pelo Hub; o ADM gera o link por contrato; o envio é o aviso oficial; 1ª entrega só com registro + lista |
| 2026-10-14 | Fase 21 (central de cadastros) | Eduardo: 6 cadastros do Google num motor único (1 página + 1 tabela + 1 função + 1 lista); piloto Locador PJ; destino de e-mail por tipo; histórico das 2 planilhas importado; pode construir |
| 2026-11-23 | Fase 29 (dados para a reunião, PRD §5.23) | Eduardo: a reunião precisa de uma página só. A fase começa pela Saúde Imovit e vai depois para conciliação, entrada por nível, Aquisição/Comercial, orgânico e decisões |
| 2026-11-25 | 29e S4: GA4 + Search Console no orgânico (tabela de dimensões, RPC, 3 fluxos desligados, cartão da Saúde) | briefing-ga4 com a conta de serviço pronta; dimensões não cabem em organico_diario; nada aplicado ou ligado sem OK |
| 2026-11-24 | Saúde: bloco Mídias sociais com o orgânico real (29a × 29e S7) | Eduardo: trocar o "aguardando captura" pelos dados do Instagram; conta no banco (regra do Sprint B); variação pela média por dia capturado e ⚪ acumulando abaixo de 5 dias |
| 2026-11-24 | Fase 29a Sprint B (contas da tela no banco) | Eduardo: acertar tudo antes de publicar; a tela fazia 6 contas direto nas tabelas e copiava a régua de sinal, risco de divergir do banco |
| 2026-10-19 | Fase 23 (onboarding de colaboradores) | Entrada da Giovana feita à mão (INSERT + checklist no Obsidian); Eduardo: a pessoa passa os dados por link, ele cria e-mail e Imoview, aprova no Hub → `colaboradores_raw`; checklist com CRM e fila de repique |
| 2026-10-28 | Fase 24 (fonte única dos atendimentos) | Auditoria de 27/10: duas fontes para o mesmo lead (A1/A7); Eduardo aprovou a jornada como fonte única, trocando ao lado e comparando antes |
| 2026-10-29 | PRD §5.19 (Relatório da Diretoria e dashboards finais) | Reclamação da Diretoria: dados divergem e a navegação perde o fio. Eduardo aprovou a espinha de 6 páginas, o relatório + e-mail diário, safra × fluxo sem filtro e o "parado" 3/7 dias com 🟢🟡🔴. **Sem fase no plano ainda**: depende da Fase 24 S3 e do detalhe página por página; ordem com o Brooks |
| 2026-10-29 | Agendador da receita da carteira (prioridade 2 do Pareto) | Pagamentos só eram lidos pelo botão "Atualizar"; `pg_cron` diário chama a `carteira-locacao` (Schema §2.10) |
| 2026-10-29 | Alerta de leitura que falhou (prioridade 3 do Pareto) | E-mail às 7h15 para eduardo@ só com falha (Schema §2.18); base do aviso do e-mail diário v1 |
| 2026-11-04 | Fase 26 (dados bancários no onboarding) | Pedido do Financeiro; Eduardo: conta + PIX, Gestão e ADM leem, conta sempre do colaborador, opcional; tabela própria para o ADM não ler CPF/endereço |
| 2026-10-29 | E-mail diário da Diretoria v1 (PRD §5.19) | Aprovado pelo Eduardo; seg–sex 7h30; segunda cobre sexta a domingo (para a sexta não ficar sem e-mail); Schema §2.19 |
| 2026-11-24 | Fase 29a S2 aplicado com valor fechado | Eduardo: manchete = valor fechado (venda VGV + locação aluguel dos contratos iniciados, padrão Km 32); mesa em valor; receita como referência; trimestre e custo por qualificado confirmados; OK para aplicar |
| 2026-11-24 | Fase 29a: negócios de locação por contratos | Eduardo: "sim, conta por contratos igual ao Km 32" (D2 resolvida). Migration `20261124120000` testada, não aplicada; foto de 16/11 precisa do placar corrigido |
| 2026-11-24 | Fase 29a S2 reescrito (período livre) e S3 redefinido | Eduardo: filtros 7–90 dias + personalizado e finalidade; comparação com o período anterior de mesmo tamanho; média 8 semanas só para "agora"; mídias sociais/GA4 como placeholder; sem Evento. Migration v1 (semana fixa) nunca foi aplicada |
| 2026-11-05 | Fase 27 (plantão de locação) | Pedido do Eduardo: segundo plantão, visualmente identificável; mesma tabela com `tipo`, cor + ícone + rótulo |
| 2026-11-26 | Fase 30 (login de integração do Imoview) | API do Imoview mudou em 24–25/11 e parou todas as integrações; Eduardo criou 1 chave geral + usuário de integração 111 |
| 2026-11-27 | Fase 30 S4+S5 (estoque, captadores, Severino) | Últimos fluxos parados desde 24/11; captadores trocam o App_ por `RetornarImoveis`; sub-fluxo "só chave" para não pedir sessão em endpoint de Site/Imóveis |
| 2026-11-27 | Fase 31 (alertas por e-mail: erro do n8n + vigia diário 7h30) | CRM parado 18–22/11 sem ninguém perceber; Eduardo escolheu e-mail. Preparada desligada; migration não aplicada |
| 2026-11-27 | Fase 32 (alerta ao corretor: lead do Severino) — proposta | 6 de 30 atendimentos do Severino sem 1ª resposta e ninguém avisado; Eduardo: e-mail primeiro + WhatsApp depois, alerta na hora, 30 min / 2 h úteis (seg–sáb 9h–18h), repique desenhado e desligado |
| 2026-11-27 | Fase 32 revista: só WhatsApp; peças 32a colunas → 32b alerta → 32c vigia; opções de canal A (prestador) / B (Cloud API) | Eduardo: o Imoview já manda e-mail e notificação; feriado conta como útil; retorno entra no vigia; 3 colunas em `colaboradores_raw`; gestão = códigos 6 e 24 |
