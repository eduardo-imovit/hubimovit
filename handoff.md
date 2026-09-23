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
- Edge Function **não foi checada com Deno** (não instalado aqui) e **não foi deployada**. A produção continua com a versão anterior.
- Commitado em `792b801` (main, 1 à frente do `origin`). **Push pendente**, feito pelo Eduardo no VS Code.
- Prévia dos 9 e-mails gerada com dados de exemplo e aberta para o Eduardo aprovar. O arquivo fica na pasta temporária da sessão, fora do repo.
- Não testado ao vivo: o botão "Solicitar ajustes" e o e-mail consolidado.

### Decisões e contexto
- Reprovação parcial (locatário ainda não mandou tudo) não gera e-mail: o aviso no portal basta. O e-mail só sai quando o ADM fecha a revisão com "Solicitar ajustes". Decisão do Eduardo em 23/09.
- Segui o template de e-mail do Obsidian como está (coral `#ff5e4d`, preto `#000`), não os tokens do Design System (`#E8593C`, `#2D2D2D`). A nota registra essa divergência como não decidida.
- A regra do "Solicitar ajustes" espelha o trigger `recalcular_status_proposta`. O status sozinho não serve, porque qualquer reprovação já volta a proposta para `aguardando_docs`.
- Não há registro em `status_historico` quando o ADM solicita ajustes. O schema dessa tabela não está nas migrations do repo.

### Pendências / próximos passos
- [x] Eduardo aprovou o visual e o texto dos e-mails (2026-09-23)
- [ ] Push do `792b801` (Eduardo, VS Code)
- [ ] **Só depois do push e do deploy da Vercel:** `supabase functions deploy esteira-locacao`. Invertendo a ordem, reprovar documento deixa de avisar o locatário e o botão ainda não existe no painel.
- [ ] Testar do início ao fim: reprovar 2 docs → "Solicitar ajustes" → conferir o e-mail único
- [ ] Seguir o sprint: teste completo com os campos novos, IP das chaves de API no Brevo, dashboard, dados (registro órfão de 21/08, proposta de teste que vence em 25/09), fluxos antigos no n8n

### Como retomar
- `npm run dev` (precisa de `.env` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
- Painel do ADM: `/admin/esteiras`. Portal do locatário: `/portal/entrar`.
- Acompanhamento do sprint no Obsidian: "🟡 Esteira de Locação - Validação do Fluxo".
