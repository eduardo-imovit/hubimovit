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
