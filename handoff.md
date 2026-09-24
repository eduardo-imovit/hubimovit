# Handoff — Hub Imovit

## ▶ Sprint 2026-09-24 — ENCERRADO: Home por nível (Fase 8, RF20)

**Objetivo:** Home simples de navegar, diferente por nível, que leva cada pessoa ao próprio trabalho. Encerrado pelo Eduardo em 24/09.

### Entregue
- Home nova: busca "O que você procura?", atalhos por nível, **Para você hoje** (pendências com número que levam à tela certa), **Plantão** dos próximos 5 dias, **Agenda da semana** (eventos + fotógrafo, filtros), avisos e links úteis. Sem banner (fica só na TV).
- Seletor "Ver a Home como…" para a Gestão conferir os 5 níveis.
- `/agenda` (calendário completo) e `?aba=` em Configurações.
- Docs: PRD §5.4 e RF20, App Flow, plano (Fase 8).

### Estado atual
- Commitado na `main`; **push pendente** junto com o sprint anterior (a `main` está à frente do GitHub).
- Conferido no localhost como Gestão e pela prévia dos outros níveis. Não testado com logins reais de Admin/Marketing/Corretor, nem no celular.

### Pendências
- [ ] Push (Eduardo, VS Code)
- [ ] Confirmar formulários/eventos na lista de links e o que mais entra na Home (aniversariantes do mês, novidades do catálogo, meta do mês)
- [ ] Limpar as propostas de teste abertas da esteira (geram "8 documentos esperando decisão" para o Admin)
- [ ] Testar a Home com um login real de corretor quando houver

### Como retomar
- `npm run dev` → `http://localhost:5173/` (Gestão vê o seletor "Ver a Home como").

---

## Sprint 2026-09-24 (cont.) — Home por nível — Fase 8 (RF20, PRD §5.4)

**Objetivo:** a Home como porta de entrada simples: "o que eu faço agora?", diferente por nível.

### Feito
- Docs antes: PRD (RF20, §5.4), App Flow (Home e `/agenda`), plano (Fase 8).
- `src/pages/Home.jsx` reescrita: saudação → **busca** "O que você procura?" (páginas do nível + links úteis; setas/Enter) → **atalhos** por nível → **Para você hoje** (pendências com número que levam à tela; "Tudo em dia" quando vazio; erro de consulta nunca vira "tudo em dia") | **Hoje no escritório** (plantão dos próximos 5 dias, compromissos de hoje/amanhã, link para a agenda) → **Avisos** (3 + "ver todos") | **Links úteis** (chips por categoria, âncora `#links`) → banner no fim.
- Pendências (`src/hooks/usePendenciasHome.js`): Gestão = pedidos de nível, CRM parado, leads sem contato (via `kpis_tv`); Admin = documentos `enviado` de propostas abertas e propostas em aprovação interna; Corretor = propostas dele com link vencendo/paradas e leads dele sem contato (login ↔ corretor pelo e-mail em `colaboradores_raw`); Marketing = orçamento do mês e dias sem plantão nos próximos 7; Sem nível = pedir acesso.
- Seletor **"Ver a Home como…"** só para a Gestão (prévia visual; os dados seguem a permissão de quem está logado).
- `src/lib/homeNiveis.js` (atalhos, páginas da busca), `src/components/home/BlocosHome.jsx` (ícones SVG, blocos), `src/pages/Agenda.jsx` + rota `/agenda` (o calendário do mês saiu da Home), Configurações aceita `?aba=`. Removidos `PlantaoCard`, `AvisosFeed`, `BibliotecaLinks`. CSS `home-*` em `hub.css`.

### Estado atual
- Lint/build ok. Conferido no localhost (Gestão), passando pelos 5 níveis no seletor: atalhos e pendências certos para cada um (Gestão: CRM parado 2 dias + 77 sem contato; Admin: 8 documentos esperando decisão; Marketing: orçamento de setembro + 2 dias sem plantão; Corretor: tudo em dia; Sem nível: pedir acesso). Busca testada ("plantao", "convite").
- Bug achado e corrigido no teste: a consulta de orçamento usava `2026-09-31` (data inválida) e o erro aparecia como "Tudo em dia".
- **Não testado:** login real de corretor/admin/marketing (não há contas de corretor), celular. Não commitado.

- **Agenda da semana** (pedido do Eduardo: "calendário de eventos, fotógrafo…"): `AgendaSemana` em `BlocosHome.jsx`, bloco largo com os próximos 7 dias em colunas (reuniões, datas/aniversários, avisos com data, fotógrafo), filtros Tudo/Eventos/Fotógrafo com contagem, legenda de cores, "+N na agenda". O bloco "Hoje no escritório" virou só **Plantão** (os compromissos foram para a agenda da semana) e mostra "Carregando o plantão…" em vez de "sem escala" enquanto a consulta não volta (a captura de tela pegou esse estado e parecia que a escala tinha sumido; o banco estava certo, 60 plantões).

- **Banner fora da Home** (Eduardo, 24/09): `BannerCarrossel` e o CSS `home-banner` saíram de `Home.jsx`/`hub.css`; o componente continua na TV (`TVDisplay.jsx`). A Home ficou com 1.273 px de altura (era 2.064 px).

### Pendências
- [ ] Revisão do Eduardo; confirmar formulários/eventos nos links; o que mais entra no "…" (aniversariantes do mês? novidades do catálogo?)
- [ ] Os 8 "documentos esperando decisão" do Admin são de propostas de teste abertas — limpar os dados de teste da esteira

---

## ▶ Sprint 2026-09-24 — ENCERRADO: painéis, TV e escala de plantão

**Objetivo:** dados de performance confiáveis e um Dash que conta a história (Gestão e Performance), a TV com os mesmos números e o plantão importado do PDF mensal. Encerrado pelo Eduardo em 24/09. As seções abaixo têm o detalhe de cada entrega.

### Entregue
- **Dados:** gclid na V31 do GTM (publicado), `wpp_entrada` corrigido, Meta Ads de mai–set = API, `campaign_id` na Meta (migration aplicada + fluxo alterado).
- **Dash:** `/dashboard/gestao` (Painel da Gestão) e `/dashboard/performance` (Painel de Performance), com filtros na URL; páginas antigas removidas, endereços antigos redirecionam mantendo os filtros.
- **TV:** KPIs com as definições dos painéis (migration `kpis_tv_alinhado_paineis` aplicada, compatível com a TV antiga) e painel "Plantão" com os próximos 5 dias (fim de semana incluído, hoje em destaque).
- **Plantão:** importação da escala em PDF em Configurações → Plantão; outubro importado (60 plantões, fim de semana = dia inteiro).
- **Docs:** `docs/01–06` (retroativos, outra sessão do dia) + PRD §5.0, §5.0b, §5.1, §5.3, RF16–RF19, App Flow, Schema e plano atualizados.

### Estado atual
- Commits locais na `main` (este sprint); **push pendente** (Eduardo, VS Code) → a Vercel publica os painéis, a TV nova e a importação.
- Banco já está pronto para tudo (migrations aplicadas; escala de outubro gravada).
- Lint sem avisos novos; build ok; `npm audit` = 0 (pdfjs-dist 6.3.289).
- Não testado: login Marketing nos painéis, celular, a TV real depois do push.

### Pendências (próximos sprints)
- [ ] Push (Eduardo) e conferir a TV do escritório
- [ ] CRM sem leads novos desde 22/09 — investigar a sincronização
- [ ] Mapa de canais em `vw_atendimentos_base` (mídias do site e do bot caindo em "Outros"/"WhatsApp")
- [ ] Orçamento de setembro em `metas_campanhas` (o Painel de Performance usa agosto como referência)
- [ ] Preencher `campaign_id` no histórico da Meta (rodar o fluxo por mês e voltar as datas) e conferir abril
- [ ] Developer token do Google Ads → conversões offline
- [ ] Chip "Aguardando seus dados" na TV → "Aguardando locatário"
- [ ] Revisar os painéis com a Gestão e ajustar

### Como retomar
- `npm run dev` → `/dashboard` (Gestão), `/dashboard/performance`, `/tv-display`, `/configuracoes` (aba Plantão).
- Supabase `vlsrmtryzwddqkwqugfr` pelo conector (CLI não logado). Fluxos do n8n: só ler/executar pelo MCP; edições pelo Eduardo no editor.

---

## Sprint 2026-09-24 (cont.) — Escala de plantão por PDF + plantão na TV — RF19

**Objetivo:** subir o PDF mensal da escala ("PLANTAO VENDAS") e o sistema atualizar o plantão; mostrar na TV.

### Feito
- Docs antes: PRD (RF19 e §5.3), `03-app-flow.md` (aba Plantão), plano (Fase 7).
- `src/lib/escalaPlantao.js`: lê o PDF no navegador com **pdf.js** (`pdfjs-dist` **6.3.289**; a 5.x tem a falha GHSA-hq66-cqwq-w95j, execução de JS por PDF malicioso; `npm audit` = 0) e monta DATA/MANHÃ/TARDE pelas colunas do cabeçalho (`montarEscala`, função pura). Casa apelido → corretor de `colaboradores_raw` (todas as palavras do apelido no nome, sem acento); apelidos escolhidos à mão ficam no `localStorage`.
- `src/components/settings/ImportarEscalaPlantao.jsx` (no topo da aba Plantão de Configurações): escolher PDF → prévia (dias, plantões, nomes casados com select para corrigir, opção "fim de semana = dia inteiro", aviso de quantos plantões serão substituídos) → Importar. Grava os novos e **só depois** apaga os antigos do intervalo do arquivo.
- `src/components/tv/PlantaoSemanalTV.jsx`: painel "Plantão", 2º no carrossel do rodapé (`TVDisplayFooter.jsx`). **Ajustado a pedido do Eduardo:** só segunda a sexta, 5 colunas numa linha, sem caixas/bordas (antes: 7 dias na grade de 3 colunas do fotógrafo, quebrando em 3 linhas). **Versão final:** mostra os **próximos 5 dias úteis a partir de hoje** (no fim de semana, a partir da segunda seguinte), com hoje rotulado "Hoje" e em destaque; os outros ficam com opacidade 0,4. Motivo: a versão "semana seg–sex" pulava para a próxima semana quando a atual não tinha escala e destacava 28/09 num dia 24/09 — o Eduardo apontou o erro. Relê a cada 10 min. `usePlantao` agora expõe `recarregar`.
- CSS `escala-import-*` e `plantao-tv-*` em `hub.css`. pdf.js vai num pedaço separado do build (só carrega ao escolher um PDF).

### Estado atual
- Testado: `montarEscala` com o PDF real de outubro no Node → 35 dias (26/09–30/10), 60 plantões, os 5 apelidos casaram sozinhos (Maria Inês, Patrícia Macedo, Rachel Bittencourt, Ricardo Pinheiro, Gabriel Betti). No localhost (logado Gestão), a prévia abriu igual. **Não cliquei em Importar**: nada gravado no banco. Painel da TV renderizado (semana atual vazia).
- Sem mudança de banco (RLS de `plantao`: leitura para qualquer logado, escrita `pode_editar_conteudo()`). Lint/build ok. Não commitado.

### Decisões e contexto
- Fim de semana: por padrão fica "manhã", como no PDF; a caixa na prévia transforma em "dia inteiro". **Falta o Eduardo dizer qual é o certo.**
- Datas do arquivo são a fonte da verdade: plantões antigos entre a primeira e a última data do PDF são apagados na importação (a prévia avisa quantos).

- **Escala de outubro importada em 24/09** pela própria tela (a pedido do Eduardo: "só faltam os corretores"): 60 plantões de 26/09 a 30/10 (35 manhã, 25 tarde), sem substituições; conferido no banco contra o PDF e na TV do localhost ("Plantão — próxima semana · 28/09 a 02/10" com os nomes). Fins de semana gravados como "manhã".

- **Fim de semana = dia inteiro** (Eduardo, 24/09): os 10 plantões de fim de semana de outubro foram atualizados no banco de "manha" para "dia_inteiro" (update limitado a sáb/dom de 26/09–30/10, `observacao like 'Escala importada:%'`); na importação a caixa agora vem marcada. O painel da TV passou a mostrar **os próximos 5 dias corridos, fim de semana incluído** (hoje: qui 24, sex 25, sáb 26 e dom 27 com Maria Inês o dia inteiro, seg 28); conferido no localhost.

### Pendências
- [ ] Push (VS Code) para a TV e as Configurações em produção ganharem a novidade
- [ ] Se o layout do PDF mudar (colunas), o leitor avisa "não achei as colunas MANHÃ e TARDE"

---

## Sprint 2026-09-24 (cont.) — KPIs da TV alinhados com os painéis — Fase 7

**Objetivo:** atualizar os números da TV Display, que ainda usavam as definições antigas.

### Feito
- **Migration `20260924140000_kpis_tv_alinhado_paineis` aplicada** (função `kpis_tv()`): acrescenta `leads_mes`, `ritmo_dia`, `projecao_mes`, `leads_media_3m`, `negocios_fechados_mes`, `negocios_media_3m`, `conversao_safra`, `conversao_safra_anterior`, `ciclo_mediano_12m`, `sem_contato`, `abertos_30d`, `atividades_vencidas_30d` e `crm_atualizado_ate`. **Os campos de 23/09 continuam**, então a TV em produção (site antigo) não quebra antes do push.
- `src/components/tv/KpisTV.jsx`: slide **Comercial** = leads do mês + ritmo 30 dias + projeção × média, negócios no mês (pela data de fechamento) × média 3 meses, conversão da safra madura × semestre anterior, ciclo mediano 12 meses. Slide **Operação** = propostas da esteira, leads sem nenhum contato (+ abertos 30+ dias), atividades vencidas no último mês, plantão. Os dois títulos mostram "· CRM até dd/mm" quando o CRM está sem dados há mais de 1 dia. Sem os campos novos, cada card volta ao campo antigo.
- Docs: `05-backend-schema.md` (kpis_tv), PRD (RF06), plano (Fase 7).

### Estado atual
- Testada antes com `BEGIN … ROLLBACK` simulando um usuário Gestão (resultado igual ao Painel da Gestão: 93 leads, projeção 117, média 138, conversão 4,5% × 4,9%, ciclo 11, 77 sem contato, 148 abertos, 190 vencidas); depois de aplicar: versão nova no banco, `anon` sem execução, `authenticated` com execução.
- Conferido no localhost em `/tv-display`: os dois slides com os números novos e o aviso do CRM. Build ok. **Não visto na TV real**; não commitado.
- Diferença que a versão antiga escondia: ela contava 102 leads em setembro (com ruído e captação interna); a nova conta 93.

### Pendências
- [ ] Push (Eduardo, VS Code) para a TV passar a mostrar os cards novos
- [ ] O chip da esteira mostra "Aguardando seus dados" (texto do portal do locatário); na TV o certo seria "Aguardando locatário" — rótulo antigo, não mexido
- [ ] Sprint 3 da TV: legibilidade na TV real

---

## Sprint 2026-09-24 (cont.) — Remoção das páginas antigas do Dash

**Objetivo:** pedido do Eduardo depois de aprovar os dois painéis: tirar as páginas antigas do Dash.

### Feito
- **Removidos (37 arquivos; os do git voltam pelo histórico):** páginas `DashboardVisaoGeral`, `DashboardLeads`, `DashboardFunil`, `DashboardCampanhas`, `DashboardPerformance` (com a pasta `components/PerformanceDashboard/` e `src/utils/performance*.js`), os protótipos `DashboardComercial`/`DashboardOperacional` e `components/paineis/CardMetrica.jsx`, 14 componentes de `components/dashboard/` que só elas usavam, e os hooks `useCampanhas`, `useMetas`, `useView`, `usePerformanceDashboard`, `usePerformanceFilters`. A lista saiu de uma varredura de imports a partir do `main.jsx`: só foi apagado o que ficou inalcançável.
- **Mantidos:** Kanban, Dados de Atendimento e Relatório de Atividades (usam os componentes restantes de `components/dashboard/`).
- **Rotas (`App.jsx`):** `/dashboard/gestao` e `/dashboard/performance` (endereço definitivo; `performance-v2` sai). `/dashboard` e todos os endereços antigos redirecionam para um dos painéis **mantendo os filtros da URL** (componente `Redirecionar`).
- **Menu (`Navbar.jsx`):** Dash → Painel da Gestão, Painel de Performance e o grupo Kanban; o item "Dash" abre o Painel da Gestão.
- `lib/paineis.js` enxugado (ficaram só utilitários, safra madura e saúde dos dados); `usePaineis.js` sem as cargas dos protótipos e sem duas consultas que não eram mais usadas (`vw_cobertura_atividades`, `vw_descartes`).
- `hub.css`: removidas 62 regras que só as páginas apagadas usavam (`dash-*`, `funnel*`, `mini-funnel*`, `etapa-*`, `tabs-panel`, `painel-*` dos protótipos).
- Docs: PRD (escopo; RF08 marcado como substituído por RF16/RF18; rota da performance), `03-app-flow.md` (tabela de rotas), `06-implementation-plan.md`.

### Estado atual
- `npm run lint` sem avisos novos (sumiram os dos arquivos apagados); `npm run build` ok.
- Conferido no navegador: `/dashboard` → Painel da Gestão; `/dashboard/performance-v2?plataforma=Google&periodo=90d` → `/dashboard/performance` com os mesmos filtros; `/kanban/dados` carrega os 11 gráficos sem erro; o menu só aponta para os painéis novos.
- Não commitado.

### Pendências
- [ ] Commit/push (Eduardo, VS Code); depois o deploy da Vercel publica os dois painéis
- [ ] Revisão dos painéis em produção com os níveis Gestão e Marketing

### Como retomar
- `npm run dev` → `http://localhost:5173/dashboard` (abre o Painel da Gestão).

---

## Sprint 2026-09-24 (cont.) — Painel de Performance — Fase 5b

**Objetivo:** o Eduardo aprovou o Painel da Gestão e pediu um parecido com foco em performance (PRD §5.0b).

### Feito
- `src/pages/PainelPerformance.jsx` em **`/dashboard/performance-v2`** (menu Dash → "Painel de Performance").
- Estrutura: manchete (ritmo de gasto × orçamento, CPL, custo real) → 1 gasto acumulado × orçamento × projeção pelo ritmo de 30 dias → 2 CPM/CTR/CPC em três gráficos pequenos, Meta × Google → 3 tabela de campanhas (barra de gasto com marca do orçamento, CPL × meta, status; clique filtra) → 4 cascata investimento → impressões → cliques → conversões → leads CRM → qualificados → visitas → negócios, com taxa e custo por degrau → 5 matriz gasto × CPL + recomendações geradas → saúde dos dados.
- Filtros na URL: período, plataforma, etapa da campanha (`metas_campanhas.etapa_funil`), finalidade (inferida pelo nome), campanha.
- `src/lib/painelPerformance.js`, `src/components/painel/GraficosPerformance.jsx`, `src/hooks/useFiltrosUrl.js` (agora compartilhado com o Painel da Gestão), `usePainelPerformance` em `usePaineis.js`, CSS `pp-*` em `hub.css`.
- `fmtMoeda` agora mostra centavos abaixo de R$ 10 (CPC, CPL de marca). Isso vale para todos os painéis.
- Cores validadas: Meta `#6A4FB8`, Google `#14907F`.
- Docs no mesmo sprint: PRD (RF18 e §5.0b), `03-app-flow.md` (rota), `06-implementation-plan.md` (Fase 5b, item marcado).

### Estado atual
- Lint limpo nos arquivos novos, build ok, conferido ao vivo (Gestão) com dados reais. Filtros deste painel **não** foram testados clicando; celular e Marketing também não.
- Números de hoje: set/26 R$ 3.543 até 23/09, projeção R$ 4.448 = 43% do orçamento de agosto (setembro não tem orçamento cadastrado); CPL da plataforma R$ 21; 4 leads pagos no CRM (atribuição quebrada: leads do bot entram como "WhatsApp").

### Decisões e contexto
- Mês sem orçamento em `metas_campanhas` usa o último mês cadastrado como referência, com aviso na tela.
- As etapas do CRM na cascata não respeitam os filtros de plataforma/campanha (o CRM não guarda a campanha); aviso na tela.
- "Maior perda" só concorre com etapa anterior ≥ 10 (evita marcar 0 de 4).

### Pendências
- [ ] Revisão do Eduardo
- [ ] Cadastrar o orçamento de setembro em `metas_campanhas` (ou pela futura tela de metas)
- [ ] Remover as páginas antigas (Performance, Campanhas etc.) depois da aprovação

### Como retomar
- `npm run dev` → `http://localhost:5173/dashboard/performance-v2` (ex.: `?plataforma=Google&periodo=90d`).

---

## Sprint 2026-09-24 (cont.) — Painel da Gestão: a história em cascata — Fase 5b

**Objetivo:** o protótipo por cards foi reprovado ("números vazios, sem história"). Refeito como uma página com narrativa, gráficos e filtros (PRD §5.0).

### Feito
- `src/pages/PainelGestao.jsx` em **`/dashboard/gestao`** (menu Dash → "Painel da Gestão"; os protótipos saíram do menu, mas as rotas continuam).
- Estrutura: manchete escura com frases geradas pelos dados + índices com minigráfico → 1 Ritmo (leads e negócios por mês, projeção pelo **ritmo de 30 dias**) → 2 Funil em cascata venda × locação, com a maior queda e o delta vs semestre anterior → 3 Descartes por etapa + **simulador** (slider de p.p. no gargalo → negócios/mês) → 4 Matriz de canais (volume × conversão, bolha = negócios) + custo real por lead → 5 Mapa de calor por corretor (clique filtra o painel) → saúde dos dados + aviso no topo quando uma fonte atrasa.
- Filtros numa barra fixa: finalidade (Tudo/Venda/Locação), período (mês atual, 30d, 90d, mês passado), canal, corretor. **Estado na URL** + botão "Copiar link desta visão".
- `src/lib/painelGestao.js` (cálculo puro), `src/components/painel/Estrutura.jsx` e `Graficos.jsx` (recharts), CSS `pg-*` no fim de `hub.css`.
- Cores validadas com o script do skill de dataviz: Venda `#E8593C`, Locação `#2F6DB5` (o `--info` do DS reprovou no piso de saturação).

### Estado atual
- Lint limpo nos arquivos novos, build ok, conferido ao vivo logado como Gestão (visão "Tudo" e filtro "Venda": URL e todos os capítulos recalculam).
- **Não testado:** celular, login Marketing, filtros de período diferentes do padrão e clique no mapa de pessoas. Não commitado.
- Docs atualizados no mesmo sprint: PRD §5.0 (narrativa) e §5.1 (dicionário de métricas), `03-app-flow.md` (rota `/dashboard/gestao`), `06-implementation-plan.md` (Fase 5b: Painel da Gestão marcado como primeira versão feita).

### Como retomar
- `npm run dev` → `http://localhost:5173/dashboard/gestao` (nível Gestão ou Marketing). Os filtros ficam na URL, ex.: `?finalidade=Venda&periodo=90d`.

### Pendências
- [ ] Revisão do Eduardo
- [ ] Remover as páginas antigas do Dash e os protótipos depois da aprovação
- [ ] Tabela "ver dados" para cada gráfico (acessibilidade; hoje os valores estão no tooltip e nas tabelas)

---

## Sprint 2026-09-24 — Painéis Comercial e Operacional (protótipo) — Fase 5b

**Objetivo:** trocar os cards "sem noção" por dois painéis com catálogo definido (PRD §5.1): Comercial = resultado, Operacional = execução.

### Feito
- Docs antes do código: `docs/01-prd.md` (RF16, RF17 e §5.1 com o catálogo), `docs/03-app-flow.md` (rotas), `docs/06-implementation-plan.md` (Fase 5b).
- `src/lib/paineis.js`: cálculo puro de cada card (conferível contra SQL); `src/hooks/usePaineis.js`: cargas; `src/components/paineis/CardMetrica.jsx`: card com pergunta, fórmula (ícone "i"), comparação com cor de status.
- `src/pages/DashboardComercial.jsx` (`/dashboard/comercial`) e `src/pages/DashboardOperacional.jsx` (`/dashboard/operacional`), rotas em `App.jsx`, menu "Dash → Painéis (novo)" no `Navbar.jsx`, CSS no fim de `hub.css`. Nenhuma página antiga removida. Nada mudou no banco.

### Estado atual
- `npm run lint` sem avisos nos arquivos novos; `npm run build` ok. Dev em `http://localhost:5173` (rodando nesta sessão).
- Conferido ao vivo, logado como Gestão, contra SQL: leads de set = 93 (venda 37), média 3 meses = 138, conversão do último semestre maduro = 45/1.003 = 4,5% (anterior 33/677), ciclo = 11 dias, pipeline = 44 visitas e 10 propostas. Operacional renderizado com dados reais.
- **Não testado:** login como Marketing (não vê propostas por RLS; o card da esteira mostra aviso) e celular.
- Não commitado.

### Decisões e contexto
- O CRM só tem negócios de leads a partir de out/2025: conversão e funil usam esse piso (antes disso, leads com zero negócios distorciam a taxa).
- `vw_aging_ativos.dias_parado` = dias desde a **entrada**, não desde a última interação: o card virou "abertos há 30+ dias".
- "1ª atividade": o valor principal virou "% em até 1 dia" (a mediana só de quem teve contato dava "0 dia", enganoso).
- "Valor locado" de set = R$ 2.000 vem da proposta de teste sincronizada; só vai ter sentido com propostas reais.
- Abril na tabela de mídia mostra 123% porque a Meta de abril está incompleta (só 05–08/04).

### Pendências / próximos passos
- [ ] Eduardo revisar os dois painéis no localhost e pedir ajustes
- [ ] Decidir o destino das páginas antigas (Visão Geral etc.) e do painel de Marketing
- [ ] Commit/push (Eduardo, VS Code) depois da aprovação

### Como retomar
- `npm run dev` → `/dashboard/comercial` e `/dashboard/operacional` (nível Gestão ou Marketing).

---

## Sprint 2026-09-24 — ENCERRADO: dados de performance e conversões (gclid, bot, Meta)

**Objetivo:** deixar os dados de mídia e de leads confiáveis antes das metas e dos cards do Hub. Encerrado pelo Eduardo em 24/09.

### Feito
- **GTM (versão 94 publicada):** a V31 envia gclid/gbraid/wbraid/fbclid, guardados por 90 dias; a tag `[N8N] WHATSAPP CLICK`, que gerava linhas vazias, foi excluída. Testado ponta a ponta: o gclid chega em `leads_wpp_gtm`.
- **`wpp_entrada` (bot) corrigido e publicado:** o IF passou a testar `acao` (lead quente vira atividade, não lead duplicado), a atividade é montada com JSON seguro e a mídia é inferida. Testado com o lead de teste (atividade criada no atendimento 6242).
- **`dashboard_meta_ads` = API da Meta de mai a set/26:** mai 4.266 · jun 8.329 (era 21.741) · jul 9.016 (era 10.178) · ago 3.111 · set confere. Backup `dashboard_meta_ads_backup_20260924`.
- **Migration `20260924120000_meta_ads_campaign_id` aplicada** e fluxo `meta_ads` alterado pelo Eduardo: 42 linhas de 10–23/09 já ganharam `campaign_id` sem duplicar.
- Taxas do funil recalculadas (tabela corrigida abaixo). `docs/05-backend-schema.md` atualizado.

**Topo do funil pago com a Meta corrigida (substitui a tabela mais abaixo):**
| Mês | Invest. | CTR | CPC | Conv/clique | CPL plataforma | Leads pagos CRM | CPL real |
|---|---|---|---|---|---|---|---|
| abr* | 695 | 3,1% | 1,49 | 9,1% | 16 | 52 | 13 |
| mai | 7.551 | 1,7% | 1,01 | 3,0% | 33 | 30 | 252 |
| jun | 14.741 | 1,5% | 1,08 | 1,6% | 67 | 41 | 360 |
| jul | 14.523 | 1,1% | 1,52 | 3,9% | 39 | 44 | 330 |
| ago | 6.137 | 2,3% | 1,48 | 7,5% | 20 | 38 | 162 |
| set (até 23/09) | 3.543 | 3,0% | 1,57 | 7,6% | 21 | 4 | 886 |
*abril da Meta ainda incompleto (só 05–08/04).

### Estado atual
- Tudo aplicado em produção e conferido contra a API ou por teste. Nada de código do app mudou neste sprint; os arquivos novos no repo são a migration e o handoff/docs, **não commitados**.

### Pendências (seguem para os próximos sprints)
- [ ] Eduardo: preencher o `campaign_id` no histórico (rodar o `meta_ads` mês a mês com datas fixas e **voltar as expressões**); abril traz os dados que faltam. Depois eu confiro.
- [ ] Mapa de canais em `vw_atendimentos_base` (mídias do site e do bot caindo em "Outros"/"WhatsApp") — migration pequena.
- [ ] CRM sem leads novos desde 22/09 — investigar a sincronização.
- [ ] Developer token do Google Ads → conversões offline pelo gclid.
- [ ] `imovel_titulo` nunca gravado; UTMs da V31 só da URL atual; token da Meta e senha do Imoview em texto aberto nos fluxos.

---

## Sprint 2026-09-24 — Documentação retroativa (framework docs-first)

**Objetivo:** documentar o Hub como ele está hoje nos 6 documentos do novo framework, para os próximos sprints partirem de uma base escrita.

### Feito
- `docs/01-prd.md`: problema, papéis, escopo, 15 requisitos com estado, regras de negócio, critérios de aceite.
- `docs/02-trd.md`: stack, arquitetura, integrações, auth/RLS, ambientes, secrets (só nomes), ordem de deploy, decisões.
- `docs/03-app-flow.md`: mapa de telas por papel, tabela de rotas, fluxo de status da esteira, estados de tela, e-mails.
- `docs/04-design-system.md`: tokens de `tokens.css`, componentes de `components.css`, padrões, tom de voz, divergências.
- `docs/05-backend-schema.md`: lido do banco de produção: tabelas, RLS por papel, Storage, funções, triggers, views.
- `docs/06-implementation-plan.md`: pendências do handoff e do Obsidian em 8 fases (0 a 7), com a segurança primeiro.

### Estado atual
- Só documentação. Nenhuma mudança em código, banco ou n8n. Não commitado.
- Levantamento do banco só com leitura (`select` no catálogo).
- Os itens marcados com ⚠ nos docs são inferências que o Eduardo precisa confirmar.

### Decisões e contexto (achados do levantamento)
- 🔴 `repique_control` e `repique_ponteiro` estão sem RLS, e `anon` tem SELECT/INSERT/UPDATE/DELETE/TRUNCATE nelas. A anon key é pública, então qualquer pessoa pode ler ou apagar essas tabelas. Virou a Fase 1 do plano. **Não corrigi**: primeiro precisa confirmar com qual chave o n8n acessa essas tabelas.
- 🟠 As 9 views `vw_*` não têm `security_invoker` e têm SELECT para `anon` (já estava no handoff; confirmado).
- O repo tem 28 migrations; o banco tem 67. Tudo de antes de 21/08 não está versionado (Fase 2).
- Existem 5 tabelas de metas com formatos diferentes: é preciso decidir qual fica antes de fazer a tela de metas (Fase 6).
- `leads_wpp_gtm` (nome e telefone de lead) e `atividades` são legíveis por qualquer usuário logado, inclusive "Sem nível" e a TV.

### Pendências / próximos passos
- [ ] Eduardo revisar os docs e responder aos ⚠ (Fase 0)
- [ ] Fase 1: confirmar a chave usada pelo n8n no repique → RLS + revogar anon em `repique_*` e `vw_*`
- [ ] Commitar `docs/` (Eduardo, VS Code)

### Como retomar
- Comece por `docs/06-implementation-plan.md`. Regra do framework: mudança de banco é conferida contra `docs/05-backend-schema.md` antes de aplicar, e os docs são atualizados no mesmo sprint.

---

## 2026-09-24 — Taxas do funil refeitas com os dados corrigidos (só análise, nada alterado no banco)

**Topo do funil pago (Meta + Google, por mês):**
| Mês | Invest. | CTR | CPC | Conv/clique | CPL plataforma | Leads pagos no CRM | CPL real (CRM) |
|---|---|---|---|---|---|---|---|
| abr | 695 | 3,1% | 1,49 | 9,1% | 16 | 52 | 13 |
| mai | 7.100 | 1,8% | 1,00 | 3,4% | 29 | 30 | 237 |
| jun ⚠ | 28.153 | 1,0% | 1,38 | 1,3% | 103 | 41 | 687 |
| jul | 15.685 | 1,1% | 1,49 | 3,8% | 40 | 44 | 356 |
| ago | 5.976 | 2,3% | 1,50 | 7,6% | 20 | 38 | 157 |
| set (até 22/09) | 3.543 | 3,0% | 1,57 | 7,6% | 21 | 4 | 886 |

**Fundo do funil (safras maduras out/25–jul/26; 90% dos ganhos fecham em até 49 dias):**
| Grupo | Leads | L→Qualif | Qualif→Visita | Visita→Proposta | Proposta→Negócio | Lead→Negócio |
|---|---|---|---|---|---|---|
| Todos os canais | 1.713 | 43,0% | 50,0% | 44,0% | 48,1% | 4,55% |
| Site | 426 | 56,1% | 67,4% | 56,5% | 39,6% | 8,45% |
| Campanhas pagas | 333 | 32,1% | 16,8% | 3 de 18 | 1 de 3 | 0,30% |

**Achados:**
- **Junho da Meta inflado:** 10 linhas (R$ 11.014, dias 01, 10, 18 e 24/06) são totais de período, não diários. Ex.: "WhatsApp - Entreverdes | Interesses" começou em 29/05 gastando cerca de R$ 30/dia, e a linha de 01/06 tem R$ 1.886. Parte disso cobre dias sem registro e parte se sobrepõe a dias que existem. O dedup de 23/09 não pega esse caso. Google sem esse padrão.
- **Conversão da plataforma ≠ lead:** só 11–15% das conversões (cliques no WhatsApp) viram lead de "Campanhas pagas" no CRM (mai–ago).
- **Atribuição paga quebrada no CRM:** o canal "WhatsApp" subiu de 7–11/mês para 43 (jul) e 51 (ago), e os pagos caíram para 4 em setembro. Os leads de anúncio que entram pelo bot chegam como "WhatsApp". Em `vw_atendimentos_base`, as mídias `site pagina imovel`, `site_imovel`, `severino`, `severino_desconhecido` e `wpp_nao_identificado` caem em "Outros".
- **CRM parado:** o último `data_de_entrada` em `dashboard_atendimentos_crm` é de 22/09.
- Os dados de anúncios só começam em abril/26.

**Meta — verdade pela API (24/09):** cópia do fluxo `meta_ads` sem o nó de gravação (workflow `xiWPwuZQoJg1hK0u`), rodada pelo Eduardo por mês. Eu leio a execução pelo MCP; a consulta direta à Graph API foi bloqueada pela regra de segurança, porque o token está no fluxo.
- Junho (execução 17250): **R$ 8.328,54 reais** × R$ 21.741 na tabela; 129 linhas diárias, 5 campanhas. O total de cada campanha é igual às linhas "gordas" de 01/06.
- A tabela mistura granularidades: abr–mai só por anúncio; **jun com linhas por anúncio (01–16/06) + por campanha + totais de período** (contagem em dobro); jul–set só por campanha. O índice único (data, campanha, anuncio) não pega isso.
- A campanha "Engajamento 2026" passou a se chamar "Imovit | Engajamento | Posts | Geral" (as duas aparecem na tabela, de 16/07 a 28/07).

**Pendências:**
- [x] **Junho corrigido (24/09, com o OK do Eduardo):** backup `dashboard_meta_ads_backup_20260924` (698 linhas); as 187 linhas de junho foram trocadas pelas 129 da API. Conferido: junho = R$ 8.328,54, igual à API. Junho no funil: investimento total R$ 14.741 (antes 28.153), CPL da plataforma R$ 67, CPL real R$ 360 (antes 687). A "Engajamento 2026" foi mantida com o nome antigo em junho.
- [x] **Maio corrigido (24/09, com o OK do Eduardo; execução 17252):** as 185 linhas por anúncio foram trocadas pelas 99 por campanha da API. Conferido: R$ 4.266,44 (antes 3.815,77, faltavam 01–02/05 e parte do gasto por anúncio) e 98 conversões (antes 117).
- [x] **Agosto (execução 17254):** estava certo, mas faltavam 30 e 31/08 (o fluxo não gravou esses dias; também não estavam no backup de 23/09). As 6 linhas foram inseridas e o dia 29/08 do Engajamento foi ajustado. Conferido: R$ 3.111,49, 93 linhas, 176 conversões, igual à API.
- [x] **Setembro (execução 17256):** certo até 22/09. Em 23/09 há diferenças de centavos e 24/09 é parcial; o fluxo diário atualiza os dois sozinho. Nada foi gravado.
- [x] **Julho gravado (24/09, com o OK do Eduardo):** R$ 9.016,39, 207 conversões, 130 linhas (duas campanhas diferentes chamadas "RMKT" em 08/07 foram somadas, porque a chave por nome não aceita as duas). Antes: R$ 10.178.
- [x] **Migration `20260924120000_meta_ads_campaign_id.sql` APLICADA em 24/09** (conferido depois: coluna text, 532 linhas intactas, total R$ 26.388,50, índices parciais e trigger no lugar).
- [ ] Eduardo: mudar o fluxo `meta_ads` (os 3 pontos abaixo) e salvar/publicar; depois eu confiro a execução das 3h (as linhas devem ganhar campaign_id).
- Registro do teste antes de aplicar: Testada em produção com rollback: renomear atualiza o nome sem duplicar; mesmo nome com id diferente vira duas linhas; linha antiga sem id adota o id; insert sem id segue casando por nome. Ordem: aplicar a migration → Eduardo muda o fluxo `meta_ads` (campaign_id em `fields`, no Code e no nó do Supabase). Opcional: rodar a cópia do fluxo com campaign_id para preencher o histórico.
- Detalhe de julho: API R$ 9.016,39 × tabela R$ 10.178. Causa: **campanhas renomeadas contadas duas vezes**. O fluxo regrava 14 dias com o nome novo e as linhas com o nome antigo ficam: "Locação jul/2026" → "Imovit | Locação | WhatsApp | Geral", "Engajamento 2026" → "Imovit | Engajamento | Posts | Geral", "Imovit - WhatsApp - Casas à venda" → "Imovit | Vendas | WhatsApp | Casas | Campinas". Falta também 01/07 do RMKT. SQL pronto no scratchpad (`fix_meta_julho.sql`), com os nomes da API.
- [ ] **Causa raiz dos duplicados por renomeação:** a chave única é (data, campanha, anuncio), por **nome**. Adicionar `campaign_id` na tabela e no fluxo (`fields=campaign_id,...`) e usar o id na chave. Sem isso, toda renomeação volta a duplicar.
- [ ] Abril (a tabela só tem 05–08/04).
- [ ] Ajustar o mapa de canais em `vw_atendimentos_base` (mídias de site e do bot); migration pequena, com aprovação.
- [ ] Ver por que o CRM não sincroniza desde 22/09.
- [ ] Taxas do pago abaixo de Qualificado: amostra pequena (18 visitas). Para as metas, usar a taxa do pago em L→Q e a de todos os canais daí para baixo, até as conversões offline darem atribuição por gclid.

## 2026-09-24 — Ponte do gclid no GTM: testada e publicada

**Feito (no GTM e no n8n, pelo Eduardo; conferido por mim):**
- Tag `V30` virou `V31 - WhatsApp - Mensagem (testado)`: envia `gclid`/`gbraid`/`wbraid`/`fbclid`. Lê da URL e guarda em cookies `imv_*` por 90 dias; como reserva, usa `_gcl_aw` (Vinculador de conversões) e `_fbc` (Meta Pixel). Sintaxe conferida.
- Tag `[N8N] WHATSAPP CLICK` excluída: usava o mesmo webhook e só mandava UTMs, gerando linhas vazias.
- `wpp_gtm` no n8n grava `gclid` e `imovel_codigo`.
- **Teste no Visualizar (24/09, 12:48 UTC):** 2 linhas em `leads_wpp_gtm` com `gclid = teste123`, `origem_registro = site_gtm`. O gclid sobreviveu à navegação da home até o imóvel 8771.
- Aviso de CSP do GTM: alarme falso. O único CSP do site é `upgrade-insecure-requests`, e GTM, GA4 e Ads carregam com status 200.

**Pendências:**
- [x] Contêiner publicado pelo Eduardo (versão 94). Conferido no `gtm.js` público: tem o código do gclid, não tem mais a `[N8N] WHATSAPP CLICK` nem as variáveis `form_corretor_*`. **Não conferi** se as 3 tags do formulário antigo (`Enviar Form para N8N`, `GA4 - Form Submission`, `Meta Pixel - Form Submission`) foram pausadas.
- [x] As 2 linhas de teste (`gclid = 'teste123'`) foram apagadas de `leads_wpp_gtm`.
- [ ] Acompanhar nos próximos dias: leads de anúncio do Google devem chegar com `gclid` preenchido.
- [ ] `imovel_titulo` nunca foi gravado (0 de 802 linhas): conferir o mapeamento no n8n e a variável `{{nome_do_imovel}}` no GTM.
- [ ] UTMs na V31 vêm só da URL atual: quem navega vira `direct`/`organic`. Usar os cookies de UTM como reserva.
- [ ] `wpp_entrada`: ver a seção abaixo. Conversões offline (developer token do Google Ads). Refazer as taxas do funil.

**`wpp_entrada` — diagnóstico de 24/09 (fluxo lido pelo MCP, sem edição):**
- Já corrigido pelo Eduardo em 23/09, às 19:41: o nó do Supabase usa `telefone`, `codigo_atendimento` e `midia`, e grava `tipo_conversao = whatsapp_bot` e `origem_registro = bot_severino`. "Incluir lead" e "Criar atividade" estão ligados.
- Insert do bot simulado no banco (transação desfeita): passa. `lead_id` é identity e a trigger de vazias não o barra.
- **Nenhuma linha do bot desde 22/09, às 09:59.** Em setembro o ritmo foi de 0 a 5 por dia, então pode ser só falta de lead. Não deu para confirmar pelas execuções, porque o MCP não lista execuções.
- **Bug:** o IF "Está atualizado 30D?" testa `$json.ehLeadFrio`, campo que o Code nunca cria (ele cria `acao`). Por isso "Criar atividade" nunca roda, e todo lead que já existe é incluído de novo no Imoview. Correção: condição de texto `{{ $json.acao }}` é igual a `criar_atividade`.
- **Bug:** a nota de "Criar atividade" lê `$('Webhook').item.json.body[0].body[0].body.mensagem_completa` (caminho frágil) e monta o JSON com texto cru (aspas ou quebras de linha na mensagem quebram o JSON). Correção: usar `JSON.stringify` com `mensagem_testada`.
- O nome do nó diz 30 dias, mas o Code usa 60. Falta o Eduardo definir qual vale.
- **Teste de 24/09 (execução 17239, manual via Postman, com o lead de teste do Eduardo, atendimento 6242):** o fluxo inteiro passou. `existe = true` → Retornar Atendimento → `acao = criar_atividade` → **atividade criada** para a corretora → linha 483 no banco com telefone e `origem_registro = bot_severino`. As duas correções (IF por `acao`, e `jsonAtividade` com `JSON.stringify`) funcionaram.
- **Bug novo:** o bot real manda `midia = "whatsapp"`/`"WhatsApp"` (341 linhas no histórico). Esse valor não está no `NORMALIZA`, então vira `wpp_nao_identificado`, e a inferência pelo código de atendimento ou pela mensagem **nunca roda**. Correção: só confiar em `payload.midia` quando estiver no `NORMALIZA`; caso contrário, cair na inferência.
- Detalhe: o título da atividade saiu "Ligação - Ligação - Eduardo", porque o Imoview já prefixa o tipo. Deixar só o nome em `titulo`.
- [x] **Publicado em 24/09, 13:34 UTC** (versão ativa = versão do editor). Conferido pelo MCP: IF por `acao`, `jsonAtividade` com `JSON.stringify` e título só com o nome, mídia via `NORMALIZA` com queda para a inferência.
- [ ] Acompanhar o primeiro lead real do bot: linha com `midia` inferida (`wpp_site_geral`/`wpp_pag_imovel`/`campanha_*`) e atividade ou lead no Imoview.
- [x] Linha de teste 483 apagada de `leads_wpp_gtm`.
- [x] Limite de lead frio: **60 dias** por enquanto (decisão do Eduardo, 24/09). O nome do nó "Está atualizado 30D?" está desatualizado; dá para renomear para "60D" no editor.
- [ ] Envios ao GA4 voltaram 503 no navegador de teste: conferir no GA4 → Tempo real.

---

## ▶ Retomar em 2026-09-24 (fim do dia 23/09)

**Onde paramos:** auditoria dos dados de performance. Meta e `leads_wpp_gtm` corrigidas no banco. Próximo passo: o Eduardo aplica as edições no n8n e no GTM, e eu confiro se o `gclid` chega.

### Estado de cada frente
| Frente | Estado | Nota no Obsidian |
|---|---|---|
| **Dados de performance + conversões Google** | Banco corrigido (Meta sem duplicados; leads vazias removidas e bloqueadas). **Falta:** edições nos fluxos `wpp_gtm` e `wpp_entrada` (expressões prontas na seção abaixo), montagem da ponte no GTM, e depois as conversões offline | 🟡 Dados de Performance e Conversões Google |
| **Metas pelo funil** | Método discutido (taxas móveis, maturação, faixas, hierarquia de amostra). **Espera os dados certos** antes da calculadora de funil e do cadastro/aprovação de metas | 🟡 Níveis de Acesso e Perfil (tela de metas) |
| **TV Display, rodapé** | Sprints 1 e 2 prontos e commitados (carrossel Fotógrafo → Comercial → Operação → Eventos; função `kpis_tv` já aplicada). Eduardo decidiu não testar na TV agora. **Push pendente** | 🟡 Modo TV v2 - Design e Dados |
| **Esteira de locação** | Sprint encerrado; pendências em nota própria | 🟡 Esteira de Locação - Próximo Sprint |

### Checklist para começar
1. `git status`: a `main` está **4 commits à frente** do origin (TV sprints 1 e 2, migrations da Meta e do GTM). O push pode ir a qualquer momento; o banco já está pronto para tudo.
2. Perguntar ao Eduardo se aplicou as edições no `wpp_gtm`/`wpp_entrada` e no GTM. Para testar: abrir o site com `?gclid=teste123`, clicar no WhatsApp e procurar a linha em `leads_wpp_gtm`.
3. Perguntar se os nós desligados do `wpp_entrada` ("Incluir lead", "Criar atividade") são intencionais.
4. Depois do `gclid` chegando: montar as conversões offline (n8n + API do Google Ads; precisa de developer token).
5. Refazer as taxas do funil pago com os números corrigidos (agosto: cerca de R$ 6 mil de mídia no total, não R$ 32 mil).

### Cuidados
- **Não editar fluxos do n8n pelo conector MCP:** ele regrava o fluxo inteiro e cria credenciais novas (desligaria Supabase e Imoview). Correções de fluxo: passar as expressões ao Eduardo, ou resolver no banco.
- Backups de hoje: `dashboard_meta_ads_backup_20260923`, `leads_wpp_gtm_backup_20260923`. Dá para apagar quando os números forem validados no Gerenciador de Anúncios.
- Deploys de banco e função pelo conector do Supabase (o CLI local não está logado). Push sempre pelo Eduardo, no VS Code.

---


## 2026-09-23 — Dados de performance: duplicados da Meta e ponte de conversões

### Achados
- **`dashboard_meta_ads` duplicada:** o fluxo n8n `meta_ads` (3h, janela de 14 dias) grava com "Create a row"; cada dia entrava até 14 vezes. Somar a tabela inflava tudo (ago/26: R$ 29.176 somado × **R$ 2.950** real; jul: 22.980 × 10.178). `dashboard_google_ads` e `dashboard_atendimentos_crm` não têm duplicados.
- **`leads_wpp_gtm` com 3.939 linhas totalmente vazias (cerca de 80%):** vêm do webhook público do `wpp_gtm`. Padrão de máquina (24h por dia, rajadas de 5 a 93 chamadas no mesmo segundo), sem nenhum dado. *(A primeira hipótese, de que viriam do `wpp_entrada`, estava errada.)*
- **`wpp_entrada` (bot Severino):** desde 02/09 o telefone deixou de ser gravado, porque o nó usa `whatsapp`/`id_atendimento`/`origem` e a etapa anterior entrega `telefone`/`codigo_atendimento`/`midia`. Os nós "Incluir lead" e "Criar atividade" estão **desligados**.
- **`wpp_gtm`:** `imovel_codigo` lido de `$json.imovel_codigo` em vez de `$json.body.imovel_codigo` (nunca gravou). Nenhum identificador de clique (gclid) é capturado.
- Token da Meta e senha/chave do Imoview estão em texto aberto nos fluxos; o certo é movê-los para as credenciais do n8n.

### Feito
- `supabase/migrations/20260923230000_meta_ads_sem_duplicados.sql` (**aplicada**): backup `dashboard_meta_ads_backup_20260923` (1.992 linhas); ficou 1 linha por dia+campanha+anúncio, a de maior investimento (695 linhas); trigger `meta_ads_upsert`, que transforma o insert repetido do n8n em atualização; índice único. Colunas novas em `leads_wpp_gtm`: `gclid`, `gbraid`, `wbraid`, `fbclid`, `origem_registro`.
- `supabase/migrations/20260923233000_leads_wpp_gtm_sem_vazias.sql` (**aplicada**): backup `leads_wpp_gtm_backup_20260923` (4.739); remove as vazias (ficam 800); trigger que descarta linha sem nenhum dado. Testado: webhook chamado com corpo vazio respondeu 200 e não gravou nada.
- **Verificado com o fluxo real:** execução n8n 17171 do `meta_ads` terminou com sucesso, a tabela continuou com 695 linhas e 0 duplicadas, e os dias recentes foram atualizados. Os dashboards já leem o número correto.
- As edições nos fluxos `wpp_gtm` e `wpp_entrada` **não foram feitas pelo conector**: ele reescreve o fluxo inteiro e cria credenciais novas, o que desligaria Supabase e Imoview. Foram entregues ao Eduardo como expressões para colar.

### Pendências
- [ ] Eduardo aplicar as edições no `wpp_gtm` (código do imóvel + gclid/gbraid/wbraid/fbclid) e no `wpp_entrada` (3 campos + origem)
- [ ] GTM: tag que guarda os identificadores de clique em cookie, envio deles no payload, Conversion Linker, tag de conversão do Google Ads
- [ ] Conversões offline (lead qualificado, visita, negócio) de volta ao Google Ads pelo gclid (n8n + API do Google Ads)
- [ ] Confirmar se os nós desligados do `wpp_entrada` são intencionais
- [ ] Mover o token da Meta e a senha do Imoview para as credenciais do n8n

---

## Sprint 2026-09-23 — TV Display: carrossel de dados no rodapé (Sprints 1 e 2 de 3)

**Objetivo da tarefa:** a TV continua como está; o espaço da agenda do fotógrafo, no rodapé, vira um carrossel de painéis em ciclo: Agenda do fotógrafo → KPIs 1 → KPIs 2 → Agenda de eventos. Detalhes do escopo e das decisões no Obsidian: "🟡 Modo TV v2 - Design e Dados". O esboço do Google Stitch foi analisado e descartado como redesenho completo.

### Feito (Sprint 1)
- `src/components/tv/CarrosselRodapeTV.jsx` (novo): troca de painel a cada 15 s; todos os painéis na mesma célula de grid (altura estável, dados mantidos); indicador com rótulo e barra de tempo; respeita `prefers-reduced-motion`.
- `src/hooks/useEventosCalendario.js` (novo): a montagem de eventos saiu de `Calendario.jsx` (reuniões recorrentes, avisos com data, fotógrafo, datas comemorativas, aniversário e tempo de casa). A Home e a TV usam a mesma fonte; o comportamento da Home não mudou.
- `src/components/calendar/AgendaEventosSemanalTV.jsx` (novo): semana seg–dom, dia de hoje destacado, até 3 eventos por dia (+N), sem os blocos do fotógrafo (que têm painel próprio).
- `TVDisplayFooter.jsx`: carrossel com os painéis Fotógrafo e Eventos; `useHojeISO` atualiza a data a cada minuto, para a semana virar sozinha na TV ligada 24/7.
- CSS em `hub.css` (bloco "CARROSSEL DO RODAPÉ").

### Estado
- Build ok; Lint sem avisos nos arquivos novos.
- Prévia temporária (já apagada) com o carrossel real em 1920 px: troca de Fotógrafo para Eventos aos 15 s, confirmada por captura.
- A conta da TV já lê todas as fontes da agenda de eventos (RLS `authenticated`). Nada mudou no banco.
- **Não testado ao vivo na TV** (depende do push).

### Feito (Sprint 2): KPIs
- `supabase/migrations/20260923220000_kpis_tv.sql` (**aplicada**): função `kpis_tv()` (security definer, só leitura) que devolve um JSON só com agregados; chamável por gestao/adm/marketing/tvaccess, recusa os demais (testado: Corretor bloqueado; sem login responde 401). Fuso de São Paulo.
- `src/hooks/useKpisTV.js`: RPC com atualização a cada 5 min; se uma atualização falhar, mantém os últimos números.
- `src/components/tv/KpisTV.jsx`: **KPIs 1 · Comercial** (leads × meta, ou × mês anterior quando não há meta; negócios; conversão; ciclo até o fechamento) e **KPIs 2 · Operação** (propostas de locação por etapa; leads parados 30+ dias; leads venda × aluguel; plantão de hoje).
- Ciclo do rodapé: Fotógrafo → Comercial → Operação → Eventos.
- **Ajustes pelos dados reais:** não há meta de leads para setembro (a última é de junho), então aparece a comparação com o mês anterior. "Imóveis locados no mês" foi trocado por venda × aluguel, porque `imoveis_locados` está vazia. Não há plantão escalado depois de 11/09, então hoje aparece "Sem plantão escalado hoje".
- Números de hoje (23/09) no teste: 101 leads (ago: 191), 0 negócios (ago: 4), 182 leads parados, 43 venda × 58 aluguel, 1 proposta aguardando o locatário.

### Próximos passos
- [ ] Sprint 3: ajuste na TV real (tempos, legibilidade, 24/7)
- [ ] Cadastrar a meta de leads do mês (depende da tela de metas do Marketing) e preencher a escala de plantão
- [ ] Sincronização da `imoveis_locados` com o Imoview (tabela vazia)

---

## Sprint 2026-09-23 — ENCERRADO: Finalizar a esteira de locação

**Objetivo:** fechar a esteira de locação para uso real. Encerrado pelo Eduardo em 2026-09-23, depois do teste completo da esteira ("funcionou 100%").

### Entregue (tudo em produção)
- E-mails da esteira no padrão Imovit; reprovação de documentos consolidada em "Solicitar ajustes" (e-mail único).
- Links dos e-mails em `hub.imovit.com.br` (`APP_URL` lido a cada envio, com o domínio novo como padrão).
- Portal do locatário: jornada com etapas destraváveis e atualização automática.
- Favicon com o símbolo da Imovit.
- Níveis de acesso (Gestão/Admin/Marketing/Corretor), página de Perfil, pedidos de nível decididos pela Gestão.
- **Segurança:** fechada a falha que expunha propostas, documentos e arquivos da esteira sem login (RLS reescrita, view com `security_invoker`, RPCs revogadas).
- Gestão suspende, reativa e exclui colaboradores.
- Estado de produção: migrations `niveis_acesso_perfil` e `suspender_colaborador` aplicadas; funções `esteira-locacao` v18 e `gestao-colaboradores` v1; frontend no ar via Vercel.

### Não testado ao vivo
- A jornada destravando sozinha com o portal aberto.
- O login real em cada nível novo (Corretor, Marketing).
- Suspender, reativar e excluir colaborador.

### Pendências (próximo sprint)
No Obsidian: "🟡 Esteira de Locação - Próximo Sprint" e "🟡 Níveis de Acesso e Perfil".
- [ ] Revisar o dashboard e os dados da esteira (itens da pauta de 23/09 que não foram feitos)
- [ ] Workflows antigos da esteira no n8n: confirmar se estão ativos e arquivar
- [ ] Limpar o registro órfão de 21/08 e os 11 arquivos de teste; limpar o Storage também ao descartar, rejeitar ou expirar proposta
- [ ] Brevo: liberar a checagem de IP das chaves de API
- [ ] Tela de metas para o Marketing
- [ ] Views `vw_*` do dashboard legíveis sem login; tabelas `repique_*` sem RLS; proteção contra senha vazada

### Como retomar
- `npm run dev` (precisa de `.env` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`). Produção: `https://hub.imovit.com.br`.
- Supabase `vlsrmtryzwddqkwqugfr`. O CLI local não está logado; os deploys desta sessão foram feitos pelo conector do Supabase.
- O detalhe de cada entrega está nas seções abaixo, da mais recente para a mais antiga.

---

## Sprint 2026-09-23 — Finalizar a esteira de locação (ponto 1: e-mails)

**Objetivo:** fechar a esteira de locação ponto a ponto. O ponto 1 cobre os e-mails do fluxo: visual no padrão Imovit, reprovação de documentos num e-mail só e remoção do resto de `proprietario_email`.

### Feito
- `supabase/functions/esteira-locacao/emails.ts` (novo): template no padrão da nota "E-mails - Templates Imovit" do Obsidian (header preto com logo, badge coral, título em serif itálico, caixa de destaque, botão preto/coral, assinatura). Estilos inline. Um template por notificação (9 no total).
- `supabase/functions/esteira-locacao/index.ts`:
  - todos os handlers usam os novos templates; o `emailHtml` antigo saiu;
  - `decisao_adm` **não manda mais e-mail ao reprovar**. O locatário vê o motivo ao lado do documento no portal;
  - novo evento `solicitar_ajustes` (só gestão/adm): confere que todos os obrigatórios foram enviados, que nenhum espera decisão e que há pelo menos 1 reprovado, e aí manda **um** e-mail com a lista de reprovados e os motivos;
  - "Processo concluído" vai só para o locatário (`proprietario_email` removido).
- `src/lib/esteira.js`: `solicitarAjustes(proposta_id)`.
- `src/pages/admin/Esteiras.jsx`: botão "Solicitar ajustes (N)" na lateral do checklist, visível só quando as regras acima valem, com modal de confirmação listando os reprovados.

### Estado atual
- `npm run build`: ok.
- Edge Function **no ar como v11** (deploy em 2026-09-23, JWT obrigatório como na v10). Antes do deploy, conferi que a v10 era idêntica ao repo. Teste rápido: a função sobe, reconhece `solicitar_ajustes` e responde 401 sem usuário logado.
- `792b801` e `709c668` no `origin/main`. Deploy da Vercel ok.
- Prévia dos 9 e-mails gerada com dados de exemplo e aberta para o Eduardo aprovar. O arquivo fica na pasta temporária da sessão, fora do repo.
- Não testado ao vivo: o botão "Solicitar ajustes" e o e-mail consolidado.

### Decisões e contexto
- Reprovação parcial (locatário ainda não mandou tudo) não gera e-mail: o aviso no portal basta. O e-mail só sai quando o ADM fecha a revisão com "Solicitar ajustes". Decisão do Eduardo em 23/09.
- Segui o template de e-mail do Obsidian como está (coral `#ff5e4d`, preto `#000`), não os tokens do Design System (`#E8593C`, `#2D2D2D`). A nota registra essa divergência como não decidida.
- A regra do "Solicitar ajustes" espelha o trigger `recalcular_status_proposta`. O status sozinho não serve, porque qualquer reprovação já volta a proposta para `aguardando_docs`.
- Não há registro em `status_historico` quando o ADM solicita ajustes. O schema dessa tabela não está nas migrations do repo.

### Pendências / próximos passos
- [x] Eduardo aprovou o visual e o texto dos e-mails (2026-09-23)
- [x] Push (Eduardo, VS Code) e deploy da Vercel
- [x] Deploy da Edge Function `esteira-locacao` v11 (via conector do Supabase; o CLI local não está logado)
- [ ] Testar do início ao fim: reprovar 2 docs → "Solicitar ajustes" → conferir o e-mail único
- [ ] Seguir o sprint: teste completo com os campos novos, IP das chaves de API no Brevo, dashboard, dados (registro órfão de 21/08, proposta de teste que vence em 25/09), fluxos antigos no n8n

### Suspender e excluir colaborador (Gestão) (2026-09-23)
- Pedido do Eduardo: a Gestão suspende e exclui colaboradores.
- `supabase/migrations/20260923210000_suspender_colaborador.sql` (**aplicada**): `perfis.suspenso_em`/`suspenso_por`; `is_gestao`, `is_adm_ou_gestao` e `papel_atual` ignoram perfil suspenso (o acesso cai na hora, mesmo com a sessão aberta); o trigger protege os campos de suspensão.
- `supabase/functions/gestao-colaboradores` (**nova, v1 no ar**): `suspender` (bloqueio no Auth com `ban_duration` + marca no perfil + cancela o pedido de nível pendente), `reativar`, `excluir` (apaga a foto e o usuário do Auth; perfil e pedidos em cascata; propostas ficam com `criado_por` null). Travas: ninguém age sobre si mesmo; a última pessoa da Gestão ativa não pode ser suspensa nem excluída.
- Frontend: `src/lib/funcoes.js` (`chamarFuncao`, extraído de `esteira.js`); `src/lib/colaboradores.js`; Usuários & Acessos com coluna Situação e botões Suspender/Reativar/Excluir com confirmação (Excluir avisa que não tem volta e sugere Suspender); `ProtectedRoute` mostra "acesso suspenso" com botão Sair; Login explica quando o bloqueio é suspensão.
- Verificado: migration testada com `BEGIN … ROLLBACK` (Gestão suspensa perde o nível na hora; só sobra o acesso de locatário por e-mail, e o Auth bloqueia o login); função responde 401 sem login e 400 com ação inválida; build ok. **Não testado ao vivo:** suspender, reativar e excluir de verdade (depende do push).

### Níveis de acesso, página de Perfil e correção de segurança (2026-09-23)
- **Pedido do Eduardo:** Gestão (tudo) · Admin (Home + Propostas/Esteira/Processos + Perfil **+ Kanban**) · Marketing (Home + Perfil + dashboards e metas + avisos/links/banners/plantão/fotógrafo/datas) · Corretor (Home + Perfil + Propostas/Esteira/Processos **só das propostas que criou**; cria e acompanha, não decide). Quem é novo entra sem nível (`user`: Home + Perfil) até a Gestão aprovar. Página de Perfil: o usuário edita nome/telefone/cargo/foto e pede troca de nível; só a Gestão altera.
- **Falha de segurança encontrada (antes disso):** sem login, dava para ler propostas, documentos, histórico e **listar, baixar e enviar arquivos** da esteira. Causa: `coalesce(proprietario_email,'') = coalesce(email do login,'')` → '' = '' desde que o proprietário saiu do sistema. Também: view `propostas_ativas` SECURITY DEFINER legível por anon; 3 RPCs (`confirmar_dados_locatario`, `completar_cadastro_locatario`, `descartar_proposta_locacao`) executáveis por anon. Só havia dados de teste expostos.
- `supabase/migrations/20260923190000_niveis_acesso_perfil.sql` (**aplicada em produção em 2026-09-23** como `niveis_acesso_perfil`): colunas de perfil; níveis `marketing`/`corretor`; trigger que impede mudar o próprio nível/e-mail; tabela `solicitacoes_acesso` + RPC `decidir_solicitacao_acesso` (só Gestão); bucket público `avatares` (cada um só escreve na própria pasta); `propostas_locacao.criado_por` (preenchido pelo histórico: 5/5); `pode_ver_proposta()` substitui as regras quebradas nas 3 tabelas e nos arquivos; envio de arquivo só pelo locatário ou Admin/Gestão; view com `security_invoker`; RPCs revogadas; conteúdo da Home editável por Gestão/Marketing (antes Admin/Gestão); dados do dashboard e das metas legíveis por Gestão/Marketing.
- **Teste da migration:** rodada inteira em produção dentro de `BEGIN … ROLLBACK`, sem erros, e confirmado depois que nada ficou aplicado.
- Frontend: `src/lib/acessos.js` (mapa único de níveis → rotas/menu/botões); `App.jsx` usa o mapa + rota `/perfil`; `Navbar` monta o menu por nível ("Admin" virou "Locação"), e o rodapé tem foto/nome/nível com link para o Perfil; `usePerfil` traz os novos campos e se atualiza com o evento `hub:perfil-atualizado`; `pages/Perfil.jsx` (novo); `UsuariosAdmin` com nome/cargo, níveis novos e fila de pedidos pendentes; Propostas/Esteiras escondem as ações de decisão para o Corretor.
- Edge Function: `nova_proposta` exige gestao/adm/corretor e grava `criado_por`. **No ar como v18** (v14–v17 foram republicações automáticas do Supabase ao editar Secrets).
- **Verificado depois de aplicar:** sem login, propostas, documentos, histórico e view respondem 401; a listagem de arquivos vem vazia; as RPCs revogadas respondem 404. Simulação por papel (transação desfeita): Gestão vê 5 propostas; Corretor só as 2 dele; Marketing nenhuma proposta, mas lê `dashboard_meta_ads`; locatário só a própria.
- Ordem seguida: migration → função → push do frontend (o push é do Eduardo). Falta: testar o login real com cada nível depois do push.
- **Fica para depois:** tela de edição de metas para o Marketing (hoje as metas só são lidas; não existe tela); views do dashboard (`vw_*`) ainda legíveis sem login (dados de negócio, sem dados pessoais de cliente); tabelas `repique_*` sem RLS; proteção contra senha vazada; limpeza dos 11 arquivos de teste que sobraram e limpeza do Storage ao descartar proposta.

### Portal do locatário: jornada com etapas destraváveis (2026-09-23)
- Pedido do Eduardo depois do teste completo ("funcionou 100%"): com o portal aberto, a aprovação não aparecia, e o locatário só chegava à etapa nova pelo e-mail. Pediu navegação melhor e "desbloquear acessos" gamificado; escolheu o modelo "etapas com cadeado".
- `src/hooks/usePortalAcesso.js`: atualização silenciosa a cada 20 s (só com a aba visível) e ao voltar para a aba. `recarregar({ silencioso: true })` não troca a tela por "Carregando…".
- `src/lib/esteiraLabels.js`: `ETAPAS_JORNADA` + `etapaJornada(proposta)`, com 5 etapas: Proposta → Aprovação → Cadastro → Documentos → Conclusão. Cadastro e Documentos se separam por `tipo_pessoa`, porque os dois têm status `aguardando_docs`.
- `src/components/esteira/JornadaLocatario.jsx` (novo): trilha com check/atual/cadeado, barra de %, selo "Liberada!" com animação (respeita `prefers-reduced-motion`).
- `src/pages/portal/PortalStatus.jsx`: jornada no lugar da antiga lista de etapas. Aviso "Nova etapa liberada" quando a etapa avança desde a última visita (guardada em `localStorage` por proposta, com try/catch). A mensagem de espera diz o que acontece agora. A lista de documentos recarrega quando a proposta muda.
- Removidos `StepProgress.jsx`, `PASSOS_FLUXO`/`passoAtual` e o CSS `.esteira-progress` (só eram usados ali).
- Verificado: build ok; jornada renderizada com o componente real em 4 estados (prévia temporária, já apagada). **Não testado ao vivo** no portal logado: a troca automática de etapa com a aba aberta e o aviso.
- Limite conhecido: reprovação de documento que não muda o status da proposta só aparece para o locatário ao recarregar a página.

### Correção: links dos e-mails com localhost (2026-09-23)
- Sintoma: mesmo depois de o Eduardo trocar a secret `APP_URL` para `https://hub.imovit.com.br`, o e-mail de proposta criada ainda saiu com localhost.
- Causa provável: o `APP_URL` era lido uma vez, no carregamento do módulo, e uma instância já quente mantinha o valor antigo.
- `index.ts`: `appUrl()` agora lê a secret a cada envio; o valor reserva passou de `localhost:5175` para `https://hub.imovit.com.br`. Os links `linkPortal()`, `linkPropostas()` e `linkEsteiras()` viraram funções.
- Deploy **v13** feito (o deploy também reinicia as instâncias). Teste rápido ok (401 sem usuário logado).
- A v12 entre a minha v11 e esta v13 não veio de mudança de código: o Eduardo só alterou `APP_URL` e URL Configuration (provável republicação automática do Supabase ao salvar a secret). Nada perdido.
- `localhost:5173` não existe no código nem no histórico do git. Veio de configuração: a secret `APP_URL` antiga (e-mail da função) ou, se for o e-mail de login, a Site URL / template de Magic Link do Supabase Auth.
- Falta: confirmar com um e-mail real que o link sai com `hub.imovit.com.br`.

### Extra do dia: favicon (2026-09-23)
- O favicon padrão do Vite (raio roxo) foi trocado pelo símbolo coral da Imovit (`00 - Padrão/2026 - lares/simbolo-coral.png`).
- `public/favicon.svg`: símbolo redesenhado em vetor, com a mesma geometria do PNG (dois anéis, raio 420/245, cor `#F15E51`). Conferido renderizado em 200/32/16 px, em fundo claro e escuro.
- `public/favicon-32.png` (reserva para navegadores sem SVG) e `public/apple-touch-icon.png` (180 px, fundo branco, porque o iOS pinta transparência de preto), gerados a partir do PNG original.
- `index.html`: links dos três ícones. Build ok.

### Como retomar
- `npm run dev` (precisa de `.env` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
- Painel do ADM: `/admin/esteiras`. Portal do locatário: `/portal/entrar`.
- Acompanhamento do sprint no Obsidian: "🟡 Esteira de Locação - Validação do Fluxo".
