# Handoff — Hub Imovit

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
