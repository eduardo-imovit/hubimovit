# Briefing: captura do orgânico do Instagram/Facebook (para o OpenCode)

> **Atualização 24/11 (OpenCode/Asimov):** executado como Fase **29e**, não 29a, e com o Schema **§2.23**, não §2.22. A tabela aprovada é `organico_diario` (formato longo) + `organico_metricas`, não `social_organico_diario`; o fluxo se chama `organico_meta`. A métrica é `visualizacoes` (API `views`, já que `impressions` foi deprecated), não "impressões". O fluxo lê **ontem** com `metric_type=total_value` — `views` rejeita `time_series` na v27.0. Posts/Reels (`organico_posts`), cliques de WhatsApp e Facebook ficaram para depois; só Instagram entrou nesta rodada. A migration foi aplicada direto no Supabase (sem o `BEGIN … ROLLBACK` do item 2) e o fluxo já gravou 1 linha em 2026-11-23; falta só comparar com o Business Suite.

**Objetivo:** capturar todo dia os números orgânicos do Instagram @imovitimobiliaria e da página do Facebook no Supabase, para preencher o bloco "Mídias sociais" da Saúde Imovit (hoje "aguardando captura").

**Contexto (ler antes):** `handoff.md` (topo + sprint 23/11 "meta_ads religado" e "Orgânico"), PRD §5.23, Schema §2.22, `docs/06-implementation-plan.md` Fase 29a.
- Página ID `1555978387975798`; Instagram ID `17841402369467127`.
- O token novo (usuário do sistema, app "Imovit - N8N") já está pronto, com `read_insights`, `instagram_basic` e `ads_read`. Ele fica **só na credencial do n8n** (Query Auth, parâmetro `access_token`), igual ao `meta_ads`. Nunca em texto, no código ou nos docs.
- Graph API v27.0.

**Ordem (docs-first):**
1. Documentar no PRD §5.23 quais números entram: seguidores, alcance, impressões, interações e cliques no perfil/WhatsApp por dia; posts e Reels com alcance e interações. No Schema, a tabela nova (sugestão `social_organico_diario` + `social_posts`), as RLS (Gestão e Marketing leem; anon zero) e o fluxo. No plano, uma fase nova.
2. Migration testada em `BEGIN … ROLLBACK`.
3. Fluxo n8n `social_organico_diario`: agendado às 3h30, upsert por (conta, data), criado **DESLIGADO**.
4. Teste manual: 1 execução, conferir no banco e comparar com o Meta Business Suite.
5. Handoff no topo do `handoff.md`.

**Não fazer sem o OK do Eduardo:** aplicar migration em produção, ligar/publicar o fluxo, commit/push na `main`, mexer no `meta_ads` ou no `wpp_entrada`.

**Devolver:** o resumo dos números capturados × o Business Suite, o que a API não entrega (permissão/erro) e o que precisa de decisão.
