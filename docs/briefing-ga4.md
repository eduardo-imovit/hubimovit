# Briefing: captura do GA4 (para o OpenCode)

**Objetivo:** capturar todo dia os números do site imovit.com.br no GA4 e gravar no Supabase, para preencher o cartão "GA4" da Saúde Imovit (hoje "aguardando captura").

**Contexto (ler antes):** `handoff.md` (topo), PRD §5.23 (pendência 8), Schema **§2.23**, Fase **29e** do `docs/06-implementation-plan.md` (o GA4 entra como parte do Orgânico, ao lado do Instagram). Como modelo, usar o orgânico do Instagram: formato longo em `organico_diario` + catálogo `organico_metricas`, fluxo `organico_meta` (`docs/n8n/organico_meta.json`) e migration `20261124190000_organico_meta.sql`. Prefira reaproveitar essas tabelas (fonte `ga4`) em vez de criar outras; só crie tabela nova se a dimensão não couber (por exemplo, páginas).
- Acesso: GA4 Data API (`runReport`) com uma conta de serviço do Google Cloud, adicionada como **Leitor** na propriedade do GA4. A credencial fica **só no n8n** (Google Service Account), nunca em texto, no código ou nos docs.
- **ID da propriedade GA4: `320331795`** (Eduardo, 24/11). A conta de serviço vem do Eduardo; se faltar, pare e pergunte.

**O que capturar (por dia; confirmar no PRD antes):**
- Totais: usuários, novos usuários, sessões, sessões engajadas, taxa de engajamento, visualizações.
- Por canal (`sessionDefaultChannelGroup`) e por origem/mídia/campanha (`sessionSourceMedium`, `sessionCampaignName`): sessões e conversões.
- Eventos-chave: clique no WhatsApp e envio de formulário (os nomes estão nos eventos do GTM; listar os que existem).
- Páginas mais vistas: as 20 primeiras (`pagePath`).

**Search Console (na mesma rodada):** Search Console API (`searchanalytics.query`), com a mesma conta de serviço adicionada como usuário **Restrito** na propriedade `imovit.com.br` (ou `sc-domain:imovit.com.br`). Por dia: cliques, impressões, CTR e posição média (total), as 50 consultas e as 20 páginas que mais aparecem. Os dados chegam com 2–3 dias de atraso, então o fluxo lê D-3 e reprocessa até D-5. O catálogo `organico_metricas` já tem a rede `search_console`. Também carregar o histórico de 90 dias, que a API permite, para a Saúde já ter base de comparação.

**Histórico do GA4:** carregar também os últimos 90 dias na primeira execução (por um fluxo de backfill separado, depois arquivado).

**Ordem (docs-first):**
1. PRD §5.23 (o que entra no cartão), Schema §2.23 (métricas novas no catálogo; RLS igual à do orgânico; upsert por (fonte, métrica, dimensão, data)), plano 29e (passo novo).
2. Migration **em arquivo** em `supabase/migrations/`, testada em `BEGIN … ROLLBACK` **antes** de qualquer aplicação. Na rodada do Instagram, a migration foi aplicada direto, sem teste e sem OK. Desta vez, não.
3. Fluxo n8n `ga4_diario`: agendado às 4h, lê D-1 (e reprocessa D-2 e D-3, porque o GA4 consolida com atraso), faz upsert e é criado **DESLIGADO**.
4. Teste: 1 execução manual, comparar 3 dias com a interface do GA4 (a diferença deve ficar abaixo de 2%).
5. Handoff no topo do `handoff.md`.

**Não fazer sem o OK do Eduardo:** aplicar migration em produção, ligar ou publicar o fluxo, commit/push na `main`, mexer no `wpp_entrada`, no `meta_ads` ou no fluxo do orgânico.

**Devolver:** os números capturados × a interface do GA4, o que a API não entregou e o que precisa de decisão (por exemplo, quais eventos contam como conversão).
