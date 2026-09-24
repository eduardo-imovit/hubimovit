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

## Fase 1 — Fechar as exposições de dados 🔴 (prioridade máxima)
- **Entrega:** nada de negócio legível ou gravável sem login.
- **Requisitos:** PRD §7 (critério de aceite de segurança).
- **Depende de:** saber como o n8n acessa `repique_*` (service role ou anon key?).
- **Tarefas:**
  - [ ] Confirmar no n8n qual chave os fluxos de repique usam
  - [ ] `repique_control` / `repique_ponteiro`: ligar RLS e revogar anon (se o n8n usar service role, ele continua funcionando)
  - [ ] Views `vw_*`: `security_invoker = true` + revogar anon; conferir que gestao/marketing continuam vendo os dashboards
  - [ ] Ligar a proteção contra senha vazada (Supabase → Authentication → Passwords)
  - [ ] Rodar o Security Advisor do Supabase e zerar os alertas críticos
- **Pronto quando:** chamada com a anon key e sem login a `repique_*` e `vw_*` responde vazio ou 401; os dashboards abrem normalmente para gestao/marketing.
- **Como testar:** `curl` com a anon key antes e depois; login como Marketing e como Corretor.

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

## Adiado conscientemente (rever quando o volume real crescer)
- Backup: upgrade para o plano Pro do Supabase (~US$ 25/mês) ou dump periódico.
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
