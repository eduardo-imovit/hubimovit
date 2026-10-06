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

## Fase 13 — Campanha Km 32 na Home (RF25, PRD §5.9) — proposta (06/10)
Depende de: jornada ativa (Fase 12, `crm_jornada_diaria v3`, ok em 06/10).

**S1 — Banco**
- [ ] Migration: `campanhas`, `campanha_metas` (com a carga do Km 32), RLS e `campanha_resumo()` (Schema §2.8)
- [ ] Teste em transação desfeita, com negócio simulado (venda e locação, com e sem valor, antes e depois de 06/10, reaberto) e permissões (corretor recebe o total; "Sem nível" e anon não recebem nada)
- **Pronto quando:** o resumo bate com uma consulta de conferência na jornada.

**S2 — Tela**
- [ ] `TrilhaKm32.jsx` lê `campanha_resumo('km32-4tri-2026')`; sai a constante fictícia
- [ ] 4 números (valor, negócios, ticket, ritmo), rodapé com a regra e a atualização, e os estados do App Flow
- [ ] Bloco só para quem tem nível; "hoje" a partir de 06/10
- **Pronto quando:** com dados reais, a tela mostra o mesmo que a consulta de conferência; build ok.

**S3 — Preview e produção**
- [ ] Branch `campanha-km32` → preview na Vercel; conferir as envs de Preview e a Deployment Protection
- [ ] O Eduardo e o gestor aprovam o preview → merge na `main` (produção)
- **Pronto quando:** no ar em hub.imovit.com.br, conferido logado.

**Depois:** conciliação com contratos e financeiro; comemoração ao bater a parada.

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
