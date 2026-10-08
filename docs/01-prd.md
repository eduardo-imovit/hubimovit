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
| RF19 | **Importar a escala de plantão (PDF) do mês**: o sistema lê a tabela (data, dia, manhã, tarde), casa os nomes com os corretores, mostra prévia e grava; a TV mostra o plantão da semana (§5.3) | gestao, marketing (import); todos (TV) | must | feito no localhost (24/09); falta push |
| RF20 | **Home por nível**: busca, atalhos, pendências com número que levam à tela certa, hoje no escritório, avisos e links (§5.4) | todos com perfil | must | feito (24/09), commitado; falta push |
| RF21 | **Proposta de venda (compra)**: corretor cria, proponente confirma e assina pelo portal `/venda`, a equipe recebe o PDF assinado; valores e condições ficam no banco para análise (§5.5) | corretor, adm, gestao; proponente | must | aprovado e publicado no banco/função em 28/09; frontend aguarda push (ver plano, Fase 9) |
| RF22 | **Esteira de locação v4**: gestor registra a proposta negociada (com observações); locatário valida ou pede correção; ao validar abre a esteira e avisa o ADM, sem aprovação interna (§5.6). Substitui partes de RF10–RF12 | corretor; locatário; adm | must | aprovado e implementado (28/09) |
| RF23 | **Formulários no Hub** (§5.7): 1ª entrega Captação (link público por corretor, assinatura, PDF, lista) e Feedback de visita (PDF); depois apresentações públicas, Avaliação, Guia e Relatório | corretor, adm, gestao; proprietário | must | 1ª entrega no ar (28/09) |
| RF24 | **Dados confiáveis e dashboards v2** (§5.8): histórico acumulado do funil no banco, páginas Comercial, Performance e Geral com todos os filtros respeitados e só a equipe comercial ativa, Kanban com código e filtro por etapa | gestao, marketing | must | Comercial v1 no localhost (29/09); histórico (S1–S2) aguarda o Pro |
| RF25 | **Campanha "Km 32" na Home** (§5.9): trilha do 4º tri 2026 com valor realizado, volume e ticket médio por finalidade, a partir dos negócios realizados no CRM desde 06/10/2026, contra metas guardadas numa tabela de campanha | todos com nível | must | **no ar (06/10)** |
| RF26 | **Adm locação** (§5.13): painel da carteira de contratos administrados pela ótica do gestor (administração recebida, crescimento, bairros e tipos, saídas e motivos, reajustes, inadimplência e atenção, proteção, proprietários), lido do Imoview | gestao | must | **no ar para a Gestão (07/10)** |
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
     - Mesmos campos e textos do Tally: contato (nome, e-mail, telefone, CPF); natureza (tipo, finalidade venda/locação/ambos, exclusividade + período 30/90/180 dias/1 ano); endereço (rua, número, bairro, CEP, apto/sala, bloco, quadra); valores (locação, venda, condomínio, IPTU mensal); atributos (área interna, área do terreno, quartos, suítes, banheiros, salas, vagas, tipo de vaga); lazer (16 opções) e observações; **declaração de ciência com honorários** (locação: 1º aluguel; administração: 8% do aluguel bruto; venda: 6%) e **assinatura desenhada**.
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
| Volume de negócios | quantidade de negócios da campanha |
| Ticket médio | valor realizado ÷ volume (“—” com 0 negócios) |
| Avanço na trilha | valor realizado ÷ meta de valor, convertido em Km (32 + 10 × fração), limitado ao Km 42 |
| Ritmo | avanço da meta − fração do calendário já passada, em pontos ("5 pontos à frente/atrás do calendário") |

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
- RF25.3: valor realizado, volume e ticket médio por finalidade, com a mesma regra de contagem em todos.
- RF25.4: cada número mostra de onde veio (subtexto) e a data da última informação do CRM. Se a fonte estiver atrasada mais de 1 dia, aparece um aviso.
- RF25.5: se um negócio não tiver valor no CRM, ele conta no volume, fica fora do valor e do ticket, e a tela informa quantos estão nessa situação ("2 negócios sem valor no CRM").
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

### 5.12 Jornada do lead: tempos, perdas e motivos (pedido do Eduardo, 07/10) — **PROPOSTA, aguardando aprovação**
**Objetivo.** Ver quanto tempo o lead leva em cada etapa, onde ele se perde e por quê. A fonte é a jornada diária (`crm_atendimento_jornada`, fluxo `crm_jornada_diaria v3`, rodando desde 06/10).

**Onde (revisto em 07/10, depois do feedback "fugiu do design kit").** Não vira um gráfico novo. A jornada completa dois capítulos que já existem na página Comercial, com os mesmos componentes:
- **Capítulo 1 (funil):** a coluna "tempo na etapa", hoje reservada com "—", passa a mostrar a mediana em dias ("acum." com menos de 5 passagens). Embaixo, dois cartões `.pg-mesa-card`: tempo até o negócio e parados há N+ dias.
- **Capítulo 3 ("Onde o lead se perde e por quê?"):** descartes pelas 7 etapas (`.pg-hbarras`, a maior em coral) + motivos de todas as etapas + motivos da etapa clicada. O simulador de ganho continua.

Segue todos os filtros da página (período, finalidade, mídia, corretor) e o filtro geral; o corretor vê só a dele em "Meus números". Maquete: https://claude.ai/artifact/LWATNn1x2NedBQd3uYwgX8 (v2, CSS real do Hub).

**O gráfico.** As 7 etapas em linha (Pré-atendimento → Seleção de perfil → Seleção de imóveis → Lead qualificado → Visita → Proposta → Negócio). Em cada etapa:
- **Tempo mediano na etapa** (dias), com o n ao lado. Tempo na etapa = data em que saiu − data em que entrou, contando só passagens com as duas pontas observadas pela jornada;
- **Passaram:** quantos leads entraram na etapa no período;
- **Perdas na etapa:** quantos foram descartados estando nela, com os **3 principais motivos**.

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
