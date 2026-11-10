# PRD — Hub Imovit
**Versão:** 0.1 (retroativa) · **Data:** 2026-09-24 · **Status:** rascunho, aguardando revisão do Eduardo

> Documento reconstruído em 24/09/2026 a partir do código, do banco e dos handoffs, com o sistema
> já em produção. Descreve o que **existe hoje**. Itens com ⚠ são inferências que o Eduardo precisa confirmar.

## 1. Problema
A Imovit opera com informação espalhada: atendimentos e atividades no Imoview (CRM), mídia paga
na Meta e no Google, avisos e escalas no WhatsApp, propostas de locação por formulário e e-mail.
Faltava um lugar único para:
- a equipe ver o dia a dia (agenda, plantão, avisos, links);
- a gestão e o marketing acompanharem funil, campanhas e metas com números confiáveis;
- conduzir a proposta de locação do início ao fim, com documentos, aprovação e registro.

## 2. Usuários e papéis
| Papel (`perfis.role`) | Quem é | O que precisa fazer |
|---|---|---|
| `gestao` | Diretoria / Eduardo | Tudo, inclusive usuários e níveis; suspender e excluir colaborador |
| `adm` (rótulo "Admin") | Administrativo de locação | Propostas, esteira e processos de todos; decidir documentos; Kanban |
| `marketing` | Time de marketing | Dashboards e metas; conteúdo da Home (avisos, links, banners, plantão, fotógrafo, datas) |
| `corretor` | Corretores | Criar propostas e acompanhar **só as suas**; não decide |
| `user` ("Sem nível") | Novo cadastro `@imovit.com.br` | Home e Perfil; pede um nível para a Gestão |
| `tvaccess` | Conta da TV do escritório | Só a TV Display |
| Locatário (sem perfil) | Cliente externo | Entra por magic link no portal, preenche dados e envia documentos da própria proposta |

## 3. Objetivos
- Um ponto de entrada diário para a equipe (Home e TV do escritório).
- Números de marketing e comercial confiáveis, sem planilha paralela.
- Esteira de locação sem retrabalho manual, da proposta até a sincronização com o Imoview.
- Acesso por papel garantido no banco (RLS), e não só escondido na tela.
- ⚠ Falta quantificar: qual resultado de negócio mostra que o Hub está funcionando?

## 4. Escopo
### Dentro (o que existe hoje)
- Login com e-mail `@imovit.com.br`, níveis de acesso, Perfil e pedidos de nível.
- Home: banners, agenda (reuniões recorrentes, avisos, datas comemorativas, aniversários, tempo de casa, blocos do fotógrafo), plantão, avisos, biblioteca de links, clima.
- TV Display: navbar própria, clima, relógio, Spotify, rodapé em carrossel (fotógrafo → KPIs comercial → KPIs operação → eventos).
- Kanban de atendimentos, Dados de Atendimento, Relatório de Atividades.
- Dashboards: **Painel da Gestão** e **Painel de Performance** (§5.0 e §5.0b). As páginas antigas (visão geral, funil, campanhas, performance com PDF, leads) foram removidas em 24/09.
- Configurações: conteúdo da Home, agenda do fotógrafo, datas, usuários e acessos.
- Esteira de locação: propostas, esteira (documentos), processos, portal do locatário, e-mails pelo Brevo, sincronização com o Imoview.
- Proposta de venda (RF21, §5.5): criação pelo corretor, assinatura pelo proponente no portal `/venda`, PDF para a equipe. Banco e função no ar (28/09); frontend aguarda push.

### Fora (não é o Hub)
- Editar dados do CRM: o Hub só **lê** o que o n8n traz do Imoview.
- Automações do n8n (repique, blog, newsletter, campanha de proprietários): usam o mesmo Supabase, mas não fazem parte do produto Hub.
- App mobile nativo.

## 5. Requisitos funcionais
| ID | Requisito | Papel | Prioridade | Estado |
|---|---|---|---|---|
| RF01 | Login com e-mail `@imovit.com.br`; perfil novo entra como `user` | todos | must | feito |
| RF02 | Gestão atribui nível, aprova pedidos, suspende, reativa e exclui | gestao | must | feito, **não testado ao vivo** |
| RF03 | Perfil: nome, telefone, cargo, foto; pedir troca de nível | todos | must | feito |
| RF04 | Home com agenda unificada, plantão, avisos, links e banners | todos | must | feito |
| RF05 | Conteúdo da Home editável em Configurações | gestao, marketing | must | feito |
| RF06 | TV Display 24/7 com KPIs agregados | tvaccess, gestao, adm | should | Sprints 1–2 feitos; KPIs alinhados com o Painel da Gestão em 24/09; Sprint 3 (TV real) pendente |
| RF07 | Kanban e análise de atendimentos do CRM | gestao, adm | must | feito |
| RF08 | Dashboards de funil, campanhas, performance e leads | gestao, marketing | must | **substituído** por RF16 e RF18 em 24/09 (páginas antigas removidas) |
| RF09 | Tela para cadastrar metas | marketing | must | **não existe** |
| RF10 | Criar proposta de locação e enviar o link ao locatário | corretor, adm, gestao | must | feito |
| RF11 | Locatário confirma dados, completa o cadastro e envia documentos pelo portal | locatário | must | feito |
| RF12 | Aprovação interna, decisão por documento, "Solicitar ajustes" com e-mail único | adm, gestao | must | feito |
| RF13 | Finalizar processo: baixar `.zip`, limpar o Storage e sincronizar com o Imoview | adm, gestao | must | feito |
| RF14 | Limpar o Storage ao descartar, rejeitar ou expirar uma proposta | sistema | should | **pendente** |
| RF15 | Atribuição de leads (gclid/fbclid) e conversões offline no Google Ads | marketing | should | captura feita em 24/09; conversões offline pendentes |
| RF16 | **Painel da Gestão**: uma página que conta a história em cascata (resultado → ritmo → onde perde → quanto custa → canais → pessoas), com gráficos, filtros e visões compartilháveis por URL | gestao, marketing | must | em construção (24/09); substitui os protótipos Comercial/Operacional |
| RF18 | **Painel de Performance**: história do investimento em mídia até o negócio, com orçamento, campanhas e recomendações (§5.0b) | gestao, marketing | must | em construção (24/09) |
| RF19 | **Importar a escala de plantão (PDF) do mês**: o sistema lê a tabela (data, dia, manhã, tarde), casa os nomes com os corretores, mostra prévia e grava; a TV mostra o plantão da semana (§5.3). **Dois plantões: Vendas e Locação** (05/11), cada um com a própria escala | gestao, marketing (import); todos (TV) | must | vendas no ar; locação em 05/11 |
| RF20 | **Home por nível**: busca, atalhos, pendências com número que levam à tela certa, hoje no escritório, avisos e links (§5.4) | todos com perfil | must | feito (24/09), commitado; falta push |
| RF21 | **Proposta de venda (compra)**: corretor cria, proponente confirma e assina pelo portal `/venda`, a equipe recebe o PDF assinado; valores e condições ficam no banco para análise (§5.5) | corretor, adm, gestao; proponente | must | aprovado e publicado no banco/função em 28/09; frontend aguarda push (ver plano, Fase 9) |
| RF22 | **Esteira de locação v4**: gestor registra a proposta negociada (com observações); locatário valida ou pede correção; ao validar abre a esteira e avisa o ADM, sem aprovação interna (§5.6). Substitui partes de RF10–RF12 | corretor; locatário; adm | must | aprovado e implementado (28/09) |
| RF23 | **Formulários no Hub** (§5.7): 1ª entrega Captação (link público por corretor, assinatura, PDF, lista) e Feedback de visita (PDF); depois apresentações públicas, Avaliação, Guia e Relatório | corretor, adm, gestao; proprietário | must | 1ª entrega no ar (28/09) |
| RF24 | **Dados confiáveis e dashboards v2** (§5.8): histórico acumulado do funil no banco, páginas Comercial, Performance e Geral com todos os filtros respeitados e só a equipe comercial ativa, Kanban com código e filtro por etapa | gestao, marketing | must | Comercial v1 no localhost (29/09); histórico (S1–S2) aguarda o Pro |
| RF25 | **Campanha "Km 32" na Home** (§5.9): trilha do 4º tri 2026 com valor realizado, volume e ticket médio por finalidade, a partir dos negócios realizados no CRM desde 06/10/2026, contra metas guardadas numa tabela de campanha | todos com nível | must | **no ar (06/10)** |
| RF26 | **Adm locação** (§5.13): painel da carteira de contratos administrados pela ótica do gestor (administração recebida, crescimento, bairros e tipos, saídas e motivos, reajustes, inadimplência e atenção, proteção, proprietários), lido do Imoview | gestao | must | **no ar para a Gestão (07/10)** |
| RF27 | **Estoque de imóveis** (§5.14): (A) painel Dash ▸ Estoque (quanto temos e vale, captações, tickets, parados, desatualizados +45 d, fora do site) e (B) **busca inteligente** Ferramentas ▸ Buscar imóveis (texto livre → filtros, resultados exatos + "quase lá" com margem e motivo), lido do Imoview 1×/dia | gestao (corretor depois, na busca) | must | **proposta (08/10)** |
| RF28 | **Cadastro Locador PF no Hub** (§5.15): form público de link fixo com os 5 blocos do Google Form; grava no Supabase e avisa `administrativo3@`; lista em Propostas (só gestão/adm); Propostas em produção só gestão/adm | locador (público); gestao, adm | must | **aprovado (09/10)** |
| RF29 | **Distratos** (§5.16): o ADM gera o link por contrato; o locatário lê o procedimento e envia o aviso oficial (data registrada), o motivo e a pesquisa de satisfação; e-mail a `administrativo@` + comprovante; lista com motivos e NPS | gestao (adm depois); locatário (link) | must | **no ar (14/10), só Gestão** |
| RF30 | **Central de Cadastros** (§5.17): os 6 cadastros do Google (Locador/Locatário/Fiador × PF/PJ) num motor único — 1 página pública com seletor + links diretos, 1 tabela, 1 função, 1 lista admin com filtro; piloto Locador PJ; histórico das planilhas importado | locador/locatário/fiador (público); gestao, adm; corretor (só links) | must | **aprovado (14/10, pode construir)** |
| RF31 | **Painel da Gestão v2** (§5.0c): foco no atendimento, com os ativos de Qualificado a Proposta na manchete, o funil inbound × outbound, a maior perda por corretor × equipe e as atividades contra a média da equipe; sai o ritmo de leads | gestao, marketing | must | **aprovado (15/10)** |
| RF17 | Listas de ação da Operação (quem ligar, o que venceu), abertas a partir do capítulo "Pessoas" | gestao, adm | should | a fazer depois do RF16 |

### 5.0 Painel da Gestão — a história (decidido com o Eduardo, 24/09)
- **Público e uso:** a Gestão olha o tempo todo e pede recortes diferentes. Por isso: uma página, **filtros em vez de páginas** (período, venda/locação, canal, corretor) numa barra única no topo, e o estado dos filtros vai para a URL, para cada recorte ter um link.
- **Cascata:** cada capítulo responde uma pergunta e leva à seguinte; o título é a **conclusão gerada pelos dados**, não o nome da métrica; um gráfico principal, poucos índices e, quando couber, "o que fazer".
  0. **Manchete**: 3 frases automáticas + 4 índices (leads/ritmo, negócios, conversão, valor locado).
  1. **Estamos no ritmo?** Leads e negócios por mês (12 meses) com o mês atual projetado. **Ritmo = média diária dos últimos 30 dias** (decisão do Eduardo); projeção = realizado no mês + dias restantes × ritmo.
  2. **Onde o lead se perde?** Funil em cascata, venda × locação lado a lado, maior queda destacada.
  3. **Quanto isso custa?** Descartes por etapa + simulação de ganho ao melhorar a passagem mais fraca.
  4. **Quais canais valem a pena?** Volume × conversão por canal; custo real da mídia paga por mês.
  5. **Pessoas: quem precisa agir?** Mapa de calor por corretor (carteira, sem contato, abertos 30+, atividades vencidas, contato em até 1 dia, negócios).
  - Rodapé: **saúde dos dados** (última atualização de cada fonte).
- **Visual:** Venda = coral `#E8593C`, Locação = azul `#2F6DB5` (validados para daltonismo no script do skill de dataviz, 24/09); gráficos de uma série usam ênfase (coral + cinza). Status só com verde/amarelo/vermelho do design system, sempre com texto.

### 5.0c Painel da Gestão v2 — foco no atendimento (pedido da Gestão, 15/10) — **aprovado (15/10, pode construir)**
**Por quê:** a Gestão pediu, e o Eduardo confirmou, que o painel olhe o **atendimento**, não a entrada de leads. O ritmo de entrada é métrica do Marketing; na tela da Gestão vira cobrança para o lado errado. O capítulo 3 ("Quanto custa", com o simulador) não foi entendido.

**Pedidos da Gestão (15/10):**
1. clientes em cada etapa do funil, com conversão, inbound × outbound;
2. maior perda no funil, comparando funis e corretores da equipe;
3. atividades no período, comparadas com a média da equipe;
4. imóveis ativos na carteira;
5. imóveis atualizados (% sobre o total);
6. propostas em andamento;
7. vendas no período (R$).

**Fora:** ritmo e projeção de entrada de leads (capítulo 1 atual), o índice "Leads no período" e o simulador.

**Nova cascata:**
0. **Manchete — "Em atendimento agora".** O número principal é a quantidade de leads **ativos entre Qualificado e Proposta** (fase 4 a 6 no CRM), aberta por venda × locação e por inbound × outbound. Índices ao lado:
   - negócios fechados no período;
   - propostas em andamento;
   - atividades realizadas no período, contra a média da equipe.
   As frases automáticas falam de atendimento, sem nenhuma frase sobre o ritmo de leads.
1. **Como foi o funil no período?** (revisto em 16/10: segue o filtro de período, para mostrar a efetividade) Leads que entraram no período, **inbound e outbound lado a lado**, divididos pela etapa mais avançada que alcançaram (Lead, Qualificado, Visita, Proposta, Negócio), com a taxa de passagem entre etapas dessa mesma safra e a diferença para o período anterior. Em período curto a conversão parece menor, porque parte dos leads ainda está em andamento; o rodapé avisa. Fonte: campo `funil` do CRM (`Inbound (passivo)` / `Outbound (ativo)`), que já vem em `vw_atendimentos_base`.
2. **Onde perdemos mais?** A passagem mais fraca do funil, comparando:
   - inbound × outbound;
   - a passagem de cada corretor com a média da equipe dele.
   Tabela curta: corretor, a sua taxa, a da equipe e a diferença. Os descartes por etapa ficam como apoio. Este capítulo substitui os antigos 2 e 3.
3. **Quem está atendendo?** Atividades **realizadas** no período por corretor, contra a média da sua equipe (venda ou locação), com o selo **acima / na média / abaixo**. "Na média" vai de −10% a +10% (decidido 15/10). Não contam as "Anotações".
4. **A carteira está atualizada?** (feito em 16/10, só a Gestão vê) Imóveis em estoque (Vago/Disponível, Em moderação, Em reforma, Em desocupação) e quantos foram atualizados (alterados ou validados) nos últimos 45 dias, lidos do estoque (§5.14), **por captador**: barra empilhada atualizados × desatualizados, total e selo de % atualizado (80% ou mais verde, 50–79% amarelo, abaixo de 50% vermelho). Decisões do Eduardo em 16/10: entram **só os imóveis em estoque**, e um imóvel com mais de um captador **conta para cada um**. Também mostra o **valor desatualizado** (soma do preço pedido dos imóveis desatualizados), no geral e por captador, com venda (R$) e locação (R$/mês) sempre separadas, sem somar uma com a outra (pedido de 16/10). O captador vem do detalhe do Imoview (E4 resolvido). Clicar num captador que também é corretor da equipe filtra o painel.
5. **Quem precisa agir agora?** O mapa de pessoas atual continua.
- O capítulo "Canais e custo da mídia" sai da Gestão (decidido 15/10); já existe no Painel de Performance (§5.0b).

**Equipe do corretor (decidido 15/10):** `colaboradores_raw.cargo` (`vendas` | `locação`) com `equipe = 'comercial'` e `ativo`; a ligação com o CRM é por `lower(trim(nome))`. Quem não está nessa lista (ex.: Gabriel Rosa, gestão comercial) fica fora da média e aparece sem selo.

**Lacunas (o que ainda não dá para mostrar):**
- **Vendas no período (R$):** o CRM não traz o valor da venda. As propostas de venda do Hub têm valor, mas são só 2 até agora. Por enquanto, a quantidade de negócios. O R$ entra quando as vendas passarem pelo Hub ou o valor vier do Imoview.
- ~~**Imóveis ativos / atualizados:**~~ resolvido em 15/10 (1ª carga completa: 11.220 imóveis, 1.308 em estoque).

**Pronto quando:**
- a manchete mostra os ativos de Qualificado a Proposta e o número bate com uma consulta direta no banco;
- inbound e outbound aparecem no funil;
- cada corretor tem o selo de atividades em relação à própria equipe;
- o ritmo de leads sumiu da tela;
- `npm run build` passa.

**Ajustes depois da 1ª revisão (Eduardo, 15/10):**
- **Filtro de corretor:** nenhum outro corretor aparece nomeado. A comparação é sempre com a média da equipe dele, sem nomes. Vale para a manchete e para os capítulos 2 e 3.
- **Funil (cap. 1):** uma linha por funil (inbound, outbound), com as etapas em cores; a legenda com os valores fica ao lado. A conversão de cada passagem aparece abaixo da linha, com a mais fraca em vermelho. Substitui as barras e a cascata.
- **Onde perdemos (cap. 2):** respeita todos os filtros e mostra as passagens do recorte contra uma referência:
  - com corretor filtrado: a média da equipe dele;
  - sem corretor: o semestre anterior.
  Só a **Gestão** tem o "Comparar com", para pôr outro corretor na mesma tabela (parâmetro `comparar` na URL).
- **Atividades (cap. 3):** volume e **variedade** (por tipo de atividade), total contra a média da equipe:
  - com corretor filtrado: o total dele, quantos tipos usou (contra os da equipe), o período anterior e as barras por tipo com a média da equipe marcada;
  - sem corretor: por equipe, o total, a média por corretor, os tipos e a lista de corretores com o selo.
- O capítulo 4 (Pessoas) ficou como estava.

### 5.0b Painel de Performance — a história do dinheiro (pedido do Eduardo, 24/09)
Mesma lógica do Painel da Gestão (capítulos com conclusão como título, gráficos, filtros na URL), contando **investimento → atenção → conversão → lead real → negócio**. Rota `/dashboard/performance`.
- **Filtros:** período (mês atual, 30d, 90d, mês passado), plataforma (Meta/Google), etapa do funil da campanha (topo/MQL/lead, de `metas_campanhas`), finalidade inferida pelo nome da campanha (venda/locação/institucional), campanha.
  0. **Manchete** + índices: investimento, % do orçamento, CPL da plataforma, custo real por lead (CRM).
  1. **Estamos gastando no ritmo certo?** Gasto acumulado do mês × orçamento (`metas_campanhas.meta_investimento`) × projeção pelo ritmo de 30 dias. Sem orçamento cadastrado no mês → usa o do último mês cadastrado, avisando.
  2. **O dinheiro vira atenção?** CPM, CTR e CPC por mês, Meta × Google (três gráficos pequenos, um eixo cada).
  3. **Quais campanhas entregam?** Por campanha: gasto × orçamento, conversões, CPL × meta de CPL, com status.
  4. **A conversão vira negócio?** Cascata investimento → impressões → cliques → conversões na plataforma → leads pagos no CRM → qualificados → visitas → negócios, com taxa e custo de cada degrau. As etapas do CRM não separam plataforma/campanha (atribuição pendente).
  5. **Onde pôr o próximo real?** Matriz gasto × CPL por campanha (bolha = conversões, cor = plataforma) + recomendações geradas.
  - Rodapé: saúde dos dados (Meta, Google, CRM).
- **Cores:** Meta = violeta `#6A4FB8`, Google = verde-azulado `#14907F` (validadas; o âmbar foi descartado por parecer o amarelo de alerta).
- **Limites:** conversão da plataforma = clique no WhatsApp/formulário, não lead; CRM sem campanha nos leads pagos; orçamentos cadastrados até ago/26.

### 5.3 Escala de plantão por PDF (pedido do Eduardo, 24/09)
- **Formato de entrada:** o PDF mensal "PLANTAO VENDAS" (ex.: `ESCALA IMOVIT OUTUBRO.pdf`): uma tabela com DATA (d/m/aa), DIA, MANHÃ e TARDE. Fins de semana têm um nome só, na coluna da manhã. Nomes em apelido e maiúsculas ("BETTI", "MARIA INES").
- **Fluxo:** Configurações → Plantão → "Importar escala (PDF)" → leitura no navegador (pdf.js, pelas colunas do cabeçalho) → prévia com os nomes casados com `colaboradores_raw` (sem acento/maiúsculas; apelido = um dos nomes do cadastro); nome sem par ou ambíguo fica para escolher → "Importar".
- **Regras:** o arquivo é a fonte da verdade para as datas que ele cobre: os plantões já cadastrados entre a primeira e a última data do arquivo são substituídos (a prévia mostra quantos). Grava primeiro os novos e só depois apaga os antigos, para uma falha não deixar dias sem plantão. Turno = coluna do PDF, exceto **fim de semana com um nome só = dia inteiro** (confirmado pelo Eduardo em 24/09; a caixa vem marcada na prévia). Apelidos escolhidos à mão ficam lembrados no navegador para o mês seguinte.
- **TV:** painel "Plantão" no carrossel do rodapé: **os próximos 5 dias a partir de hoje, fim de semana incluído, em 5 colunas, sem caixas** (pedido do Eduardo), manhã/tarde ou "dia inteiro"; hoje em destaque ("Hoje") e os outros dias esmaecidos. Relê a cada 10 minutos. O card "Plantão de hoje" do slide Operação continua.
- **Plantão de locação (pedido do Eduardo, 05/11):** o Hub passa a ter dois plantões, **Vendas** e **Locação**, na mesma tabela (`plantao.tipo`). Requisito: não pode confundir, tem que ser identificável de relance. Por isso cada plantão aparece sempre com **três sinais juntos**: cor (Vendas = coral `#E8593C`, Locação = azul `#2F6DB5`, as cores que o Hub já usa para Venda/Aluguel), ícone (🏠 Vendas, 🔑 Locação) e o rótulo escrito.
  - **Entrada:** Configurações → Plantão tem o seletor `Vendas | Locação`; a importação por PDF e o cadastro à mão valem para o plantão escolhido. Importar a escala de um tipo **só substitui plantões do mesmo tipo**.
  - **Onde aparece (decisão do Eduardo, 05/11: os dois juntos ficariam grandes demais):** um time por vez. **Home:** abas `🏠 Vendas | 🔑 Locação` no bloco Plantão, a lista na cor da aba e a última aba lembrada no navegador. **TV:** dois slides no carrossel do rodapé, "Plantão de Vendas" e "Plantão de Locação", com o título na cor do time. O card "Plantão de hoje" (só hoje) mostra os dois, com a etiqueta compacta. Pendência do Marketing conta os dias sem plantão **por tipo**.

### 5.4 Home: a porta de entrada por nível (pedido do Eduardo, 24/09)
- **Princípio:** a Home responde "o que eu faço agora?". É curta, muda por nível de acesso e **nada nela é só para ler**: todo número ou item leva à tela onde se resolve.
- **Ordem:** 1) saudação + busca "O que você procura?" (páginas do nível, links úteis, manuais, formulários); 2) atalhos (4–6 cartões por nível); 3) "Para você hoje": pendências com número (ou "Tudo em dia") | Plantão dos próximos 5 dias; 4) **Agenda da semana** (pedido do Eduardo): próximos 7 dias em colunas com reuniões, datas/aniversários, avisos com data e agenda do fotógrafo, filtros Tudo/Eventos/Fotógrafo e legenda de cores; 5) avisos (3 mais recentes) e links úteis. **Sem banner** (decisão do Eduardo, 24/09: o carrossel fica só na TV). O calendário do mês sai da Home e vai para `/agenda`.
- **Pendências por nível:** Gestão = pedidos de nível, saúde do CRM, leads sem contato; Admin = documentos aguardando decisão e propostas aguardando aprovação interna; Corretor = propostas dele paradas ou com link vencendo, e os leads dele sem contato (login ↔ corretor pelo e-mail em `colaboradores_raw`); Marketing = orçamento do mês não cadastrado em `metas_campanhas`.
- **Revisão:** a Gestão tem um seletor "ver a Home como…" para conferir cada nível (só muda o que a tela mostra; os dados seguem a permissão de quem está logado).
- **Decisões:** banner fora da Home (só na TV); formulários e eventos entram na busca e nos links (provisório). Configurações aceita `?aba=` para as pendências abrirem a aba certa.

### 5.5 Proposta de venda (pedido da direção, 25/09; documentado retroativamente em 28/09)
- **Problema:** a proposta de compra hoje é informal (WhatsApp/papel); não fica registro assinado nem dado para análise (valor ofertado × referência, condições).
- **Fluxo:** corretor (ou Adm/Gestão) cria em `/admin/vendas` com nome e e-mail do proponente, código do imóvel e valor de referência → proponente recebe e-mail "Sua proposta de compra foi criada" → entra em `/venda/entrar` por magic link → preenche telefone, valor da proposta e descrição (condições), assina no quadro → "Assinar proposta" → o navegador gera o PDF e o proponente **baixa a via dele direto na página** (botão "Baixar proposta assinada (PDF)", disponível sempre que voltar) → a equipe (`daniel@`, `gabriela@`) recebe "Nova proposta de compra assinada" e baixa o mesmo PDF em `/admin/vendas`.
- **Diferença para a locação:** sem aprovação interna, sem cadastro, sem documentos, sem esteira e sem sincronizar com o Imoview. Paralela: não toca em `propostas_locacao` nem na `esteira-locacao`.
- **Regras:** link vale 7 dias; uma assinatura por proposta (depois de confirmada, não muda mais); só Adm/Gestão descartam; corretor vê só as dele; proponente vê só as do próprio e-mail.
- **Decidido pelo Eduardo (28/09):** a assinatura desenhada no portal tem validade (sem certificado digital); aviso de proposta assinada vai para `daniel@` e `gabriela@`; **não** vai para o Imoview; o PDF é gerado ao fim da proposta e fica baixável direto na página (portal e `/admin/vendas`).

### 5.6 Esteira de locação v4: as partes negociam, o locatário só valida (pedido do Eduardo, 28/09) — **aprovado, implementado**
- **Problema:** o locatário digitava a oferta no portal e a proposta ainda passava por aprovação interna. A negociação real já acontece antes, entre as partes; o sistema duplicava esse trabalho e atrasava a abertura da esteira.
- **Fluxo (Eduardo):** locatário entra em contato → negocia → locador aceita os termos → **gestor gera a proposta registrando os termos** → sistema envia ao locatário → ele **valida ou pede correção** → validando, **entra na esteira**.
  1. Em `/admin/propostas` o gestor (corretor, Admin ou Gestão) preenche o locatário (nome, e-mail, telefone), o imóvel e as **condições negociadas**, no mesmo modelo do e-mail que a equipe já mandava (28/09):
     - obrigatórias: **corretor responsável** (lista do CRM, sugerindo quem cria), **valor da locação** (negociado) e valor do anúncio, **tipo de garantia** (seguro-fiança, fiador, caução, título de capitalização, outra), **data da posse**, **prazo contratual** (meses, sugere 30), **dia de vencimento do aluguel**;
     - opcionais: **cláusula de rescisão**, **negociação específica**, **outros combinados e benfeitorias**, **taxa de administração** (%).
     Ao criar, o locatário recebe o e-mail "pronta para validar" com as condições.
  2. No portal, o locatário vê as condições só para leitura (tudo, **menos a taxa de administração**), marca "Li e confirmo que estes são os termos combinados" e **Valida**, ou clica **"Algo está errado"** e escreve o motivo.
  3. Correção → status `correcao_solicitada`; e-mail a quem registrou a proposta (sem dono: gabriel@/daniele@). O gestor usa **"Corrigir e reenviar"**; o locatário recebe "proposta corrigida: valide de novo".
  4. **Validar abre a esteira na hora** (`aguardando_docs`), sem aprovação interna; e-mail "Nova esteira aberta" para gabriel@, daniele@, administrativo@ e administrativo3@.
  5. Locatário completa o próprio cadastro (PF/PJ, profissão, renda, cônjuge) e envia os documentos; ADM valida e finaliza, como antes.
- **Regras:**
  - O gestor pode editar e reenviar enquanto o locatário não validou (e-mail e imóvel não mudam: são a chave da proposta). Depois da validação, não.
  - Prazo: 7 dias para validar (renovado a cada reenvio); ao validar, **30 dias** para cadastro e documentos. Antes, os 7 dias da criação valiam para o processo inteiro e expiravam propostas no meio da esteira.
  - Correção pedida não expira: a bola está com o gestor.
  - Não dá para criar outra proposta por cima de uma em andamento ou concluída (mesmo e-mail + imóvel); só por cima de descartada, expirada ou validação vencida. Antes, um prazo vencido bastava para sobrescrever até processo concluído.
- **Sai:** aprovação interna (`decisao_interna`, status `aguardando_aprovacao_interna`) e a digitação de oferta/detalhes pelo locatário. A única proposta que estava na aprovação interna (teste do Daniel) volta para a validação do locatário.
- **Taxa de administração:** é responsabilidade do proprietário (acordo Imovit × proprietário). Aparece para a equipe (Propostas, Esteira, e-mail "esteira aberta"), nunca para o locatário: fica em `propostas_locacao_interno`, que o locatário não consegue ler nem pela API.
- **Decisões assumidas (28/09, o Eduardo pode rever):** validação por clique com confirmação (sem assinatura desenhada); alerta "esteira aberta" para a lista que já existia; 30 dias para a fase de documentos.

### 5.7 Formulários dentro do Hub (pedido do Eduardo, 28/09) — **aprovado; 1ª entrega no ar**
- **Problema:** os formulários do dia a dia estão no Tally (`documentos.imovit.com.br`), fora do Hub: os dados não caem no nosso banco, não ficam ligados ao corretor e o documento final não sai no padrão Imovit. A seção "Links úteis" da Home é só uma lista de links para eles.
- **Visão (7 itens, por etapas):** Captação de imóvel · Feedback de visita · Apresentação Imovit (página pública para leads do topo) · Sobre a CasaDezoito (página pública, estrutura) · Avaliação de imóvel (doc padrão de precificação; comparáveis de mercado) · Guia de visita (a definir) · Relatório do imóvel (GA4, conversões, campanhas; por último).
- **1ª entrega (decisão do Eduardo, 28/09): só os dois formulários.**
  1. **Captação de imóvel** (substitui o Tally "Acompanhamento personalizado"). Quem preenche é o **proprietário**:
     - **Link fixo por corretor**, público, sem login: `/captacao/<código aleatório>` (28/09: antes era o id do CRM, sequencial). Cada corretor vê **só o próprio link**, identificado pelo login; não há lista de corretores na página pública.
     - Mesmos campos e textos do Tally: contato (nome, e-mail, telefone, CPF); natureza (tipo, finalidade venda/locação/ambos, exclusividade + período 30/90/180 dias/1 ano); endereço (rua, número, bairro, CEP, apto/sala, bloco, quadra); valores (locação, venda, condomínio, IPTU mensal); atributos (área interna, área do terreno, quartos, suítes, banheiros, salas, vagas, tipo de vaga); lazer (16 opções) e observações; **declaração de ciência com honorários**, montada conforme a finalidade (locação: 1º aluguel, administração de 8% do aluguel bruto e vistoria por conta do locatário; venda: 6%; ambos: todas) e **assinatura desenhada**.
     - Ao assinar: o proprietário **baixa o PDF da autorização** na hora; a equipe recebe **e-mail**; a captação entra na lista **Captações** do Hub (PDF baixável, marcar "cadastrada no Imoview").
  2. **Feedback de visita** (substitui o Tally "Feedback da visita"). Quem preenche é o **corretor**, no Hub: código do imóvel, olhar do visitante, curadoria de ajustes, termômetro de interesse (1 a 5), corretor e nota do consultor. Gera um **PDF no padrão Imovit** para o corretor mandar ao proprietário (sem e-mail automático). Fica o histórico.
- **Home:** "Links úteis" vira **Ferramentas**: os formulários do Hub primeiro; os links externos ficam enquanto não migram e **somem aos poucos**.
- **2ª entrega (28/09, decisões do Eduardo):**
  - **Apresentação Imovit**: página pública `/apresentacao/<código do corretor>` (o mesmo código da captação), texto escrito a partir de "A Alma da Imovit" e do Perfil de Comunicação (abertura "Lares com a sua alma", essência, como trabalhamos, o que fazemos, a CasaDezoito) e **cartão do consultor** com WhatsApp no fim. Sem código: termina em "Fale com a Imovit" + Instagram. Fotos: lounge e fachada da CasaDezoito.
  - **Sobre a CasaDezoito**: não se recria; é o link do site `www.casadezoito.com.br`.
  - Os dois ficam em Ferramentas → **Materiais para clientes**, com "Copiar link" / "Abrir".
- **Depois:** Avaliação de imóvel com comparáveis informados pelo corretor (scraping de portais como ZAP/VivaReal é proibido pelos termos de uso e bloqueado; automatizar só com fonte autorizada); Guia de visita; Relatório do imóvel.
- **Decidido (28/09):** o aviso de captação vai **só para o corretor**; a captação é **só registro** (sem revisão), o corretor é o responsável pelo processo; os dados ficam no banco para visualizar em Captações.

### 5.8 Dados confiáveis e dashboards v2: Comercial, Performance e Geral (pedido do Eduardo, 29/09) — **aprovado; página Comercial v1 no localhost**
**Problema.** A Gestão filtra por período e os números não acompanham o filtro. Há duas causas, confirmadas no código e no banco em 29/09:
1. **Muitos gráficos ignoram o período de propósito.** Funil, conversão e canais usam a "safra madura" (janelas fixas de 60–425 dias), e o ritmo usa sempre os últimos 30 dias (`src/lib/painelGestao.js`, `safraMadura`). O filtro muda os índices do topo, mas não esses gráficos.
2. **O banco não guarda a jornada.** O `crm_atendimentos` (n8n) faz *upsert* em `dashboard_atendimentos_crm` pelo `codigo` e sobrescreve a fase. Resultado: 1 linha por atendimento (2.788 linhas, 2.788 códigos), só a fase atual, sem saber quando o lead passou por cada etapa. Além disso, o fluxo busca com `dataInicial = ontem`, então pode perder mudanças de fase de leads mais antigos.

**Decisão do Eduardo.** Assinar o Supabase Pro. O banco para de atualizar linhas e passa a **acumular**: puxar os atendimentos todo dia e, quando um lead mudar de etapa, gravar uma linha nova. Com isso dá para medir o tempo médio de cada etapa e reconstruir a jornada.

**Regra de ouro dos dashboards v2:** todo número e todo gráfico respeita **todos** os filtros da página. Cada gráfico tem um subtexto com o que está sendo mostrado e o filtro aplicado (ex.: "Leads que **entraram** entre 01/09 e 29/09 · Venda · Equipe X · todas as mídias").

**Filtros (barra única, estado na URL):** período, finalidade (venda/locação), corretor e mídia. *(Filtro "time" descartado pelo Eduardo em 29/09.)*

**Filtro geral, sempre ligado (decisão do Eduardo, 29/09):** os dashboards só consideram atendimentos de corretores com `colaboradores_raw.equipe = 'comercial'` e `ativo = true`. Corretor inativo não aparece em nenhum número, lista ou filtro. A ligação atendimento → colaborador é pelo nome (`dashboard_atendimentos_crm.corretor` = `colaboradores_raw.nome_completo`), porque o CRM não manda o id do corretor no atendimento. O subtexto de cada gráfico lembra: "só equipe comercial ativa".

**Funil do Hub (7 etapas, nesta ordem):** Pré-atendimento → Seleção de perfil → Seleção de imóveis → Lead qualificado → Visita → Proposta → Negócio. *("Agendamento" não é etapa, decisão de 29/09. "Visitas agendadas" continua como índice, contado pelas atividades "Visita".)*
- No Imoview a ordem numérica é outra: "Lead qualificado" é a fase 7. O Hub usa uma tabela de mapeamento (fase do CRM → posição no funil).

**Página Comercial** (`/dashboard/comercial`, `src/pages/PainelComercial.jsx`)
- **Corretor vê só os próprios dados (pedido do Eduardo, 29/09).** O nível Corretor acessa esta página como "Meus números" (menu Dash). O filtro de corretor fica travado no nome dele no CRM, ligado pelo e-mail do login (`perfis.email` = `colaboradores_raw.email_oficial`). A trava de verdade é a RLS (migration `20260929150000_corretor_ve_so_os_seus_dados`): o corretor só lê os próprios atendimentos, as atividades e notas dele e os leads do site dos atendimentos dele. Os painéis da Gestão e de Performance continuam só para Gestão e Marketing.
- Índices: leads em atendimento que **entraram** no período · leads qualificados no período · visitas agendadas · propostas.
- Funil das 7 etapas com a taxa de passagem entre elas e o **tempo médio em cada etapa** (dias entre entrar na etapa e sair dela).
- Visitas por região (bairro) e por tipo de imóvel (casa, casa de condomínio, apartamento, terreno), comparadas ao longo do tempo. Fonte: atividades do tipo "Visita" com o imóvel (há dados desde 15/05/2026).
- Mantidos, agora respeitando os filtros: canais e eficiência, volume de propostas e valores "na mesa", ritmo de leads, onde o lead se perde, custo da perda, leads em atendimento.

**Página Performance**
- Índices: total investido · alcance total · engajamento médio · conversões registradas · CPL.
- O resto da página atual continua como está.

**Página Geral:** conteúdo a definir (pergunta P2).

**Kanban:** código do atendimento em cada card e filtro por etapa.

**Limites que precisam ficar claros na tela**
- O histórico de etapas só existe **a partir do dia em que o acúmulo começar**. Tempo por etapa e jornada valem para leads que entraram depois disso. O que veio antes continua com a aproximação atual ("fase máxima").
- Captura **1 vez por dia** (decisão de 29/09): a precisão do tempo por etapa é de 1 dia.

### 5.9 Campanha "Km 32" — 4º trimestre 2026 (pedido do Eduardo, 06/10) — **no ar em 06/10**
**Contexto.** A direção lançou a campanha "Km 32 · Campanha 4º Tri 2026" (apresentação em `Downloads\Imovit.zip`). A metáfora é a maratona: o trimestre é o trecho final da prova, do Km 32 (largada) ao Km 42 (chegada), com paradas no fim de outubro, novembro e dezembro. Existe um protótipo visual local (`src/components/home/TrilhaKm32.jsx`, sem commit, dados fictícios), usado só como referência de design.

**Problema.** A equipe precisa ver, todo dia e no mesmo lugar, quanto da meta do trimestre já foi feito e se o ritmo acompanha o calendário. Hoje isso não existe no Hub.

**Objetivo.** Mostrar na Home do Hub o avanço da campanha com números reais do CRM. A equipe se orienta pela trilha, e a Gestão acompanha sem montar planilha.

**Fonte dos dados (decisão do Eduardo, 06/10).**
- O realizado vem dos **atendimentos do CRM** (Imoview → n8n → Supabase).
- Conta como negócio da campanha o atendimento com situação **"Negócio realizado"** e **data de fechamento a partir de 06/10/2026**, até o fim da campanha (31/12/2026).
- Venda e locação ficam separadas pela finalidade do atendimento (`Venda` / `Aluguel`).
- Não há lançamento manual nesta versão.

**O que a trilha mostra (por finalidade, abas Venda / Locação).**
| Número | Fórmula |
|---|---|
| Valor realizado | soma do valor dos negócios da campanha |
| Ticket médio | valor realizado ÷ volume de negócios (“—” com 0 negócios) |
| Avanço na trilha | valor realizado ÷ meta de valor, convertido em Km (32 + 10 × fração), limitado ao Km 42 |
| Próxima parada (urgência) | a 1ª parada de fim de mês que o realizado ainda não alcançou: "R$ X faltam para a parada de 31/10 (R$ meta acumulada) · N dias · R$ Z por dia". O número fica sempre em coral (destaque, pedido do Eduardo); abaixo do esperado até hoje (meta ÷ dias da campanha × dias passados, mostrado no `title`), a legenda ganha "· abaixo do esperado". Com a meta total alcançada: "Meta batida" |
| Em proposta | soma das propostas "verdes" do CRM: atendimento em atendimento na fase Proposta, com interação nos últimos 30 dias, contando hoje (15 na 1ª versão; 30 por decisão do Eduardo em 13/10); em cada imóvel vale a negociação mais recente, e só conta se estiver "Em análise" |

**Ajuste de 13/10 (Eduardo):** volta a meta total do trimestre (a meta mensal de outubro foi só para a reunião), sai o quadro "1 de 14 vendas" (o volume continua no banco), o ritmo em pontos virou o quadro "esperado até hoje" e entrou o quadro "em proposta". No mesmo dia o "esperado até hoje" virou "próxima parada": estando à frente, o time relaxava; o alvo do fim do mês mantém a urgência (Eduardo).

**Ajuste de 16/10 (Eduardo):** o 1º quadro passa a mostrar o realizado no mês contra a meta do mês. A meta do mês é a meta da campanha ÷ dias da campanha × dias do mês dentro dela, e serve para dar a sensação de possível. O % do trimestre fica no tooltip e no Km. O quadro da próxima parada volta a ser **"esperado até hoje"**: a meta diária somada até hoje, com quanto o time está acima ou abaixo desse valor.

**Ajuste de 19/10 (Eduardo, pedido da direção): a locação conta contratos iniciados.**
- Conta todo contrato de locação com **data de início** de **01/10/2026** até hoje (e até 31/12/2026), sem os cancelados. Contrato com início futuro entra no dia em que começa.
- O dia 01/10 entra: é antes do lançamento (06/10), mas é do trimestre.
- Valor = aluguel do contrato. A venda continua por negócio realizado no CRM, desde 06/10.
- No quadro da locação (Home e TV) aparece embaixo "N contratos iniciados · X ativos" (e "· Y em ativação" quando houver). O rodapé diz a regra.
- Conferido com o Eduardo em 19/10: **3 contratos, R$ 39.450** (1824, 1823 e 1826, todos ativos). Antes eram 2 negócios do CRM, R$ 17.800. Primeiro testamos "contrato gerado" (data de inclusão, R$ 25.000), mas a direção quer os iniciados.

**Ajuste de 20/10 (Eduardo): os dois quadros ficam no mês.**
- **1º quadro:** realizado no mês, meta do mês e quanto isso representa da meta ("46,8% da meta do mês · faltam R$ 4,5 MM"; batida: "meta de outubro batida · N%"). O % não é mais limitado a 100%.
- **2º quadro:** esperado até hoje **no mês** = meta do mês ÷ dias do mês dentro da campanha × dias passados do mês, comparado com o **realizado no mês** (antes era a meta da campanha ÷ 87 dias × dias passados, contra o realizado total). Embaixo: "15 de 26 dias de outubro × R$ 321,8 mil" e o valor acima/abaixo. Em outubro dá o mesmo número que antes (a campanha começa em 06/10); muda a partir de novembro, quando o mês recomeça a conta.
- A trilha (Km) continua na régua da campanha inteira. A TV usa a mesma régua (`lib/campanhaKm32.js`).

**Ajuste de 10/11 (pedido do Daniel, feito pelo Eduardo): números da Home em mês × trimestre.** Objetivo: dar visibilidade ao objetivo, do mês e do trimestre.
- **Como estava antes (20/10 a 10/11):** três quadros lado a lado. (1) Realizado no mês, com a meta do mês, o % e "faltam R$ X". (2) Esperado até hoje no mês ("15 de 26 dias × R$ por dia") e quanto o realizado estava acima ou abaixo disso. (3) Em proposta, com o número de propostas ativas (30 dias).
- **Como ficou:** duas colunas, **Mês** (ex.: "Mês · novembro") e **Trimestre** ("out a dez"), cada uma com a meta no título e três linhas: **Realizado** (com o %, em destaque), **Para bater a meta** (em coral; "Meta batida" quando chega lá) e **Em proposta** (o mesmo valor nas duas colunas). Na locação, a linha "N contratos iniciados · X ativos" fica embaixo das colunas.
- Trimestre = a campanha inteira: venda desde 06/10, locação desde 01/10, contra a meta da campanha.
- O "esperado até hoje" saiu da Home. A conta continua em `lib/campanhaKm32.js`, e a **TV não mudou**.
- No ar em 10/11 (commit 20c3085).

**Na TV Display (16/10, Eduardo):** painel "Km 32" no carrossel do rodapé, entre Plantão e Comercial, só com a campanha no ar. Venda e Locação aparecem lado a lado (a TV não tem aba). Cada uma mostra a trilha com o Km e a marca de hoje, o realizado no mês × meta do mês, um selo acima (verde) ou abaixo (coral) do esperado até hoje e o valor em proposta. A régua é a mesma da Home (`lib/campanhaKm32.js`), e os números são relidos a cada 5 min. As barrinhas do indicador do rodapé passam a ser clicáveis: o clique vai direto ao painel e recomeça a contagem de 15 s.

Também mostra as paradas no último dia de cada mês (meta acumulada proporcional aos dias) e o marcador "hoje".

**Metas (da apresentação; ficam numa tabela, não no código).**
- Venda: R$ 28 milhões e 14 negócios no trimestre.
- Locação: R$ 160 mil e 18 negócios no trimestre.
- Meta acumulada de cada mês = proporcional aos dias da campanha até o fim do mês.

**Quem vê.** A trilha aparece na Home. Quem vê está na pergunta C3. Os números são da imobiliária inteira, não por corretor.

**Escopo — dentro.**
- Trilha na Home com os números acima, lidos do banco.
- Metas e período da campanha numa tabela de campanha: dá para corrigir sem deploy e reaproveitar em campanhas futuras.
- Origem do valor do negócio trazida do Imoview para o banco (ver dependências).
- Subtexto com a regra de contagem ("Negócios realizados no CRM desde 06/10/2026") e a data da última atualização do CRM.

**Escopo — fora (por enquanto).**
- Lançamento manual de fechamentos.
- Ranking ou números por corretor na trilha.
- Conciliação do CRM com outra fonte (contratos, financeiro).
- Notificações ou comemoração automática ao bater a parada do mês.

**Requisitos.**
- RF25.1: a trilha lê os negócios da campanha do banco; nenhum número fica no código.
- RF25.2: metas, período e data de corte vêm da tabela da campanha.
- RF25.3: valor realizado, volume e ticket médio por finalidade, com a mesma regra de contagem em todos. Na tela: realizado no mês × meta do mês, esperado até hoje (acima/abaixo) e em proposta (16/10; o quadro de ticket médio saiu a pedido do Eduardo, o ticket continua no banco).
- RF25.4: cada número mostra de onde veio (subtexto) e a data da última informação do CRM. Se a fonte estiver atrasada mais de 1 dia, aparece um aviso.
- RF25.5: se um negócio não tiver valor no CRM, ele fica fora do valor e do ticket, e a tela informa quantos estão nessa situação ("2 negócios sem valor no CRM").
- RF25.6: acessível: o avanço é dito em texto (não só pela posição do ponto), e a animação respeita `prefers-reduced-motion`.

**Critérios de sucesso.**
- A trilha bate com uma consulta SQL de conferência: os mesmos negócios, valor e volume.
- A Gestão confere a lista de negócios da campanha contra o Imoview na primeira semana e não acha diferença.
- Um negócio fechado no Imoview aparece na trilha até a manhã seguinte (captura diária das 6h).

**Origem do valor e da data — RESOLVIDO em 06/10** (1ª leitura do `crm_jornada_diaria v3`, atendimento 6133):
- **Valor:** `payload.imoveisnegocio[].valornegocio` (na locação é o aluguel mensal, ex.: 7.200; isso responde à C2). Com mais de um imóvel no negócio, soma.
- **Data do negócio realizado:** a interação cuja descrição começa com "NEGÓCIO REALIZADO" → `datahora` (ex.: 01/10/2026 14:11). Exata e independente do dia da leitura. `imoveisnegocio[].datanegocio` é o início da negociação, não o fechamento.
- O campo `datafechamento` da lista vem sempre vazio: não usar.
- Conta para a campanha: negócio com interação "NEGÓCIO REALIZADO" em data ≥ 06/10/2026.

**Dependências e riscos (verificados em 06/10).**
- **D1 — Valor do negócio:** o banco não tem nenhuma coluna de valor nos atendimentos; o n8n não traz esse dado. Sem resolver, a trilha só mostra o volume. Caminho: ver na resposta crua do Imoview (guardada pelo fluxo `crm_jornada_diaria` em `crm_atendimento_jornada.payload`) se há valor do negócio ou o imóvel/proposta. Se não houver, buscar em outro endpoint do Imoview (imóvel ou proposta).
- **D2 — Data de fechamento:** o último fechamento com data no banco é de 16/09; nenhum negócio de outubro aparece. Pode ser falta de negócio ou o fluxo antigo não gravando a data. Caminho: (a) o fluxo `crm_jornada_diaria` registra o dia em que o atendimento virou "Negócio realizado" (precisão de 1 dia); (b) se o Imoview mandar a data do negócio, usar ela, que é exata. **O fluxo precisa estar rodando antes de qualquer negócio da campanha; enquanto não roda, fechamentos podem ficar sem data.**
- **D3 — Atraso:** os dados são do dia anterior (captura diária). A tela deixa isso claro.

**Decisões (Eduardo, 06/10).**
- **C1 Meta de venda:** 14 negócios / R$ 28 milhões no trimestre.
- **Régua única (Eduardo, 06/10):** 0% = 06/10 e 100% = 31/12/2026, e a mesma régua vale para o tempo e para o valor. A tracejada é o dia de hoje no período; a linha laranja com a bolinha é o valor realizado ÷ a meta (R$ 28 mi na venda, R$ 160 mil na locação). As paradas ficam no **último dia de cada mês**, na posição do tempo (31/10 ≈ 29,9%, 30/11 ≈ 64,4%), e a meta acumulada da parada é a mesma fração (ex.: venda até 31/10 ≈ R$ 8,4 mi).
- **C2 Valor na locação:** o aluguel mensal (`valornegocio`), coerente com a meta de R$ 160 mil.
- **C3 Quem vê:** todos com nível (gestao, adm, marketing, corretor, tvaccess). Os números são da imobiliária inteira, inclusive para o corretor. "Sem nível" não vê.
- **C4 Quais negócios:** todos os negócios realizados no CRM, sem o filtro de equipe comercial ativa.
- **C5 Campanhas futuras:** estrutura genérica (tabela de campanhas com período e metas).
- **C6 Início:** 06/10/2026 para tudo, negócios e calendário. O marcador "hoje" e o ritmo partem de 06/10.

### 5.10 Lançamento para o time: produção sem Propostas (decisão do Eduardo, 06/10) — **implementado**
- **Produção (hub.imovit.com.br):** Home, Dash e Ferramentas. Para o corretor: Home, "Meus números" e Captações, Feedback de visita e Materiais.
- **Propostas** (locação, venda, esteira, processos) **não ficam em produção** por enquanto. Ficam num ambiente de teste, com o mesmo banco, até a bateria de aceite.
- O portal do cliente (`/portal`, `/venda`) continua acessível em produção só pelo link do e-mail, sem menu. Assim as funções `esteira-locacao` e `proposta-venda` não precisaram mudar.

### 5.11 Corretor no Dash e "Ver como" (decisão do Eduardo, 06/10) — **implementado**
| Página | Corretor | Como |
|---|---|---|
| Comercial ("Meus números") | só os dele | filtro travado no nome + RLS |
| Painel da Gestão | **não vê** | só Gestão e Marketing |
| Performance | vê, com os números da imobiliária | `pode_ver_dash()` inclui corretor; leads pagos via `performance_leads_pagos()` (agregado, sem código nem corretor) |
| Kanban: Quadro, Dados de atendimento | só os dele | RLS de atendimentos + filtro na tela |
| Relatório de atividades | só as dele | RLS de atividades + filtro por `codigousuario` |

**"Ver o Hub como" (só Gestão):** o seletor da Home troca o Hub inteiro (menu, Home, pendências, Dash) para outro nível ou para um corretor específico, com uma faixa azul e "Sair da prévia". É uma prévia de tela: os dados são os que a Gestão lê, filtrados para a pessoa. A garantia do corretor é a RLS, testada no banco. Durante a prévia, o Perfil não pode ser editado.

### 5.12 Jornada do lead: tempos, perdas e motivos (pedido do Eduardo, 07/10) — **APROVADA em 19/10 (maquete v4), no Painel da Gestão**
**Objetivo.** Ver quanto tempo o lead leva em cada etapa, onde ele se perde e por quê. A fonte é a jornada diária (`crm_atendimento_jornada`, fluxo `crm_jornada_diaria v3`, rodando desde 06/10).

**Onde (decisão de 19/10, vale esta):** no **Painel da Gestão**, capítulo 3 (jornada em linha) e capítulo 4 (motivos), seguindo os filtros da página (período, finalidade, canal, corretor). É sempre **uma linha só**, com a média do recorte: a finalidade é dividida pelo filtro de cima (Eduardo, 19/10). J2 ficou como proposto: só os descartes da jornada. J1 não se aplica por enquanto, porque o cartão de "parados" saiu na v4.

**Onde (revisto em 07/10, substituído em 19/10).** Não vira um gráfico novo. A jornada completa dois capítulos que já existem na página Comercial, com os mesmos componentes:
- **Capítulo 1 (funil):** a coluna "tempo na etapa", hoje reservada com "—", passa a mostrar a mediana em dias ("acum." com menos de 5 passagens). Embaixo, dois cartões `.pg-mesa-card`: tempo até o negócio e parados há N+ dias.
- **Capítulo 3 ("Onde o lead se perde e por quê?"):** descartes pelas 7 etapas (`.pg-hbarras`, a maior em coral) + motivos de todas as etapas + motivos da etapa clicada. O simulador de ganho continua.

Segue todos os filtros da página (período, finalidade, mídia, corretor) e o filtro geral; o corretor vê só a dele em "Meus números". Maquete: https://claude.ai/artifact/LWATNn1x2NedBQd3uYwgX8 (v3 de 19/10, CSS real do Hub). A v3 troca o funil vertical do capítulo 1 pela jornada em linha descrita abaixo.

**O gráfico (formato pedido pelo Eduardo em 19/10; maquete v4, enxuta: "simples e legível imediatamente").** No capítulo 1, as 7 etapas ficam em linha (Pré-atendimento → Seleção de perfil → Seleção de imóveis → Lead qualificado → Visita → Proposta → Negócio), com um seletor Venda | Locação e uma linha de legenda:
- **Quadro de cada etapa:** só o número de leads que chegaram à etapa no período (grande) e o nome. O Negócio fica num quadro escuro;
- **Seta entre as etapas:** os **dias em média** para avançar (1 casa), contando só as passagens com as duas pontas observadas pela jornada; "acum." com menos de 5 passagens. A transição mais lenta fica em coral;
- **Linha de baixo:** os descartados de cada etapa em vermelho ("−12"); o maior ganha um fundo. Clicar abre os motivos daquela etapa no capítulo 3;
- sem %, barras ou textos auxiliares no gráfico. A conclusão do capítulo diz onde o lead trava;
- no celular, uma etapa por linha (número, nome e descartados), com a seta "↓ dias" entre elas.

Ao lado: **tempo total até o negócio** (mediana, da entrada ao "NEGÓCIO REALIZADO") e **parados agora** (em atendimento há mais de X dias na etapa atual).

**Motivos de descarte.** Não existem no banco hoje. Passam a ser capturados das interações do Imoview a partir da mudança no nó "Marcar fase" (v5, 07/10). Motivos de descartes anteriores ficam como "sem motivo registrado".

**Limites que a tela deixa claros.**
- Tempos só existem para passagens observadas desde 06/10. Até haver amostra (n ≥ 5 por etapa), a etapa mostra "acumulando".
- Leads que já estavam no meio do funil em 06/10 têm a data de chegada na etapa desconhecida e ficam fora das médias.
- Precisão de 1 dia: a leitura é diária.

**Critérios de pronto.** Cada número bate com uma consulta de conferência na jornada; um descarte novo aparece com o motivo no dia seguinte.

**Perguntas.**
- **J1 Parado:** a partir de quantos dias na mesma etapa um lead conta como "parado"? *(Proposta: 7 dias.)*
- **J2 Perdas por etapa:** contar só os descartes do período (eventos da jornada, desde 06/10), ou também os anteriores pela fase em que estavam ao descartar (base antiga, sem data nem motivo)? *(Proposta: só a jornada, para o número ser exato.)*

### 5.13 Adm locação: a carteira de contratos administrados (pedido do Eduardo, 07/10) — **APROVADO; no localhost em 07/10**
**Objetivo.** Uma visão gerencial da carteira de locação, pelas perguntas que o gestor faz toda semana:
- o que entra para a Imovit;
- se a carteira cresce;
- onde e o que alugamos;
- quem sai e por quê;
- o que reajusta;
- quanto está em atraso;
- se a carteira está protegida;
- quem são os proprietários.

**Regra da manchete (Eduardo, 07/10):** o número principal é o dinheiro que fica com a Imovit, a **administração recebida**. A soma dos aluguéis (R$ 1,3 mi/mês) é só o tamanho da carteira e aparece como contexto.

**Cards revistos (Eduardo, 16/10):**
1. **MRR de administração.** O valor principal é o contratado (aluguel × taxa de cada contrato ativo). Embaixo vêm o realizado (média dos 3 últimos meses fechados) e a taxa de recebimento.
2. **Contratos ativos.**
3. **Novos × encerrados no ano civil.** Mesma conta do relatório do Imoview, conferida em 16/10: 2025 = 71 × 70 e 2026 = 52 × 50. Traz o saldo em contratos e em MRR, e o ano anterior como comparação.
4. **MRR em risco.** Administração dos contratos com aviso de desocupação e dos que terminam o prazo em até 90 dias.

A inadimplência saiu dos cards e fica no capítulo 6. Abaixo dos cards, um bloco "Como ler" explica cada número em texto visível, e não só no tooltip.

**Quem vê.** Só a `gestao` por enquanto (decisão de 07/10; `ACESSO.dashAdmLocacao`; RLS `is_gestao()`). Abrir para o ADM depois é trocar a policy e o acesso. A página tem nomes de locatários e proprietários, valores e inadimplência.

**Onde.** Dash ▸ **Adm locação** (`/dashboard/adm-locacao`), com capítulos `.pg-capitulo` e os componentes do Painel. Filtros na URL: destinação, tipo de imóvel, garantia e índice. Recebimentos e proprietários não seguem os filtros (a tela diz isso).

**Fonte.** Imoview, só com a `chave`:
- `GET /ContratoAluguel/RetornarContratos`: 817 contratos desde 2014; máx. 50 por página;
- `GET /Movimento/RetornarMovimentos`: locação = `modulo 2`;
  - `situacaoConta=1`: em aberto;
  - `situacaoConta=2`: pagas. Aluguel no plano `7.1.1`; administração (`1.1.1.1`) e intermediação (`1.1.1.2`) retidas no repasse ao `Locador`.
- Imóveis em Campinas/SP; o bairro sai do fim do endereço.

Quem lê:
- o n8n `carteira_locacao_diaria` (contratos + em aberto, 6h30);
- a Edge Function `carteira-locacao` (tudo, inclusive as pagas), chamada ao abrir o painel quando a última leitura tem mais de 12 h ou pelo botão "Atualizar agora".

**Manchete.**
- Administração recebida no último mês fechado (sem as pagas: a prevista).
- Contratos ativos (saudáveis × em atraso, + em ativação).
- Inadimplência (%).
- Novos × encerrados em 12 meses (saldo e rotatividade).
- Linha de contexto: tamanho da carteira e ticket médio.

**Capítulos.**
1. **Quanto entra para a Imovit?**
   - Administração e intermediação recebidas por mês, pela data do pagamento.
   - Prevista (aluguel × taxa); taxa média; contratos que pagaram.
2. **A carteira está crescendo?**
   - Novos × encerrados por mês (24 meses), **pela regra do CRM** (conferida com o Eduardo em 07/10): novos pela data de início, encerrados pela data de rescisão. 2025 = 71 × 70; 2026 até out = 50 × 49. Os 28 rescindidos sem data de rescisão não contam como encerrados (saem dos ativos na data de fim).
   - Rotatividade (encerrados em 12 meses ÷ média de ativos).
   - Aluguel médio dos novos × carteira; permanência mediana.
3. **Onde e o que alugamos?** Bairros (n e aluguel), tipo de imóvel, faixa de aluguel, destinação.
4. **Quem está saindo e por quê?**
   - Aviso de desocupação, com a administração em risco.
   - **Último trimestre do prazo** (fim em até 90 dias).
   - Prazo indeterminado.
   - Motivos de rescisão em 12 meses. "Sem Administração" e "Proprietário tirou a administração" contam como um só motivo.
   - Listas.
5. **O que reajusta?** Reajustes nos próximos 90 dias por mês e índice; reajustes com a data vencida (lista).
6. **Quanto está em atraso?**
   - Inadimplência pela regra do Imoview: contrato ativo "Atrasado".
   - Valor por tempo de atraso; **inadimplência por garantia**; contratos em cobrança.
   - **Atenção:** pagamento informado e conta ainda em aberto, uma linha por contrato (achado de 07/10: o Imoview mantém em aberto cobranças pagas sem baixa).
   - Débito de contratos encerrados (fora da taxa).
7. **A carteira está protegida?** Seguro incêndio vencido, vencendo em 30 dias ou sem registro; garantia com validade vencida ou vencendo; lista para regularizar.
8. **Quem são os nossos proprietários?** Quantos são; os 10 maiores pela administração e quanto concentram.

**Fora (por enquanto).**
- Ações e alertas da ADM (RF17).
- Corretor ou proprietário vendo os próprios contratos.
- Escrever no Imoview.
- Cálculo oficial de reajuste.
- Vacância (viria do cadastro de imóveis).

**Dados pessoais.** CPF e CNPJ não são guardados: são tirados dos campos e mascarados em qualquer texto do payload (o resumo do locador traz CPF; achado de 07/10).

**Critérios de pronto.**
- Ativos, aluguéis, administração prevista e inadimplência batem com o Imoview. Conferido em 07/10: 157 ativos, R$ 1,30 mi, R$ 65,1 mil, 9 contratos / R$ 206,9 mil.
- Corretor, marketing e "Sem nível" recebem zero linhas.

**Decisões (07/10).**
- L1/L6 inadimplência = regra do Imoview.
- L2 receita = administração; a intermediação aparece à parte.
- L3 a renovação não gera contrato novo.
- L4 menu "Adm locação".
- L5 "Moderação" = em ativação.
- "Atenção" = pagamento informado sem baixa.
- Manchete = administração recebida.

### 5.14 Estoque de imóveis: painel da Gestão + busca inteligente (pedido do Eduardo, 08/10) — **PROPOSTA, aguardando aprovação**
**Objetivo.** Dois usos sobre a mesma base, o cadastro de imóveis do Imoview lido 1×/dia:
1. **Painel do estoque** (Gestão): quanto temos e quanto vale, onde captamos, onde estão os maiores tickets, o que está parado, o que está desatualizado e o que está fora do site.
2. **Busca no estoque** (Gestão agora; **corretor depois**): encontrar rápido o imóvel certo, num jeito "mais de conversa" que um formulário de filtros. Quando nada atende exatamente, o sistema **propõe alternativas com margem e diz o porquê**, por exemplo:
   - "além desses, temos estes na faixa de preço, mas com 1 quarto a menos";
   - "estes ficam até 10% acima do teto";
   - "estes estão a 2 km do bairro pedido".

**Quem vê.** Só `gestao` nos dois, por enquanto (decisão de 08/10). A busca já nasce sem nenhum dado que o corretor não possa ver: nada de proprietário, anotações ou número do endereço. Abrir para o corretor depois é trocar o acesso, não refazer.

**Onde.**
- Dash ▸ **Estoque** (`/dashboard/estoque`): painel em capítulos, como o Adm locação.
- Ferramentas ▸ **Buscar imóveis** (`/imoveis/buscar`): a busca.

**Fonte (análise de 08/10).** `POST /Imovel/RetornarImoveisDisponiveis` com `naoconsiderarmeusite: true`.
- Traz o cadastro inteiro (4.443 de locação + 6.741 de venda), 20 por página; sem esse parâmetro, só o publicado no site.
- Campos usados:
  - finalidade, situação, tipo, destinação;
  - bairro, cidade, CEP, latitude/longitude;
  - valor, valor/m², condomínio, IPTU;
  - quartos, suítes, banheiros, vagas, área principal/útil e do lote;
  - características (piscina, varanda gourmet, mobiliado, permite animais…);
  - fotos (quantidade + foto principal), vídeo;
  - `exclusivo`, `placa`, `temproposta`/`temreserva`, título e descrição;
  - datas: cadastro (= captação), última alteração, última validação, vago desde.
- **Não vêm:** captador (E4) e proprietário.
- O valor pode ser "Sob consulta" (fica sem valor e entra nas buscas sem filtro de preço).

**Definições (decididas em 08/10).**
- **Estoque** = todo imóvel ainda negociável: Vago/Disponível, Em moderação, Em reforma e Em desocupação. A situação é filtro. Alugado, vendido e desativado ficam fora.
- **Desatualizado** = sem atualização há **mais de 45 dias**, contando a mais recente entre a última alteração e a última validação.
- **Captação** = cadastro no período (`datahoracadastro`), em qualquer situação atual.
- **Fora do site** = no estoque e ausente da leitura sem `naoconsiderarmeusite`.
- **Tempo em estoque** = hoje − "vago desde".
- **Exclusividade:** é usada, mas não incentivada internamente. Aparece como indicador (% de exclusivos no estoque e nas captações), sem meta.

**Retrato de 08/10** (só Vago/Disponível; o painel recalcula com a definição acima):

| | Locação | Venda |
|---|---|---|
| Disponíveis | 197 | 943 |
| No site | 99 | 459 |
| Captações em 12 meses | 329 | 563 |
| Ticket mediano | R$ 12,7 mil/mês | R$ 2,39 mi |
| Valor em estoque | R$ 3,4 mi/mês | R$ 3,26 bi |
| Tempo mediano em estoque | 105 d | 310 d |

#### A) Painel do estoque (Dash ▸ Estoque)
**Manchete:**
- estoque por finalidade e valor total;
- captações do último mês × média de 12 meses;
- **% do estoque desatualizado (+45 dias)**;
- fora do site.

**Capítulos:**
1. **Quanto temos e quanto vale?** Por finalidade, situação e tipo; valor total; ticket mediano; faixas de valor.
2. **Onde captamos?** Captações por mês (24 meses) e por bairro (12 meses); % exclusivos.
3. **Onde estão os maiores tickets?** Ticket mediano e R$/m² por bairro (mín. 5 imóveis), por finalidade.
4. **O que está parado?** Tempo em estoque por faixa (até 90 d, 91–180, 181–365, + 1 ano); bairros e tipos mais lentos; lista dos parados há + 1 ano.
5. **O cadastro está em dia?**
   - % desatualizado (+45 d) e por bairro;
   - **lista de trabalho**: código, tipo, bairro, valor, dias sem atualizar, fotos; do mais antigo para o mais novo;
   - sem foto ou com menos de 5.
6. **O que está fora do site?** Por bairro e tipo, com o motivo provável (sem foto, sem valor, desatualizado, em moderação).

Cada número abre a lista dos imóveis. O código leva ao imóvel no Imoview.

#### B) Busca no estoque (Ferramentas ▸ Buscar imóveis)
**Como funciona:**
- **Uma caixa de busca em texto livre** (ex.: "casa em condomínio no Alphaville até 3 milhões com 4 suítes e piscina"), que vira filtros visíveis e editáveis em chips: finalidade, tipo, bairro(s), preço mín./máx., quartos/suítes/vagas mínimos, área mínima, características.
- O usuário ajusta os chips à mão. Os filtros vão na URL, para mandar a busca a alguém.

**Resultado em três blocos:**
1. **Atendem a tudo:** ordenados por aderência e atualização. Cartão com foto principal, tipo, bairro, valor, quartos/suítes/vagas, área, situação, "atualizado há N dias" (selo de desatualizado acima de 45 d) e código do Imoview.
2. **Quase lá:** imóveis que falham em **um** critério, dentro de uma margem, sempre com o motivo escrito:
   - preço até **10%** acima do teto (ou abaixo do piso);
   - **1** quarto, suíte ou vaga a menos;
   - área até **10%** menor;
   - outro bairro a até **2 km** (pela latitude/longitude) ou bairro do mesmo grupo;
   - característica pedida ausente (ex.: sem piscina).
3. **Se nada aparecer:** a busca diz qual critério mais restringe e quantos imóveis surgem ao afrouxá-lo ("sem o filtro de 4 suítes, são 12").

**Inteligência:**
- **Fase 1:** as alternativas saem de regras claras (as margens acima, configuráveis), sem custo por consulta e explicáveis.
- **Fase 2:** o texto livre é interpretado por um modelo de linguagem (Claude), que só transforma a frase em filtros; a busca e as margens continuam nas regras. Se a interpretação falhar, ficam os chips.

**Desempenho:** resposta em menos de 1 s para ~1.200 imóveis em estoque (busca no banco, com índices).

**Fora (por enquanto).**
- Corretor usando a busca: vem depois, já previsto.
- Enviar imóveis ao cliente (link, apresentação).
- Editar ou validar no Imoview: o Hub só lê.
- Ranking de captadores (E4).
- Cruzar com contratos de locação (vacância).

**Dados.** Sem proprietário, anotações internas, número ou complemento do endereço. Bairro, CEP, coordenadas e características bastam.

**Critérios de pronto.**
- **Painel:** estoque, no site e captações do mês batem com o Imoview no mesmo dia; o % desatualizado bate com o filtro equivalente.
- **Busca:**
  - uma frase de teste traz os mesmos imóveis que o filtro manual no Imoview;
  - toda alternativa "quase lá" mostra o motivo e fica dentro da margem;
  - nenhum dado de proprietário sai da API do Hub.
- Corretor, marketing e "Sem nível" recebem zero linhas (até a liberação do corretor).

**Decisões (08/10).**
- E1: só Gestão por enquanto.
- E2: estoque = todo imóvel negociável.
- E3: desatualizado = +45 dias sem atualização.
- E5: exclusividade como indicador, sem incentivo.
- B1: margens 10% (preço, área), 1 quarto/suíte/vaga e 2 km aprovadas.
- B2: ordem de entrega = painel (A) → busca por regras (B fase 1) → texto livre (B fase 2).
- **B3: texto livre com o Claude fica para depois da validação da busca por regras.** A fase 1 é só com filtros em chips (a caixa de texto entra na fase 2).
- **Corretor (futuro):** vê o imóvel, o código, o **captador** e o condomínio (nome e valor); **não vê** proprietário nem endereço completo (rua, número, complemento, CEP). Bairro e cidade aparecem. As coordenadas ficam só no servidor (cálculo da distância), nunca na resposta.

**Perguntas.**
- **E4 Captador (resolvido em 16/10):** a consulta pública por imóvel dá 403 e não traz o captador (08/10). A consulta com login (`Imovel/App_RetornarDetalhesImovel`) traz `captadores[]` (nome, principal, percentual): testada em 10 imóveis, 10 de 10 OK. O n8n lê o detalhe só dos imóveis em estoque sem captador ou alterados depois da última leitura.
- **E6 Condomínio para o corretor (confirmado pelo Eduardo em 23/10):** nome do condomínio e valor da taxa entram; o endereço completo não. Motivo: corretores que saíram da Imovit já usaram esses dados para levar imóveis para concorrentes. Proteção da captação: não liberar número, complemento ou CEP para o corretor sem nova decisão.

#### Revisão de 16/10 (pedido do Eduardo) — **APROVADA em 16/10; feita no localhost, aguarda publicação**
Três pedidos novos, que mudam parte das decisões de 08/10 (E1, B2, B3 e "Corretor (futuro)"):

**1. Painel da Gestão — card "Quanto temos disponível?"** (capítulo novo, só Gestão)
- Volume de imóveis com situação **Vago/Disponível** (só essa situação, não o estoque inteiro), por finalidade (venda × locação) e por tipo (apartamento, casa, casa em condomínio, terreno, comercial…).
- Valor total e ticket mediano, venda em R$ e locação em R$/mês, nunca somados.
- Segue o filtro de finalidade do painel. Clicar num tipo abre a busca do Estoque já filtrada.

**2. Painel da Gestão — mapa de calor de Campinas** (no mesmo capítulo)
- Mapa de Campinas e arredores com mapa de calor de onde está o **estoque atual** (decisão de 16/10: estoque de hoje, não captações do período), pela latitude/longitude do Imoview.
- Segue o filtro de finalidade. Mostra quantos imóveis ficaram fora do mapa por falta de coordenadas (hoje 56 de 1.308).
- Ao passar o mouse ou tocar numa região, mostra os bairros com mais imóveis ali.
- Mapa: OpenStreetMap (gratuito, sem chave), com a biblioteca Leaflet e a camada de calor `leaflet.heat`.

**3. Dash ▸ Estoque: busca para o corretor** (`/dashboard/estoque`)
- Substitui o plano "Ferramentas ▸ Buscar imóveis só para a Gestão": a busca nasce para **corretor e Gestão** (muda E1 e "Corretor (futuro)").
- **Caixa de texto livre já na 1ª versão, por regras, sem IA** (muda B3): o Hub lê frases como "apartamento 3 quartos com piscina no Cambuí até 1,5 mi para alugar" e transforma em chips editáveis:
  - finalidade ("alugar", "locação", "comprar", "venda");
  - tipo ("apto", "apartamento", "casa", "casa em condomínio", "terreno", "sala"…);
  - bairro ou região (lista dos bairros e regiões do próprio estoque, sem acento e tolerando erro de digitação);
  - preço ("até 1,5 mi", "entre 800 mil e 1 milhão", "até 5 mil");
  - quartos, suítes, vagas, área ("3 quartos", "2 suítes", "120 m²"), tratados como mínimo;
  - características ("piscina", "churrasqueira", "mobiliado", "aceita pet", "portaria 24h", "varanda gourmet"…), das ~60 que o Imoview marca.
  - O que não for reconhecido vira busca por palavra no título, condomínio, rua e bairro.
  - Bairro: aceita o nome inteiro, uma palavra marcante ("no Gramado" → Sítios de Recreio Gramado) e erro de 1 letra; um nome leva junto os bairros que o contêm ("Sousas" → os loteamentos "(Sousas)"; "Alphaville" → todas as fases). O Imoview não preenche "região", então região = bairro + vizinhos a até 2 km.
  - Sem "alugar"/"comprar" na frase, o preço decide: teto ou piso de R$ 100 mil ou mais = venda; até R$ 60 mil = locação.
  - **Erros de português (pedido de 16/10):** antes de ler a frase, cada palavra que a busca não conhece é comparada ao vocabulário dela (tipos, finalidade, cômodos, características, números por extenso). A comparação vale pelo som (pissina/picina → piscina, churasqueira, mobilhado, garagen, trez, condisionado) e por 1 letra errada, faltando, sobrando ou trocada de lugar (apartameto, quatros → quartos, alugel); só palavras de 10+ letras aceitam 2 erros. Fora do "pelo som", a 1ª letra tem de bater. Palavra que existe no estoque (título, condomínio, rua) ou em nome de bairro nunca é "corrigida": Pinheiro não vira banheiro. A tela avisa: "Buscando por **piscina** (você digitou "pissina")". O texto livre e o bairro também aceitam o erro pelo som ("alfaville" → Alphaville).
- Filtros clicáveis ao lado dos chips, para quem preferir clicar. A busca vai na URL, para mandar a alguém.
- Resultado nos blocos já aprovados: "Atendem a tudo", "Quase lá" (margens B1, com o motivo) e "o que mais restringe".
- **Ordenação** (pedido de 16/10), vale para os dois blocos: atualizados há menos tempo (padrão), menor preço, maior preço, maior área, menor preço por m² e cadastrados mais recentemente. Imóvel sem o dado (preço sob consulta, sem área) vai para o fim. A ordem vai na URL e continua quando se faz outra busca ou se limpa os filtros.
- **Ficha comercial** (decisão de 16/10), igual para corretor e Gestão:
  - foto principal, título, código, tipo, finalidade, situação;
  - bairro, região, cidade e **rua sem número** (muda a decisão de 08/10, que tirava a rua);
  - valor, condomínio (nome e valor), IPTU, área, quartos, suítes, banheiros, vagas;
  - características marcadas, captador(es), "atualizado há N dias";
  - link do anúncio no site (quando publicado) e o código para abrir no Imoview.
  - **Nunca:** número, complemento, CEP, coordenadas, chaves (local, número, identificador), comissão e taxas, matrícula/cartório, proprietário e anotações. A busca roda numa função no servidor que só devolve esses campos permitidos.
- Quem vê: `corretor` e `gestao`. Marketing, ADM e "Sem nível" ficam sem acesso.
- Por padrão entram os imóveis Vago/Disponível e Em desocupação; uma opção mostra também os em moderação e em reforma.

**Fica para depois:** o painel do estoque em capítulos (parte A acima, que vira o restante do Dash ▸ Estoque) e a interpretação da frase por IA (vale se as regras não derem conta).

### 5.15 Cadastro Locador PF no Hub (pedido do Eduardo, 09/10) - **APROVADO**
Traz o Google Form "Cadastro Locador(a) - Pessoa Física" para dentro do Hub, no visual do Hub e com os mesmos campos. O locador preenche pelo link fixo aberto (sem login); a resposta cai no Supabase e vai por e-mail para `administrativo3@imovit.com.br` (com cópia ao locador, como o Google fazia). A lista dos cadastros fica junto das Propostas, visível só para gestão/adm. Na mesma entrega, o módulo Propostas passa a aparecer em produção, só para gestão/adm (o corretor entra depois).

- RF28.1: rota pública `/cadastro-locador`, página única, 5 blocos (e-mail; locador 14 campos/11 obrigatórios; cônjuge 8 opcionais; banco 6 obrigatórios + tipo de conta; imóvel + administradora) + lista de documentos com o e-mail `administrativo3@`.
- RF28.2: envio grava em `cadastros_locador` (Schema §2.12) e dispara o e-mail via Brevo (mesmo `notificar` da esteira). Sem e-mail válido, não envia.
- RF28.3: lista em `/admin/cadastros-locador` (só gestão/adm): quem, qual imóvel, quando, status do e-mail.
- RF28.4: `ACESSO.esteira/vendas/propostas` = gestão+adm, sem gate `VITE_MODULO_PROPOSTAS`. Portal do cliente e captação não mudam. Corretor sem acesso até liberação futura.
- RF28.5: documentos (RG/CPF, matrícula, IPTU, CPFL, Sanasa, gás) continuam por e-mail nesta versão — sem upload no Hub.

**Critérios de pronto:** um cadastro de teste aparece na tabela e na lista, e os 2 e-mails chegam; logado como corretor, Propostas some; `npm run build` ok.

### 5.16 Distratos: aviso de desocupação, motivo e satisfação (pedido do Eduardo, 14/10) — **NO AR em 14/10 (commit 4c64908), só Gestão**
**Problema.** Hoje o aviso de desocupação chega por e-mail em `administrativo@imovit.com.br`, com o motivo em texto livre. O procedimento vai como PDF ("PROCEDIMENTO DESOCUPAÇÃO"). Não existe nenhuma medida de satisfação de quem sai. O motivo só aparece depois, no Imoview (`motivo_rescisao`), preenchido pelo ADM.

**Objetivo.**
- Tratar o distrato pelo Hub. Com um link só, o locatário:
  - recebe o procedimento;
  - avisa a saída e informa o motivo;
  - responde a uma pesquisa de satisfação.
- O envio vale como **aviso oficial**, com data e hora registradas para contar os 30 dias.
- A Gestão passa a saber **por que** os locatários saem e **como avaliam** a Imovit.

**Decisões do Eduardo (14/10).**
- D1. O link é **por contrato**. O ADM gera o link no Hub a partir do contrato e envia ao locatário. Não há link fixo público.
- D2. O formulário **substitui o e-mail de aviso**. O envio é o aviso oficial e dispara e-mail para `administrativo@`. O texto do procedimento muda de "encaminhar por e-mail" para "pelo link".
- D3. A 1ª entrega é **só registro + lista**. As etapas (vistoria, aprovação do proprietário, chaves, documentos, rescisão) ficam para depois.

**Fluxo.**
1. O locatário comunica ao ADM que vai sair (telefone, WhatsApp ou e-mail).
2. Em Propostas ▸ **Distratos**, o ADM clica em "Novo distrato" e busca o contrato ativo (código, imóvel ou nome do locatário). Imóvel, locatário, contato e datas do contrato vêm da carteira (`contratos_locacao`).
3. O Hub gera `/distrato/<token>`, válido por 15 dias. O ADM copia o link ou abre o WhatsApp com uma mensagem pronta. Também pode enviar por e-mail ao locatário (Brevo).
4. O locatário abre o link, sem login, e passa por 3 passos:
   - **Procedimento de desocupação.** O conteúdo do PDF: os 6 itens, a lista de documentos 6.1–6.3 e o aviso de multa. O locatário marca "Li e estou ciente".
   - **Aviso de desocupação.** Confere imóvel e nome (só leitura). Informa a data prevista de entrega das chaves, o motivo, um detalhe (opcional) e um telefone ou e-mail de contato.
   - **Pesquisa de satisfação.** É opcional e não impede o aviso.
5. Ao enviar:
   - o Hub grava data e hora (= data do aviso);
   - manda e-mail a `administrativo@` com o resumo e cópia ao locatário. A cópia serve de **comprovante**: data do aviso, fim dos 30 dias e procedimento;
   - o link passa a mostrar só o comprovante (uso único).
6. O distrato aparece na lista com o status: link enviado · aviso recebido · link expirado · cancelado.

**Motivo (lista fechada).** São os mesmos nomes do Imoview, para o ADM lançar igual no `motivo_rescisao`:
- Mudou de cidade
- Foi transferido
- Comprou outro imóvel
- Alugou outro imóvel
- Valor do aluguel
- Dificuldade financeira
- Fechou empresa
- O proprietário solicitou o imóvel de volta
- Vencimento do contrato
- Outro (texto obrigatório)

Algumas respostas abrem perguntas extras (Eduardo, 14/10):
- **"Alugou outro imóvel"** e **"Comprou outro imóvel"** perguntam **"Com quem?"**: com a Imovit · com outra imobiliária · direto com o proprietário.
  - Se a resposta for "com a Imovit", o imóvel continuou com a gente. Na lista, isso aparece como "retido".
- **"Alugou outro imóvel"** e **"Valor do aluguel"** também perguntam **"O que pesou mais?"**: preço · tamanho · localização · estado do imóvel · outro.

Achado: "Valor do aluguel" aparece em 489 rescisões, a última em 01/2025. Parece um valor padrão antigo do Imoview, não um motivo real. Por isso não entra na análise de motivos antes de 2025.

**Pesquisa de satisfação.**
- NPS de 0 a 10: "Recomendaria a Imovit a um amigo?"
- Nota de 1 a 5 em cada área:
  - atendimento da equipe;
  - manutenção e reparos;
  - financeiro (boletos, repasses, reajustes);
  - comunicação e prazo de resposta;
  - estado do imóvel na entrada.
- "Alugaria com a Imovit de novo?" (sim / talvez / não).
- Comentário livre.

**Prazo de 30 dias.** Se a data prevista for antes de hoje + 30 dias, a tela mostra o aviso de multa do procedimento ("será cobrado 1 mês de aluguel e encargos") e pede confirmação. O envio não é bloqueado.

**Lista no Hub (só Gestão, D8).**
- Colunas: contrato, imóvel, locatário, data do aviso, data prevista, fim dos 30 dias, motivo, NPS, status.
- Detalhe: a pesquisa completa, "Copiar motivo para o Imoview" e "Cancelar" (locatário desistiu).
- Resumo no topo: avisos no mês, motivos em 12 meses, quantos ficaram com a Imovit (alugou ou comprou com a gente), NPS de saída e médias por área.

**Quem vê.**
- Só a `gestao` cria, vê e cancela (D8, 14/10). O `adm` entra depois.
- ADM, corretor, marketing e "Sem nível" não veem nada.
- O locatário vê só o próprio link.
- Hoje só a `gestao` lê `contratos_locacao`. Por isso o ADM busca o contrato por uma RPC `security definer`, que devolve só os campos mínimos dos contratos ativos.

**Fora (por enquanto).**
- Etapas depois do aviso: vistoria, revistoria (R$ 150), aprovação do proprietário, chaves e documentos.
- Escrever no Imoview: o ADM lança o aviso e o motivo.
- Upload das contas e da CND.
- Painel de distratos no Dash ▸ Adm locação. Depois, o capítulo 4 ("Quem está saindo e por quê") pode ler a pesquisa.

**RFs.**
- RF29.1: Propostas ▸ Distratos (`/admin/distratos`, gestão e adm):
  - lista e "Novo distrato" (busca de contrato ativo);
  - link válido por 15 dias;
  - ações: copiar, WhatsApp, enviar por e-mail, cancelar.
- RF29.2: rota pública `/distrato/<token>`, com 3 passos (procedimento + ciência, aviso + motivo, pesquisa opcional), no visual do Hub e pensada para celular.
- RF29.3: o envio grava o aviso com data e hora do servidor e só pode ser feito uma vez. Pelo Brevo, manda e-mail a `administrativo@` e o comprovante ao locatário.
- RF29.4: na lista, detalhe e resumo (motivos, NPS, médias por área) e "Copiar motivo para o Imoview".

**Critérios de pronto.**
- Um distrato de teste percorre todo o caminho: criar → link → enviar → e-mails → lista.
- Reaberto, o link mostra só o comprovante. Vencido, mostra "expirado".
- Logado como corretor, Distratos não aparece e a RPC devolve zero linhas.
- O anon só lê e grava pelo token (via Edge Function).
- `npm run build` ok.

**Respostas do Eduardo (14/10).**
- D4. O e-mail do aviso vai **só para `administrativo@`**, por enquanto. O comprovante continua indo ao locatário.
- D5. O proprietário **não recebe** o aviso nesta entrega.
- D6. O texto do procedimento **pode ser adaptado** para o formato de link.
- D8. **Só a Gestão** vê e trata os distratos por enquanto (14/10): `ACESSO.distratos`, RLS e RPC com `is_gestao()`, função exige `gestao`. Para abrir ao ADM, migration `20261014130000` explica o caminho.
- D7. Os distratos já recebidos (2 planilhas do Google Forms) **entram no Hub**, com `origem = planilha`, a linha original guardada e os campos mapeados quando der.

### 5.17 Central de Cadastros (pedido do Eduardo, 14/10) — **APROVADO, pode construir**
Trazer os demais Google Forms de cadastro para o Hub sem replicar o custo do Locador PF (que hoje = 1 rota + 1 tabela + 1 função + 1 item de menu por formulário). Os 6 cadastros (Locador, Locatário, Fiador × PF, PJ) compartilham ~80% dos campos; a solução é **1 motor genérico** com a mesma cara do Hub.

- RF30.1: página pública `/cadastros` com seletor em cards (papel × PF/PJ) + links diretos `/cadastro/<tipo>` (ex. `/cadastro/locador-pj`) para o corretor mandar o link exato. O `/cadastro-locador` atual redireciona para `/cadastro/locador-pf` (não quebra o link que já circula).
- RF30.2: blocos reutilizáveis (PessoaPF, PessoaPJ, Endereço, Banco, Imóvel, Profissional/Referências); cada tipo monta seus blocos com as mesmas obrigatoriedades do Google Form. Destino de e-mail **por tipo** (decisão do Eduardo, 14/10): locador → `administrativo3@`, fiador PF → `administrativo@`, fiadora PJ → `pamela@` (locatários: confirmar destino ao aprovar cada tipo).
- RF30.3: 1 tabela `cadastros` (Schema §2.14) + 1 Edge Function `cadastro-locador` estendida (parâmetro `tipo`, sem ele = locador-pf, compatível com o front já publicado). A `cadastros_locador` existente é migrada (linhas viram `tipo = 'locador-pf'`) e mantida como está, sem escrita nova.
- RF30.4: 1 lista `/admin/cadastros` (só gestão/adm) com filtro por tipo e origem; substitui "Cadastros locador" no menu Propostas (o item passa a se chamar "Cadastros"; a rota antiga redireciona). **Nenhum item novo no menu.** A linha abre o cadastro completo num modal (todos os blocos, sem edição) e há busca por nome, e-mail, CPF/CNPJ, telefone e endereço (15/10).
- RF30.5: Ferramentas ▸ Cadastros (gestão/adm/corretor): os links copiáveis de cada tipo, no padrão de Materiais para clientes. O corretor não vê a lista de respostas.
- RF30.6: histórico — as respostas já recebidas nos Google Forms (2 planilhas do Eduardo) entram na mesma lista com `origem = 'planilha'`, sem reenviar e-mail. Importe por script local com CSV exportado das planilhas.
- Fatiamento (decisão do Eduardo, 14/10): **piloto = Locador PJ** (maior overlap com o PF pronto); depois Fiador PF → Fiadora PJ → Locatários, habilitando um `tipo` por vez na mesma estrutura, sem migração nova.
- Pendente do Eduardo: link da pág. 2 do Locatário PF + link do Locatário PJ (se existir) e os e-mails de destino dos dois locatários.

**Critérios de pronto:** um Locador PJ de teste aparece na tabela e na lista com o filtro, e os 2 e-mails chegam ao destino do tipo; `/cadastro-locador` antigo continua funcionando; `npm run build` ok; histórico visível na lista com origem "planilha".

### 5.18 Onboarding de colaboradores (pedido do Eduardo, 19/10) — **NO AR em 19/10** (commit 0cfd8d2; plano Fase 23)
**Problema.** A entrada da Giovana (corretora de locação, 19/10) foi feita à mão:
- o cadastro entrou em `colaboradores_raw` por um `INSERT` no SQL;
- o CPF circulou no chat;
- o checklist ficou numa nota do Obsidian ("🟡 Onboarding de Colaboradores - Procedimento");
- ninguém lembrava que é preciso incluir a pessoa nas filas de repique, que ficam fixas no n8n.

O Hub liga a pessoa a tudo por dois campos: o **e-mail** (`perfis.email = colaboradores_raw.email_oficial`) e o **nome completo** (os atendimentos do CRM são casados por nome). Basta um e-mail ou um nome diferente para o colaborador sumir dos dashboards sem nenhum aviso. E `colaboradores_raw` não tem lugar seguro para CPF, porque todo usuário logado lê a tabela.

**Objetivo.**
- O colaborador novo passa os dados por um link, sem login.
- A Gestão usa esses dados para criar o e-mail e o usuário no Imoview, informa os dois no Hub e aprova. Então o Hub grava em `colaboradores_raw` e manda o acesso para a pessoa.
- Cada colaborador tem um checklist de entrada no Hub, incluindo **CRM** e **filas de repique**.
- CPF e endereço ficam numa área que **só a Gestão** lê.

**Decisões do Eduardo (19/10).**
- D1. Quem preenche é o **colaborador, por link** com token (`/onboarding/<token>`), no padrão do Distrato (§5.16).
- D2. O colaborador passa: **nome completo, telefone, CPF, CRECI, equipe (locação ou venda) e endereço**. O e-mail @imovit e a conta no Imoview **são criados pelo Eduardo** depois, a partir desses dados.
- D3. A ordem é: **colaborador preenche → Eduardo cria e-mail e Imoview → informa no Hub e aprova → `colaboradores_raw` → acesso enviado para a pessoa**.
- D4. O **checklist** fica no Hub, por colaborador, e inclui **CRM** e **filas de repique**.

**Fluxo.**
1. **Link.** Em Configurações ▸ **Onboarding**, a Gestão clica em "Novo colaborador". O Hub gera `/onboarding/<token>`, válido por 15 dias e de uso único. A Gestão copia o link ou abre o WhatsApp com uma mensagem pronta.
2. **O colaborador preenche**, sem login, numa página única:
   - nome completo;
   - telefone/WhatsApp;
   - CPF, com dígito validado;
   - CRECI (número e UF);
   - equipe: **Locação** ou **Venda**;
   - endereço com CEP, com busca do CEP.

   No fim, há um aceite de uso dos dados (LGPD). Ao enviar, o status vira "dados recebidos", a Gestão recebe um e-mail e o link passa a mostrar só "recebido".
3. **O Eduardo cria as contas fora do Hub.** A ficha mostra os dados com botão de copiar, para criar:
   - o e-mail @imovit;
   - o usuário corretor no Imoview, com o **nome exatamente como foi digitado**.
4. **Aprovação no Hub.** A Gestão informa:
   - o **e-mail @imovit** criado;
   - o **código no Imoview** (`id_corretor_crm`).

   Antes de aprovar, o Hub valida que o e-mail é `@imovit.com.br` e que o código e o e-mail não pertencem a outra pessoa. Ao aprovar, faz o upsert em `colaboradores_raw`:
   - nome;
   - e-mail;
   - telefone no formato `(19) 99999-9999`;
   - `equipe = 'comercial'`;
   - `cargo` = `locação` ou `vendas`;
   - `data_admissao` = dia da aprovação;
   - `ativo = true`.
5. **Acesso para a pessoa.** O botão "Enviar acesso" abre o WhatsApp com uma mensagem pronta: o e-mail @imovit e o link do Hub, com o passo "crie sua conta com este e-mail". Quando ela cria a conta, o checklist mostra o botão "Definir nível Corretor".
6. **Checklist do colaborador** (na mesma ficha):

   | Etapa | Como marca |
   |---|---|
   | Dados recebidos | automático |
   | E-mail @imovit criado | automático: informado na aprovação |
   | Usuário no Imoview | automático: código informado na aprovação |
   | Cadastro em `colaboradores_raw` | automático |
   | **CRM: equipe/distribuição no Imoview** | manual |
   | **Fila de repique** (venda ou locação) | manual, com a instrução na tela (ver P2) |
   | Acesso enviado | automático: botão usado |
   | Login no Hub | automático: existe `perfis` com o mesmo e-mail |
   | Nível Corretor | automático: `perfis.role = 'corretor'` |
   | Plantão | manual |

   **Status:** link enviado · dados recebidos · aprovado · concluído (checklist completo) · cancelado.

**Requisitos.**
- RF32.1: aba Configurações ▸ **Onboarding** (só gestão), com lista (nome, equipe, status, checklist x/10), "Novo colaborador" e a ficha com os dados, os botões de copiar, a aprovação e o checklist.
- RF32.2: rota pública `/onboarding/<token>`, servida por uma Edge Function `onboarding` no padrão da `distrato`. O anônimo não lê nem escreve nas tabelas.
- RF32.3: a tabela `onboarding_colaboradores` (dados enviados, CPF, CRECI, endereço, e-mail @imovit, código do Imoview, status, marcações manuais, token) tem RLS **só gestão**.
- RF32.4: aprovar = upsert em `colaboradores_raw` com os campos acima. CPF e endereço **nunca** vão para ela.
- RF32.5: e-mail via Brevo (`notificar`) para a Gestão quando chegam dados.
- RF32.6: as marcações automáticas são calculadas na leitura (`onboarding_colaboradores`, `colaboradores_raw` e `perfis`), não gravadas.

**Fora de escopo (1ª entrega).**
- Criar o e-mail @imovit ou o usuário do Imoview automaticamente: o Eduardo cria (D2).
- Upload de documentos (ver P1).
- Desligamento: o fluxo inverso (inativar, tirar das filas e do plantão) fica para depois.

**Perguntas em aberto.**
- P1. **Data de nascimento e documentos**: a data de nascimento alimenta os aniversários da agenda. Entra no formulário? Os documentos (RG, comprovante de endereço, CRECI) sobem no Hub ou ficam fora?
- P2. **Filas de repique:** hoje as filas são **listas fixas** no nó "Calcular fila" do n8n. O fluxo ativo é o "teste repique" (`n6NEH8TiFRs2yQor`), e o "Repique 3.0" (`4wQRK0lOBk2vuFwP`, desligado) tem a mesma lista. Incluir alguém exige editar os dois fluxos. Proposta para depois: criar a coluna `no_repique` em `colaboradores_raw` e fazer o n8n montar a fila a partir dela. Assim, a etapa vira um botão no Hub e entra e sai junto com `ativo`. Isso é uma mudança no n8n, feita pelo Eduardo no editor.
- P3. **Retenção:** o que acontece com o CPF e o endereço quando o colaborador sai?
- P4. **Outras funções** (adm, marketing, recepção) usam o mesmo formulário sem CRECI, ou a 1ª entrega é só corretor?

**Critérios de pronto.**
- Um colaborador de teste preenche o link e a Gestão recebe o e-mail.
- Ao aprovar com e-mail e código, aparece em `colaboradores_raw` no padrão.
- "Enviar acesso" abre o WhatsApp com a mensagem certa.
- Logado como corretor, nem a aba nem os dados de ninguém aparecem. Conferir no banco (RLS).
- Um link vencido ou já usado não lê nada.
- O checklist marca sozinho login e nível.
- `npm run build` ok.

#### 5.18b Dados bancários no onboarding (pedido do Financeiro, 04/11) — **APROVADO e NO AR em 04/11** (plano Fase 26) (plano Fase 26, Schema §2.21)
**Problema.** O financeiro precisa da conta e do PIX de cada colaborador para pagar comissões. Hoje esses dados chegam por fora (WhatsApp/chat), sem lugar seguro no Hub.

**Decisões do Eduardo (04/11).**
- B1. O formulário pede **conta + PIX**: banco, agência, conta com dígito, tipo (corrente/poupança), tipo da chave PIX e a chave.
- B2. **Gestão e ADM** (o financeiro) leem os dados bancários.
- B3. A conta **é sempre do próprio colaborador**. O formulário avisa isso e não pede titular.
- B4. Os dados bancários são **opcionais**: o colaborador pode enviar sem eles e mandar depois.

**Como fica.**
1. **No link público**, uma seção nova "Dados bancários (opcional)", com o aviso "a conta precisa estar no seu nome". Cada bloco é tudo ou nada: quem começa a conta preenche os 4 campos da conta, e quem escolhe o tipo da chave PIX preenche a chave. Se a chave for do tipo CPF, ela tem de ser o CPF do próprio colaborador (B3).
2. **"Mandar depois"**: se o colaborador enviou sem os dados bancários, o mesmo link mostra "Recebemos seus dados" e, abaixo, só a seção bancária, até ele enviar ou o link vencer. Assim os dados não passam pelo WhatsApp.
3. **Gestão**: a ficha do onboarding mostra os dados bancários, com botão de copiar.
4. **ADM (financeiro)**: em **Configurações ▸ Usuários & Acessos** (B5), a lista **Dados bancários** (nome, equipe, banco, agência, conta, PIX), sem CPF nem endereço. O ADM vê só essa aba e, nela, só essa lista; a Gestão vê a lista abaixo da tabela de usuários.
5. O aceite LGPD passa a dizer: "O CPF e o endereço ficam visíveis só para a Gestão; os dados bancários, para a Gestão e o financeiro."

**Requisitos.**
- RF32.7: tabela própria `onboarding_dados_bancarios` (1 por onboarding), com RLS de leitura `is_adm_ou_gestao()`. Separada da `onboarding_colaboradores` porque a RLS vale para a linha inteira: na mesma tabela, liberar o ADM abriria também o CPF e o endereço.
- RF32.8: a escrita passa só pela Edge Function `onboarding` (eventos `enviar` e `enviar_bancarios`). O anon não lê nem escreve.
- RF32.9: dados bancários **nunca** vão para `colaboradores_raw`, para e-mail ou para log.
- RF32.10: a lista do ADM lê por uma RPC (`dados_bancarios_colaboradores`) que confere o papel e devolve só nome, equipe e os campos bancários.

**Fora de escopo.**
- Colaboradores que já entraram antes de 04/11 (sem link de onboarding). Ficam para depois, ou o financeiro segue como hoje.
- ~~Editar os dados pelo Hub~~: entrou em 04/11 (B7–B8, abaixo).
- Validar a conta no banco (dígito da agência ou da conta): cada banco tem uma regra; confere-se no primeiro pagamento.

**Em aberto.**
- ~~B5. Onde fica a lista do ADM?~~ **Decidido (04/11): Configurações ▸ Usuários & Acessos.** PRD e plano aprovados pelo Eduardo em 04/11.
- B6. Retenção: os dados bancários seguem a P3 (o que acontece quando o colaborador sai).

**Editar e excluir (pedido do Eduardo, 04/11).**
- B7. **Gestão e ADM** editam e excluem, na lista de Configurações ▸ Usuários & Acessos (botões Editar e Excluir).
- B8. **Excluir apaga só os dados bancários**: o onboarding, o CPF e o checklist ficam. Pede confirmação ("não tem como desfazer").
- Editar segue as mesmas regras do formulário (PIX CPF = CPF do colaborador; cada bloco tudo ou nada). Para tirar tudo, usa-se Excluir.
- **Quem editou fica registrado** (sugestão do Asimov, aceita): a lista mostra "Editado por X em data". Troca de PIX é o golpe clássico de desvio de comissão.

**Critérios de pronto.**
- O colaborador envia com e sem dados bancários; sem eles, o link aceita só a seção bancária depois.
- A chave PIX do tipo CPF diferente do CPF dele é recusada.
- Gestão e ADM veem os dados; corretor, marketing e anon recebem zero (conferido no banco).
- O ADM continua sem ler CPF e endereço.
- O e-mail para a Gestão não leva dado bancário.
- `npm run build` ok.

### 5.19 Relatório da Diretoria e dashboards finais (pedido da Diretoria, 28–29/10) — **APROVADO (29/10) como direção; detalhe página por página a seguir**
**Problema.** O diretor não confia nos dados (divergem do CRM) e perde o fio do raciocínio navegando entre páginas. Causa: duas fontes de atendimento (achados A1/A7, Fase 24) e painéis sem ligação entre si nem com as listas (0 links nos 4 painéis; os filtros da URL se perdem ao trocar de página pelo menu).

**Estrutura (a espinha do dinheiro).** Mídia → Lead → Atendimento → Visita → Proposta → Contrato → Carteira. Seis páginas:
- **Relatório da Diretoria**: resumo, entregue primeiro (é o que a Diretoria pediu);
- **Aquisição**: ex-Performance (§5.0b);
- **Atendimento**: junta Gestão v2 (§5.0c), jornada (§5.12), Dados de atendimento e Comercial/Meus números (o corretor vê esta página filtrada nele; "Ver como" do §5.11). Dados de atendimento deixa de ser página;
- ~~**Fechamento**: propostas e esteira~~ → **vira o capítulo 5 do Atendimento (03/11)**: as tabelas de propostas do Hub estão vazias (módulo desligado), a fonte é a mesma jornada do Atendimento e o volume é pequeno (12 negócios de locação e 2 de venda na safra jul–set). Volta a ser página quando o módulo de Propostas tiver valor em R$. A espinha fica com 5 páginas;
- **Carteira**: ex-Adm locação (§5.13);
- **Estoque**: ao lado da espinha (§5.14); recebe o capítulo "A carteira está atualizada?" do §5.0c.

**Gargalo que orienta a ordem (dados de 28/10).** Safra jul–set/26, locação: Seleção de imóveis → Qualificado 45%, **Qualificado → Visita 35%**, lead → negócio 4,2% (12 de 288). Venda: Qualificado → Visita 29% (base pequena, 2 negócios). Pressuposto: o descartado fica na fase em que caiu.

**Relatório da Diretoria (página no Hub) — detalhe aprovado em 29/10 (P1–P3, R1–R5).** Uma visão geral **na ordem do funil** (pedido do Eduardo): placar no topo e cinco atos, do investimento à receita. Cada ato tem título-conclusão gerado pelos dados, poucos números com comparação e link para a página detalhada.

- **Período e comparação.** Mês atual (padrão) → mês anterior **até o mesmo dia**; mês passado → o mês antes dele; 30/60/90 dias e personalizado → período anterior do mesmo tamanho.
- **Placar (P1).** Uma linha com 5 números, cada um com ▲▼ e a comparação: **Investido · Leads · Em atendimento · Negócios · Receita**.
- **Ato 1 — Investimento e campanhas → Aquisição.** Investido por plataforma (Meta, Google); **no máximo 5 campanhas** (P2) com gasto, conversões na plataforma e custo por conversão. Aviso fixo: "a ligação campanha → lead do CRM ainda não é rastreada". Ex.: "R$ 5 mil investidos, 60% no Google; a campanha X levou metade da verba."
- **Ato 2 — Leads → Aquisição.** Leads válidos (fluxo) por finalidade e canal; % vindo de mídia paga; **custo real por lead pago** = investimento Meta + Google ÷ leads "Campanhas pagas" no CRM (R4). Se o período pegar antes de 23/09, aviso de dias duplicados no Meta (custo inflado). Ex.: "196 leads, 28% pagos, a R$ 92 cada."
- **Ato 3 — Funil → Atendimento.** Etapas em linha com quantos chegaram a cada uma no período (fluxo). Embaixo de cada etapa: **dias desde a entrada até chegar nela** (P3; funciona mesmo quando o corretor pula etapas; "acumulando" com menos de 5 casos) e a conversão por passagem (safra, com selo de maturidade). **Gargalo calculado** = passagem com a menor taxa, em destaque (R5). Ao lado: em atendimento agora e 🔴 esquecidos. Ex.: "Na locação o lead chega à Seleção de imóveis em 1 dia, mas só 35% dos qualificados chegam à visita."
- **Ato 4 — Fechamento → Atendimento, cap. 5.** Negócios no período (fluxo), locação e venda; propostas em andamento (com o valor na locação); conversão lead → negócio e dias até o negócio (safra madura). Venda em **quantidade** de negócios, com a lacuna escrita na tela (R2).
- **Ato 5 — Receita e carteira → Carteira.** **Receita total** = administração + intermediação recebidas, **sempre com a divisão** embaixo (R1): administração = recorrente; intermediação = pontual, com o nº de contratos. A frase diz de qual das duas veio a variação. Contratos ativos e saldo novos × encerrados; administração contratada (MRR); administração em risco (aviso de desocupação + fim do prazo em até 90 dias); inadimplência. Ex. (set/26): "Setembro rendeu R$ 115 mil, 30% acima de agosto; a alta veio da intermediação (6 contratos); a administração subiu 12%."
- **Rodapé.** Fonte e hora de leitura de cada ato. Leitura atrasada → tarja "dados de dd/mm" **no próprio ato**.
- **Cliques.** Placar e atos abrem a lista por trás do número (recebimentos sem dados pessoais; leads; negócios e propostas) ou a página detalhada já filtrada.

**Dados conferidos em 29/10 (base do detalhe).**
- Receita (recebimentos, por mês de pagamento): administração R$ 55–69 mil/mês (mai–set), intermediação R$ 12–63 mil/mês com 3–6 contratos. **A última leitura dos pagos era de 19/10.**
- Investimento: R$ 4,5–6 mil/mês desde ago (out até 28/10: Google R$ 3,2 mil, Meta R$ 1,8 mil); 54 de 196 leads de out vieram de mídia paga.
- **Nenhum** lead pago no CRM (jul–out, 156) tem campanha preenchida.
- Jornada desde 06/10: Pré-atendimento → Seleção de imóveis 1,3 dia (locação, 69 casos); Seleção de imóveis → Qualificado 2,2 dias (18); venda Pré → Qualificado direto 7,4 dias (25). Visita → Proposta com 2 casos. Pular etapa é comum.

**Página de Atendimento — detalhe aprovado em 29/10.** Só **clientes**: atendimentos de mídia "Captação" (`is_interno`, proprietário cadastrando imóvel) ficam fora de todas as contas, com **aviso fixo** da diferença para o CRM (decisão do Eduardo: evidenciar sempre). Conferido em 29/10: CRM 62 locação / 156 venda = Hub 56 / 126 + 5 / 31 captações (± 1 de horário da leitura). Sem faixa de Aquisição no topo (decidido 29/10): a mídia fica na página Aquisição e no Relatório.

- **0 Manchete.** **Em atendimento agora = todos os ativos** (não só Qualificado a Proposta, como no §5.0c), para bater com o CRM: 182 (locação 56 · venda 126) em 29/10. Aviso: "O CRM mostra N: M são captações e ficam fora desta conta." Ao lado: 🔴 esquecidos (vs ontem), conversão na passagem gargalo (vs período anterior), negócios no período (vs mês anterior até o mesmo dia). Frase ex.: "182 clientes em atendimento, 143 sem nenhuma ação no prazo. O maior acúmulo está em Qualificado (103)." Cada número abre a sua lista; os 🔴 esquecidos levam ao capítulo 1 e o gargalo, ao capítulo 2.
  - **Velocidade (03/11, Eduardo):** entra na manchete o **tempo da entrada até Qualificado** (mediana, por finalidade), comparado com o período anterior e com uma meta (a definir; para locação, o Eduardo considera 2 dias tempo demais: o cliente já seguiu com outro corretor ou outra imobiliária). Em 29/10, na locação: Pré-atendimento → Seleção de imóveis 1,3 dia + Seleção de imóveis → Qualificado 2,2 dias. Sustenta a leitura: desde 06/10, 112 dos 157 descartes que são perda real (71%) são "Perdemos o contato".
- **Ordem dos capítulos (revista em 03/11, Eduardo + Pareto):** primeiro o que ainda dá para salvar (indicador de ação), depois a explicação do passado. Ordem anterior (29/10): Onde trava? → Por quê? → Com quem? → O que fazer hoje?.
- **1 O que fazer hoje?** Lista de trabalho dos 🔴 em 3 blocos, do mais perto do dinheiro:
  - 🔥 **Perto do dinheiro**: Proposta + Visita (29/10: 8 + 26);
  - 🔴 **Qualificados** (83; 39 nunca tiveram atividade);
  - ⚪ **Início do funil** (26).
  Colunas: código (abre o Imoview), corretor, etapa, dias na etapa, última atividade (ou "nunca"). **Dentro do bloco: quem passou do prazo há menos tempo primeiro** (mais chance de recuperar). O corretor vê só a dele. O Hub não escreve no CRM; a lista muda na leitura do dia seguinte. O e-mail diário leva o número do bloco 🔥. Substitui o mapa de pessoas e a página Dados de atendimento.
- **2 Onde trava?** Seletor Locação | Venda. **5 etapas**: Lead (Pré-atendimento + Seleção de perfil + Seleção de imóveis) → Qualificado → Visita → Proposta → Negócio. Em cada etapa: quantos chegaram (fluxo), dias desde a entrada (mediana; "acumulando" com n < 5) e descartados (clique → capítulo 3). Na seta: conversão da passagem (safra, com selo de maturidade). **Gargalo = menor taxa entre as passagens com base ≥ 20 leads**, seta em coral. Com a safra jul–set: locação Lead → Qualificado 29% (288 → 84 → 29 → 16 → 12); venda Qualificado → Visita 29%.
- **2b Qual canal performa melhor? (pedido da Diretoria, 29/10; aprovado).** Tabela canal × funil: leads, qualificados, visitas, propostas, negócios e lead → negócio (safra madura), com a **pior passagem de cada canal em coral**. Canal com menos de 20 leads no período ganha o selo "base pequena". Clicar no canal filtra a página inteira (os motivos do capítulo 3 passam a ser os daquele canal); clicar num número abre a lista de leads. Finalidade, corretor e período continuam valendo. No Relatório, o Ato 2 ganha a linha "melhor e pior canal" com link para este capítulo.
  - **Achado de 29/10 (safra abr–ago, clientes):** Campanhas pagas 208 leads → 55 qualificados (26%) → 8 visitas → **0 negócios**; Site 173 → 112 (65%) → 69 → 17 negócios (9,8%); Indicação 89 → 75 (84%) → 44 → 11 (12,4%); WhatsApp 122 → 3 (2,5%); Portais 94 → 3 (3,2%).
  - **Conferência (29/10):** 5 leads pagos (5385, 5404, 5552, 5900, 5912) conferidos no Imoview, 5/5 descartados como no Hub; motivos de perfil (desistiu, sem condição, comprou com terceiros, não responde, outro). Pela pessoa nas atividades, 44 dos 208 eram rastreáveis: 2 tiveram outro atendimento, nenhum virou negócio. Conclusão: o zero se sustenta, com o limite de que só 1 em 5 era rastreável. Em aberto: "Campanha Halma" é anúncio da Imovit ou de construtora (se for de construtora, sai da conta de mídia paga).
- **3 Por quê?** Motivos de descarte lidos das interações do CRM ("ATENDIMENTO DESCARTADO MOTIVO: …"), agrupados:
  - 🔴 **Perdemos o contato**: não responde contato; +30 dias sem interação;
  - 🟠 **Cliente sem perfil**: sem condições; desistiu; região fora do escopo; curiosidade;
  - ⚪ **Não é perda**: repique/transferência de corretor; teste do marketing; alteração de etapa; corretor se passando por cliente; erro. **Sai das contas do funil**, como o ruído.
  Desde 06/10: 112 / 45 / 41. Clicar numa etapa do capítulo 2 filtra os motivos; clicar num motivo abre a lista. O link para o Estoque saiu ("não encontrou imóvel" quase não aparece).
- **4 Com quem?** Tabela por corretor: ativos, 🔴 esquecidos (n e %), atividades realizadas no período (sem anotações), conversão no gargalo vs média da equipe. **Ordenada pelo número de esquecidos.** Frase ex. (29/10): "9 de 13 corretores com mais de 2/3 da carteira esquecida: é processo, não pessoa." Clicar no corretor filtra a página; com corretor filtrado, valem as regras do §5.0c (só a média da equipe, sem nomes; "Comparar com" só para a Gestão).
- **5 O que fechou? (ex-página Fechamento, 03/11).** Negócios no período (locação e venda; vs mês anterior até o mesmo dia); dias até o negócio (safra madura); propostas paradas há mais de X dias, em lista (código abre o Imoview); receita de intermediação com link para a Carteira. Venda em quantidade, com a lacuna de valor escrita na tela (R2).

**Página de Carteira — detalhe aprovado em 03/11 (Eduardo + Pareto).** Reorganiza a Adm locação (§5.13) pelas regras deste §5.19: primeiro o que ainda dá para salvar, depois o passado. Tudo na moeda da Imovit: **reais de administração por mês**. Quem vê: continua só a Gestão (§5.13).

- **0 Manchete.** **Administração contratada/mês** (aluguel × taxa dos ativos), com a recebida (média dos 3 últimos meses fechados) embaixo. Ao lado: **− saindo** (administração dos contratos com aviso de desocupação). Contexto em letra menor: contratos ativos e soma dos aluguéis administrados (tamanho, nunca manchete). Ex. (03/11): "R$ 67,5 mil/mês de administração; R$ 6,1 mil (9%) com aviso de saída. 157 contratos, R$ 1,3 mi/mês em aluguéis."
  - **Depois (03/11, decisão do Eduardo: não agora):** "+ entrando" (propostas de locação × taxa). Hoje não há fonte de valor: as tabelas de propostas do Hub estão vazias (módulo desligado) e a jornada do CRM não tem valor.
- **1 Quem pode sair?** Lista em 3 blocos, do maior risco para o menor:
  - 🔴 **Com aviso de desocupação** (03/11: 13 contratos, R$ 6,1 mil/mês);
  - 🟠 **Fim do prazo em até 90 dias** (3, R$ 745/mês);
  - ⚪ **Prazo indeterminado** (49, 31% dos ativos): não "vencem", e por isso a regra dos 90 dias não os enxerga, mas saem com 30 dias de aviso. Grupo separado, ordenado por administração.
  Colunas: contrato (abre o Imoview), imóvel, administração/mês, data do aviso ou do fim, meses de contrato. Linha no fim: **reajustes atrasados** (03/11: 8, o mais antigo de 05/10).
- **2 Quem não pagou?** Número principal: **administração em atraso** (o que a Imovit deixa de receber), com contratos por faixa de atraso (até 30 / 31–90 / +90 dias). O valor bruto vencido (aluguel do proprietário) aparece só como contexto. **Alerta de concentração** quando um contrato tiver mais de 1/3 do valor vencido. Ex. (03/11): 10 contratos, 8 com até 30 dias; R$ 287 mil brutos, um contrato com R$ 105 mil.
- **3 A carteira cresce?** Novos × encerrados em contratos **e em R$ de administração**, comparados com o ano anterior (contas do §5.13).
- **4 Por que saem?** Motivos de rescisão (Distratos, §5.16).
- **Fica fora desta página:** "onde alugamos" (bairro e tipo; vai para o Estoque ou sai) e a lista de proprietários (ferramenta da ADM, não leitura da Diretoria).
- ⚠ **Taxa zero (conferido em 03/11):** os ~1,5% vinham de contratos com `taxa_adm` = 0 no Imoview; a conta do Hub está certa. São 4 ativos com taxa zero (R$ 141,5 mil/mês de aluguel, 10,6% da carteira), todos de jun–set/26: 1805 e 1815 com intermediação de 100% (podem ser "só intermediação"); **1807 (comercial, R$ 102,7 mil/mês) e 1817 com administração e intermediação zeradas**. **Respondido pelo Eduardo (03/11):**
  - **1807:** contrato bloqueado em negociação com o diretor; devia estar em **Moderação** no Imoview, não Ativo. A taxa (0% hoje) pode mudar. Enquanto aparecer como Ativo, ele infla a soma dos aluguéis (R$ 102,7 mil) e a inadimplência (R$ 105,5 mil dos R$ 287 mil). A correção é no Imoview (situação → Moderação); a leitura diária traz a mudança.
  - **1817:** imóvel do diretor, 0% combinado.
  - 1805 e 1815 (intermediação de 100%): sem resposta; tratados como "só intermediação".
  Regra da página: contrato ativo com taxa zero aparece num aviso "sem taxa de administração" com o número de contratos, fora das médias de taxa.
- **Exceção manual "Fora das contas: em negociação" (aprovada em 03/11).** Para contrato que o Imoview mostra como Ativo mas não deve contar, como o 1807: no Imoview ele é Ativo, Atrasado, "Cobrança amigável", sem campo de bloqueio, e o Eduardo não consegue mudar a situação. Regras para não virar lixeira de número feio:
  - só a Gestão marca, com motivo obrigatório; fica registrado quem marcou e quando;
  - **vence em 30 dias**: depois disso, o contrato volta às contas até alguém confirmar a marcação de novo;
  - sai sozinha quando o Imoview mudar a situação (Moderação, Rescindido etc.);
  - sempre visível: uma linha "N contrato(s) fora das contas, R$ X/mês de aluguel" na manchete e no capítulo 2, que abre a lista com os motivos;
  - fora da inadimplência, da soma dos aluguéis e das médias. Continua no Imoview como está.
  - A correção de verdade continua sendo a situação no Imoview (ADM ou suporte do Imoview).

**Página de Aquisição — detalhe aprovado em 03/11 (Eduardo + Pareto).** Substitui o Painel de Performance (§5.0b), que foi feito para o marketing. A pergunta da Diretoria é uma só: **o real investido em anúncio volta como negócio?** (decisão: manter, cortar ou mudar a verba de lugar).

- **0 Manchete.** Investido no mês (vs anterior até o mesmo dia); **custo real por lead pago** (investimento Meta + Google ÷ leads "Campanhas pagas" no CRM, R4); **custo por negócio da mídia paga** (investimento ÷ negócios vindos de leads pagos, safra madura). Antes de 23/09: aviso de dias duplicados no Meta.
- **1 O dinheiro vira negócio?** Cascata investido → leads pagos → qualificados → visitas → negócios, com o custo de cada degrau e o orgânico (Site, Indicação) lado a lado. Achado de 29/10 (safra abr–ago): pagos 208 → 26% qualificados → 8 visitas → 0 negócios; Site 65% → 9,8%.
- **2 O lead pago é bom?** O sinal antecipado: % qualificados e **tempo até qualificar** dos leads pagos, vs Site e Indicação, por mês. Aparece em semanas; o negócio leva meses.
- **3 Onde está indo a verba?** Meta × Google; no máximo 5 campanhas, com gasto e custo por conversão na plataforma. Aviso fixo: "a ligação campanha → lead do CRM ainda não é rastreada" (0 de 156 leads pagos com campanha, jul–out).
- **Página dona:** a tabela canal × funil completa é do Atendimento (cap. 2b); aqui só o recorte pago × orgânico, da mesma fonte.
- **Sai da visão da Diretoria:** CPM, CTR, CPC, matriz de bolhas e ritmo de orçamento (orçamentos cadastrados só até ago/26). Viram uma aba "Detalhe do marketing", ou saem.
- **Campanha Halma (respondido pelo Eduardo, 03/11):** campanha interna e antiga de **reativação de leads inativos** que responderam a uma ação, sem verba em Meta/Google. Não é mídia paga: sai de "Campanhas pagas" e vai para um canal próprio ("Reativação da base"). Efeito: 14 leads (abr–jul), 0 negócios; a mídia paga passa de 208 para 194 leads e continua em 0 negócios. A mudança é no mapa de mídias do CRM (escrita: Asimov/Eduardo).
- **Marcação de canal da venda (conferido em 03/11, outubro):** as campanhas de venda gastaram R$ 680 (Google "Pesquisa - Venda" R$ 414 / 17 conversões; Meta "Vendas | WhatsApp | Casas" R$ 266 / 27) e o CRM marca **2** leads de venda como pagos (5% das conversões). Na locação, R$ 4,4 mil e 139 conversões viram 54 leads pagos (39%). Em out, a venda tem 18 leads "WhatsApp" e 17 "Site": hipótese, não provada, de que o lead pago de venda entra com a mídia do canal de chegada. **Teste do Eduardo:** um lead de teste pelo anúncio de venda no WhatsApp, para ver com que mídia cai no CRM. Até a correção, a venda paga aparece na Aquisição com o aviso "marcação incompleta: o custo por lead da venda não é confiável".
  - **Hipótese confirmada pelo Eduardo (03/11):** o GTM registra a origem em `leads_wpp_gtm`, mas ela não chega ao CRM. Em out: 116 registros, 53 com marca de mídia paga (utm, `gclid`, `fbclid` ou `gbraid`). O `codigo_atendimento` dessa tabela é um **código curto do site** (ex. 6 letras), compartilhado com o `bot_severino`, **não o número do atendimento no CRM**: o cruzamento direto dá 0. Também há `utm_source = direct` com `gclid`/`fbclid` preenchido (a UTM se perde; o id de clique fica).
  - **Requisito (alinhamento GTM → CRM):** quando o atendimento é criado no Imoview (bot/cadastro), gravar a mídia paga a partir do código do site (`gclid` → Google, `fbclid` → Meta, senão utm) **no próprio CRM**, que é o gabarito da Diretoria, e guardar o número do atendimento de volta em `leads_wpp_gtm`. Corrigir no Hub sem corrigir no CRM fica descartado. Detalhe técnico e ordem: Asimov/Brooks.

**Página de Estoque — detalhe aprovado em 03/11 (Eduardo + Pareto).** Reorganiza o §5.14. A função principal da página é **achar imóvel de forma fácil**: a busca da revisão de 16/10 (texto livre, "quase lá", ficha comercial; corretor e Gestão) continua como está. Embaixo dela, um painel curto, só para a Gestão, que responde a duas decisões: **o que destravar no estoque de locação** e **o que captar**.

- **0 Manchete.**
  - Quantidade disponível por finalidade.
  - Locação em **R$ de administração parada por mês** = aluguel dos vagos × **taxa média efetiva da carteira** (administração contratada ÷ aluguéis dos contratos ativos, sem os de taxa zero e sem os "Fora das contas"). Decisão do Eduardo, 03/11.
  - % desatualizado (+45 d) e % fora do site.
  - Venda em **quantidade**, com "% parado há mais de 1 ano". O valor somado (VGV) aparece só em letra pequena, como contexto, nunca como manchete.
- **1 Quanto temos e onde?** Quantidade por tipo (card "Quanto temos disponível?" de 16/10) e mapa de calor (16/10). **Atualizações:** imóveis atualizados nos últimos 7 e 30 dias × desatualizados (+45 d). Mostra se o cadastro está sendo cuidado ou envelhecendo.
- **2 O que fazer hoje?** Lista de trabalho dos vagos de locação **fora do site, desatualizados ou com menos de 5 fotos**, com o motivo de cada um.
  - **Na faixa que aluga (pedido do Eduardo, 03/11):** selo nos vagos cujo aluguel está entre o 1º e o 3º quartil (p25–p75) dos contratos de locação novos dos últimos 12 meses. Faixa, não média: a média é puxada pelos poucos contratos caros. Esses vêm primeiro na lista, porque são os que viram administração mais rápido; dentro de cada grupo, do maior aluguel para o menor. A busca ganha o mesmo selo e o filtro "na faixa que aluga".
- **3 Captamos o que aluga?** Estoque vago × contratos novos (12 meses) × procura dos leads, por faixa de valor e por bairro. Captações do mês × média de 12 meses entram como uma linha aqui. Hipótese a confirmar na construção: o aluguel médio do vago (~R$ 17 mil/mês) é o dobro do da carteira (~R$ 8 mil/mês): captamos caro e alugamos barato.
- **4 Limpeza da venda.** Lista dos parados há mais de 1 ano (vago desde), para validar com o proprietário ou tirar do estoque, do mais antigo para o mais novo.
- **Sai do §5.14:** "maiores tickets e R$/m² por bairro" e captações por mês em 24 meses (curiosidade, sem decisão).
- **Retrato de 03/11** (`vw_estoque_imoveis`, Vago/Disponível):
  - Locação: 208 imóveis, R$ 3,6 mi/mês de aluguel, mediana de 96 dias vago, **105 fora do site (50%)**, 51 desatualizados, 62 há mais de 1 ano.
  - Venda: 970 imóveis, R$ 3,3 bi, mediana de 475 dias, 517 fora do site, 527 desatualizados (54%), **558 há mais de 1 ano (58%)**.
  - Fora do Vago/Disponível: 93 de locação e 61 de venda em moderação, todos fora do site.
  - Não comparar com o retrato de 08/10 (mediana da venda 310 d → 475 d): a definição não mudou (conferido com o Eduardo), mas o retrato de 08/10 é anterior à 1ª carga completa (15/10). **A base de comparação passa a ser 03/11.**

**E-mail diário (7h30, Brevo; pedido da Diretoria).** Boletim, não o relatório inteiro:
- **Ontem:** leads novos (L/V), mudanças de etapa, propostas novas, negócios.
- **No mês:** receita e negócios, vs mês anterior **até o mesmo dia**.
- **Atenção:** 🔴 esquecidos (qtd e variação vs ontem), propostas paradas, avisos de rescisão.
- Link "abrir o relatório completo" (Hub, mês atual). Todo número tem link para a lista no Hub.
- Se a leitura do CRM do dia falhar, o e-mail sai com aviso no topo ("CRM sem leitura hoje, números de dd/mm"). Dia sem novidade: e-mail curto.
- **Detalhe aprovado em 29/10:**
  - **Destinatários:** daniel@imovit.com.br, gabriel@imovit.com.br, eduardo@imovit.com.br (o mesmo e-mail para os três).
  - **Quando:** segunda a sexta, **7h30** (depois da receita às 6h45 e do alerta de leitura às 7h15; combinado com o Asimov em 29/10). Na segunda, o bloco "ontem" cobre **sexta, sábado e domingo** (correção do Asimov, 29/10: sem e-mail no sábado, a sexta ficava de fora).
  - **Assunto:** "Imovit dd/mm · N negócios ontem · N perto do dinheiro esquecidos".
  - **Blocos:** Placar (Investido · Leads · Em atendimento · Negócios · Receita; mês até ontem vs mês anterior até o mesmo dia) → Ontem (leads novos L/V, mudanças de etapa, propostas novas, negócios) → Atenção (🔥 perto do dinheiro esquecidos com variação vs ontem; 🔴 esquecidos no total; avisos de rescisão novos) → link "Abrir o relatório completo" → rodapé com a hora de cada leitura.
  - Cada número com link para a lista no Hub.

**Regras de todas as páginas.**
- Todo número é clicável e abre a lista por trás dele, com os mesmos filtros; o código abre no Imoview. É o gabarito da Diretoria (não há relatório pronto no Imoview): conferência por amostra de códigos.
- Barra de filtros fixa (período, finalidade, canal, corretor) que acompanha a navegação.
- Cada métrica tem uma página dona; nas outras aparece o mesmo componente lendo a mesma fonte, nunca uma segunda conta.
  - **Esquecidos (03/11):** a conta oficial é a de `boletim_diretoria()` (ativo há mais dias na etapa que o prazo, sem atividade realizada desde hoje − prazo e sem atividade agendada a partir de hoje). A página de Atendimento lê a mesma regra do banco, sem recalcular no navegador. O 143 × 142 de 29/10 não dá para reproduzir (a função usa o estado atual dos ativos) e fica encerrado por esta regra.
- Título de capítulo/ato = conclusão gerada pelos dados.
- Rodapé com fonte, hora da leitura, nº de registros e estado dos vigias.

**Períodos.** Mês atual (padrão), mês passado, 30/60/90 dias, personalizado.

**Safra × fluxo (decisão do Eduardo, 29/10; sem filtro de troca).**
- Cartão de **quantidade** (leads, propostas, negócios) = **fluxo** do período ("no período").
- Cartão de **taxa** (conversão) = **safra** que entrou no período, com **selo de maturidade** (% ainda em andamento; ex.: "safra imatura: a taxa vai subir").
- A jornada só tem fluxo desde 06/10: comparação de fluxo com o período anterior mostra "acumulando" até haver os dois períodos.

**Parado (decisão do Eduardo, 29/10; resolve J1 do §5.12).** Prazo na etapa, contado da última mudança de etapa na jornada: **locação 3 dias, venda 7 dias**.
- 🟢 **Andando**: mudou de etapa dentro do prazo.
- 🟡 **Parado, mas trabalhado**: passou do prazo, mas teve atividade realizada ou interação no CRM no prazo, ou tem atividade agendada.
- 🔴 **Esquecido**: passou do prazo sem nada disso. Só o 🔴 vai para o topo da lista de trabalho.
- Leads sem mudança de etapa desde 06/10 aparecem como "23+ dias" (data de chegada na etapa desconhecida).
- Teste de 29/10 (só atividades): locação 53 ativos → 15 🟢, 0 🟡, 38 🔴; venda 114 → 13 🟢, 7 🟡, 94 🔴. Limite: mede o que foi **registrado** no Imoview, não o que foi feito (atendimento só por WhatsApp aparece como 🔴).

**Requisitos de dado novos.**
- **Última interação diária.** A jornada só grava quando o lead muda de etapa/situação; as interações do payload ficam congeladas naquele momento. O robô passa a guardar, a cada leitura diária, a **data da última interação** dos leads ativos. Achado de 29/10: a resposta do CRM já traz o campo `datahoraultimainteracao`; basta gravá-lo a cada leitura. Até lá, o 🟡 considera só atividades e a tela avisa "interações do CRM ainda não consideradas".
- **Recebimentos pagos lidos todo dia (R3).** Hoje só a Edge Function `carteira-locacao` lê as contas pagas, ao abrir o Adm locação (última leitura: 19/10). O relatório e o e-mail precisam da leitura diária antes do envio. **Sem isso, não há e-mail diário.**
- **Atribuição campanha → lead (lacuna).** O CRM não traz a campanha dos leads pagos. Caminho a investigar: `leads_wpp_gtm`. Até lá, campanhas são avaliadas pela conversão na plataforma.
- **Meta sem duplicados antes de 23/09** para períodos de 60/90 dias (ou aviso na tela).

**Depende de.** Fase 24 S3 (fonte única). Nada desta seção vai ao ar lendo a tabela antiga.

**Pronto quando.**
- Cada número do relatório e do e-mail é igual à contagem da lista que ele abre.
- Uma amostra de 5 códigos por ato confere no Imoview.
- O e-mail não sai com dado velho sem aviso.
- `npm run build` ok.

**Perguntas em aberto.**
- Detalhe página por página: **Relatório ✅ (29/10)** → **e-mail diário ✅ (29/10)** → **Atendimento ✅ (29/10)** → **Aquisição ✅ (03/11)** → ~~Fechamento~~ (virou cap. 5 do Atendimento) → **Carteira ✅ (03/11)** → **Estoque ✅ (03/11)**; `03-app-flow.md` e a fase no plano depois do detalhe.

### 5.20 Processo de Locação: guia do processo no Hub (pedido do Eduardo, 30/10) — **APROVADO (30/10), v1 pode construir** (plano Fase 25, Schema §2.20)
**Origem.** Em 30/10, a Direção (Daniel Aranovich) montou fora do Hub, no claude.ai, uma página HTML (`processo-locacao-imovit.html`) com o processo de locação desenhado. Ela já grava no banco do Hub, em 3 tabelas criadas fora das migrations do repo: `locacao_papeis` (9 papéis), `locacao_etapas` (42 etapas) e `locacao_casos` (vazia). Usa o login do Hub e as funções `is_team()` e `is_adm_ou_gestao()`. O Eduardo decidiu trazer uma cópia para dentro do Hub.

**Problema.**
- O processo de locação, do fechamento ao 1º boleto, e as solicitações durante a vigência não estão escritos em lugar nenhum do Hub.
- A página da Direção fica fora do Hub: não tem migration, RLS conferida nem design system.

**Decisões do Eduardo (30/10).**
- D1. **v1 = guia do processo.** Abas **Processo de Contrato**, **Administração do Contrato** e **Equipe e papéis**, lendo e gravando nas tabelas `locacao_*` existentes, sem recriar nem apagar os dados.
- D2. **Visual 100% no design system do Hub** (tokens, `hub.css`, componentes existentes). Não copiar o CSS da página HTML.
- D3. **Gestão e ADM editam; o time só lê** (é um guia).
- D4. **Menu: dentro da Esteira de Locação** (Propostas › Locação).
- D5. **Aba "Em andamento" escondida na v1.** `locacao_casos` fica no banco, sem tela.
- D6. **v2, quando a Esteira estiver ativa e estável:** a proposta aprovada na Esteira abre o caso sozinha, e a aba "Em andamento" é ligada. **Caso não é digitado à mão.**

**O que a v1 mostra.**
1. **Processo de Contrato:** do fechamento da negociação até a emissão do 1º boleto. Mapa de raias (papel × etapa), filtro "destacar papel" e lista de etapas por fase, cada uma com papel, canal, prazo em dias úteis, detalhes, checklist, decisão/desvio e melhoria pendente.
2. **Administração do Contrato:** um fluxo por tipo de solicitação (fase = fluxo), no mesmo formato.
3. **Equipe e papéis:** nome, cor, responsáveis, "fora da Imovit" e ordem.
- Gestão e ADM veem, além disso: criar, editar, subir/descer e excluir etapa (com aviso se algum caso estiver nela); criar, editar e excluir papel.

**Requisitos (RF33).**
- RF33.1: a escrita em `locacao_papeis` e `locacao_etapas` é só `is_adm_ou_gestao()`, garantida **no banco (RLS)**, não só na tela.
- RF33.2: leitura por todo o time ativo (gestão, adm, corretor, marketing). `user`, `tvaccess` e anon não leem.
- RF33.3: as alterações aparecem para quem está com a página aberta sem F5 (realtime).
- RF33.4: o menu Propostas › Locação hoje é só gestão/adm (`ACESSO.propostas`). Para o time ler o guia, o item novo tem acesso próprio (`ACESSO.processoLocacao`), e o grupo aparece para o corretor **só com esse item**. Propostas, Esteira etc. continuam escondidas para ele.
- RF33.5: as 3 tabelas ganham migration de regularização no repo e registro no Schema §2.20.

**Fora de escopo (v1).** Aba "Em andamento" e qualquer tela de `locacao_casos` (vai para a v2, D6); integração com o Imoview; notificações.

- D7. **A página HTML da Direção fica no ar até a ADM validar o guia no Hub** (decisão de 30/10). Depois, combinar com o Daniel e desligar. As duas gravam nas mesmas tabelas, então convivem sem conflito.

**Critérios de aceite.**
- As 42 etapas e os 9 papéis aparecem no Hub iguais à página da Direção.
- Uma etapa editada no Hub aparece na página da Direção, e o contrário também.
- O corretor vê o guia sem botões de edição e recebe erro (RLS) ao tentar editar pela API (teste simulando o papel).
- O corretor continua sem ver Propostas, Esteira e os demais itens do menu.
- `npm run build` ok; 375 px ok.

### 5.1 Dicionário de métricas (fórmulas e fontes; vale para o Painel da Gestão)
Divisão: **Comercial = resultado** (semana/mês, Gestão). **Operacional = execução** (dia a dia, Gestão, ADM e corretores). As métricas de plataforma (CTR, CPC, CPM, conversões da Meta/Google) ficam num painel de **Marketing**, fora destes dois.

**Regras de todo card:** o rótulo é a pergunta e a fórmula vai no tooltip; sempre há comparação (meta, média ou mês anterior); o período é explícito ("entrou no mês" ≠ "fechou no mês"); venda e locação separadas; amostra pequena mostra o n ("1 de 3"); ruído (`is_ruido`) e captação interna (`is_interno`) fora das contas comerciais.

| Painel | Card | Fórmula / fonte |
|---|---|---|
| Comercial | Leads válidos do mês | entradas no mês sem ruído/interno, venda × locação; comparação com a média dos 3 meses anteriores (meta quando existir) — `vw_atendimentos_base` |
| Comercial | Negócios fechados no mês | pela `data_encerramento` com situação "Negócio realizado", venda × locação |
| Comercial | Valor locado no mês | soma do `valor` das propostas de locação concluídas no mês — `propostas_locacao` (venda: sem valor no CRM ainda) |
| Comercial | Conversão lead → negócio (safra madura) | leads que entraram entre 60 e 425 dias atrás; 90% dos ganhos fecham em até 49 dias |
| Comercial | Funil com taxas de passagem | fase máxima atual (Lead→Qualificado→Visita→Proposta→Negócio), mesma safra madura. Aproximação: não há histórico de fases |
| Comercial | Ciclo de venda | mediana de dias entre entrada e ganho (ganhos dos últimos 12 meses) |
| Comercial | Resultado por canal | leads, % que chega à visita e negócios por canal (safra madura) |
| Comercial | Mídia paga pelo custo real | investimento Meta + Google ÷ leads de "Campanhas pagas" no CRM, por mês |
| Comercial | Pipeline em aberto | atendimentos ativos em Visita ou Proposta, por corretor |
| Operacional | Leads com atividade em até 1 dia | % dos leads dos últimos 30 dias com 1ª atividade em até 1 dia (sem atividade conta como fora do prazo); mediana no detalhe — `vw_tempo_resposta` (resolução em dias) |
| Operacional | Leads novos sem contato | ativos sem nenhuma atividade — `vw_tempo_resposta.tem_atividade` |
| Operacional | Leads abertos há 30+ dias | faixas de dias **desde a entrada** por corretor — `vw_aging_ativos` (o CRM não exporta a data da última interação) |
| Operacional | Cobertura de atividades | `vw_cobertura_atividades` |
| Operacional | Atividades vencidas e do dia | `atividades` não realizadas com início até hoje, por corretor |
| Operacional | Descartes por etapa | `vw_descartes` |
| Operacional | Esteira de locação | propostas por status, dias parada, links perto de expirar — `propostas_locacao` |
| Operacional | Saúde dos dados | última data em CRM, Meta, Google e atividades; alerta se passar de 2 dias |

**Lacunas conhecidas:** valor de venda (não existe no CRM); histórico de fases (só a fase atual); data da última interação; atribuição paga (mapa de canais e gclid pendentes). **Piso de histórico:** o CRM só tem negócios de leads que entraram a partir de 01/10/2025 (`INICIO_HISTORICO_CONFIAVEL` em `src/lib/paineis.js`); conversão compara o último semestre maduro (60–242 dias) com o anterior.

### 5.21 Ajuda: manual de uso dentro do Hub (pedido do Eduardo, 06/11)

O manual nasceu como documento no Claude (04/11) e o primeiro botão "Ajuda" abria esse link numa aba nova. O Eduardo vetou: o manual é **interno da Imovit** e mora no próprio Hub.

- RF34.1: página `/ajuda` com o manual completo (introdução, primeiro acesso, navegação, uma seção por nível, perguntas frequentes, suporte). Texto em `src/pages/Ajuda.jsx`; mudar o manual = editar esse arquivo.
- RF34.2: item **Ajuda** no fim do menu, para todos os níveis, inclusive "Sem nível". Abre na mesma aba.
- RF34.3: sumário no topo com atalho para cada seção; a seção do nível de quem lê ganha o selo "seu nível" (Sem nível → Primeiro acesso).
- Fora de escopo: busca no manual, edição pela tela, vídeos. Sem banco: é texto estático.

### 5.22 Blog: revisão dos posts no Hub (pedido do Eduardo, 09/11) — **APROVADO (09/11)** (plano Fase 28)

O motor do blog mora no projeto `newsletters-imovit` (`docs/blog-pautas.md`): o n8n pega a próxima pauta, escreve o post e grava um rascunho em `blog_posts`. Até aqui a aprovação era por **links no e-mail** (`aprovacao_blog`), que qualquer um com o link (ou um filtro de e-mail que abre links) podia acionar, com cópia no Google Docs para ler. Decisão de 09/11: **a revisão passa para o Hub**, com o login e a portaria que já existem. O Hub é só a mesa do editor; o motor continua fora.

- RF35.1: página **`/blog/revisar`** para `gestao` e `marketing` (`pode_editar_conteudo()`): lista os rascunhos (título, pauta, data) e abre o artigo **renderizado como no site**.
- RF35.2: botões **Aprovar** (vai para o site: `publicado`) e **Rejeitar** (`rejeitado`; a pauta volta para a fila e é **reescrita em até ~15 min**, não na segunda seguinte: robô que demora uma semana não serve), com campo opcional **"o que mudar"**, que vai junto para a IA quando a pauta voltar. Pede confirmação antes. A decisão grava quem decidiu e quando.
- RF35.3: **Home → "Para você hoje"** (RF20) ganha a pendência "N posts do blog para revisar" → `/blog/revisar`, para Gestão e Marketing. Sem rascunho, não aparece.
- RF35.4: aviso fora do Hub: o n8n manda **um e-mail curto, só para o Eduardo** ("1 post esperando revisão no Hub") com um link que **só abre o Hub**; nenhuma ação acontece pelo e-mail.
- Fora de escopo (v1): editar o texto pelo Hub (se precisar mudar, rejeita e a pauta volta), gerenciar a fila de pautas pela tela, métricas do blog.
- **Dados (Schema, a aplicar):** policy de leitura dos rascunhos em `blog_posts` para `pode_editar_conteudo()`; colunas `decidido_por` e `decidido_em`; função `blog_decidir(post_id, acao)` para usuário logado (substitui a versão por senha, que ainda não foi usada) e saem a coluna `token_aprovacao` e a senha do `blog_salvar_rascunho`.
- **Sai do caminho:** o fluxo n8n `aprovacao_blog` (com o disparo no Brevo) e a cópia no Google Docs.
- Decidido (09/11): o aviso vai só para o Eduardo; o campo "o que mudar" entra na v1.

## 6. Regras de negócio
- Só e-mails `@imovit.com.br` ganham perfil (`handle_new_user`). O locatário não tem perfil: acessa pelo e-mail da proposta.
- Ninguém muda o próprio nível ou e-mail (trigger `proteger_campos_perfil`). Só a Gestão decide pedidos de nível.
- Quem é suspenso perde o acesso na hora, mesmo com a sessão aberta. A última pessoa da Gestão ativa não pode ser suspensa nem excluída.
- O Corretor vê só as propostas com `criado_por` = ele. Não aprova, não descarta e não decide documento.
- Uma proposta por par (e-mail, imóvel). O link do portal expira (`link_expira_em`), e proposta expirada não avança.
- Reprovar um documento não manda e-mail na hora. O e-mail sai só quando o ADM usa "Solicitar ajustes".
- Soft-delete (`ativo = false`) na maioria das tabelas de conteúdo: dado "sumido" costuma ser isso.
- Lead frio no bot do WhatsApp: 60 dias sem atualização (decisão de 24/09).
- Os termos da proposta (valor negociado e **observações**) são registrados pelo gestor; o locatário só valida ou pede correção (v4, 28/09, §5.6). No banco: `valor_oferta` e `observacoes`. A abertura de cada esteira (locatário validou) notifica também `administrativo@` e `administrativo3@`.

## 7. Critérios de sucesso / aceite
- Cada papel, com login de verdade, vê exatamente o que a tabela da seção 2 diz, e nada a mais. Conferir no banco, não só na tela.
- Nenhuma tabela ou view com dado de negócio legível sem login.
- Os números de mídia do dashboard batem com o Gerenciador de Anúncios e com o Google Ads.
- Uma proposta real passa pela esteira inteira sem nenhum passo fora do Hub.

## 8. Riscos e perguntas em aberto
- [ ] ⚠ Supabase no plano Free, **sem backup**. Decisão consciente de adiar (22/09); rever antes de considerar o sistema em produção de verdade.
- [ ] "Finalizar processo" apaga os documentos sem confirmar que o `.zip` foi salvo.
- [ ] Views `vw_*` legíveis sem login; tabelas `repique_*` sem RLS.
- [ ] Checagem de IP nas chaves de API do Brevo: os e-mails da esteira podem voltar 401.
- [ ] ⚠ Quais indicadores a diretoria usa para dizer se o Hub está dando resultado?

### Perguntas em aberto da §5.8 (29/09)
- ~~P1 Agendamento~~ **decidido:** não é etapa do funil.
- **P2 Página Geral:** o Eduardo ainda não definiu; começar pela Comercial (29/09).
- ~~P3 Time~~ **decidido:** filtro descartado. No lugar, entra o filtro geral "equipe comercial ativa".
- ~~P4 Valor na mesa~~ **decidido:** vem das propostas feitas no Hub (venda `valor_proposta`, locação `valor_oferta`); fica completo quando todas as propostas passarem pelo sistema.
- ~~P5 Frequência~~ **decidido:** 1 vez por dia.
- ~~P6~~ **resolvido em 29/09:** Sandra corrigida para "comercial"; Gabriel Rosa (gestão comercial), Daniel (direção) e Giovana (recepção) ficam fora, como está. Registro do achado: com a regra ao pé da letra, ficam de fora corretores que atendem hoje:
  - Sandra Nobre (Locação, ativa, **equipe vazia** no CRM; 46 leads em 90 dias);
  - Gabriel Rosa (equipe "gestão comercial"; 11 em atendimento);
  - Daniel Aranovich (direção; 7 em atendimento).
  Proposta: corrigir o cadastro no CRM (equipe da Sandra = comercial) e decidir se "gestão comercial" entra. Giovana saiu, mas ainda consta ativa: inativar no CRM.
