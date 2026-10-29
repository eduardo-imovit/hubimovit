# Mapa de dados — Hub Imovit

> **Para que serve:** saber, para qualquer número do Hub, de onde ele vem e por onde passa.
> É a base da auditoria de dados (iniciada em 27/10/2026). As fichas de cada número entram na §6.
> **Estado:** camadas 1 e 2 levantadas **pelo código e pelas migrations do repo**. Falta conferir contra o banco real (§7): tabelas criadas por fora das migrations não aparecem aqui com detalhe.

## 1. Como ler

Todo número passa por 5 etapas. Um erro pode nascer em qualquer uma delas.

```
 FONTE             TRANSPORTE          ARMAZÉM (tabela)      CÁLCULO (view/função/src/lib)   TELA
 Imoview, Meta, ─▶ n8n (1x/dia) ────▶ Supabase ──────────▶ vw_* / rpc / JS no navegador ─▶ card/gráfico
 Google, Hub
```

- **Camada 1 (§3):** tela → o que ela lê.
- **Camada 2 (§4):** view/função → de quais tabelas ela lê (o "cruzamento").
- **Camada 3 (§2):** tabela → quem escreve nela.

## 2. Origem: quem escreve em cada tabela (camada 3)

| Tabela | Quem escreve | Frequência | Observação |
|---|---|---|---|
| `crm_atendimento_jornada` + `crm_leituras` | n8n `crm_jornada_diaria v3` → função `registrar_atendimentos_crm` | 1×/dia, 6h | Acumula: linha nova quando o atendimento muda. Dá a **fase/situação atual** à view base; é a fonte única do Km 32 |
| `dashboard_atendimentos_crm` | n8n `crm_atendimentos` (fluxo antigo) | diário, `dataInicial = ontem` | Sobrescreve a fase (upsert). **Espinha dorsal:** define *quais leads existem* em `vw_atendimentos_base` (código, entrada, corretor, mídia, finalidade). É lida direto por Kanban, Dados de Atendimento, `vw_jornada_etapas` e `kpis_tv`. ⚠ **Não desligar o fluxo antigo** antes de migrar a view base (A7) |
| `atividades`, `atividades_notas` | n8n (Imoview) | diário | upsert por trigger |
| `dashboard_meta_ads` | n8n `meta_ads` | diário (reinsere 14 dias) | Trigger `meta_ads_upsert` evita duplicar desde 23/09. Dado de antes de 23/09 calculado dessa tabela estava inflado |
| `dashboard_google_ads` | n8n | diário | |
| `imoveis_estoque` + `estoque_cargas` | n8n (Imoview) | carga em lotes | |
| `contratos_locacao`, `_cobrancas` | n8n `carteira_locacao_diaria` + Edge `carteira-locacao` | 6h30 e 6h45 | |
| `contratos_locacao_recebimentos` (receita) | **só** Edge `carteira-locacao` (o n8n manda `pagas: 0`) | 6h45, `pg_cron` desde 29/10 | Antes, só pelo botão "Atualizar" (parou em 19/10) |
| — (vigia) | Edge `alerta-leituras` + `saude_leituras()` | 7h15, `pg_cron` | E-mail para eduardo@ só quando uma leitura falha |
| `boletim_diretoria_fotos` | Edge "boletim-diretoria" (`rapid-worker`) + `boletim_diretoria()` | 7h30 seg–sex, `pg_cron` | E-mail da Diretoria para daniel@, gabriel@ e eduardo@ |
| `colaboradores_raw` | aprovação do Onboarding (Hub) | manual | **Não** é sincronizada pelo n8n. Os painéis cruzam atendimento × colaborador **pelo nome** |
| `metas_campanhas`, `campanhas`, `campanha_metas` (+3 de metas) | manual | — | 5–6 tabelas de metas com formatos diferentes |
| `propostas_locacao`, `propostas_venda`, `documentos_enviados`, `captacoes`, `feedbacks_visita`, `distratos`, `cadastros`, `onboarding_colaboradores` | o próprio Hub (telas e Edge Functions) | em tempo real | |
| `avisos`, `plantao`, `home_banners`, `biblioteca_links`, `datas_comemorativas`, `agendamentos_fotografo` | Configurações (Hub) | manual | |

## 3. Telas → dados (camada 1)

Levantado seguindo os imports de cada página (script em §8). "Lê" = `select`, `rpc` ou Edge Function.

### Painéis (Dash)
| Tela | Rota | Lê | Carga |
|---|---|---|---|
| Painel da Gestão | `/dashboard/gestao` | `vw_atendimentos_base`, `vw_tempo_resposta`, `vw_aging_ativos`, `atividades` (abertas até hoje + feitas em 200 dias), `propostas_locacao`, `colaboradores_raw`, `vw_estoque_imoveis`, `vw_jornada_etapas`, `vw_jornada_descartes`; saúde: última data de `dashboard_atendimentos_crm`, `atividades`, `estoque_cargas` | `carregarGestao` (`src/hooks/usePaineis.js:67`) |
| Comercial / Meus números | `/dashboard/comercial` | `vw_atendimentos_base`, `colaboradores_raw`, `atividades` (Visita), `propostas_venda`/`propostas_locacao` (só com `PROPOSTAS_ATIVAS`), `perfis`; saúde: `dashboard_atendimentos_crm`, `atividades` | `carregarComercial` (`:112`) |
| Performance | `/dashboard/performance` | `dashboard_meta_ads`, `dashboard_google_ads`, `metas_campanhas`, rpc `performance_leads_pagos`; saúde: `dashboard_atendimentos_crm`, Meta, Google | `carregarPerformance` (`:97`) |
| Estoque | `/dashboard/estoque` | rpc `estoque_busca`, `estoque_bairros` | `carregarEstoque` (`:129`) |
| Adm Locação | `/dashboard/adm-locacao` | `vw_carteira_locacao`, `vw_carteira_locacao_mensal`, `vw_cobrancas_locacao`, `vw_proprietarios_locacao`, `vw_recebimentos_locacao_mensal`, `contratos_locacao_fotos`; Edge `carteira-locacao` | |

### Operação
| Tela | Rota | Lê |
|---|---|---|
| Kanban | `/kanban` | **`vw_atendimentos_base`** (desde 28/10, adaptador em `src/hooks/useAtendimentos.js`; antes, a tabela antiga), `colaboradores_raw`, `perfis`. Fase 8 (Agendamento) → coluna Lead qualificado. Filtro padrão: entradas dos últimos 7 dias (`src/lib/atendimentos.js:28`) |
| Dados de Atendimento | `/kanban/dados` | **`vw_atendimentos_base`** (desde 28/10, mesmo adaptador; `data_fechamento` = `data_encerramento` da view, que tem a data dos descartes), `atividades`, `colaboradores_raw`, `perfis` |
| Relatório de Atividades | `/kanban/atividades` | `atividades`, `colaboradores_raw`, `perfis` |
| Home | `/` | rpc `campanha_resumo` (Km 32), `vw_atendimentos_base`, `vw_tempo_resposta`, `metas_campanhas`, `propostas_locacao`, `documentos_enviados`, `solicitacoes_acesso` + conteúdo de Configurações |
| TV | `/tv-display` | rpc `campanha_resumo` (relê a cada 5 min), rpc `kpis_tv`, conteúdo de Configurações |
| Agenda | `/agenda` | `avisos`, `datas_comemorativas`, `agendamentos_fotografo`, `colaboradores_raw` |

### Esteiras, formulários e portais
| Tela | Lê / grava |
|---|---|
| Propostas, Esteiras, Processos (`/admin/*`) | `propostas_locacao`, `propostas_ativas`, `documentos_enviados`, `documentos_tipos_obrigatorios`, `status_historico`; Storage `esteira-documentos` |
| Vendas (`/admin/vendas`) | `propostas_venda`, `propostas_venda_ativas`; Edge `proposta-venda`; Storage `propostas-venda` |
| Captações, Materiais, Captação pública | `captacoes`, rpc `meu_link_captacao`; Edge `captacao` |
| Cadastros (público e admin) | Edge `cadastros` (via `src/lib/cadastros.js`), `cadastros` |
| Distratos | `distratos`, rpc `contratos_para_distrato` |
| Feedback de visita | `feedbacks_visita` |
| Configurações | conteúdo da Home, `perfis`, `solicitacoes_acesso`, `onboarding_colaboradores`; Edge `gestao-colaboradores` |
| Portal do locatário / da venda | `propostas_locacao` / `propostas_venda`, documentos, Storage |

> Hooks compartilhados têm leitura **e** gravação no mesmo arquivo (ex.: `useBanners`). Por isso a análise automática indica "grava" em telas só de leitura, como Home e TV. A permissão real de gravar é da RLS.

## 4. Cruzamentos no banco (camada 2)

Pela última definição de cada objeto nas migrations:

`*` = tabela criada fora das migrations.

```
dashboard_atendimentos_crm* ──(QUAIS leads: código, entrada, corretor, mídia, finalidade)──┐
crm_atendimento_jornada ──────(EM QUE FASE estão: fase, situação, data de encerramento)────┴─▶ vw_atendimentos_base

vw_atendimentos_base ─┬─▶ vw_tempo_resposta (+ atividades*)
                      ├─▶ vw_aging_ativos, vw_kpis_mensais, vw_corretores
                      ├─▶ performance_leads_pagos (rpc)
                      └─▶ kpis_tv (rpc, + dashboard_atendimentos_crm*, atividades*, metas_mensais*, plantao*, propostas_ativas)

crm_atendimento_jornada ─┬─▶ vw_jornada_etapas (+ dashboard_atendimentos_crm*)
                         ├─▶ vw_jornada_descartes
                         └─▶ campanha_resumo (rpc, + campanhas, campanha_metas, contratos_locacao, crm_leituras)   ← Km 32: só a jornada

dashboard_atendimentos_crm* ──▶ (direto no navegador) Kanban, Dados de Atendimento, selo "Saúde dos dados"
propostas_locacao* + propostas_locacao_interno ──▶ propostas_ativas

imoveis_estoque + estoque_cargas ─▶ vw_estoque_imoveis ─▶ estoque_busca, estoque_bairros (rpc)

contratos_locacao (+ _cobrancas, _recebimentos) ─▶ vw_carteira_locacao ─▶ vw_cobrancas_locacao, vw_proprietarios_locacao
                                                 ─▶ vw_carteira_locacao_mensal, vw_recebimentos_locacao_mensal
```

> **Correção de 27/10:** a 1ª versão deste mapa dizia que os painéis liam só a jornada. O script de levantamento escondia tabelas criadas fora das migrations e, por isso, não mostrou a tabela antiga dentro da view base. Lição: o achado A3 cegou o próprio levantamento.

**Cruzamentos por nome (sem chave):** atendimento × colaborador pelo **nome**, no navegador (`corretor` = `colaboradores_raw.nome_completo`); mídia → canal pelo **nome da mídia**, na view `vw_atendimentos_base` (`supabase/migrations/20261019120000_vw_base_data_descarte.sql:70`).

## 5. Achados do levantamento (a confirmar)

| # | Achado | Risco | Status |
|---|---|---|---|
| A1 | **RESOLVIDO em 28–29/10** (Kanban e Dados de Atendimento leem a view base). **CONFIRMADO em 27/10 (Fonte 1, P3): 47 leads, 8/8 no gabarito.** **Duas fases para o mesmo lead.** Os painéis tiram a fase da jornada; Kanban e Dados de Atendimento tiram a fase da tabela antiga, que pode perder mudanças de lead antigo | Kanban × painéis divergem na mesma pergunta. Explica a divergência de propostas de 23/10 | conferir na Fonte 1, pergunta 3 |
| A2 | **O selo "Saúde dos dados" vigia só a tabela antiga** (`usePaineis.js:60,106,124`). Ela responde pelos leads novos, mas não pela jornada (fases) | Se o fluxo da jornada parar, o selo continua "ok" e as fases congelam | conferir na Fonte 1, pergunta 1 |
| A3 | **Tabelas fora das migrations:** `dashboard_atendimentos_crm`, `atividades`, `colaboradores_raw`, `dashboard_meta_ads`, `dashboard_google_ads`, `metas_campanhas`, `metas_mensais`, `plantao`, `propostas_locacao` | Estrutura e regras sem versão; o repo não descreve o banco real | confirmar pela consulta da §7 |
| A7 | **RESOLVIDO em 29/10** (migration `20261029130000`: a view base tira a lista de leads da jornada). **CONFIRMADO em 27/10 (Fonte 1, P2): 14 leads ativos fora dos painéis.** **A view base depende dos dois fluxos ao mesmo tempo.** Lead que está na jornada e não está na tabela antiga **some dos painéis**. A pendência do vault "desligar o `crm_atendimentos` antigo" quebraria os painéis | Desligar o fluxo antigo = painéis sem leads novos | ⚠ alerta posto no vault; conferir na Fonte 1, pergunta 2 |
| A4 | **Cruzamentos por nome** (corretor e mídia) | Renomear um corretor ou uma mídia no CRM tira leads dos números sem erro visível. Afeta a limpeza de mídias planejada | conhecido; entra nas fichas |
| A5 | **RESOLVIDO em 28/10** (Schema §2.4 e §2.17). **Doc de schema desatualizado:** `05-backend-schema.md` §2.4 diz que `dashboard_atendimentos_crm` é a "base das `vw_*`", e §2.6 diz "não aplicada", mas a jornada já é a base | Quem lê o doc audita a tabela errada | corrigir no fim da auditoria |
| A6 | **Metas espalhadas** em 5–6 tabelas com formatos diferentes | Meta errada → % de atingimento errado | conhecido (doc §2.4) |

## 6. Método da auditoria (aprovado em 27/10)

**Auditar a raiz, não as folhas:** a confiança se herda. Uma fonte ou regra conferida vale para todos os números que dependem dela.

| Nível | O quê | Como |
|---|---|---|
| 1. Fontes | ~7 fontes, por impacto | 3 perguntas: **chegou?** (última data) · **chegou inteiro?** (contagem × CRM) · **chegou certo?** (amostra de 10 × CRM) |
| 2. Regras | ~8 regras compartilhadas | conferir e explicar cada uma uma vez |
| 3. Números | cada card/gráfico | ficha curta = fonte + regras + filtro; gabarito manual só nos ~10 que vão à diretoria. Selo: ✅ confiável · ⚠️ com limite (escrito na tela) · ❌ não usar |
| 4. Vigias | cada conferência | vira consulta que devolve linhas **só quando algo está errado** → novo selo de "Saúde dos dados" (resolve A2) |

**Fontes, em ordem:** 1 atendimentos (tabela antiga + jornada → `vw_atendimentos_base`) · 2 `colaboradores_raw` · 3 `atividades` · 4 destino da tabela antiga (A1/A7) · 5 Meta/Google · 6 `contratos_locacao` · 7 `imoveis_estoque`.

**R2 (mídia → canal): conferida em 27/10 ✅.** Migrations `20261027120000` (nomes novos do CRM: Meta Ads/Lançamentos → Campanhas pagas) e `20261027130000` (54 atendimentos de "Outros" para o canal certo). Em "Outros" só sobram Telefone, Placas, Stand, Tik Tok, vagas, Visita Espontânea e CA5083. Vigia futuro: alerta quando aparecer mídia nova em "Outros".

**Regras compartilhadas:** R1 equipe comercial ativa (por nome) · R2 mídia → canal (por nome) · R3 fora ruído/interno · R4 fase do CRM → etapa do funil · R5 "entrou" × "fechou" no período · R6 safra madura (60–425 dias) · R7 piso de histórico (01/10/2025) · R8 "em proposta" do Km 32 (5 condições).

### 6.1 Fonte 1: atendimentos

**P1 Chegou?** Leituras da jornada por dia (falta de dia = fluxo não rodou) e a última entrada na tabela antiga.
```sql
select dia, lido_em at time zone 'America/Sao_Paulo' as hora, lidos, novos, mudancas_etapa, encerramentos, reaberturas, ignorados
from crm_leituras order by id desc limit 15;

select max(data_de_entrada) as ultima_entrada, count(*) as total from dashboard_atendimentos_crm;
```
Esperado: uma leitura por dia, `ignorados` = 0, última entrada = ontem ou hoje.

**P2 Chegou inteiro?** Os dois fluxos têm os mesmos leads? E o total por mês bate com o CRM?
```sql
with a as (select distinct codigo from dashboard_atendimentos_crm),
     j as (select distinct codigo from crm_atendimento_jornada)
select (select count(*) from a) as na_antiga,
       (select count(*) from j) as na_jornada,
       (select count(*) from a where not exists (select 1 from j where j.codigo = a.codigo)) as so_na_antiga,
       (select count(*) from j where not exists (select 1 from a where a.codigo = j.codigo)) as so_na_jornada;

select to_char(data_entrada, 'YYYY-MM') as mes, finalidade, count(*) as leads
from vw_atendimentos_base where data_entrada >= '2026-07-01'
group by 1, 2 order by 1, 2;
```
Esperado: `so_na_jornada` = 0 (senão esses leads somem dos painéis, A7). Gabarito: total de atendimentos de setembro no CRM, por finalidade.

**P3 Chegou certo?** Onde as duas fontes discordam da fase (A1), e uma amostra para conferir no CRM.
```sql
with u as (select distinct on (codigo) codigo, fase_crm, btrim(situacao) as situacao
           from crm_atendimento_jornada order by codigo, id desc)
select a.fase as fase_antiga, u.fase_crm as fase_jornada, btrim(a.situacao) as sit_antiga, u.situacao as sit_jornada, count(*)
from dashboard_atendimentos_crm a join u on u.codigo = a.codigo
where a.fase is distinct from u.fase_crm or btrim(a.situacao) is distinct from u.situacao
group by 1, 2, 3, 4 order by 5 desc;

select codigo, corretor, data_entrada, midia_raw, finalidade, fase_label, situacao
from vw_atendimentos_base order by data_entrada desc, codigo desc limit 10;
```
Gabarito: abrir os 10 códigos no CRM e conferir corretor, mídia, finalidade, fase e situação.

| Pergunta | Resultado | Data |
|---|---|---|
| P1 Chegou? | ✅ Jornada: 1 leitura/dia às ~6h02, `ignorados` = 0 nos 15 dias. Falha conhecida em 16/10 (erro passageiro do Imoview; o retry está ligado desde 19/10). As mudanças daquele dia foram pegas em 17/10, datadas com 1 dia de atraso. Domingo lê tudo (~5.100) e os dias úteis leem ativos + encerrados de 60 dias (~950). Os 1.984 "novos" de 18/10 são atendimentos antigos vistos pela 1ª vez (primeira_leitura), não leads novos. Tabela antiga: última entrada 26/10, 3.034 linhas (= total da view). **Vigia a criar:** alerta se não houver leitura no dia (o selo não olha `crm_leituras`, A2) | 27/10 |
| P2 Chegou inteiro? | ⚠️ Tabela antiga 3.034 × jornada 5.158. `so_na_antiga` = 0; **`so_na_jornada` = 2.124**: 1.982 descartados e 126 negócios em `primeira_leitura` (histórico que o fluxo antigo nunca trouxe, porque só busca "o que mudou desde ontem") + **16 em atendimento**. Destes, 2 entraram em 27/10 (só horário: 6497, a proposta do dia, e 6498, o 1º lead "Meta Ads") e **14 são clientes ativos invisíveis em painéis e Kanban**: 5655 (Rachel, Proposta), 6396 (Patrícia, Visita, entrada 14/10), 1313 (Ricardo, interação 26/10), 9 da Maria Inês (entradas 2024–25, interações até out/26), 2883 (Daniel). Aparecem no Km 32 (que lê a jornada). **Causa:** o fluxo antigo não recupera o que perdeu. **Correção:** a view base passar a tirar a lista de leads da jornada (Fonte 4, A1/A7). Os 126 negócios por ano de entrada: 2024 = 43 (antes do piso, inofensivo), 2025 = 82, 2026 = 1. Efeito: a **conversão fica subestimada** (negócios sem data de fechamento conhecida não entram em "negócios no mês"). Dos 82 de 2025, só **1** é de out/2025 (os outros 81 são de jan–set, antes do piso). Dentro do piso faltam **2 negócios** (1 de out/2025 + 1 de 2026): impacto pequeno na conversão. Os 81 explicam o piso de histórico (R7): a tabela antiga não tem os negócios de antes de out/2025 | 27/10 |
| P3 Chegou certo? | ⚠️ **47 leads com fase/situação diferente** entre a tabela antiga e a jornada, e em **todos** a jornada está à frente: 33 avançaram no funil, **7 em Proposta**, **4 Negócios realizados** e 4 reabertos (descartado → em atendimento). **Gabarito no CRM: 8 de 8 batem com a jornada** (6008, 6294, 6310, 5791 e 6427 em 27/10; 6241, 6383 e 6441 em 23/10). Conclusão: a jornada é confiável. Kanban e Dados de Atendimento (que leem a fase da tabela antiga) mostram esses 47 errado. **Explica a divergência de propostas de 23/10 (A1 confirmado).** Os painéis estão certos nesses casos. Não conferido na amostra: corretor, mídia e finalidade (ficam com R1/R2) | 27/10 |

### 6.1b Fonte 4: a jornada sozinha dá conta? (Fase 24, S1)

**Q1 Que datas o payload guarda?** Lista os campos com "data" no nome e em quantos leads aparecem.
```sql
with u as (select distinct on (codigo) codigo, payload from crm_atendimento_jornada
           where payload is not null order by codigo, id desc)
select k as campo, count(*) as leads
from u, jsonb_object_keys(u.payload) k
where k ilike '%data%' group by k order by leads desc;
```

**Q2 Cobertura:** quantos leads da jornada têm payload e data de entrada legível.
```sql
with c as (select distinct codigo from crm_atendimento_jornada),
     u as (select distinct on (codigo) codigo, payload from crm_atendimento_jornada
           where payload is not null order by codigo, id desc)
select count(*) as leads,
       count(u.codigo) as com_payload,
       count(*) filter (where u.payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4}') as com_data_entrada
from c left join u using (codigo);
```
Esperado: `com_data_entrada` = `leads`. Se faltar, ver quais são (`primeira_leitura` antigos?) e se a tabela antiga cobre.

**Resultado Q1 + Q2 (28/10):**
- 5.166 leads na jornada, todos com payload.
- **5.163 têm os campos do Imoview**, incluindo `datahoraentradalead`. O campo `datafechamento` existe, mas **vem vazio em todos, até nos negócios** (já registrado no handoff em 06/10; a Q4 confirmou). A data do negócio fica na interação "NEGÓCIO REALIZADO … datahora" em `payload.interacoes` (mesmo padrão da data do descarte). Por isso a Q4b não precisa ser rodada.
- **3 têm outro formato** (só a chave `data_fechamento`, com underline) e por isso ficam sem data de entrada. Investigar com a Q2b.
```sql
with u as (select distinct on (codigo) codigo, id, tipo, situacao, data_evento, detectado_em, payload
           from crm_atendimento_jornada where payload is not null order by codigo, id desc)
select codigo, id, tipo, situacao, data_evento, detectado_em, payload
from u where not payload ? 'datahoraentradalead';
```
**Resultado Q2b (28/10):** 3528, 5735 e 6178, todos "Em atendimento", com payload `{"origem":"dashboard_atendimentos_crm","data_fechamento":null}`, gravado na carga inicial (06/10 17:19). O payload nunca foi trocado, apesar da leitura completa de domingo, então **o Imoview não devolve mais esses códigos** (excluídos, mesclados ou fora das consultas?). Eduardo confere no CRM. Na view nova: data de entrada da tabela antiga como reserva.
- **Conferido no CRM (28/10):** 3528 e 6178 **descartados**; **5735 em atendimento**. ⚠ **A jornada também tem ponto cego:** um lead ativo que a leitura completa de domingo não devolve. Hipótese: a combinação fase × situação × finalidade dele não está entre as consultas do nó "Montar consultas". **Bloqueia a S3** (trocar a fonte com o buraco aberto congela leads como o 5735). Q2c, as combinações que a jornada conhece:
```sql
with u as (select distinct on (codigo) codigo, finalidade, fase_crm, funil, situacao
           from crm_atendimento_jornada
           where payload ? 'datahoraentradalead'
           order by codigo, id desc)
select finalidade, funil, fase_crm, count(*) as leads
from u where situacao = 'Em atendimento'
group by 1, 2, 3 order by 1, 2, 3;
```
**Resultado Q2c + CRM (28/10): causa achada.** O 5735 (Venda, Simon, mídia "Site da imobiliária") está na fase **Agendamento**. A jornada só conhece as fases ativas 2, 3, 4, 5 e 7: **o "Montar consultas" não pergunta pela fase Agendamento**, então todo lead nela é invisível para a jornada. Origem: a decisão da Fase 12 (29/09) de um funil de 7 etapas "sem Agendamento" virou também a lista do que coletar. **Regra: coletar tudo, esconder na tela.** A fase 1 (Pré-atendimento) também não tem nenhum ativo: verificar. Q2d (código e piso de leads por fase na tabela antiga):
```sql
select fase, fase_nome, count(*) as leads
from dashboard_atendimentos_crm
where btrim(situacao) = 'Em atendimento'
group by 1, 2 order by 1;
```
Correção: incluir Agendamento no "Montar consultas" (o Eduardo cola no n8n) e, na view, agrupá-lo em "Lead qualificado" (**aprovado pelo Eduardo em 28/10**).

**Resultado Q2d (28/10):** a tabela antiga também só tem as fases ativas 1, 2, 3, 4, 5 e 7 (fase_nome quase sempre nulo). **Os dois robôs são cegos para o Agendamento.** Em 29/09 o handoff registrou que "Agendamento não existe como fase" no Imoview, então **a fase foi criada depois**. O robô pergunta por uma lista fixa de fases (a resposta do Imoview não traz o código da fase, que vem da própria consulta). Código do Agendamento ainda desconhecido (provável 8). Próximo: o Eduardo conta os leads em Agendamento no CRM (gabarito) e copia o código do nó "Montar consultas"; a versão nova inclui a fase e um **sentinela** (soma das fases conhecidas × total do Imoview, com aviso quando divergir).
- **Gabarito do CRM (28/10):** 5 leads em Agendamento / Em atendimento (2 venda, 3 locação). A fase é **antiga e pouco usada** (já existia em 29/09; foi anotada errado como inexistente).
- **Código do nó confirmado:** listas fixas `finalidade [1, 2]`, `fase [1..7]`, `situacao [1, 2, 3]` (`docs/n8n/BACKUP_original_ate_28-10__montar_consultas.js`). Qualquer valor fora delas é invisível.
- **Descoberta do código:** versão temporária com as fases 8–10 (`..._montar_consultas_descoberta.js`), uma rodada manual, depois a Q2e:
```sql
select fase_crm, finalidade, situacao, count(*) as leads, string_agg(codigo::text, ', ' order by codigo) as codigos
from (select distinct on (codigo) codigo, fase_crm, finalidade, btrim(situacao) as situacao
      from crm_atendimento_jornada order by codigo, id desc) u
where fase_crm > 7
group by 1, 2, 3 order by 1, 2, 3;
```
- **Sentinela (revisto):** a API não tem contagem total confirmada. Alternativa no banco: marcar quando cada lead foi visto pela última vez (o update de payload hoje não grava data) e alertar quando um lead "Em atendimento" não aparece na leitura de domingo. É assim que os 3 fósseis teriam sido pegos. Fica para depois da correção.

**Q3 Concordância** com a tabela antiga nos leads que estão nas duas.
```sql
with u as (select distinct on (codigo) codigo, btrim(corretor) as corretor, lower(btrim(midia)) as midia, btrim(finalidade) as finalidade
           from crm_atendimento_jornada order by codigo, id desc),
     e as (select distinct on (codigo) codigo, to_date(substr(payload->>'datahoraentradalead', 1, 10), 'DD/MM/YYYY') as entrada
           from crm_atendimento_jornada where payload->>'datahoraentradalead' ~ '^\d{2}/\d{2}/\d{4}' order by codigo, id desc)
select count(*) as nas_duas,
       count(*) filter (where e.entrada is distinct from a.data_de_entrada::date) as entrada_diferente,
       count(*) filter (where u.corretor is distinct from btrim(a.corretor)) as corretor_diferente,
       count(*) filter (where u.midia is distinct from lower(btrim(a.midia))) as midia_diferente,
       count(*) filter (where u.finalidade is distinct from btrim(a.finalidade)) as finalidade_diferente
from dashboard_atendimentos_crm a join u using (codigo) left join e using (codigo);
```
Diferença não é erro automático. Corretor trocado e mídias mescladas em 27/10 mudam no CRM, e a jornada tem a foto mais nova. Conferir uma amostra no CRM.

**Q4 Data do negócio** (revista em 28/10 com o achado da Q1): tabela antiga × payload × jornada, incluindo negócios que só a jornada conhece.
```sql
with u as (select distinct on (codigo) codigo, situacao, tipo, data_evento,
                  payload->>'datafechamento' as fech_payload
           from crm_atendimento_jornada order by codigo, id desc)
select u.codigo, a.data_fechamento::date as na_tabela, u.fech_payload as no_payload,
       u.data_evento as na_jornada, u.tipo
from u left join dashboard_atendimentos_crm a using (codigo)
where u.situacao = 'Negócio realizado'
order by a.data_fechamento desc nulls first
limit 25;
```
**Resultado Q4 (28/10):** as 25 linhas vieram todas do grupo "só na jornada, `primeira_leitura`, `datafechamento` = texto vazio" (efeito do `nulls first` + `limit`). A comparação não apareceu. **Lição: para contar grupos, agrupar, não amostrar.** Q4b:
```sql
with u as (select distinct on (codigo) codigo, situacao,
                  nullif(payload->>'datafechamento', '') as fech
           from crm_atendimento_jornada order by codigo, id desc)
select a.codigo is not null          as na_tabela_antiga,
       a.data_fechamento is not null as tabela_tem_data,
       u.fech is not null            as payload_tem_data,
       count(*)                      as negocios,
       count(*) filter (where u.fech ~ '^\d{2}/\d{2}/\d{4}'
                          and to_date(substr(u.fech, 1, 10), 'DD/MM/YYYY') = a.data_fechamento::date) as datas_iguais,
       min(u.fech) as exemplo_payload
from u left join dashboard_atendimentos_crm a using (codigo)
where u.situacao = 'Negócio realizado'
group by 1, 2, 3 order by 1, 2, 3;
```
Junto com a Q1, define a regra da data do negócio na view nova (Schema §2.17).

### 6.2 Fichas dos números
_(preenchidas depois das fontes e regras)_

## 7. Conferência contra o banco real

O mapa acima saiu do repo. Para confirmar, rodar no SQL Editor e exportar como CSV:

```sql
select c.relname as objeto,
       case c.relkind when 'r' then 'tabela' when 'v' then 'view' when 'm' then 'view materializada' end as tipo,
       c.reltuples::bigint as linhas_aprox,
       (select string_agg(distinct u.table_name, ', ' order by u.table_name)
          from information_schema.view_table_usage u
         where u.view_schema = 'public' and u.view_name = c.relname) as le_de
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
order by tipo, objeto;
```

## 8. Como refazer o levantamento

Os scripts seguem os imports das páginas e as definições das migrations. Ficaram no scratchpad da sessão de 27/10. Se forem úteis de novo, mover para `scripts/` do repo.
