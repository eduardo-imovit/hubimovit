# Handoff — Hub Imovit

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
