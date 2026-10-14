# Handoff — Hub Imovit

## Sprint 2026-10-14 (d) — Central de Cadastros + piloto Locador PJ (Fase 21)

**Objetivo (Eduardo):** trazer os demais Google Forms de cadastro para o Hub sem lotar o menu (1 página + 1 tabela + 1 função + 1 lista), começando pelo Locador PJ; importar o histórico das 2 planilhas para a mesma lista. "Pode construir" em 14/10.

### Feito
- **Docs (Fase 21, proposta→aprovada):** PRD RF30 + §5.17 (`docs/01-prd.md`), Schema §2.14 (`docs/05-backend-schema.md`), Plano Fase 21 (`docs/06-implementation-plan.md`), rotas no App Flow (`docs/03-app-flow.md`). TRD/DS sem mudança (mesmos padrões e CSS).
- **Banco (NÃO aplicado):** `supabase/migrations/20261014000000_cadastros_central.sql` — tabela `cadastros` (`tipo` check nos 6, `pessoa/acompanhante/financeiro/imovel` jsonb, `destino`, `origem hub|planilha`, `email_ok`), RLS só `is_adm_ou_gestao()`, e cópia das linhas de `cadastros_locador` como `locador-pf` (bloco DO tolera a tabela antiga não existir).
- **Função (NÃO deployada):** `supabase/functions/cadastro-locador/index.ts` — parâmetro `tipo` (sem ele = locador-pf, compatível com o front publicado), schemas PJ (empresa/sócio/banco com CPF-ou-CNPJ/imóvel com IPTU-CPFL-Sanasa-gás), destino por tipo, grava em `cadastros`.
- **Front (NÃO commitado):**
  - `src/lib/cadastros.js` (TIPOS com `habilitado`, links, `enviarCadastro`); `src/components/cadastro/BlocosCadastro.jsx` (Moldura/Campo/Linha/Opcoes/BlocoEndereco + validadores).
  - `src/pages/publico/CadastroLocadorPJ.jsx` + `/cadastro/locador-pj`; `src/pages/publico/Cadastros.jsx` + `/cadastros` (seletor, tipos futuros como "Em breve").
  - `CadastroLocador.jsx` intacto, só troca a lib e manda `tipo: locador-pf`; `/cadastro-locador` redireciona.
  - `src/pages/admin/Cadastros.jsx` + `/admin/cadastros` (filtro por tipo, coluna origem Hub/Planilha; rota antiga redireciona); menu Propostas vira "Cadastros" (`propostasNav.js`).
  - `src/pages/CadastrosLinks.jsx` + `/ferramentas/cadastros` (links copiáveis; corretor vê só isso, sem a lista) + item no dropdown Ferramentas (`Navbar.jsx`).
  - Removidos: `src/lib/cadastroLocador.js`, `src/pages/admin/CadastrosLocador.jsx` (zero refs restantes).
- **Importe do histórico (script pronto, NÃO rodado):** `scripts/importar_cadastros_planilha.mjs` — CSV → `cadastros` com `origem='planilha'`, `email_ok=true`, sem reenviar e-mail; separador `,`/`;` autodetectado; colunas fora do mapa vão para `pessoa.extra_*` (nada se perde); destino de locatário marcado "a confirmar".

### Estado atual
- `npm run build` ok (só warnings de chunk que já existiam); `node --check` ok no script e na lib.
- **Nada publicado nem testado ao vivo:** migration não aplicada, função não deployada, sem commit/push, nenhuma tela aberta (nem localhost com banco real). Ordem: aplicar migration (transação de teste antes) → deploy `cadastro-locador` (mesmo nome, secrets já existem) → push `main` → teste ponta a ponta Locador PJ.
- Faltam os links da pág. 2 do Locatário PF e do Locatário PJ + destinos de e-mail dos locatários (pendentes do Eduardo desde a §5.17).

### Decisões e contexto
- Form PF mantido quase intacto de propósito (só 3 linhas): é o que já funciona; o BlocoEndereco novo serve ao PJ e aos próximos tipos.
- Tabela antiga `cadastros_locador` preservada, sem escrita nova; a lista nova lê só `cadastros` (inclui as linhas migradas).
- As 2 planilhas do Google pediram login (401 no export direto) — o import depende do Eduardo exportar em CSV.

### Pendências / próximos passos
- [ ] Eduardo: aplicar migration + deploy da função + push `main`
- [ ] Teste ao vivo: preencher `/cadastro/locador-pj`, conferir tabela, lista/filtro e os 2 e-mails (equipe + cópia)
- [ ] Conferir redirects: `/cadastro-locador` e `/admin/cadastros-locador` antigos
- [ ] Eduardo: exportar as 2 planilhas em CSV e rodar o script (ver cabeçalho do script); conferir contagem × lista
- [ ] Eduardo: mandar links faltantes (Locatário PF pág. 2, Locatário PJ) + e-mails de destino dos locatários
- [ ] Depois: habilitar fiador-pf → fiadora-pj → locatários (só estender TIPOS + schema do tipo)

### Como retomar
- `npm run dev` → `/cadastros`, `/cadastro/locador-pj`, `/admin/cadastros`, `/ferramentas/cadastros`.
- Importe: `setx` nada — `$env:SUPABASE_URL` + `$env:SUPABASE_SERVICE_ROLE_KEY` na sessão e `node scripts/importar_cadastros_planilha.mjs locador-pf respostas.csv`.

## Sprint 2026-10-14 (c) — Distratos em produção, só Gestão

- **Fechamento (14/10):** os 3 distratos de teste foram apagados e a tabela está vazia. Docs commitados em `c43abcf`, junto com os da Central de Cadastros (mesmos arquivos). ⚠ As "2 planilhas" que o Eduardo mandou provavelmente são o histórico dos **cadastros** (PRD §5.17, RF30.6) e não de distratos. Confirmar com ele antes de importar.

- **Ajuste (commit `6886b8e`, no ar):** a lista usava a classe `hub-table`, que não existe no CSS, e por isso aparecia sem estilo. Trocada por `data-table` (padrão de Propostas), sem o card em volta. Colunas agrupadas: aviso + fim dos 30 dias; entrega + "antes dos 30 dias"; imóvel cortado com reticências. A `teste` recebeu o merge `2546de9`.

### Feito
- Decisão do Eduardo: só a Gestão vê, por enquanto.
  - Migration `20261014130000_distratos_so_gestao` aplicada: policy "gestao le" e RPC com `is_gestao()`.
  - Função `distrato` v2: `exigirEquipe` aceita só `gestao`.
  - `ACESSO.distratos = ['gestao']`. A página do menu ganhou `acesso` próprio, filtrado por `paginasVisiveis()` (`propostasNav.js`) em Navbar, SubnavPropostas e PropostasInicio.
  - Testado em transação desfeita: gestão 3/20, adm 0/0.
- **Produção:** commit `4c64908` em worktree limpa, só com os arquivos do Distratos. Push em `main` (Vercel success); `teste` recebeu o merge `1f50f31`. Conferido: `hub.imovit.com.br/distrato/...` dá 200 e o bundle tem a RPC.
- Checkout principal: `main` movida para `4c64908` com `git update-ref` e índice resetado. O working tree continua com as mudanças **não commitadas** da outra sessão (Central de cadastros, Km 32), intactas; build ok.
- Push precisa da credencial `eduardo-imovit` (ver a memória do push).

### Estado atual
- No ar para a Gestão. **As telas não foram abertas no navegador** (nem localhost nem produção).
- Docs (PRD/Flow/Schema/Plano) atualizados, mas **não commitados**: o mesmo arquivo tem mudanças da outra sessão.
- Os 3 distratos de teste continuam no banco (`token like 'teste0distrato%'`).

### Pendências / próximos passos
- [ ] Importar as 2 planilhas: o Eduardo vai baixar (CSV/XLSX em Downloads) → mapear colunas → inserir com `origem = 'planilha'` e `respostas_originais`.
- [ ] Eduardo conferir `/admin/distratos` logado como gestão; depois apagar os testes.
- [ ] Commitar os docs junto com a Central de cadastros.

## Sprint 2026-10-14 (b) — Distratos: construído (Fase 20, S1–S4)

**Objetivo:** construir o RF29 aprovado e trazer os distratos antigos das 2 planilhas do Google.

### Feito
- **Banco (APLICADO, MCP):** `supabase/migrations/20261014120000_distratos.sql` com a tabela `distratos` (`origem` hub|planilha, `respostas_originais`), a RLS de leitura só para gestão/adm, anon e escrita direta revogados, e a RPC `contratos_para_distrato` (security definer, só ativos, até 20). Testado em transação desfeita: gestão lê 1 linha e a RPC devolve 20; corretor 0/0; anon negado.
- **Função `distrato` v1 (publicada, verify_jwt):** eventos `criar`, `enviar_link`, `cancelar` (gestão/adm), `abrir` e `enviar` (token). Testada por curl como anon:
  - `criar` sem login dá 401;
  - pede o "com quem", pede a confirmação da multa antes de 30 dias, aceita o envio e bloqueia o 2º envio (409);
  - `email_ok` ficou true (e-mail para administrativo@ + comprovante para eduardo@).
- **Front (só no localhost, sem commit):**
  - `src/lib/distrato.js` (textos do procedimento, motivos, NPS);
  - `src/pages/publico/DistratoPublico.jsx` (`/distrato/:token`: 3 passos + comprovante);
  - `src/pages/admin/Distratos.jsx` (`/admin/distratos`: resumo, filtros, novo distrato, detalhe, cancelar, copiar motivo);
  - rotas em `src/App.jsx` e aba em `src/lib/propostasNav.js`.
- `npm run build` ok; oxlint sem aviso nos arquivos novos.

### Estado atual
- **As telas não foram vistas no navegador:** só build e testes da função por curl.
- **Sem push.** Outra sessão está trabalhando ao mesmo tempo no mesmo repo ("Central de cadastros": `/admin/cadastros`, `/cadastros`, PJ, migration `20261014000000_cadastros_central.sql`, função `cadastro-locador` alterada). `App.jsx` e `propostasNav.js` misturam as duas mudanças: commitar só um lado quebra a build (importa arquivos não versionados). Fazer o push junto com a Central ou separar os hunks com cuidado.
- No banco ficaram 3 distratos de teste (token `teste0distrato…`, nome "TESTE Hub … (ignorar)"), para conferir a lista. Apagar depois: `delete from distratos where token like 'teste0distrato%';`
- O e-mail de teste "Aviso de desocupação: TESTE Hub…" chegou em administrativo@ (3×).

### Decisões e contexto
- Planilhas antigas: o conector do Google Drive respondeu "not found" para os 2 IDs. Provavelmente estão em outra conta. O Eduardo recusou abrir pelo Chrome.
- Achado: a função `cadastro-locador` **não está publicada** no Supabase (a lista de funções não tem). Conferir com a sessão da Central de cadastros.
- curl no Git Bash corrompe acentos no corpo: testar com JSON gerado em arquivo (`ensure_ascii`).

### Pendências / próximos passos
- [ ] Importar as 2 planilhas (precisa de acesso: compartilhar com a conta do conector ou baixar em CSV/XLSX).
- [ ] Ver as telas no localhost (`npm run dev` → `/admin/distratos` e `/distrato/teste0distrato0hub0000000000000000000001`) e apagar os testes.
- [ ] Push `main` + `main:teste` junto com a Central de cadastros.

### Como retomar
- `npm run dev`; logar como gestão/adm; Propostas ▸ Locação ▸ Distratos.

## Sprint 2026-10-14 — Distratos: PRD e plano (sem código)

**Objetivo (Eduardo):** tratar os distratos no Hub. O locatário recebe o procedimento de desocupação (PDF "PROCEDIMENTO DESOCUPAÇÃO", de Downloads), um formulário com o motivo e uma pesquisa de satisfação.

### Feito
- Documentação da feature (framework docs-first), **sem código e sem banco**:
  - PRD §5.16 + RF29;
  - App Flow (Distratos);
  - Schema §2.13 (tabela `distratos`, RPC `contratos_para_distrato`, Edge Function `distrato`);
  - Plano Fase 20 (S0–S4) + registro de mudanças.
- Decisões do Eduardo (14/10):
  - o link é por contrato, gerado pelo ADM;
  - o envio do formulário é o aviso oficial e substitui o e-mail para `administrativo@`;
  - a 1ª entrega é só registro + lista, sem as etapas de vistoria, chaves e documentos.

### Estado atual
- Só os docs mudaram. Nada foi aplicado no banco, nenhuma função foi publicada e nada foi commitado.
- O working tree já tinha alterações do sprint de 13/10, não commitadas e que não foram mexidas: `TrilhaKm32.jsx`, `hub.css`, PRD/DS.

### Decisões e contexto
- A lista de motivos usa os mesmos nomes do `motivo_rescisao` do Imoview, consultados na carteira em 14/10.
- "Valor do aluguel": 489 rescisões, a última em 01/2025. Parece um valor padrão antigo, não um motivo real.
- O ADM não lê `contratos_locacao` (RLS só `is_gestao()`). Por isso, a busca de contrato é feita por uma RPC `security definer` com campos mínimos.

### Pendências / próximos passos
- [x] P1–P3 respondidas (14/10): o e-mail vai só a `administrativo@`; o proprietário não recebe; o texto do procedimento pode ser adaptado. "Com quem?" (Imovit/outra/direto) entra em alugou/comprou.
- [x] "Pode começar" do Eduardo para a Fase 20 (14/10).
- [ ] Fase 20, S1–S4, depois da aprovação.

### Como retomar
- Ler o PRD §5.16 e o Plano Fase 20. O padrão de código a copiar está em `cadastro-locador` (função + `CadastroLocador`/`CaptacaoPublica`).

## Sprint 2026-10-13 (b) — Trilha Km 32: volta ao total, "esperado até hoje" e "em proposta"

**Objetivo (Eduardo):** depois da reunião, voltar a trilha para a meta total do trimestre (com paradas por mês); quadros = valor/% da meta, ticket, "no dia X era esperado Y e estamos com Z", e o valor das propostas "verdes" (atualizadas) do CRM. Tirar o "1 de 4 vendas".

### Feito
- **Banco, já em produção:** campanha `km32-4tri-2026` de volta ao trimestral (fim 31/12; Venda R$ 28 MM / 14; Aluguel R$ 160 mil / 18), conferido relendo as tabelas. Isso resolve a pendência "voltar ao trimestral" da entrada de cima.
- **Migration aplicada** `20261013120000_campanha_resumo_em_proposta` (MCP): `campanha_resumo()` ganha `em_proposta` e `propostas` por finalidade. Regra do "verde" (escolha do Eduardo): fase Proposta (`fase_crm = 5`), em atendimento, última interação nos últimos **30 dias** contando hoje (começou com 15; o Eduardo trocou para 30 → migration `20261013130000_campanha_resumo_proposta_30_dias`, aplicada); por imóvel, a negociação mais recente e só "Em análise". Os campos são aditivos, então o front em produção não quebra.
- **Front (commit `8b1ef50`, push `main` → Vercel success; `teste` recebeu o merge `3cd0c72`):** `src/components/home/TrilhaKm32.jsx`: sai o quadro de volume; o de ritmo virou "R$ esperado · esperado até 13/10 · estamos com R$ Y" (Y em coral se abaixo); entra "R$ em proposta · N ativas (30 dias)". O CSS fica em `src/styles/hub.css` (`.km32-l strong`).
- **Docs:** PRD §5.9 (tabela de números + ajuste de 13/10, RF25.3/25.5), App Flow, Design System, Schema §2.8 e Plano Fase 13.

### Estado atual
- `npm run build` ok. A função publicada foi testada como Gestão, numa transação desfeita: Venda: realizado R$ 3,9 MM, em proposta R$ 12,1 MM (4) com 30 dias; Aluguel: realizado R$ 13,5 mil, em proposta R$ 3,7 mil (1).
- **Publicado em 13/10** (deploy de produção da Vercel com status success). **A tela não foi aberta** em produção nem no localhost: falta o Eduardo conferir.

### Decisões e contexto
- A tabela `crm_funil_etapas` citada no Schema não existe no banco; o 5 = Proposta ficou fixo na função.
- O CRM não manda a cor "verde"; o critério de 30 dias é uma aproximação acordada. Para mudar o corte, basta trocar o `30` na função.
- Uma janela `>= hoje − 15` incluía 16 dias (pegava 28/09 e +R$ 9,5 MM); ficou `> hoje − 15`.

### Ajuste 13/10 (c) — urgência (commit `7e62777`, `teste` em `a295714`)
- O Eduardo: "estamos com 3,9 e o esperado era 2,6, mas pode virar nos próximos dias; a ideia é dar urgência". O quadro "esperado até hoje" virou **próxima parada**: "R$ 4,5 MM faltam para a parada de 31/10 (R$ 8,4 MM) · 19 dias · R$ 234,4 mil por dia" (coral se abaixo do esperado; esperado no `title`; "Meta batida" se passar da meta total).
- `moeda()` da venda mostra em mil abaixo de R$ 1 MM (senão o "por dia" virava "R$ 0,2 MM").
- Depois: o "faltam" fica **sempre em coral** (`.km32-n.is-falta`); abaixo do esperado, a legenda ganha "· abaixo do esperado" (texto, não só cor).
- Build ok. **Visto em produção em 13/10** (Chrome, Gestão), nas abas Venda e Locação; o Eduardo aprovou. Detalhe: "(R$ 8,4 MM)" quebra linha no quadro da parada (deixado assim).

### Pendências / próximos passos
- [ ] Conferir a trilha no celular.
- [ ] A `teste` só aceita merge (não fast-forward): usar `git merge main` na `teste`, como em `3cd0c72`.
- [ ] Conferir com o Imoview se as propostas "em análise" de 30 dias batem com as verdes de lá.

### Como retomar
- `npm run dev` → Home (logado com nível que vê a campanha).

## ▶ 2026-10-13 — Trilha Km 32 com meta MENSAL (temporário, para a reunião)

**Objetivo:** pedido do Eduardo: mostrar na Home a meta de outubro em vez da do trimestre, só para a reunião. Depois volta ao trimestral.

### Feito
- **Banco (Imovit Database `vlsrmtryzwddqkwqugfr`), sem deploy:** campanha `km32-4tri-2026` (id 1) alterada direto nas tabelas. Meta **proporcional aos dias** (opção escolhida pelo Eduardo): outubro = 26 dos 87 dias da campanha = 29,9%. Início mantido em 06/10.
  | | Antes (trimestral) | Agora (outubro) |
  |---|---|---|
  | `campanhas.nome` | Km 32 · Campanha 4º Tri 2026 | Meta de outubro · Km 32 |
  | `campanhas.fim` | 2026-12-31 | 2026-10-31 |
  | Venda | R$ 28.000.000 · 14 negócios | R$ 8.367.816 · 4 negócios |
  | Aluguel | R$ 160.000 · 18 negócios | R$ 47.816 · 5 negócios |
- **Código (commit `1355810`, em produção pela Vercel):** em `TrilhaKm32.jsx`, o quadro de ritmo trocou "+X pts" pela diferença **em reais** entre o realizado e o esperado até hoje (meta × fração do calendário): "+R$ 1,3 MM · acima do esperado até hoje" / "−R$ 1,2 mil · abaixo…" (vermelho). Diferença menor que 1% da meta = "no ritmo do esperado até hoje". O esperado aparece no `title` do texto.
- A contagem continua igual: só negócios com interação "NEGÓCIO REALIZADO" dentro do período (06/10–31/10).

### Estado atual
- Conferido: tabelas relidas depois do update; build ok; deploy de produção da Vercel com sucesso. **A tela não foi aberta em produção** (o Eduardo vai conferir). `campanha_resumo` não roda pelo SQL do conector (exige usuário logado).
- Números em 13/10: Venda 1 negócio (atendimento 6008, 12/10, R$ 3.915.000); Aluguel 1 negócio (6294, 08/10, R$ 13.500).

### Pendências
- [ ] **"Tira o 1 de vendas"** — sem resposta: (a) esconder o quadro "1 de 4 vendas" ou (b) tirar o negócio 6008 da conta?
- [ ] **Voltar ao trimestral depois da reunião:**
  ```sql
  begin;
  update campanhas set nome = 'Km 32 · Campanha 4º Tri 2026', fim = date '2026-12-31' where slug = 'km32-4tri-2026';
  update campanha_metas set meta_valor = 28000000, meta_negocios = 14 where campanha_id = 1 and finalidade = 'Venda';
  update campanha_metas set meta_valor = 160000,   meta_negocios = 18 where campanha_id = 1 and finalidade = 'Aluguel';
  commit;
  ```
- [ ] Decidir se o ritmo em reais fica de vez ou volta para pontos (reverter `1355810`) junto com o trimestral.
- [ ] PRD §5.9 ainda descreve o ritmo em pontos: atualizar se o valor em reais ficar.

## Sprint 2026-10-09 (b) — Base de imóveis no Supabase + planilha de duplicados

**Objetivo (Eduardo):** planilha com todos os imóveis duplicados para o time, a partir de uma base completa de imóveis no Supabase alimentada pelo n8n ("vou precisar dessa base mesmo").

### Feito
- Docs revistos (Fase 18): TRD (carga direto pelo n8n, sem Edge Function), Schema §2.11 (endereço + `endereco_chave`, `estoque_cargas`, `vw_estoque_duplicados`), Plano (S2 antes, S2b planilha).
- Tentativas descartadas:
  - Edge Function temporária `tmp-estoque-enderecos` usando o secret `IMOVIEW_API_KEY`: o deploy foi bloqueado pelo controle de permissões do Claude Code. **Ela não existe no Supabase.**
  - Script local (`scratchpad/dup/ler_enderecos.py`): precisaria da chave, que o Eduardo não tem à mão.

- **S1 aplicado (aprovado pelo Eduardo em 09/10):** migration `supabase/migrations/20261009120000_estoque_imoveis.sql`.
  - Tabelas `imoveis_estoque` (com endereço e `endereco_chave`) e `estoque_cargas`.
  - RPC `carregar_estoque_imoveis` (só service_role) e views `vw_estoque_imoveis`, `vw_estoque_captacoes_mensal` e `vw_estoque_duplicados`.
  - Testada antes, numa transação desfeita: endereço escrito de outro jeito caiu no mesmo grupo, unidade diferente ficou fora, imóvel sem número ficou fora, proprietário não foi gravado, leitura incompleta foi recusada. O teste achou e corrigiu o fuso das datas.
  - Permissões: anon nada; authenticated lê só se `is_gestao()`; a carga só pela service_role.
- **S2 criado DESLIGADO:** n8n `estoque_imoveis_diario` (`1hNdOFqnmJTwpVXi`), 5h30, 11 nós. Lê locação e venda (cadastro inteiro + publicados), enxuga num nó Code e grava pela RPC.

- **1ª execução (09/10) parou no "Locação: conferir e enxugar":** 4.459 lidos × 4.450 informados pela API. A trava exigia igualdade. Agora ela só recusa leitura **menor**: RPC corrigida (migration `20261009130000_estoque_carga_aceita_leitura_maior`) e, nos 2 nós Code, `!==` virou `<` (o Eduardo cola no editor).

- **2ª execução (09/10) DERRUBOU O SUPABASE:** o "Locação: gravar no Supabase" mandou ~4.450 imóveis numa chamada só e o banco do plano Free travou.
  - O Hub e a TV ficaram fora do ar de ~14h20 até o restart que o Eduardo fez pelo painel, ~14h50 (Brasília).
  - A gravação foi desfeita inteira; não ficou lixo.
  - Correção: carga em **lotes de 250** (migration `20261009140000_estoque_carga_em_lotes`). A RPC ganhou `iniciada_em` e `finalizar` e recusa lote > 500. Só o último lote confere o total, com folga de 10 min de relógio, e registra a carga. Testada em transação desfeita.
  - No n8n, o Eduardo cola o código novo nos 2 nós "conferir e enxugar" e, nos 2 "gravar", muda o JSON body e liga Batching 1 item / 300 ms.
- **Lição:** nada de chamada única com milhares de linhas JSON no plano Free. Lote sempre.

### Estado atual
- Banco no ar e vazio. O fluxo existe, mas **nunca rodou**: faltam as credenciais (o Eduardo liga).
- **Não verificado:** os nomes dos campos de endereço na resposta da API. A RPC tenta `endereco`/`logradouro`, `numero`, `complemento`, `bloco`, `nomecondominio`… Se vierem com outro nome, o `payload` guardado permite corrigir com um `update`, sem reler.
- **Risco:** memória do n8n com ~560 páginas cruas numa execução. Se estourar, dividir por lotes.
- A base de 08/10 (`estoque.json`, sem endereço) só existe na pasta temporária da sessão de 08/10.

### Pendências / próximos passos
- [ ] Eduardo: ligar as credenciais nos 6 nós HTTP (Imoview Header Auth do `carteira_locacao_diaria`; Supabase da jornada) e rodar manualmente uma vez.
- [ ] Conferir `estoque_cargas` (locação ≈ 4.443, venda ≈ 6.741), a saída `campos` do nó "conferir e enxugar" e se `endereco_chave` veio preenchida.
- [ ] S2b: planilha `.xlsx` a partir de `vw_estoque_duplicados` (aba de grupos + aba de resumo por bairro/captador).
- [ ] Depois de conferido: ativar o fluxo (5h30).

## Sprint 2026-10-09 — Cadastro Locador PF no Hub + Propostas em produção (só gestão/adm)

**Objetivo (Eduardo):** tirar o Google Form "Cadastro Locador(a) PF" do Google e pôr no Hub (link fixo público); resposta vai para `administrativo3@imovit.com.br` e fica no Supabase; lista junto das Propostas; Propostas em produção só para gestão/adm.

### Feito
- **Docs magros:** PRD §5.15 + RF28, Schema §2.12 (`cadastros_locador`), Plano Fase 19.
- **Banco (NÃO aplicado):** `supabase/migrations/20261009000000_cadastros_locador.sql` — tabela (`email`, `locador/conjuge/banco/imovel` jsonb, `email_ok`), RLS (só `is_adm_ou_gestao()` lê; anon nada; escrita só via service_role).
- **Função (NÃO deployada):** `supabase/functions/cadastro-locador/index.ts` — evento `enviar` (zod + honeypot), insere, Brevo para `administrativo3@` + cópia ao locador, marca `email_ok`. Mesmo padrão da `captacao`.
- **Front:**
  - `src/pages/publico/CadastroLocador.jsx` + `src/lib/cadastroLocador.js` — rota pública `/cadastro-locador`, página única com os 5 blocos e as mesmas obrigatoriedades do Google Form; documentos seguem por e-mail (sem upload).
  - `src/pages/admin/CadastrosLocador.jsx` — lista em `/admin/cadastros-locador` (aba nova na área Locação) + botão "copiar link do cadastro".
  - `src/lib/acessos.js` — `PROPOSTAS_ATIVAS = true`; `esteira/vendas/propostas` = gestão+adm (corretor sai até liberação futura). Portal e captação intocados.
  - `homeNiveis.js` (atalhos do corretor limpos + busca), `usePendenciasHome.js` (corretor sem pendências de proposta), `propostasNav.js` (aba), `App.jsx` (2 rotas).

### Estado atual
- `npm run build` ok (só warnings de chunk que já existiam).
- **NÃO publicado:** migration não aplicada, função não deployada, sem commit nem push. Nada testado ao vivo (nem localhost com banco real).
- Ordem: aplicar migration (transação de teste antes) → deploy `cadastro-locador` (MCP, secrets já existem: `BREVO_API_KEY`, `APP_URL`) → push `main` → teste ponta a ponta.

### Decisões e contexto
- Link fixo aberto, sem token (decisão do Eduardo): se gerar ruído, vira token por corretor/imóvel depois.
- CPF fica dentro do jsonb (padrão da carteira); sem upload de documentos nesta versão (RF28.5).
- E-mail com checagem de IP do Brevo ainda pendente (handoff 06/10) — pode segurar o envio até liberar.

### Pendências / próximos passos
- [ ] Aplicar migration + deploy da função + push `main`
- [ ] Teste ao vivo: preencher `/cadastro-locador`, conferir tabela, lista e os 2 e-mails
- [ ] Conferir como corretor: Propostas some do menu/busca/atalhos
- [ ] Depois: upload de documentos, corretor nas Propostas, token se precisar

### Como retomar
- `npm run dev` → `/cadastro-locador` (público) e `/admin/cadastros-locador` (gestão/adm).

## Sprint 2026-10-09 — Captação: declaração de ciência por finalidade + vistoria

**Objetivo (Eduardo):** os termos de ciência da captação devem mostrar só as condições da finalidade escolhida; incluir o custo da vistoria como sendo do locatário.

### Feito
- `supabase/functions/captacao/index.ts`: `DECLARACAO` fixo virou `declaracaoPara(finalidade)`.
  - Venda → abertura + 6%.
  - Locação → abertura + 1º aluguel + adm 8% + **vistoria (nova): custo do locatário**.
  - Ambos → tudo.
  - `formulario` devolve `declaracoes` (as 3) + `declaracao` (Ambos, para a página antiga em cache). O `enviar` grava o texto da finalidade enviada.
  - A cláusula de venda ganhou o rótulo "- Intermediação de Venda:", no padrão das outras.
- `src/pages/publico/CaptacaoPublica.jsx`: a etapa da assinatura mostra `config.declaracoes[form.finalidade]`.
- Docs: PRD §5.7 (RF23) e Schema (`captacoes.declaracao`).

### Estado atual
- `npm run build` ok. Os 3 textos foram conferidos rodando a função de montagem no node. O `npm run lint` não roda: falta o binário nativo do oxlint no `node_modules`, problema do ambiente e não do código.
- **Produção intacta:** a `captacao` continua na v4, e não há commit nem push.
- **Cópia de teste no ar:** função `captacao-v2`, mesmo código e mesmo banco.
  - `src/lib/captacao.js` aceita `VITE_FUNCAO_CAPTACAO`. O `.env.development.local` aponta para a `captacao-v2`, então só o dev local usa a cópia.
  - A chamada à cópia devolveu os 3 textos certos.
  - Cuidado: enviar o formulário pela cópia grava uma captação real e manda e-mail ao corretor.
- Ao publicar: deploy deste código na `captacao` e push. Depois, remover `VITE_FUNCAO_CAPTACAO` do `.env.development.local` e apagar a `captacao-v2` no painel.
- Ordem: deploy da `captacao` (MCP) → push `main` + `main:teste`. Entre um e outro, a página antiga mostra o texto completo, mas grava só o texto da finalidade.

### Pendências / próximos passos
- [ ] **Aprovado pelo Eduardo em 09/10, na fila do commit conjunto** com as outras sessões (sem commit ainda). Arquivos:
  - `supabase/functions/captacao/index.ts`, `src/lib/captacao.js` e `src/pages/publico/CaptacaoPublica.jsx`: só este ajuste.
  - `docs/01-prd.md` e `docs/05-backend-schema.md`: uma linha cada, junto de alterações de outras sessões.
  - No dia de subir: **deploy da `captacao` (MCP, conteúdo do `index.ts` local) logo antes do push** `main` + `main:teste`. A env `VITE_FUNCAO_CAPTACAO` não vai para a Vercel; produção usa `captacao`.
  - Depois: tirar `VITE_FUNCAO_CAPTACAO` do `.env.development.local` e apagar a função `captacao-v2`.
- [ ] Teste ao vivo: abrir um link de captação, trocar a finalidade e conferir o texto e o PDF.
- [ ] Reinstalar o `node_modules` para o oxlint voltar a rodar.

### Como retomar
- `npm run dev`; a página é `/captacao/<token>` (token em `captacao_links`).

## Sprint 2026-10-08 — Estoque de imóveis: análise da API e PRD (RF27)

**Objetivo (Eduardo):** "é possível ter um controle de estoque? onde temos mais captações, onde estão os maiores tickets, onde estão atualizados, onde estão desatualizados" → PRD do painel Dash ▸ Estoque.

### Feito
- **Análise da API:** `POST /Imovel/RetornarImoveisDisponiveis`.
  - Com `naoconsiderarmeusite: true` traz o cadastro inteiro (4.443 de locação + 6.741 de venda, todas as situações); sem ele, só o publicado no site.
  - Máx. 20 por página. O valor pode vir "Sob consulta".
  - Datas úteis: cadastro, última alteração, última validação, vago desde.
  - O captador vem vazio.
- **Retrato (08/10):**

  | | Locação | Venda |
  |---|---|---|
  | Disponíveis | 197 | 943 |
  | No site | 99 | 459 |
  | Captações em 12 meses | 329 | 563 |
  | Ticket mediano | R$ 12,7 mil | R$ 2,39 mi |
  | Valor em estoque | R$ 3,4 mi/mês | R$ 3,26 bi |
  | Desatualizados (validação > 90 d) | 38 | 355 |
  | Vagos há mais de 1 ano | 35 | 294 |

  Cambuí lidera em estoque, captação e desatualizados.
- **PRD §5.14 + RF27** (proposta): manchete + 6 capítulos (quanto temos, onde captamos, maiores tickets, parados, cadastro em dia com lista de trabalho, fora do site); perguntas E1–E5.
- Obsidian: nova nota "🟡 Painel de Estoque de Imóveis".

### Estado atual
- Só PRD. Nada de banco, carga ou tela.
- A leitura completa foi feita por script local (`estoque_ler.py`, no scratchpad da sessão), que guarda só os campos da análise, sem proprietário nem endereço completo.

### Decisões e contexto
- Mesmo modelo do Adm locação: carga diária → tabela → views → painel com capítulos; só Gestão por enquanto (E1).
- "Fora do site" sai da diferença entre as duas leituras (com e sem `naoconsiderarmeusite`).

### PRD revisto (08/10, decisões do Eduardo)
- E1: só Gestão.
- E2: **estoque = todo imóvel negociável** (Vago/Disponível, Em moderação, Em reforma, Em desocupação).
- E3: **desatualizado = +45 dias** sem atualização (a mais recente entre alteração e validação).
- E5: exclusividade "usada, mas não incentivada" → indicador, sem meta.
- **Escopo novo:** a §5.14 virou (A) painel + (B) **busca inteligente** "mais de conversa".
  - Texto livre → filtros em chips.
  - Resultado: "atendem a tudo" + "quase lá", com margem e motivo (preço ±10%, 1 quarto/suíte/vaga a menos, área −10%, bairro a até 2 km por lat/long, característica ausente) + "qual filtro mais restringe".
  - Fase 1 com regras; fase 2 com o Claude interpretando a frase.
  - Já nasce sem dado de proprietário, para o corretor usar depois.

### Respostas do Eduardo (08/10, 2ª rodada) e docs da Fase 18
- **Corretor (futuro):** vê imóvel, código, **captador** e condomínio; não vê proprietário nem endereço completo.
- B1: margens aprovadas. B2: ordem painel → busca por regras → texto livre.
- **B3: texto livre com o Claude só depois da validação** (fase 1 = chips).
- **Teste do captador:** `Imovel/RetornarDetalhesImovelDisponivel` (só `chave`) dá 403 em 4 de 5 imóveis e não traz captador. Resta `App_RetornarDetalhesImovel` com o login do Eduardo: **aguardando autorização (E4).**
- **Docs da Fase 18 escritos (proposta):**
  - PRD §5.14 (decisões, E4, E6);
  - TRD (Edge Function `estoque-imoveis` por finalidade, n8n `estoque_imoveis_diario` 5h30, RPC `buscar_imoveis` com Haversine e colunas liberadas);
  - App Flow (painel + busca);
  - Design System (`.imovel-card`, chips, etiqueta de motivo);
  - Schema §2.11 (`imoveis_estoque`, views, 2 RPCs);
  - Plano Fase 18 (S0–S5 + depois).

### Pendências / próximos passos
- [ ] Eduardo: autorizar o teste do captador com o login (E4), confirmar condomínio para o corretor (E6) e **aprovar o plano da Fase 18**
- [ ] S1 banco → S2 carga → S3 painel → S4 busca (Plano Fase 18)

### Como retomar
- Ler o PRD §5.14.

---

## Sprint 2026-10-07 (noite, 2) — Adm locação: painel do gestor NO AR (só Gestão) — Fase 17, S1–S4

**Objetivo (Eduardo):** "dashboard de acompanhamento de contratos de locação ativos" → visão de gestor ("quantos ativos, quanto recebemos de administração, inadimplência, saudáveis, último trimestre, ticket, regiões, tipos, novos × rescindidos, motivos"). Regra: a manchete é o dinheiro que fica com a Imovit, a **administração recebida** (memória `feedback_dash_dinheiro_que_fica`).

### Feito
- **Banco (APLICADO):**
  - `20261007200000_carteira_locacao`: tabelas `contratos_locacao`, `contratos_locacao_cobrancas`, `contratos_locacao_fotos`, views e RPC `carregar_carteira_locacao`.
  - `20261007220000_carteira_locacao_v2`:
    - bairro/cidade/uf, seguro incêndio, garantia;
    - `pagamento_informado`;
    - tabela `contratos_locacao_recebimentos`;
    - views `vw_recebimentos_locacao_mensal` e `vw_proprietarios_locacao`;
    - `mascarar_documentos`.
  - `20261007233000_adm_locacao_so_gestao`: policies `is_gestao()`. Teste: gestão 817, adm 0, corretor 0.
  - Tudo testado em transação desfeita antes de aplicar.
- **Carga:**
  - n8n `carteira_locacao_diaria` (`5fGPj1tBxlqbB0N2`) **ATIVO**, 6h30: contratos + cobranças em aberto.
  - Edge Function `carteira-locacao` **v2**: contratos, em aberto e **pagas**. Chamada pelo painel ao abrir (se a leitura tem mais de 12 h) ou por "Atualizar agora"; só Gestão. Lê 13 meses na 1ª vez e aos domingos; senão, do mês anterior até hoje.
- **Tela** `/dashboard/adm-locacao` (Dash ▸ Adm locação, só `gestao`):
  - manchete: administração recebida, ativos, inadimplência, novos × encerrados;
  - 8 capítulos (PRD §5.13);
  - arquivos: `src/pages/PainelAdmLocacao.jsx`, `src/lib/admLocacao.js`, `src/hooks/useAdmLocacao.js`, `acessos.js`, `Navbar.jsx`, `App.jsx`, `hub.css`.
- **Publicado:** commit `60ec7df` na `main` (Vercel → hub.imovit.com.br), com o `5fd886b` de docs que estava local.
- **Docs:** PRD §5.13, TRD §3, App Flow, Schema §2.10, Plano Fase 17. Obsidian: "🟡 Dashboard de Contratos de Locação".
- **Eduardo:**
  - criou a secret `IMOVIEW_API_KEY` (a `esteira-locacao` também depende dela e estava sem);
  - ligou as credenciais e ativou o n8n;
  - apagou do Vault a cópia `imoview_api_key` que eu tinha criado.

### Estado atual
- **No ar e conferido com dados reais** (localhost logado como Gestão, mesmo banco da produção):
  - 157 ativos (148 saudáveis / 9 em atraso) e 4 em ativação;
  - administração recebida set/26 **R$ 68,7 mil** (prevista R$ 65,1 mil/mês);
  - inadimplência 5,7% / R$ 206,9 mil;
  - 59 novos × 63 encerrados em 12 meses (rotatividade 39%, permanência mediana de 20 meses);
  - Cambuí 40 contratos;
  - 9 avisos de desocupação, 7 no último trimestre, 45 em prazo indeterminado;
  - 33 reajustes em 90 dias, 11 vencidos;
  - 7 seguros vencidos, 21 sem registro;
  - 168 proprietários (top 10 = 25% da administração).
- Última leitura completa: 07/10 19:18 (817 contratos, 61 em aberto, 2.148 pagas em 13 meses, 57 s, 0 CPF).
- `npm run build` ok. O `oxlint` não roda nesta máquina (binário nativo ausente).
- **Conferido em produção** (hub.imovit.com.br, 07/10, logado como Gestão): manchete, 8 capítulos e item no menu iguais ao localhost; sem aviso de erro; o único erro no console é de extensão do navegador ("Could not establish connection"), não do Hub.
- ~~Push `main:teste` recusado~~ **resolvido em 08/10:** a `teste` tinha só o commit `fcb4c28`, sem mudança de arquivo. Merge da `main` na `teste` sem conflito, numa worktree temporária → `c824044` pushado. O Adm locação está também em hubimovit-git-teste-imovit.vercel.app.

### Correção pós-publicação (07/10): novos × encerrados pela regra do CRM
- **Problema:** o Eduardo viu que não batia com o CRM (2025 = 71 novos × 70 rescindidos; 2026 = 50 × 49; saldos set–dez/25 = −1, +5, +2, 0).
- **Causa:** o painel contava o rescindido sem data de rescisão (28 no Imoview) como encerrado na data de fim do contrato: +6 em 2025, +6 em 2026.
- **Correção:** migration `20261008000000_carteira_mensal_regra_crm` (APLICADA). Encerrados = data de rescisão; novos = data de início. Esses 28 só saem da contagem de ativos na data de fim. A view bate com os 4 números do CRM.
- **Painel:**
  - a manchete mostra o período: "Novos × encerrados (nov/25 a out/26)" = 59 × 56, saldo +3 (antes 59 × 63, −4);
  - a rotatividade foi de 39% para 35%.
- Commit `c43a38f` na `main`; **conferido em produção.**

### Decisões e contexto
- **Novos × encerrados = regra do CRM:** novos pela data de início, encerrados pela data de rescisão.
- **Inadimplência = regra do Imoview** (contrato ativo "Atrasado"). A API não dá valor nem %; o valor vem das cobranças vencidas.
- **"Atenção"** = cobrança que o Imoview mantém em aberto mas que já tem pagamento informado (sem baixa ou pagamento parcial). Achado da 1ª carga; antes eu tinha contado como "vencida fora da régua".
- **Recebido** = repasse ao `Locador`: administração `1.1.1.1`, intermediação `1.1.1.2`, aluguel `7.1.1` na cobrança, pelo mês do pagamento.
- **API do Imoview:** o filtro `dataVencimento` é solto e não há filtro por pagamento (o banco filtra); máximo de 50 por página; o login de usuário (`codigoacesso`) não muda o resultado.
- **CPF/CNPJ** vem até em textos livres (resumo do locador): mascarado no payload inteiro.
- A função roda a partir do painel porque `pg_cron`/`pg_net` não estão instalados. O n8n segue como carga diária.
- "Sem Administração" + "Proprietário tirou a administração" contam como um motivo só (11 em 12 meses).
- `imoveis_locados`/`proprietarios_locacao` não são usadas: `proprietarios_locacao` tem FK para a 1ª, que está vazia, e grant total para anon.

### Pendências / próximos passos
- [ ] Conferir com a ADM: 10 contratos com pagamento sem baixa, 11 reajustes vencidos, 7 seguros incêndio vencidos e 21 sem registro
- [ ] Decidir se a `teste` recebe merge da `main`
- [ ] Abrir para o ADM quando o Eduardo quiser: `is_adm_ou_gestao()` nas 4 policies + `ACESSO.dashAdmLocacao` + trava da função `carteira-locacao`
- [ ] Fase 1: revogar os grants de anon em `proprietarios_locacao`/`imoveis_locados`
- [ ] Depois (RF17): lista de ações e alertas da ADM (reajustes, seguros, avisos)

### Como retomar
- Produção: hub.imovit.com.br → Dash ▸ Adm locação (logado como Gestão).
- Local: `npm run dev` → http://localhost:5173/dashboard/adm-locacao.
- Conferir a carga:
  - `select * from contratos_locacao_fotos order by data desc limit 1;`
  - `select * from vw_recebimentos_locacao_mensal order by mes desc limit 3;`
- Logs da função: Supabase → Edge Functions → `carteira-locacao`. Procurar a linha `[carteira-locacao] N contratos, N em aberto, N pagas`.
- A versão publicada da função (v2) é igual a `supabase/functions/carteira-locacao/index.ts` no commit `60ec7df`. Redeploy pelo MCP do Supabase (o CLI local não está logado).

---

## Sprint 2026-10-07 (noite) — Adm locação: PRD aprovado, banco no ar, fluxo n8n e maquete (Fase 17, S0–S3)

**Objetivo (Eduardo):** "dashboard de acompanhamento de contratos de locação ativos", seguindo o framework.

### Feito
- **Docs:** PRD §5.13 + RF26 **aprovados** (07/10); Schema §2.10; App Flow; TRD; Plano Fase 17. Decisões do Eduardo:
  - receita = só taxa de administração;
  - menu Dash ▸ Adm locação;
  - "Moderação" = em ativação;
  - inadimplência pela regra do Imoview;
  - capítulo "Atenção" para cobranças vencidas fora da régua.
- **S0 descoberta:**
  - `GET /ContratoAluguel/RetornarContratos` (só `chave`, máx. 50/página, 817 contratos);
  - `GET /Movimento/RetornarMovimentos` (locação = módulo 2).
- **Regra de inadimplência conferida:**
  - todos os 24 contratos "Atrasado" têm cobrança vencida;
  - o inverso não vale: 9 com cobrança vencida aparecem como "Saudável" (5 há ~2 dias e 4–5 há mais de 470 dias). Esses vão para "Atenção".
- **S1 banco APLICADO:** migration `supabase/migrations/20261007200000_carteira_locacao.sql` (no banco: versão `20261007175003`).
  - `contratos_locacao`, `contratos_locacao_cobrancas` (substituída a cada carga), `contratos_locacao_fotos`;
  - views `vw_carteira_locacao`, `vw_cobrancas_locacao`, `vw_carteira_locacao_mensal`;
  - RPC `carregar_carteira_locacao(contratos, cobrancas)` (só service_role).
  - Testada antes em transação desfeita, com dados sintéticos, e RLS testado por papel.
- **S2:** n8n `carteira_locacao_diaria` (`5fGPj1tBxlqbB0N2`) criado DESLIGADO, 6h30. Confere se a leitura veio inteira antes de gravar.
- **S3:** maquete v1 com o CSS do Hub e números reais (nomes de exemplo): https://claude.ai/artifact/42e11U6RhGWBKx3VmL3nEu. Gerador `gerar_maquete_carteira.py` no scratchpad da sessão.
- Obsidian: nota "🟡 Dashboard de Contratos de Locação" e endpoints na "🟡 Imoview API".

### Estado atual
- Banco no ar, **vazio** até a 1ª carga do n8n. Nenhum código de front ainda; nada commitado.
- Retrato de 07/10 (API):
  - 157 ativos, R$ 1,30 mi/mês em aluguéis, administração R$ 65,1 mil/mês;
  - inadimplência 9 contratos (5,7%), R$ 207 mil;
  - atenção 9 contratos, R$ 72,6 mil;
  - débito de encerrados 15 contratos, R$ 107 mil;
  - 9 avisos de desocupação, 45 em prazo indeterminado, 11 reajustes vencidos.
- A view mensal reconstruída termina em 157 ativos hoje (bate com a API).
- As respostas cruas da API foram apagadas do scratchpad (tinham CPF); só ficou `agregados.json`, sem dados pessoais.

### Decisões e contexto
- Locadores ficam em `contratos_locacao.locadores` (jsonb, sem CPF).
  - Motivo: `proprietarios_locacao` tem FK para `imoveis_locados` (vazia) e serve à campanha de proprietários.
  - Achado: ela tem grant total para anon (sem policy, então hoje ninguém lê). Entra na Fase 1.
- Cobranças vencidas = foto atual (delete + insert na carga). Por isso o n8n aborta se a paginação vier incompleta.
- A chave do Imoview continua escrita no `crm_adm_contratos` e em outros fluxos; no fluxo novo vai em credencial.

### Pendências / próximos passos
- [ ] Eduardo, no `carteira_locacao_diaria`:
  - credencial Header Auth (Name `chave`) nos nós "Buscar contratos" e "Buscar cobranças vencidas";
  - credencial Supabase em "Gravar carteira no Supabase";
  - rodar manualmente; ativar.
- [ ] Eu: conferir a 1ª carga (contratos, cobranças, foto do dia) contra os números acima
- [ ] Eduardo: aprovar a maquete v1
- [ ] Eu: S3, a tela `/dash/adm-locacao` (item no Dash para gestao/adm em `src/lib/acessos.js`), testada no localhost
- [ ] Fase 1: revogar os grants de anon em `proprietarios_locacao`/`imoveis_locados`

### Como retomar
- `npm run dev` no repo.
- Ler PRD §5.13, Schema §2.10 e Plano Fase 17.
- Conferir a carga com `select * from contratos_locacao_fotos order by data desc limit 1;`.

---

## Sprint 2026-10-07 (tarde) — Repique: rodízio quebrado desde 14/09, Repique 3.0

**Objetivo (Eduardo):** "confere o repique, está seguindo a regra?"

### Feito (diagnóstico)
- Fluxo ativo: **"teste repique"** (n8n `n6NEH8TiFRs2yQor`).
  - Regra no código: a cada 5 min, dias úteis 9h–19h; inbound, em atendimento, não qualificado, sem alteração, sem 1ª resposta e sem interação manual; SLA locação 5 min / venda 30 min.
  - Filas: venda [13, 28, 30, 41, 92], locação [104, 32, 59, 99]; nunca devolve ao mesmo corretor.
- Execução 18950 (12h05): lead 6335 (venda, Patrícia) repicado aos 33 min → **SLA ok**. Foi para a Rachel (13) e o fluxo **deu erro** no fim.
- **Rodízio quebrado desde 14/09:** o nó "Create a row" grava `tipo_operacao = $json.tipo_operacao_db` (nulo; o campo é `tipo_operacao`) e faz INSERT em vez de UPDATE, então falha (NOT NULL) e o ponteiro nunca mudou.
  - O ponteiro de venda estava em 104 (Daniela, fora da fila de venda): todo repique de venda ia para Rachel (ou Ricardo).
  - O de locação estava em 59: todo repique ia para Lucas (ou Daniela).
- **Bug latente:** dois nós lêem o ponteiro em paralelo e ambos alimentam o "Calcular fila". Hoje o erro final impede o 2º caminho; corrigindo só o fim, cada lead seria transferido duas vezes.

### Feito (correção)
- **Criado "Repique 3.0"** (n8n `4wQRK0lOBk2vuFwP`, DESLIGADO):
  - mesma regra e mesmas filas;
  - o ponteiro é lido uma vez (`executeOnce`) e a fila calculada uma vez (deduplica por código);
  - "Atualizar ponteiro" faz UPDATE por `tipo_operacao`;
  - `codigoUsuario` vem do login;
  - chave e senha só em credencial (Custom Auth "Imoview login").
  - As credenciais Supabase foram auto-atribuídas; as do Imoview, o Eduardo liga.
- **Ponteiros acertados no banco** (`repique_ponteiro`): venda = 13 (último real, 12h05), locação = 99.

### Estado atual
- O "teste repique" continua ATIVO até o Eduardo trocar. Com o ponteiro acertado e o fim ainda falhando, até a troca ele manda venda sempre para Ricardo (28) e locação sempre para Daniela (104). **Trocar logo.**
- Repique 3.0 não testado ao vivo (desligado).

### Pendências / próximos passos
- [ ] Eduardo: credenciais Imoview no Repique 3.0 (Custom Auth no "Acessar API"; Header Auth nos outros dois) + Settings → Timezone America/Sao_Paulo → desligar "teste repique" → ativar Repique 3.0
- [ ] Eu: conferir as primeiras execuções (ponteiro andando, 1 transferência por lead)
- [ ] Arquivar repiques antigos (Vendas/Locação, Repique, Repique 2.0, Repique leads > 11D/30D, teste repique antigos)

---

## Sprint 2026-10-07 — Jornada: proposta do gráfico de tempos, perdas e motivos

**Objetivo (Eduardo):** gráfico da jornada com tempos e medição de perdas e motivos.

### Feito
- Situação da jornada:
  - leituras: carga base (06/10), manual (06/10 15:22) e **1ª automática 07/10 06:03** (880 lidos, 129 novos, 4 mudanças);
  - os 126 "primeira_leitura" com Negócio vieram porque a diária agora lê todos os negócios (antigos que não estavam na base).
- **Motivo do descarte não existe no banco** (nem na base antiga, nem nos campos simples do payload). Precisa vir de `interacoes`.
- `docs/n8n/crm_jornada_diaria_v3__marcar_fase.js` v5: guarda `interacoes` também dos descartados (situação 2). **O Eduardo precisa colar no nó.**
- Docs (proposta): PRD §5.12 (+ perguntas J1/J2), Schema §2.9 (`vw_jornada_etapas`, `vw_jornada_descartes`), Plano Fase 16.

### Estado atual
- **v5 do "Marcar fase" ativa no n8n** (conferido 07/10 12:19). Descartes passam a vir com `interacoes` a partir da leitura de 08/10 às 6h.
- Maquete v1 reprovada pelo Eduardo ("fugiu do design kit": cores e layout próprios). **v2** no mesmo link, montada com `tokens.css` + `components.css` + `hub.css` e só componentes do painel (`.pg-capitulo`, `.pg-funil--7`, `.pg-hbarras`, `.pg-mesa-card`, `.pg-saude`): https://claude.ai/artifact/LWATNn1x2NedBQd3uYwgX8. O gerador é `gerar_maquete.py`, no scratchpad da sessão. A proposta virou completar os capítulos 1 e 3, e não criar um capítulo novo (PRD §5.12 atualizado).
- Nada de código ou banco novo. Aguardando aprovação + J1/J2.

- Conferência de 07/10 à tarde:
  - leitura das 6h03 ok (RPC 200, 1,9 MB, 3,1 s; única chamada do dia);
  - a v5 ainda não rodou (foi colada às 12:19), então 0 descartes com interações por enquanto. A 1ª prova é a leitura de 08/10 às 6h;
  - Km 32 em zero, coerente: o último "NEGÓCIO REALIZADO" no Imoview é de 01/10.

### Pendências / próximos passos
- [ ] Aprovar PRD §5.12 e responder J1 (dias para "parado") e J2 (perdas só da jornada?)
- [ ] S1 views → S2 capítulo no Comercial → S3 publicar

---

## Sprint 2026-10-06 (noite, 3) — Hub no celular

**Objetivo:** responder "como está o Hub no mobile?"

### Feito
- Medição em produção, num iframe de 375–390px com a sessão do Eduardo (o `resize_window` não muda a largura real da aba):
  - **o menu do topo não se adaptava**: a página tinha 1034px, e Dash, Ferramentas, Perfil e Sair ficavam fora da tela;
  - o resto cabe: Home, trilha Km 32, Comercial, Performance, Kanban, Dados, Relatório, Captações, Feedback, Materiais, Agenda e Perfil. Tabelas e o Kanban têm rolagem própria.
- Correção (`Navbar.jsx` + `components.css`, commit local):
  - ≤ 1100px: barra com marca, foto, Sair e botão ☰ (o menu completo precisa de ~1050px; notebooks pequenos também quebravam);
  - o ☰ abre um painel com tudo, com submenus abertos (sem hover no toque); fecha ao trocar de página;
  - tagline, clima e nome somem nessa largura.
- Testado no localhost a 375px: página com 375px (sem rolagem lateral) e painel com Home, TV, Dash (Comercial, Gestão, Performance, Kanban…), Ferramentas, Configurações.

### Estado atual
- **PUBLICADO (07/10, OK do Eduardo):** push da `main` (bundle `index-DGKLkUMi.js` / `index-DZGLDbb8.css`) e `teste` atualizada.
- Conferido em produção a 375px com o login do Eduardo: página com 375px (sem rolagem lateral); o ☰ abre o painel com os 14 itens (Home, TV, Dash e subitens, Ferramentas e subitens, Configurações).
- Não testado: celular de verdade (só a largura simulada); a página pública de captação aberta por um cliente no celular.

### Pendências / próximos passos
- [ ] Conferir num celular de verdade

---

## Sprint 2026-10-06 (noite, 2) — Corretor no Dash + "Ver o Hub como"

**Objetivo (Eduardo):**
- Comercial: só os dados dele;
- Painel da Gestão: não;
- Performance: sim;
- Kanban, Dados e Relatório: só os dele;
- seletor de visão só para a Gestão.

### Feito
- **APLICADA** `20261006230000_corretor_dash_performance`: `pode_ver_dash()` inclui corretor (Meta/Google/metas) e a nova `performance_leads_pagos()` devolve só data, fase e negócio, da imobiliária inteira.
  - Teste antes: o corretor recebe 508 pagos pela função × 85 lendo direto; 0 atendimentos de outros; "Sem nível" negado.
- Front:
  - `ACESSO.kanban` += corretor; `ACESSO.dashPerformance`; menu do Dash por nível;
  - `useMeuCorretor` + filtro "só o meu" em `useAtendimentos` e no Relatório (`codigousuario` = `id_corretor_crm`; conferido no banco para os 9 corretores);
  - atalho "Meus atendimentos".
- **"Ver o Hub como"** (só Gestão):
  - `src/lib/verComo.js` (sessionStorage + evento); `usePerfil` aplica a prévia e expõe `papelReal`/`previa`;
  - faixa azul no `AppShell` com "Sair da prévia"; Perfil bloqueado durante a prévia;
  - seletor da Home com níveis e os 9 corretores.
- Commit `a89499d`; push na `main` (bundle `index-DI0rGctp.js`) e `teste` atualizada (commit vazio).

### Estado atual
- **Localhost, "Ver como Gabriel Simon":**
  - menu de corretor (sem Painel da Gestão, TV e Configurações);
  - Meus números travado nele; Kanban com 13 cards, todos dele; Relatório só dele;
  - Performance com o total da imobiliária; pendências "33 leads seus sem contato".
- **Produção conferida logado como Gestão:** seletor "Ver o Hub como" com os 9 corretores; menu do Dash completo.
- Não conferido: um corretor real logado; celular.

### Pendências / próximos passos
- [ ] Primeiro corretor real (piloto) → conferir o que ele vê
- [ ] Brevo: liberar a checagem de IP

---

## Sprint 2026-10-06 (noite) — Produção sem Propostas; ambiente de teste

**Objetivo (Eduardo):** entregar ao time só Home, Dash e Ferramentas. Propostas ficam num domínio de teste, do jeito mais simples possível.

### Feito
- Chave `VITE_MODULO_PROPOSTAS` (`src/lib/acessos.js`, `PROPOSTAS_ATIVAS`): desligada, zera os níveis de propostas (menu, rota, busca). Atalhos e pendências da Home e o "valor na mesa" do Comercial também a consultam.
- Corretor ganhou os atalhos **Meus números** e **Captações**. A pendência "leads sem contato" agora leva a Meus números (antes levava ao Kanban, que o corretor não acessa).
- Portal do cliente (`/portal`, `/venda`) segue ativo em produção só pelo link do e-mail, então as funções não mudaram.
- Docs: PRD §5.10, TRD "Ambientes", Plano Fase 14.
- Commit `ce37c73`; push na `main` (produção) e `main:teste` (branch nova).

### Estado atual
- **Produção conferida logado como Gestão** (bundle `index-BjKxUXxn.js`):
  - menu = Home, TV, Dash, Ferramentas, Configurações;
  - 0 links de propostas; trilha Km 32 ok;
  - `/admin/propostas` → Home (visto no localhost sem a chave).
- **Teste ainda sem deploy:** o commit é o mesmo da produção, então a Vercel não gerou o preview da branch `teste` (`hubimovit-git-teste-imovit.vercel.app` → 404). Depois que o Eduardo criar a env de Preview, eu faço um commit vazio na `teste`.

### Correção: troca de foto do perfil (relato do Eduardo)
- Erro: "new row violates row-level security policy". **Nunca funcionou para ninguém**: 0 fotos no bucket desde 23/09.
- Causa: o upload faz INSERT … RETURNING (upsert), que exige policy de SELECT; o bucket `avatares` só tinha INSERT/UPDATE/DELETE.
- **APLICADA** a `20261006210000_avatares_select_proprio`. Antes, em transação desfeita: o erro foi reproduzido; com a policy, grava; a pasta de outra pessoa continua negada. Sem mudança no front.
- [ ] Eduardo testar a troca de foto em /perfil

### Pendências / próximos passos
- [ ] Eduardo: Vercel → env `VITE_MODULO_PROPOSTAS=on` só em Preview (branch `teste`) → me avisar → commit vazio na `teste` → conferir o teste com Propostas
- [ ] Eduardo: Supabase → Auth → URL Configuration → Redirect URLs += `https://hubimovit-git-teste-imovit.vercel.app/**`
- [ ] Brevo: liberar a checagem de IP (e-mails da captação e das propostas)
- [ ] Corretores criam conta em produção → nível Corretor → piloto
- [ ] Manter a `teste` em dia: a cada push na `main`, `git push origin main:teste`

### Como retomar
- Produção = `main`; teste = branch `teste` (mesmo banco). Para testar Propostas no localhost: `VITE_MODULO_PROPOSTAS=on npm run dev`.

---

## Sprint 2026-10-06 (fim do dia) — Km 32: documentação para produção

**Objetivo:** levar a trilha Km 32 para produção com dados reais, seguindo o framework.

### Feito
- Decisões do Eduardo:
  - C1 = 14 negócios / R$ 28 mi;
  - C3 = todos com nível;
  - C4 = todos os negócios do CRM;
  - C6 = 06/10 para tudo;
  - C5 = genérica, por recomendação; C2 = aluguel mensal (`valornegocio`).
- Docs:
  - PRD §5.9 com as decisões;
  - App Flow: trilha na Home + estados;
  - DS: componente trilha;
  - Schema §2.8: `campanhas`, `campanha_metas`, `campanha_resumo()`;
  - Plano Fase 13: S1 banco, S2 tela, S3 preview → produção.

### Implementação (plano aprovado pelo Eduardo)
- **S1 — APLICADA** `20261006200000_campanhas_km32`: `campanhas`, `campanha_metas` (Km 32: 06/10–31/12; Venda R$ 28 mi/14; Aluguel R$ 160 mil/18), RLS e `campanha_resumo(slug)` (security definer, só agregados, exige `pode_ler_comercial`).
  - Teste antes, em transação desfeita:
    - venda com e sem valor;
    - locação antes de 06/10 (fora);
    - reaberta (fora);
    - locação válida;
    - o corretor recebe o total e não grava meta; "Sem nível" e anon são negados.
  - Em produção: zero negócios, metas certas.
- **S2:**
  - `TrilhaKm32.jsx` lê a RPC (sem dados fictícios);
  - 4 números (valor, negócios, ticket, ritmo); rodapé com a regra e a atualização; estados vazio/erro/atraso/fora do período;
  - paradas calculadas pelos meses da campanha;
  - Home mostra o bloco só com `pode(perfil, 'campanha')` (novo em `acessos.js`);
  - CSS com 4 colunas e rodapé.
  - Visto no localhost:5180 logado: Km 32, 0 de 14, ticket "—", "atualizado em 06/10 às 15:22". Build ok; lint bloqueado pelo Windows.
- **S3:** branch `campanha-km32`, commit `c044251`, push → 1º preview `https://hubimovit-l4lpbqu7u-imovit.vercel.app` (substituído).
  - **Tem Deployment Protection (Vercel Authentication):** o gestor precisa de conta na equipe Vercel ou de um link de compartilhamento.
  - As envs de Preview existem: a tela de login do Hub carregou pelo Chrome do Eduardo.
  - Login no Hub: o Eduardo.

- **Ajuste das paradas (Eduardo):**
  - régua única: 0% = 06/10 e 100% = 31/12, valendo para o tempo e para o valor;
  - as paradas ficam no último dia de cada mês: Km 35 em 31/10 (~29,9%), Km 38 em 30/11 (~64,4%), Km 42 em 31/12;
  - o `title` da parada mostra a meta acumulada.
  - Commit `4497583`, novo preview `https://hubimovit-qqwfwllc5-imovit.vercel.app`; visto no localhost.

### Estado atual
- **PUBLICADO (OK do Eduardo):**
  - fast-forward da `main` até `4497583` e push; Vercel `index-C_5R_s4l.js` (contém `campanha_resumo`);
  - **conferido em hub.imovit.com.br logado como Gestão:** trilha na Home com Km 32, paradas Km 35/38/42, 0 de 14, "atualizado em 06/10/2026 às 15:22";
  - branch `campanha-km32` apagada (local e remota).
- Não conferido: visão de Corretor/ADM/TV logados e celular. "Sem nível" não vê o bloco (pela regra; não testado ao vivo).

### Pendências / próximos passos
- [ ] Acompanhar o primeiro negócio da campanha: conferir valor/data na trilha × Imoview
- [ ] Pôr o fuso America/Sao_Paulo nas Settings da `crm_jornada_diaria v3`
- [ ] `docs/n8n/crm_jornada_diaria_v3__marcar_fase.js` está fora do git (referência do código colado no n8n)

---

## Sprint 2026-10-06 — Protótipo da trilha "Km 32" na Home

**Objetivo:** levar para a Home a trilha da maratona da apresentação "Km 32 · Campanha 4º Tri 2026" (Downloads\Imovit.zip). É só um protótipo visual para o Eduardo conferir.

### Feito
- Novo `src/components/home/TrilhaKm32.jsx`, com dados **fictícios** na constante `CAMPANHA`.
  - Trilha Km 32→42, com paradas Out/Nov/Dez em 1/3, 2/3 e 3/3.
  - Ponto coral no % realizado da meta e marcador tracejado "hoje" na fração do trimestre (01/10–31/12).
  - Abas Venda/Locação; números de realizado × meta, unidades e ± pontos contra o calendário.
- `src/pages/Home.jsx`: `<TrilhaKm32 />` logo abaixo dos atalhos, visível para todos os níveis.
- `src/styles/hub.css`: seção "Campanha Km 32" no fim do arquivo, com tokens do DS e respeitando `prefers-reduced-motion`.

### Estado atual
- **Nada commitado nem publicado.** Só local.
- `npm run build` OK.
- `npm run lint` não roda. Investigado nesta sessão, que assumiu o protótipo: **o Windows (Application Control / Smart App Control) bloqueia o binário nativo do oxlint** (`oxlint.win32-x64-msvc.node`: "An Application Control policy has blocked this file"). Não é a config nem o código. Para voltar: liberar o arquivo no Windows. Não mexi em configuração de segurança.
- **Validado visualmente** em localhost:5180 logado (Chrome, desktop): abas Venda/Locação, paradas, marcador "hoje", ponto coral e números ok. Celular não visto.
- Ajuste: as % visíveis agora usam vírgula ("11,1%"). `pct` fica só para posições do CSS, e `pctTexto` vale para o texto. Build ok.

### Decisões e contexto
- Metas vêm da apresentação: venda R$ 28 MM / 14 un.; locação R$ 160 mil / 18 un.
- A apresentação tem uma inconsistência: o slide "O percurso" mostra 4 vendas / R$ 8,4 MM por mês (= 12 / R$ 25,2 MM). Por isso o protótipo usa meta mensal = 1/3 da meta do trimestre.
- Ainda não tem docs (PRD/schema) porque é protótipo. Se for aprovado, vira feature e passa pelo framework: seção no PRD, origem do realizado no schema e fase no plano.

### Virou feature (mesmo dia): PRD §5.9 + RF25 em rascunho
- Decisão do Eduardo:
  - fonte = atendimentos do CRM, "Negócio realizado" com data de fechamento ≥ 06/10/2026;
  - a trilha mostra valor realizado, volume e ticket médio;
  - nada de lançamento manual nesta versão.
- Verificado no banco: **não há coluna de valor** nos atendimentos (D1), e **o último fechamento com data é de 16/09** (D2). Os dois dependem do fluxo `crm_jornada_diaria` rodar (payload cru + data da virada para negócio).
- Perguntas C1–C6 no PRD. Depois da aprovação: App Flow, DS, Schema e fase no Plano.

### Teste do `crm_jornada_diaria` (06/10, a pedido do Eduardo)
- O Eduardo ligou as credenciais (a validação usa Header Auth + senha na query, igual ao fluxo antigo) e o fuso `America/Sao_Paulo`.
- Execução manual `18794` (pelo MCP): **erro** no "Juntar e normalizar". As páginas da busca paginada chegaram sem um `pairedItem` no formato esperado. A trava funcionou: **nada gravado** (`crm_leituras` = 0, jornada = 0, conferido).
- Os dados da execução não abrem pelo MCP (resposta grande demais).
- O Eduardo colou um código de diagnóstico, que mostrou a causa: **a página 43 veio com `pairedItem={"item":42}`, mas só existem as consultas 0–41.** O HTTP com paginação numera o `pairedItem` pela página, não pela consulta. As outras páginas também teriam a fase errada, em silêncio. A trava evitou gravar.
- **Criado `crm_jornada_diaria v2`** (n8n `NLDrm0WTWkYdz3ge`, desligado):
  - Loop "Uma consulta por vez" (lote 1) → HTTP paginado → "Marcar fase da consulta" (lê a consulta do lote atual com `$('Uma consulta por vez').first()`; consulta vazia devolve um marcador para o loop não parar) → volta ao loop.
  - A saída "done" vai para "Juntar leitura" (deduplica por código; com 0 lidos, para sem gravar) → RPC.
  - Credenciais vazias: o Eduardo liga as 3 ou copia o nó "Validar" da v1.
- A v1 (`4tzh8UFpxciJOYiY`) **não deve ser usada** (pairedItem). Arquivar depois que a v2 rodar.
- **1ª execução da v2 (Eduardo):** o loop leu as 42 consultas.
  - 1º erro: "Credentials not found" no último nó; o Eduardo ligou a credencial Supabase.
  - 2º erro: **statement timeout (57014)** na RPC. Pelos logs, o POST tinha **26,5 MB** (~9 KB de payload por atendimento), e o `service_role` herdava os 8s do `authenticator`.
  - A função em si leva 348 ms com 2.831 itens (medido em transação desfeita); o tempo vai em ler o JSON e gravar a 1ª carga.
- **APLICADA** a migration `20261006160000_service_role_timeout` (`alter role service_role set statement_timeout = '120s'` + reload do PostgREST). anon (3s) e authenticated (8s) não mudaram; conferido no `pg_roles`.
- Uma execução da v2 disparada por mim (MCP) antes da correção ainda estava rodando; aguardar o resultado antes de rodar outra. Banco ainda com 0 leituras.
- Execuções da v2 identificadas pelo MCP:
  - 18800: erro imediato;
  - 18803: credencial do Supabase não ligada;
  - 18808: chegou ao Supabase com 26,5 MB e deu timeout;
  - 18812: a minha, cancelada pelo MCP depois de 5 min, antes de enviar.
  - **Depois da correção do tempo, nenhuma execução foi até o fim.**
  - O "erro de autenticação" citado pelo Eduardo não aparece nos logs do Supabase (nenhum 401/403); provavelmente é o da 18803.
- O MCP não serve para rodar a v2: ela passa de 5 min e o MCP cancela. Rodar pela tela do n8n.
- **Mudança de desenho (Eduardo: "o foco é daqui para frente"):** não reler a base toda dia.
  - **APLICADA** a `20261006180000_crm_jornada_carga_inicial`: a jornada parte de `dashboard_atendimentos_crm`, 2.831 linhas (247 em atendimento). Antes foi testada em transação desfeita, com uma leitura diária parcial em cima.
  - **Criada a `crm_jornada_diaria v3`** (`OrueN2tGYYqploMp`, desligada): diária = em atendimento completo + encerrados com `dataInicial` de 60 dias; domingo = completa; 50/página; payload enxuto; trava da situação 1.
  - v1 e v2 obsoletas.
- Commits locais `155506a` e `7ec7c43` (migrations + docs), **sem push**.

### Testes da v3 (06/10, pelo MCP)
- 18833: `jsonQuery` precisava de `JSON.stringify` (o Eduardo corrigiu).
- 18835: Imoview **403 "Nº de registros não pode ser maior que 20!"** (o Eduardo voltou para 20).
- 18839: **leitura do Imoview OK, 677 atendimentos em 1m52s.** Parou no último nó com "Credentials not found": a credencial do Supabase não está na v3.
- O que a leitura mostrou:
  - situação 1 = Em atendimento (295), 2 = Descartado (373), 3 = Negócio realizado (9);
  - **`dataInicial` filtra pela data de ENTRADA** (todos os encerrados lidos entraram depois de 07/08), então um negócio de lead antigo só aparece na leitura completa de domingo;
  - **`datafechamento` vem vazio** em todos, até nos negócios;
  - existem `datahoraultimaalteracao`, `dataprevisaofechamento` e `corretorcodigo`;
  - listas `imoveisnegocio` (1 item em todo negócio), `imoveisproposta` e `interacoes`;
  - 295 em atendimento no Imoview contra 247 na base: a base antiga está defasada.
- Código v4 do "Marcar fase" (`docs/n8n/crm_jornada_diaria_v3__marcar_fase.js`): guarda inteiras `imoveisnegocio` e `imoveisproposta` (valor), e `interacoes` nos negócios (data do fechamento). O Eduardo cola.
- A saída da execução 18839 ficou salva localmente em `.claude/projects/.../tool-results/` (arquivo grande; só para análise).

- **Execução 18849: SUCESSO.** Leitura 6 em `crm_leituras`: 677 lidos, 51 novos, 21 mudanças, 3 encerramentos, 4 reaberturas (a base antiga defasada sendo corrigida).
- **Valor e data do negócio encontrados** (atendimento 6133): `imoveisnegocio[].valornegocio` e a interação "NEGÓCIO REALIZADO … datahora". Registrado no PRD §5.9 (D1/D2 resolvidos).
- Sugestão pendente: na diária, ler os negócios (situação 3) **sem** `dataInicial` (são ~90, é barato), para negócios de leads antigos entrarem no dia seguinte e não só no domingo. É 1 linha no "Montar consultas".

- **v3 ATIVA** (conferido pelo MCP às 18:28): diária lê os negócios (situação 3) sem `dataInicial`, e só os descartados ficam com 60 dias. v1 e v2 não aparecem mais na busca (arquivadas pelo Eduardo).
- ⚠ O fluxo v3 **não tem fuso nas Settings**: as "6h" seguem o fuso padrão da instância. Pedir ao Eduardo para pôr `America/Sao_Paulo`.

### Próximo passo da jornada
- [ ] Eduardo liga as credenciais na v3 (copiar o nó "Validar" da v2) e roda pela tela → eu confiro `crm_leituras` (origem `n8n`), as mudanças e o `payload` (campos de valor e data para o Km 32)
- [ ] Se a situação 1 não for "Em atendimento", ajustar `EM_ATENDIMENTO` no nó "Montar consultas"
- [ ] Confirmar o que o `dataInicial` filtra (entrada ou alteração): comparar a leitura diária com a semanal do domingo
- [ ] Conferir as leituras dos próximos dias em `crm_leituras` (a 1ª automática é 07/10 às 6h)
- [ ] Depois de alguns dias ok: a RPC passa a manter `dashboard_atendimentos_crm` → desligar o `crm_atendimentos` antigo

### Pendências / próximos passos
- [ ] Eduardo ligar as credenciais na `crm_jornada_diaria v2` → eu rodo e confiro no banco → arquivar a v1
- [ ] Eduardo aprovar o PRD §5.9 e responder C1–C6
- [ ] Rodar o `crm_jornada_diaria` uma vez (credenciais) → eu procuro valor e data no `payload`
- [ ] (substituída pela decisão acima) Valores de fechamento por lançamento manual
- [ ] URL de teste na Vercel para o gestor: branch `prototipo-km32` com commit só dos 3 arquivos (sem `handoff.md`) → preview. **Aguarda o OK do Eduardo para o push.** Depois do deploy: conferir se as env vars do Supabase valem para "Preview" (senão a tela fica branca) e se há Deployment Protection.
- [ ] Valores de fechamento: proposta de lançamento manual pela Gestão (tabela de fechamentos + metas numa tabela de campanha; a trilha soma; conciliação com o CRM depois). Feature nova: PRD + schema + plano antes de codar. Sem resposta do Eduardo ainda.
- [ ] Eduardo conferir no celular.
- [ ] Decidir se fica e para quais níveis aparece.
- [ ] Definir a fonte do realizado: VGV/VGL e unidades do 4º tri, provavelmente em `kpis_tv` ou numa RPC nova, e onde guardar as metas (tabela de campanha × constante).
- [ ] Confirmar com o Eduardo a meta mensal correta de venda.
- [ ] Investigar o `npm run lint` quebrado.

### Como retomar
- `cd C:\Users\eduar\hub-imovit; npm run dev` → Home logado.
- Para desfazer o protótipo: apagar `TrilhaKm32.jsx`, remover import/uso em `Home.jsx` e a seção "Campanha Km 32" no fim de `hub.css`.

## Sprint 2026-10-01 — Acesso aos dados comerciais + desenho do fluxo de jornada

**Objetivo:** fechar a leitura dos dados comerciais por quem não tem nível e preparar o novo fluxo do n8n.

### Feito
- **APLICADA** a migration `20261001120000_sem_nivel_nao_le_dados_comerciais` (aprovada pelo Eduardo: "pode fechar").
  - `pode_ler_comercial()` agora vale em 7 tabelas comerciais.
  - Teste antes (transação desfeita): o "Sem nível" lê 0, mas ainda vê avisos e plantão; TV e Gestão sem mudança.
  - Conferido depois no `pg_policies`.
- **APLICADA** a trava do corretor `20261001130000_corretor_ve_so_os_seus_dados` (OK do Eduardo), agora sobre `pode_ler_comercial()`.
  - Teste antes: corretora 398 atendimentos, 0 de outros.
  - Depois, em produção, a Gestão lê tudo (2.798 atendimentos, 2.148 atividades, 834 leads) e `kpis_tv` funciona.
- **Commit `cd36fdd` + push.** Vercel no ar (`index-CH5HQVSE.js`, contém "Meus números"); `/dashboard/comercial` → 200.
- Docs: Schema §2.6b e §2.7, Plano Fase 12.

- **Fluxo n8n `crm_jornada_diaria` criado DESLIGADO** (id `4tzh8UFpxciJOYiY`), pelo `create_workflow_from_code`. O `crm_atendimentos` não foi tocado.
  - Passos: manual + todo dia às 6h → validar acesso (Custom Auth: chave + email + senha, sem segredo no nó) → 42 consultas (finalidade × fase × situação, **sem `dataInicial`**) → busca paginada → junta por código (fase vem da consulta, via `pairedItem`; sem `pairedItem` o nó para) → POST `rpc/registrar_atendimentos_crm`.
  - Credenciais vazias: o Eduardo precisa ligar as 3.
  - O fluxo não tem fuso definido: conferir em Settings = America/Sao_Paulo.
- Desenho revisto no Schema §2.6: RPC + `crm_atendimento_jornada` (append-only) + `crm_leituras`, em vez de uma foto diária inteira.

- **Supabase Pro ativo** (plano `pro` confirmado na organização).
- **APLICADA** a migration `20261001160000_crm_jornada`:
  - criou `crm_leituras`, `crm_atendimento_jornada` e a RPC `registrar_atendimentos_crm`, que só o `service_role` executa;
  - teste completo antes, em transação desfeita (todos os tipos de evento + permissões);
  - depois de aplicar: tabelas vazias; Security Advisor com 0 ERROR;
  - commit local `jornada` (sem push; não há front novo).
  - A RPC ainda não escreve em `dashboard_atendimentos_crm`: o fluxo antigo segue mantendo o estado atual durante os 3 dias de paralelo.

### Estado atual
- Kanban: o Eduardo vai validar com a Gestão.
- Publicado: Dash Comercial, Kanban (código, etapa, 7 dias, dias no funil), índices e acessos. Não verificado logado em produção.
- Supabase Pro: será assinado hoje (01/10).

### Decisões e contexto
- Na API do Imoview documentada, não há histórico nem data de mudança de fase. A data da mudança vai ser o dia da captura, com precisão de 1 dia. Exceção: a entrada usa `datahoraentradalead` e o fechamento usa a data de fechamento do CRM.

### Pendências / próximos passos
- [ ] Pro ativo → migration da jornada (tabelas de captura e etapas, Schema §2.6) → fluxo n8n novo
- [ ] Mandar uma resposta crua do `RetornarAtendimentos` (1 item) para ver se há campo de data de alteração

---

## Sprint 2026-09-29 (2ª parte) — Página Comercial v1 (localhost, sem commit)

**Objetivo:** primeira versão da página de dados do Comercial (PRD §5.8) sobre os dados atuais, com todos os filtros respeitados.

### Feito
- Rota `/dashboard/comercial` (menu Dash → "Comercial"), acesso `ACESSO.dash` (gestao, marketing).
- `src/lib/painelComercial.js`: cálculos puros.
  - Filtros: período (mês, mês passado, 30/90 dias, 6/12 meses, ano), finalidade, mídia e corretor.
  - Filtro geral: `colaboradores_raw.equipe='comercial' and ativo`, ligado por nome.
  - Coorte = leads que entraram no período.
  - Visitas = atividades "Visita" ligadas a um atendimento do recorte; bairro e tipo lidos do `resumoimovel`.
  - Valor na mesa = propostas abertas criadas no Hub.
- `src/pages/PainelComercial.jsx` + `src/components/painel/GraficosComercial.jsx`. Em cada gráfico há um subtexto com o recorte.
- `BarraFiltros` ganhou `opcoesPeriodo`/`rotuloCanal`. `CaixaTooltip` foi exportado de `Graficos.jsx`. `fmtDataCurta` foi adicionado em `paineis.js`. CSS em `hub.css` ("PAINEL COMERCIAL").
- Cores dos tipos de imóvel: paleta categórica padrão do skill dataviz, validada (CVD ok). O aviso de contraste é compensado com a tabela de totais.

### Estado atual
- Lint (só avisos antigos) e build ok. Visto no Chrome logado (localhost).
- Conferido por SQL em 2 recortes:
  - setembro, sem filtros: 117 / 51 / 33 / 27 / 6;
  - 90 dias · Venda · Site: 17 / 12 / 22.
  Todos batem com a tela.
- **Sem commit e sem push.** Aguardando a revisão do Eduardo.
- Não visto: tela de celular; acesso como Marketing (`perfis` e propostas têm RLS de Gestão/criador, então o Marketing deve ver o valor na mesa zerado ou parcial).

### Decisões e contexto
- Decisões do Eduardo em 29/09: Sandra corrigida no CRM; os outros ficam fora do filtro geral. A página Geral fica para depois. O valor na mesa vem das propostas do Hub.
- Cálculos em JS e não em SQL (mesmo padrão dos painéis atuais; nada de migration antes do Pro).
- Sem histórico, as etapas contam a fase atual. A coluna "tempo na etapa" está reservada com "—".
- Achado: o navbar transborda na horizontal em janelas de cerca de 900px (antigo, não é desta página).
- As propostas de venda somam R$ 11,25 mi em 2 propostas "confirmadas". Conferir se são reais ou de teste.

### Kanban (S7, pedido do Eduardo)
- Card mostra "Atendimento #código" (`KanbanCard.jsx`, classe `.kanban-card-codigo`, selecionável para copiar).
- Filtro novo "Etapa" (`etapa` em `FILTROS_VAZIOS`). Com etapa escolhida, o quadro mostra só aquela coluna.
- O Kanban abre com **Últimos 7 dias + Em atendimento** (`filtrosKanbanPadrao()`); "Limpar filtros" volta a esse padrão.
- Tempo no funil no card:
  - em atendimento: "X dias no funil", da entrada até hoje;
  - encerrado: "X dias até encerrar";
  - cores de aviso só com o texto junto: acima de 14 dias amarelo, acima de 30 vermelho.
  - O **tempo na etapa atual** depende do histórico (S1/S2).
- `dataDiasAtras` corrigida: usa a data local (antes era UTC, que à noite já é o dia seguinte) e "últimos N dias" conta hoje + N-1 dias. Afeta também os outros atalhos de período do Kanban.
- Build e lint ok; **não visto no navegador** (dev server derrubado por memória).

### Ajuste nos índices (feedback do Eduardo: "↓ -41% 28% dos leads · vs período anterior" confuso)
- `Indice` (`src/components/painel/Estrutura.jsx`) ganhou a prop `detalhe`, que vai em linha própria. A variação agora é seta + valor sem sinal ("↓ 41%"), e isso vale também no Painel da Gestão e no de Performance.
- No Comercial:
  - 1ª linha: variação + valor anterior, ex.: "↓ 41% vs período anterior (56)";
  - 2ª linha: proporção ou detalhe ("28% dos leads que entraram", "16 já realizadas").
- Build e lint ok; **não visto no navegador** (dev server derrubado por falta de memória).

### Corretor vê só os próprios dados (pedido do Eduardo, mesmo dia)
- Tela:
  - `ACESSO.dashComercial` (gestao, marketing, corretor);
  - o corretor vê o menu Dash → "Meus números";
  - `PainelComercial` trava o filtro no nome do CRM pelo e-mail do login (a URL não muda isso);
  - `BarraFiltros` recebe `corretorFixo`;
  - sem cadastro no CRM, o corretor vê um aviso.
- Banco: migration `supabase/migrations/20260929150000_corretor_ve_so_os_seus_dados.sql`. **Testada em transação desfeita e NÃO aplicada.**
  - Corretora simulada (e-mail da Sandra): 397 atendimentos, 0 de outros.
  - Gestão sem mudança; anon 0.
  - Conferido depois: nada persistiu.
- Hoje **nenhum perfil tem o nível Corretor**. A tela de corretor não foi vista ao vivo porque não há conta de teste.
- Achado: `is_team()` libera tudo também para "Sem nível" (`user`).

### Pendências / próximos passos
- [ ] OK do Eduardo → aplicar a migration `20260929150000` (via MCP) → registrar em `schema_migrations`
- [ ] Eduardo revisar `/dashboard/comercial` → ajustes → commit/push
- [ ] Supabase Pro → S1 (banco acumulativo) → S2 (fluxo n8n) → trocar as etapas para eventos e ligar o tempo por etapa
- [ ] S5 Performance (5 índices), S7 Kanban

### Como retomar
- `npm run dev` → `http://localhost:5173/dashboard/comercial`; plano: `docs/06-implementation-plan.md` Fase 12.

---

## Sprint 2026-09-29 — Dashboards v2 / dados acumulados: diagnóstico e plano (sem código)

**Objetivo:** organizar a demanda de 29/09 (`Desktop/05 - Ferramentas/hub imovit 29-09-2026.txt`) em sprints, seguindo o framework.

### Feito
- Diagnóstico, lido do código e do banco:
  - o filtro de período não muda funil, conversão, canais e ritmo porque eles usam janelas fixas (`safraMadura`, `src/lib/painelGestao.js:182`);
  - o n8n `crm_atendimentos` faz upsert por `codigo` (2.788 linhas = 2.788 códigos, sem histórico) e busca com `dataInicial = ontem`.
- Docs atualizados:
  - PRD §5.8 + RF24 + perguntas P1–P5 (fim do PRD);
  - Schema §2.6, proposta com `crm_atendimentos_captura`, `crm_funil_etapas` e `crm_atendimento_transicoes`;
  - Plano: Fase 12 (S0–S8).
- Nota no Obsidian: "Hub Imovit/🟡 Dashboards v2 - Dados Acumulados".

### Estado atual
- Nada aplicado no banco, no n8n ou no front. Aguardando aprovação dos docs e respostas P1–P5.
- Dev server (`npm run dev`) iniciado nesta sessão em localhost:5173.

### Decisões e contexto
- Eduardo: assinar o Supabase Pro; o banco passa a acumular em vez de atualizar.
- `dashboard_atendimentos_crm` continua como estado atual, mantida por gatilho, para não quebrar Kanban/TV/views.
- O histórico de etapas só vale a partir do início da captura. Verificar se a API do Imoview tem histórico de fases (S0).
- No Imoview, "Lead qualificado" é a fase 7. "Agendamento" não existe como fase (P1). Todos os corretores estão na equipe "comercial" (P3).

- **Decisões de 29/09 (2ª rodada):** sem etapa Agendamento (funil de 7); filtro "time" descartado; captura 1×/dia; filtro geral: só `colaboradores_raw.equipe = 'comercial' and ativo`, com a ligação pelo nome do corretor.
- Impacto medido: o filtro geral mantém 1.565 de 2.788 atendimentos. Hoje ficam de fora Sandra Nobre (equipe vazia, ativa), Gabriel Rosa ("gestão comercial") e Daniel (direção). Registrado como P6.

### Pendências / próximos passos
- [ ] Eduardo aprovar os docs e responder P2, P4 e P6
- [ ] Supabase Pro + backup confirmado → S1 (migration) → S2 (fluxo n8n novo, importado pelo Eduardo)

### Como retomar
- `docs/06-implementation-plan.md` Fase 12; `npm run dev` na raiz do repo.

---

## Sprint 2026-09-28 (21ª parte) — Apresentação Imovit PUBLICADA

- Função `captacao` **v3** (evento `consultor`, testado: link do Eduardo → "Eduardo Jesus" + WhatsApp). Push `041e374` + ajuste do selo `9299261`; Vercel no ar.
- Verificado em produção (desktop, Chrome):
  - abertura com logo oficial e "Falar/Conversar com Eduardo";
  - creme correto (#F5F0E8); nenhuma imagem quebrada;
  - manifesto em 2 colunas, 4 números em linha, 22 cards (monograma "AR");
  - cartão do consultor com foto e WhatsApp com mensagem pronta.
- Corrigido depois de ver no ar: o selo da abertura herdava o tamanho e a largura do parágrafo e quebrava linha.
- **Não verificado:** visual no celular (as capturas travaram por falta de memória; conferido só por medidas no DOM). `/materiais` logado.

---

## Sprint 2026-09-28 (20ª parte) — Apresentação Imovit refeita (premium; publicada na 21ª)

- O Eduardo achou a 1ª versão vazia: pediu lead de topo (qualquer finalidade), "10 anos", equipe, premium e boutique.
- Nova versão com 10 blocos: barra fixa com "Falar com {consultor}"; abertura; manifesto + números (só dados seguros: 10 anos, tamanho do time, 2 frentes, 1 casa); 4 pilares; jornada em 6 etapas; comprar × alugar (o portal digital de locação e as garantias são fatos do Hub); bairros; **equipe com fotos**; CasaDezoito; cartão do consultor **com foto**.
- Fotos da equipe em `Downloads/drive-download-20260928T171139Z-1-001` (21). 19 recortadas 4:5 em `public/apresentacao/equipe/` (~50 KB cada), dados em `src/lib/equipeImovit.js`. Aline (Hospitalidade, cuida da casa) e Bruno (Fotografia) incluídos nos bastidores, só com o primeiro nome. Antônio Rosa (sócio) **retirado** (sem foto; pedido do Eduardo). Giovana saiu do time: não entra. **Ela ainda consta como ativa em `colaboradores_raw`** e tem código de captação; inativar no CRM.
- Rótulos por área ("Vendas", "Locação"), sem título com gênero. Correções do Eduardo: Roberta = Relacionamento e cultura; Daniele Manteli = Administrativo. Sandra Nobre = Locação (confirmado pelo Eduardo). Antônio Rosa (sócio) e Giovana (recepção) sem foto.
- Build/lint ok; commit local. **Não vista no navegador** (dev server encerrado por memória; aguardando o Eduardo pedir preview ou publicação).
- Ajustes do Eduardo: **logo oficial** `2026 - lares` (coral-grafite na barra, creme no rodapé grafite, com bordas recortadas, 39 KB cada, em `public/apresentacao/`) e o número "1 lar: CasaDezoito" no lugar de "1 casa".

---

## Sprint 2026-09-28 (19ª parte) — Apresentação Imovit + Materiais para clientes (código pronto, NÃO publicado)

- Decisões do Eduardo:
  - CasaDezoito = só o link de `www.casadezoito.com.br`;
  - a apresentação é personalizada pelo consultor;
  - eu escrevo o texto a partir de `00 - Padrão/A Alma da Imovit.pdf` e do `Perfil de Comunicação`.
- Arquivos novos:
  - `src/pages/publico/ApresentacaoImovit.jsx` (`/apresentacao/:token`, estética Editorial Boutique);
  - `src/pages/MateriaisClientes.jsx` (`/materiais`);
  - fotos em `public/apresentacao/` (lounge e fachada da CasaDezoito; as do escritório foram descartadas por mostrarem área de trabalho).
- `supabase/functions/captacao/index.ts`: evento `consultor` → `{nome, whatsapp}` (`telefone_whats` do CRM). **Função ainda não publicada.**
- Build/lint ok. **Não vista no navegador:** o dev server foi encerrado por falta de memória e não deve ser reiniciado sem o Eduardo pedir.
- [ ] Eduardo revisar o texto → publicar a `captacao` (v3) → push.

---

## Sprint 2026-09-28 (18ª parte) — Segurança fechada (S1–S3) + escalada de privilégio corrigida

Autorizado pelo Eduardo ("pode fazer"). Migration `20260928190000_seguranca_endurecimento.sql`, aplicada.
- **CRÍTICO, achado ao testar:** `proteger_campos_perfil` usava `current_user in (postgres…)` para liberar o SQL Editor. Dentro de SECURITY DEFINER, `current_user` é sempre o dono, então a checagem **nunca barrava**: qualquer perfil (Admin, Sem nível) podia se promover a Gestão pela API. Provado antes da correção (o Admin virou Gestão em teste desfeito). Agora barra quando o token é `authenticated`/`anon` e o usuário não é Gestão; SQL Editor e `service_role` (gestao-colaboradores) seguem podendo.
- Backup `dashboard_meta_ads_backup_20260924` trancado (RLS + revoke). `avisos`, `biblioteca_links` e `home_banners` só para a equipe (`is_team`). 4 funções de gatilho fora da API. `search_path` em 10 funções.
- **Testes:** 13 cenários em transação desfeita (confirmado depois que nada ficou gravado):
  - o Admin não se promove nem troca o próprio e-mail; a Gestão muda o papel dos outros; `service_role` suspende; o SQL Editor edita;
  - o cliente do portal lê 0 avisos; a Gestão lê avisos, links, banners e dashboards;
  - o gatilho de histórico funciona com o `search_path` novo.
- **Pós-aplicação:** Security Advisor com **0 ERROR** (antes 10). `/`, `/login`, `/portal/entrar`, `/venda/entrar`, `/tv-display` e captação → 200. Anon lendo o backup → 401; RPC `handle_new_user` → 404.
- Convenções novas em `docs/05-backend-schema.md` §6 (`is_team` em vez de `true`; nunca `current_user` em gatilho definer; SQL Editor vira migration).

### Pendências de segurança
- [x] ~~Senha vazada~~ indisponível (exige plano Pro; decisão do Eduardo: seguir sem). Registro: o Eduardo não achou "Passwords"; fica em Authentication → Sign In / Providers → Email → "Prevent use of leaked passwords" e **exige plano Pro** (o projeto é Free). No Free: subir a senha mínima e exigir caracteres, na mesma tela.
- [x] As 4 contas de Gestão foram confirmadas legítimas pelo Eduardo.
- [x] Backups de 23–24/09 (Meta Ads 23 e 24, leads 23) **apagados** (migration `20260928200000`, autorizada; nada dependia deles).
- [ ] Não verificado com login real depois da mudança: a Home com avisos, links e banners vista por um usuário da equipe (em teste: Gestão ok).

---

## Sprint 2026-09-28 (17ª parte) — Auditoria de segurança: S1/S2 aplicados por FORA desta sessão

Na re-auditoria (pedido do Eduardo), o banco tinha mudado **sem ter sido por mim** e **sem registro em `schema_migrations`**. As funções têm fim de linha CRLF, o que sugere SQL Editor ou outra ferramenta no Windows:
- As 9 views `vw_*` foram para `security_invoker=true`, e o anon perdeu o grant (S1, parte das views).
- As policies `true` foram trocadas por **"so equipe le"** com a função nova `is_team()` (perfil existe e `suspenso_em is null`) em 13 tabelas: leads, colaboradores, CRM, atividades, metas, plantão, fotógrafo, datas. Isso cobre quase todo o S2; a função está correta.
- Teste real depois disso: anônimo e cliente do portal (JWT sem perfil) leem **0 linhas** de leads, equipe, CRM, atividades, perfis, spotify, captações, propostas e Storage privado.

**Ainda aberto:**
- `dashboard_meta_ads_backup_20260924` **sem RLS** (anon lê e grava as 698 linhas).
- `avisos`, `biblioteca_links` e `home_banners` ainda liberados para qualquer logado; o cliente do portal lê os 2 avisos (baixa sensibilidade, decidir).
- S3: 7 funções SECURITY DEFINER executáveis por anon (+ `is_team`, inofensiva), 10 funções sem `search_path`, proteção de senha vazada.
- ~~Repo fora de sincronia~~: o Eduardo confirmou que foi ele com o **OpenCode pelo SQL Editor**. Registrado em `supabase/migrations/20260928180000_seguranca_equipe_registro.sql`: lido do banco, idempotente, validado em transação desfeita. **Não aplicado** via `apply_migration`, então não consta em `schema_migrations`; o estado já está no banco.
- **Cuidado:** o OpenCode e esta sessão mexeram no mesmo banco ao mesmo tempo. Combinar uma ferramenta por vez no banco, e mudanças no SQL Editor viram migration no repo no mesmo dia.

---

## Sprint 2026-09-28 (16ª parte) — Diagnóstico e roadmap de segurança

- **Correção:** o que eu tinha dito, que `colaboradores_raw` estava exposta sem login, estava errado. Olhei só o grant; a leitura real como anon devolve 0 linhas (policy só para `authenticated`).
- Diagnóstico real, feito com leitura como anon e contagem de policies:
  - sem login leem **9 views `vw_*`** e o backup `dashboard_meta_ads_backup_20260924`;
  - qualquer **logado** lê 16 tabelas com policy `true`, e isso inclui cliente do portal, que entra por magic link sem perfil.
- Roadmap S1–S4 escrito em `docs/06-implementation-plan.md` (Fase 1 revista). Nada aplicado ainda.

---

## Sprint 2026-09-28 (15ª parte) — Link de captação com código aleatório (no ar)

- Migration `captacao_links_token`: tabela `captacao_links` (token de 12 caracteres por corretor, sem leitura pela API), 22 tokens criados e RPC `meu_link_captacao()`. Testada em transação antes de aplicar.
- Função `captacao` **v2**: `formulario` e `enviar` exigem o token e resolvem o corretor por ele; saiu a lista de nomes; token desconhecido → 404 "link inválido".
- Front: `/captacao/:token`; formato antigo ou sem código → "Este link de captação não é válido" sem consultar; `MeuLinkCaptacao` usa o RPC.
- Verificado em produção: o link real do Eduardo (`/captacao/kwUw…`) abre com "Eduardo Jesus"; `/captacao/47` mostra "link inválido"; código inventado → 404.
- **Links numéricos enviados antes de 28/09 (~1h de vida) não funcionam mais.** A captação de teste já gravada continua em `/captacoes`.
- URL do link de captação: o Eduardo confirmou que a de produção é `hub.imovit.com.br`, que é a que já sai (`window.location.origin` em `linkCaptacao`). Nada a trocar.
- A proposta do Daniel (`686f0665…`, "Legacy 101", sem condições, do fluxo antigo) foi **descartada** a pedido do Eduardo (status `rejeitada`, motivo no histórico).
- `esteira-locacao-v4`: o Eduardo não a vê no painel, mas a API do Supabase ainda lista (v2, responde 410 "desativada"). É inofensiva; se aparecer no painel, pode ser apagada.

---

## Sprint 2026-09-28 (14ª parte) — Link de captação só do próprio usuário (no ar)

- Pedido do Eduardo: não mostrar os links do time inteiro. `src/components/formularios/MeuLinkCaptacao.jsx` encontra o corretor pelo e-mail do login (`colaboradores_raw.email_oficial`) e mostra só o link dele, com "Copiar meu link de captação", em `/captacoes` e na Home. Sem cadastro no CRM, aparece uma mensagem. A lista de todos saiu.
- Ajuste seguinte (Eduardo): a Home **não** mostra o botão de link, só o item "Captação de imóvel" na lista de Ferramentas. O link fica só em `/captacoes`. Feedback de visita aprovado como está.
- Commit e push feitos; Vercel no ar.
- **Limite:** o link usa o id do CRM (`/captacao/47`), que é sequencial. Quem troca o número cai no formulário de outro corretor, e `/captacao` sem número lista os nomes para escolher. Para o link ser privado de verdade: token aleatório por corretor (tabela nova) e tirar a lista de nomes da função. Oferecido ao Eduardo, não feito.

---

## Sprint 2026-09-28 (13ª parte) — Formulários no Hub PUBLICADOS

- Migration `formularios_captacao_feedback` aplicada; função `captacao` **v1**; push `687a800` (+ docs); Vercel `index-CMo3-Uqs.js`.
- Verificado:
  - `formulario` devolve 22 corretores (só nome e id) e a declaração;
  - honeypot e payload incompleto → 400;
  - rotas `/captacao/47`, `/captacao`, `/captacoes` e `/feedback-visita` → 200;
  - página pública vista em produção, com o corretor fixo pelo link.
- Links do Tally "Formulário de captação" e "Feedback de visita" desativados em `biblioteca_links` (`ativo=false`; para voltar, `ativo=true`).
- **Não testado:** envio real de captação (grava e manda e-mail ao corretor), PDF da captação e do feedback no navegador, telas internas logado. Fica na bateria final.

---

## Sprint 2026-09-28 (12ª parte) — Formulários no Hub: 1ª entrega implementada (publicada na 13ª parte)

### Feito (commit local, sem push)
- Migration `20260928160000_formularios_captacao_feedback.sql`: tabelas `captacoes` (assinatura como data URL com check; declaração gravada junto) e `feedbacks_visita`. Testada em `BEGIN … ROLLBACK` com 12 cenários: anon não lê nem grava; logado não grava captação direto; corretor vê só as dele; gestão vê todas; feedback só em nome próprio; termômetro 1–5.
- Edge Function `supabase/functions/captacao/index.ts`:
  - evento `formulario` devolve corretores e o texto oficial da declaração;
  - evento `enviar` valida com zod, tem honeypot `site`, resolve o corretor na lista do CRM, grava com IP/UA e manda e-mail só ao corretor.
- Front:
  - `/captacao/:corretorId` público, em 7 etapas, assinatura e PDF no navegador (`src/pages/publico/CaptacaoPublica.jsx`);
  - `/captacoes` com lista, detalhe com PDF e links dos corretores (`src/pages/admin/Captacoes.jsx`);
  - `/feedback-visita` com form, PDF e histórico (`src/pages/FeedbackVisita.jsx`);
  - `DocumentoCaptacao`/`DocumentoFeedback` e `lib/pdf.js`;
  - menu "Ferramentas", bloco "Ferramentas" na Home, `ACESSO.formularios`;
  - `toDataURL` no `AssinaturaPad`.
- Build/lint ok; sintaxe da função ok.

### Não feito / não testado
- **Nada publicado**: migration, função `captacao` e push, nesta ordem (tudo aditivo, não quebra nada do que está no ar).
- Telas não vistas no navegador (a página pública precisa da função publicada).
- Depois de publicar: desativar os links do Tally "Formulário de captação" e "Feedback de visita" em `biblioteca_links` (`ativo=false`).

### Achado de segurança (anterior a este trabalho)
- `colaboradores_raw` é legível sem login (policy `hub_read` com `true` + grant para anon): nomes, e-mails, telefones e nascimentos da equipe. A página pública de captação **não** lê essa tabela (a lista vem pela função). Corrigir em sprint próprio (conferir antes quem lê sem login: TV? n8n?).

---

## Sprint 2026-09-28 (11ª parte) — Formulários no Hub: especificação (Fase 11), aguardando aprovação

**Objetivo:** "Links úteis" vira **Ferramentas**, com formulários dentro do Hub. Primeira entrega (decisão do Eduardo): **Captação** e **Feedback de visita**. Depois: Apresentação Imovit e Sobre a CasaDezoito (páginas públicas), Avaliação, Guia de visita e Relatório do imóvel.

### Feito (commit `a50e54b`, só docs, sem código)
- Lidos os dois forms do Tally pelas páginas públicas (`documentos.imovit.com.br/r/b5dNB6` e `/r/PdEJv1`): campos, opções e textos. Descoberta: o "Formulário de captação" é preenchido pelo **proprietário** (CPF, assinatura, declaração de honorários: locação = 1º aluguel, administração 8%, venda 6%).
- Decisões do Eduardo: captação por **link fixo do corretor** (público); depois de assinar → PDF + aviso à equipe + lista no Hub; feedback → **só PDF**; apresentações → página pública com link; links externos **somem aos poucos**.
- PRD §5.7 + RF23, app-flow, schema §2.5b (`captacoes`, `feedbacks_visita`, escrita da captação só via Edge Function) e plano Fase 11.

### Pendências
- [ ] Eduardo aprovar o PRD §5.7 e responder: quem recebe o aviso de captação? A captação só registra ou passa por revisão?
- [ ] Depois da aprovação: Fase 11.1 → 11.5.

---

## ▶ Sprint 2026-09-28 (10ª parte) — Esteira de locação v4 PUBLICADA

**Estado:** no ar desde 28/09. O fluxo é: gestor registra as condições negociadas → locatário valida (ou pede correção) → esteira de documentos. Não há mais aprovação interna.

### Feito
- Teste do Eduardo no localhost (função de teste): "Gabriel Teste" (`36ef7c29…`) recebeu as condições (seguro-fiança, posse 16/12, 30 meses, dia 10, taxa 8%), foi validada e entrou em `aguardando_docs`.
- Publicação, nesta ordem:
  1. Etapa B `esteira_v4_limpeza` aplicada: a proposta do Daniel (`686f0665…`) foi para `aguardando_locatario`, o check de status fechou e os RPCs antigos foram removidos.
  2. `esteira-locacao` **v20** com o código do repo.
  3. Push `62c6113` (+ docs); a Vercel serve `index-6tlexV5k.js`.
- Limpeza: `esteira-locacao-v4` desativada (v2 responde 410; **apagar pelo painel** do Supabase, porque o conector não apaga função). `.env.development.local` removido; dev server reiniciado apontando para `esteira-locacao`.

### Verificado
- Banco: 0 RPCs antigos; os 5 novos existem; o check não tem mais `aguardando_aprovacao_interna`; as duas migrations estão em `schema_migrations`.
- Função v20: aceita `validar_proposta` (parou no 401) e recusa `decisao_interna` (400). O site publicado não referencia a função de teste.

### Pendências
> **Decisão do Eduardo (28/09):** prazo curto para liberar o projeto. Os testes de ponta a ponta ficam para o final. Enquanto isso, se algo falhar em uso real, olhar primeiro os logs das funções `esteira-locacao` e `proposta-venda` no Supabase.

**Bateria de testes do final (antes de dar o projeto por encerrado):**
- [ ] Locação: criar → e-mail → "Algo está errado" → "Corrigir e reenviar" → validar → cadastro → documentos → aprovar → finalizar.
- [ ] Venda: criar → e-mail → magic link volta para `/venda` → assinar → PDF baixa (proponente e gestão) → e-mail chega em daniel@/gabriela@.
- [ ] Confirmação de e-mail no cadastro de colaborador novo (Redirect URLs do Supabase).
- [ ] TV com o Marketing logado.
- [ ] Captação: abrir o link de um corretor, preencher e assinar → PDF baixa → e-mail chega ao corretor → aparece em `/captacoes` → PDF baixa pelo Hub.
- [ ] Feedback de visita: salvar → PDF baixa → aparece no histórico.

**Outras pendências:**
- [ ] A proposta do Daniel (`686f0665…`, "Legacy 101") voltou para validação **sem condições** (fluxo antigo): editar e preencher, ou descartar se for teste.
- [ ] Apagar a função `esteira-locacao-v4` no painel do Supabase.

---

## Sprint 2026-09-28 (9ª parte) — Esteira v4 em TESTE no localhost (produção intacta)

**Contexto:** o Eduardo testou o localhost e caiu no formulário antigo. Era mistura de versões: front novo com função e site antigos. A função antiga descartou os campos novos (proposta "Gabriel Teste" `36ef7c29…` ficou sem condições) e recusou `validar_proposta` (400). Ele pediu para testar antes de publicar.

### Feito (commit `62c6113` + aplicado no banco)
- Migration dividida em duas:
  - **A** (`20260928140000`, **aplicada**), só aditiva: RPCs antigos e o status `aguardando_aprovacao_interna` continuam. Provado em transação antes de aplicar: o fluxo antigo (criar → confirmar → aprovação interna → docs, com chamada nomeada como o PostgREST faz) e o novo convivem.
  - **B** (`20260928150000_esteira_v4_limpeza.sql`, **não aplicada**): move a proposta do Daniel, fecha o check e remove os RPCs antigos.
- Função paralela **`esteira-locacao-v4`** (v1) publicada. É **cópia de teste**: links dos e-mails para `http://localhost:5173`, avisos internos só para eduardo@, assunto com "[TESTE]". Não está no repo.
- `src/lib/esteira.js` lê `VITE_FUNCAO_ESTEIRA`. `.env.development.local` (fora do git) = `esteira-locacao-v4`, e só vale no `npm run dev`. Dev server reiniciado; conferido que o localhost chama a v4.
- Smoke: a v4 aceita `validar_proposta` (parou no 401 de token); a `esteira-locacao` (v19, site) segue a antiga.

### Como testar (Eduardo)
1. `localhost:5173/admin/propostas` → **Editar** "Gabriel Teste" → preencher as condições → "Salvar e reenviar". O e-mail "[TESTE]" vai para eduardo@ (o locatário dessa proposta).
2. `localhost:5173/portal` (mesmo login, porque o e-mail do locatário é o seu): proposta preenchida → "Algo está errado" → volta com a correção para Propostas → "Corrigir e reenviar" → validar → cadastro/documentos.
3. Para testar com outro e-mail de locatário: janela anônima, login no `localhost:5173/portal/entrar`.

### Publicar depois do teste ok
- [ ] Aplicar a etapa B → publicar o código do repo em `esteira-locacao` → push → apagar `.env.development.local` e a função `esteira-locacao-v4`.

---

## Sprint 2026-09-28 (8ª parte) — Condições negociadas na esteira v4 — pronta, NÃO publicada

**Objetivo:** o Eduardo mostrou o modelo de e-mail que o gestor já manda e pediu os campos no formulário e no processo, com a taxa de administração.

### Feito (commit `fb73368`, local; soma-se ao `506fe89` abaixo)
- Migration `20260928140000` ampliada:
  - Colunas `corretor_responsavel`, `garantia` (lista fechada), `data_posse`, `prazo_meses`, `dia_vencimento`, `clausula_rescisao`, `negociacao_especifica`. `observacoes` passa a ser "outros combinados e benfeitorias".
  - Tabela **`propostas_locacao_interno`** com a `taxa_administracao`. Motivo: o portal lê `propostas_locacao` inteira e a RLS não esconde coluna. Equipe e corretor dono leem; o locatário, não.
  - RPCs criar/editar recebem `p_termos jsonb`, validados em `validar_termos_locacao`.
- `esteira-locacao`: `termosSchema` (zod) nos dois eventos. O e-mail "esteira aberta" busca a taxa na tabela interna. As condições aparecem nos e-mails, com a taxa só no da equipe.
- Front:
  - `TermosProposta.jsx` (detalhe, painel da Esteira, Processos, portal sem taxa).
  - `useCorretores.js` (lista `colaboradores_raw`; sugere o corretor pelo e-mail de quem cria).
  - Formulário em `Propostas.jsx`.
  - `GARANTIAS` em `esteiraLabels.js`.
  - Modais agora rolam por dentro (`components.css`).
- Docs: PRD §5.6, schema, app-flow, plano 10.2b.

### Estado atual
- Migration testada em `BEGIN … ROLLBACK`: 15 cenários ok. Termos obrigatórios; dia 40 e taxa de 150% barrados; o locatário vê 0 linhas da tabela interna e `null` pela view; a gestão vê 8%; editar atualiza termos e taxa; validar ok.
- Build/lint ok. Prévia dos e-mails ok (taxa ausente no do locatário). Formulário visto no navegador (localhost, logado): campos, obrigatórios e corretor pré-preenchido ("Eduardo Jesus"). **Não enviei** nada, porque a função em produção ainda é a antiga.
- **Nada publicado.** `main` 2 commits à frente do origin.

### Pendências / próximos passos
- [ ] Autorização do Eduardo → aplicar a migration → publicar `esteira-locacao` → push (no mesmo momento).
- [ ] Teste de ponta a ponta com um e-mail de teste (criar → validar/corrigir → esteira).

---

## Sprint 2026-09-28 (7ª parte) — Esteira de locação v4 (Fase 10) — pronta, NÃO publicada

**Objetivo:** fluxo definido pelo Eduardo: locatário negocia → locador aceita → **gestor registra a proposta com os termos (com observações)** → sistema envia → locatário **valida ou pede correção** → validando, entra na esteira. Sai a aprovação interna.

### Feito (commit `506fe89`, local)
- Migration `supabase/migrations/20260928140000_esteira_v4_validacao_locatario.sql`: status `correcao_solicitada`, coluna `motivo_correcao`, RPCs `criar_proposta_locacao` (nova assinatura, grava `criado_por`), `editar_proposta_locacao`, `validar_proposta_locatario`, `pedir_correcao_proposta`. Saem `confirmar_dados_locatario` e `decidir_aprovacao_interna`. A proposta de teste do Daniel (`686f0665…`, na aprovação interna) volta para `aguardando_locatario`.
- **Bugs antigos corrigidos na migration:**
  - `bloquear_avanco_expirado` olhava o prazo antigo, e renovar não destravava.
  - O prazo de 7 dias valia para o processo inteiro e expirava propostas no meio dos documentos. Agora validar dá 30 dias.
  - Criar por cima de proposta com prazo vencido sobrescrevia até processo concluído.
- `esteira-locacao`: eventos `editar_proposta`, `validar_proposta`, `pedir_correcao`; e-mails `emailPropostaParaValidar`, `emailCorrecaoPedida`, `emailEsteiraAberta`.
- Front: `Propostas.jsx` (form com telefone, valor negociado, observações; fila de correções; editar/corrigir e reenviar), `PropostaDetalheModal.jsx`, `PortalStatus.jsx` (validação só leitura + "Algo está errado"; 4 etapas), `esteiraLabels.js`, `usePendenciasHome.js`.
- Docs: PRD §5.6 (aprovado, com as regras), app-flow §3/§5, schema, plano Fase 10.

### Estado atual
- Migration testada em `BEGIN … ROLLBACK` em produção: 16 cenários. O teste pegou um bug meu: sem perfil, `NOT (NULL OR NULL)` deixava editar. Corrigido com `coalesce` e retestado.
- Build ok, oxlint sem erros, sintaxe da função ok (esbuild). Prévia dos e-mails no Node ok, com HTML escapado.
- **Nada publicado.** Ordem obrigatória, no mesmo momento: migration → `esteira-locacao` → push. Portal antigo com função nova (ou o contrário) quebra a etapa 1.
- **Não testado:** as telas no navegador; ciclo real com e-mail.

### Decisões assumidas (Eduardo pode rever)
- Validação por clique com caixa "Li e confirmo que estes são os termos combinados" (sem assinatura desenhada).
- Alerta "esteira aberta" para a lista que já existia (gabriel@, daniele@, administrativo@, administrativo3@).
- 30 dias para cadastro e documentos depois de validar.
- Correção pedida vai para quem registrou a proposta; sem dono, gabriel@/daniele@.

### Pendências / próximos passos
- [ ] Autorização do Eduardo → aplicar a migration → publicar `esteira-locacao` → push.
- [ ] Teste de ponta a ponta com um e-mail de teste, incluindo um ciclo de correção.

---

## Sprint 2026-09-28 (6ª parte) — Ajustes da venda após o teste do Eduardo — NO AR

**Objetivo:** corrigir o que o Eduardo achou no teste real: "Visualizar" em `/admin/vendas/processos` não funcionava, a gestão não chegava ao PDF e faltava um botão de voltar ao terminar.

### Feito (commit `beadda7`, push feito, Vercel publicou `index-BYHFSDAv.js`; inclui a navegação `8cd6e50`)
- **Causa do "Visualizar":** o `VendaDetalheModal` (feito no OpenCode) não tinha `.modal-overlay`. O modal ia para o fim do `<body>` sem posicionamento, fora da vista. Era também por isso que a gestão não chegava ao PDF: a permissão estava certa (conferido simulando o JWT da gestão: 1 proposta e 2 arquivos visíveis).
- Modal com overlay (clique fora fecha) e botão principal "Baixar proposta assinada (PDF)". Aviso quando a proposta está assinada sem PDF.
- Botão **PDF** direto na linha da tabela. Download por URL assinada gerada no clique (60 s, com nome do arquivo).
- Portal `/venda`, depois de assinar: **"Voltar ao painel"** (equipe → `/admin/vendas/processos`) ou **"Concluir e sair"** (cliente, que não tem painel no Hub: sai da sessão e volta para `/venda/entrar`).

### Estado atual
- Verificado no navegador (localhost, logado como gestão): Processos lista a proposta de teste; "Visualizar" abre o modal com os dados e o botão de PDF. **Não cliquei no download** (baixaria um arquivo na máquina do Eduardo); a permissão foi conferida no banco.
- Proposta de teste real no banco: `697e3b6b…` (Fulano de Tal, assinada, com PDF), deixada como está.

### Pendências / próximos passos
- [ ] Eduardo confirmar o download do PDF pela gestão em produção.
- [ ] Descartar ou manter a proposta de teste `697e3b6b…`.
- [ ] 4 respostas da esteira v4 (PRD §5.6).

---

## Sprint 2026-09-28 (5ª parte) — Menu Propostas: locação e venda separadas

**Objetivo:** pedido do Eduardo: um menu "Propostas" em que se entra em locação ou venda, cada uma com a própria subnavegação.

### Feito (commit `8cd6e50`, local, sem push)
- `src/lib/propostasNav.js`: definição única das áreas. Locação: Propostas / Esteira / Processos. Venda: Propostas / Processos.
- `Navbar.jsx`: "Propostas ▾" com os submenus Locação ▸ e Venda ▸ (no lugar de "Vendas" e "Locação"). Fica destacado em `/propostas` e `/admin/*`.
- `src/pages/PropostasInicio.jsx` (`/propostas`): um cartão por área, filtrado pelo nível de acesso.
- `src/components/layout/SubnavPropostas.jsx`: caminho "Propostas › Área" e as abas `.tabs`, no topo das 5 páginas. Títulos simétricos ("… de locação" / "… de venda").
- Venda: `Vendas.jsx` ganhou `modo`. "propostas" (`/admin/vendas`) mostra só as que aguardam assinatura e o botão de criar; "processos" (`/admin/vendas/processos`, rota nova) mostra o histórico completo com o PDF.
- Bug corrigido: a coluna Prazo da venda sempre mostrava "—", porque `STATUS_COM_PRAZO` não tinha `aguardando_cliente`.
- Busca da Home: entradas `/propostas` e "Processos de venda". Docs: `03-app-flow.md` §1 e §3.

### Estado atual
- Build ok, oxlint sem erros.
- **Não verificado no navegador:** o Chrome abriu `localhost:5173` na tela de login e eu não entro com a senha real do Eduardo. O dev server ficou rodando em 5173.
- **Push não feito:** esperando o Eduardo ver a navegação.

### Pendências / próximos passos
- [ ] Eduardo loga no localhost (ou autoriza o push) → conferir o dropdown, os flyouts, `/propostas` e as abas → push.
- [ ] Demais pendências: teste real da venda; 4 respostas da esteira v4.

---

## Sprint 2026-09-28 (4ª parte) — Tudo no ar

**Objetivo:** a pedido do Eduardo ("coloca tudo no ar"), publicar o que estava pronto.

### Feito
- `esteira-locacao` **v19** publicada: conteúdo idêntico ao commit `f974bdd` (aviso ao administrativo@/administrativo3@ + caixa "Detalhes da proposta" no e-mail).
- **Push** `bf10035..d57629b` para `origin/main`, feito pelo terminal, sem problema. A Vercel publicou: `hub.imovit.com.br` serve o bundle `index-i6Itosal.js`, que já tem a rota `/venda/entrar`.

### Estado atual
- No ar: proposta de venda (banco + função v1 + telas), tela de confirmação de e-mail, Marketing na TV, meta de 90 dias, detalhes da proposta de locação.
- Verificado: as rotas `/venda/entrar`, `/venda`, `/admin/vendas` e `/portal/entrar` respondem 200. As duas funções sobem e validam o payload (400 com evento inválido).
- **Não testado:** fluxo real no navegador, com e-mails de verdade (venda e locação).
- Nada local pendente; o `handoff.md` segue fora do git.

### Pendências / próximos passos
- [ ] Teste real da venda (`docs/proposta-venda-teste.md`): magic link volta para `/venda`, e-mail chega em daniel@/gabriela@, PDF baixa.
- [ ] 4 respostas do Eduardo → esteira v4 (Fase 10).

---

## Sprint 2026-09-28 (3ª parte) — Proposta de venda publicada (banco + função)

**Objetivo:** com a autorização do Eduardo, aplicar a migration de venda e publicar a função.

### Feito
- Migration `propostas_venda` aplicada pelo conector: SQL idêntico ao testado em transação desfeita. Está registrada em `schema_migrations`.
- Edge Function `proposta-venda` **v1** publicada (`verify_jwt` ligado).
- Commit do código de venda: `fde1332`. Docs marcados como publicados.

### Estado atual
- Verificado no banco: 2 tabelas + view, bucket privado, 5 policies. `authenticated` sem UPDATE; `anon` sem leitura; RPCs de estado sem execução por anon/authenticated.
- Teste de fumaça na função: payload inválido → 400; token sem usuário → 401. A função sobe e valida identidade.
- Advisors: nada novo de risco. Os avisos das funções `pode_*_venda` e `registrar_documento_venda` executáveis por `authenticated` são intencionais (RLS/Storage e registro do PDF).
- **Não testado:** fluxo real no navegador (criar → e-mail Brevo → magic link `/venda` → assinar → PDF). Também não conferi se `BREVO_API_KEY` está nas secrets do projeto (a `esteira-locacao` usa a mesma).
- `main` 7 commits à frente do origin. **O push é seguro agora:** o banco e a função da venda existem, e os commits de 24/09 só mudam telas e rótulos, sem depender da `esteira-locacao` nova.

### Pendências / próximos passos
- [ ] Push (Eduardo).
- [ ] Teste real com `docs/proposta-venda-teste.md`: conferir se o magic link volta para `/venda` (Redirect URLs) e se o e-mail chega em daniel@/gabriela@.
- [ ] Publicar `esteira-locacao` com as mudanças de 24/09 (produção v18), ou juntar com a Fase 10.
- [ ] Respostas das 4 perguntas da esteira v4 (PRD §5.6).

---

## Sprint 2026-09-28 (2ª parte) — Decisões da venda, PDF baixável e proposta da esteira v4

**Objetivo:** aplicar as respostas do Eduardo na venda e publicar; documentar a nova dinâmica da locação.

### Feito
- **Venda:** aviso de proposta assinada agora vai para `daniel@` e `gabriela@` (`supabase/functions/proposta-venda/index.ts:110`). O Eduardo confirmou que gabriela@ é uma caixa real, apesar de não ter login no Hub. Não vai para o Imoview. A assinatura desenhada vale.
- **PDF baixável direto na página** (`src/pages/portal/PortalVenda.jsx`): botão "Baixar proposta assinada (PDF)" sempre que o proponente volta, com URL assinada de 60 s e download com nome do arquivo. Se o PDF falhou na hora, aparece "Gerar PDF da proposta". A assinatura entra no PDF como blob local, porque a imagem do Storage (outro domínio, sem CORS) contaminaria o canvas do html2canvas. `/admin/vendas` também baixa em vez de abrir aba.
- **Docs** (commit `871cd69`): PRD §5.5 com as decisões; **PRD §5.6 + RF22** (esteira v4), app-flow, schema (mudanças previstas) e **plano Fase 10**.

### Estado atual
- Build ok, oxlint limpo nos arquivos de venda. PDF **não testado no navegador**.
- **Bloqueado:** `apply_migration` da venda foi negado pelo modo automático (deploy em produção precisa de autorização do Eduardo). Por isso a migration e a função `proposta-venda` **continuam não aplicadas**, e o código de venda continua fora do git.
- Esteira v4: **só documentada**, nenhum código (framework: aguarda aprovação do PRD §5.6).
- `main` 5 commits à frente do origin.

### Pendências / próximos passos
- [ ] Eduardo autorizar o deploy → aplicar a migration `20260925130000_propostas_venda` (SQL idêntico ao testado) → publicar `proposta-venda` → commit do código de venda → push.
- [ ] Eduardo aprovar o PRD §5.6 e responder as 4 perguntas (quem recebe "esteira aberta", clique × assinatura, edição antes da validação, propostas presas em aprovação interna) → Fase 10.
- [ ] Publicar `esteira-locacao` (mudanças de 24/09) antes do push, ou juntar com a Fase 10.

---

## Sprint 2026-09-28 — Auditoria do trabalho do OpenCode (25/09), commits separados e correção da proposta de venda

**Objetivo:** conferir se o trabalho feito no OpenCode na sexta afetou a estrutura; separar os commits misturados; corrigir a feature de proposta de venda antes de ela ir para produção.

### Feito
- **Auditoria:** o OpenCode fez (a) commit `b7c5bb2` (Marketing vê a TV + meta 90d) e a migration `20260925120000_kpis_tv_meta_90d`, **aplicada em produção pelo SQL Editor, fora de `schema_migrations`**; (b) a feature de proposta de venda inteira, fora do git e não aplicada. Nada da esteira nem do RLS existente foi mexido no banco.
- **Commits separados** (locais, sem push): `f974bdd` esteira + confirmação de e-mail (trabalho de 24/09); `cc78a2b` migration kpis_tv 90d; `0bc97b3` docs. O `handoff.md` saiu do stage (fica fora do git).
- **Correções da venda:**
  - `supabase/migrations/20260925130000_propostas_venda.sql`: os RPCs `criar_`/`confirmar_`/`descartar_proposta_venda` liam `auth.uid()`/`auth.jwt()`, que ficam vazios quando a Edge Function chama com a service role, então **criar e assinar falhariam sempre**. Agora recebem `p_criado_por`/`p_email_chamador` e só a `service_role` executa. `authenticated` só lê (antes a policy de UPDATE deixava o proponente/corretor mudar `status`/valores direto pela API). Storage: `assinatura.png` só enquanto aguarda e no prazo, `documento.pdf` uma vez depois de confirmada. Histórico do descarte grava o status anterior real. RPC nova `registrar_documento_venda`. A confirmação exige a assinatura no Storage.
  - `supabase/functions/proposta-venda/index.ts`: passa a identidade para os RPCs; o `criado_por` vai direto no insert (sai o update separado).
  - `src/pages/portal/PortalVenda.jsx`: `documento_path` via RPC, não por UPDATE direto.
  - Docs: PRD §5.5 + RF21, app-flow (fluxo de venda, TV do Marketing), schema §2.3b + Storage + `meta_leads_90d`, plano Fase 9. `docs/proposta-venda-teste.md` ajustado.

### Estado atual
- `npx vite build` ok; oxlint sem erros novos. Deno não instalado: a Edge Function **não foi checada por tipo**.
- Migration de venda **testada em produção dentro de uma transação desfeita**: 20 cenários passaram (criar com e sem papel, UPDATE direto bloqueado, RPC pela API bloqueada, Storage por etapa, intruso não vê nada, confirmar com e-mail errado ou 2×, PDF uma vez só, descarte com histórico certo). Conferido depois: banco sem nenhuma sobra.
- **Não aplicado:** a migration de venda e a função `proposta-venda`. O código de venda (frontend + função + migration) continua **fora do git de propósito**: se entrasse num push antes da migration, o menu "Vendas" apareceria quebrado.
- Não testado: fluxo de ponta a ponta no navegador (criar → e-mail → assinar → PDF).
- `main` 4 commits à frente do origin (`b7c5bb2`, `f974bdd`, `cc78a2b`, `0bc97b3`); push é com o Eduardo.

### Decisões e contexto
- Padrão para Edge Functions com service role: o RPC recebe a identidade como parâmetro e só a `service_role` executa. Nunca confiar em `auth.uid()` dentro de RPC chamado pela service role.
- O `kpis_tv` aplicado pelo SQL Editor funciona; só falta registrar em `schema_migrations` (ou aceitar a divergência até a migration-base da Fase 2).

### Pendências / próximos passos
- [ ] Eduardo aprovar o PRD §5.5 e responder: assinatura desenhada basta juridicamente? Quem mais recebe o e-mail? Vai para o Imoview?
- [ ] Aplicar a migration de venda → publicar `proposta-venda` → commit do código de venda → push (nessa ordem).
- [ ] Rodar `docs/proposta-venda-teste.md` com um e-mail de teste.
- [ ] Publicar `esteira-locacao` (mudanças de 24/09 já commitadas em `f974bdd`; produção segue v18) antes do push.
- [ ] Pendências do sprint de 24/09 abaixo continuam valendo (n8n `crm_atendimentos`, Redirect URLs etc.).

### Como retomar
- `cd C:\Users\eduar\hub-imovit` → `npm run dev -- --port 5173 --strictPort`.
- Supabase pelo conector MCP (`vlsrmtryzwddqkwqugfr`). O teste em transação desfeita está em `docs/05-backend-schema.md` §6 (convenção); o script usado ficou só no scratchpad da sessão.

---

## Sprint 2026-09-24 (pausado no fim do dia; commitado em 28/09 como `f974bdd`) — Esteira, confirmação de e-mail e negócios do CRM

**Objetivo:** (1) ajustes da esteira de locação; (2) aviso claro de confirmação de e-mail no cadastro; (3) fazer o Hub/TV mostrarem os negócios reais de setembro (1 venda + 4 locações). **Eduardo pediu para não commitar ainda**: vêm mais alterações da esteira; o aviso de e-mail entra no mesmo commit.

### Feito
**Esteira (código, não commitado, função não publicada)**
- `supabase/functions/esteira-locacao/index.ts`: `DESTINATARIOS_NOVA_ESTEIRA` = gabriel@, daniele@, **administrativo@, administrativo3@**, usada no e-mail "Nova proposta aguardando revisão interna" (evento `confirmar_dados_locatario`). Os e-mails de documentos continuam só para gabriel@/daniele@.
- `emails.ts`: caixa "Detalhes da proposta" no e-mail de revisão interna (valor ofertado × anúncio e o texto do locatário, quebras de linha, HTML escapado). Prévia no Node ok, `<script>` escapado.
- Portal (`src/pages/portal/PortalStatus.jsx`): "Observações (opcional)" → **"Detalhes da proposta"**, 4 linhas, placeholder "Ex.: contrato de 30 meses, aluguel de R$ 3.500 com condomínio incluso, garantia por seguro-fiança, entrada no dia 10/11." e dica. Continua opcional; coluna do banco segue `observacoes`.
- `src/components/esteira/PropostaDetalheModal.jsx`: rótulo "Detalhes da proposta (enviados pelo locatário)".

**Confirmação de e-mail no cadastro (código, não commitado)** — aprovado visualmente pelo Eduardo
- Bug: em `src/pages/Login.jsx` o aviso "Conta criada!…" era apagado na mesma hora por `trocarModo('entrar')`; ninguém via nada. E login sem confirmar dizia "E-mail ou senha inválidos".
- Agora: tela **"Confirme seu e-mail"** (endereço, 3 passos, dica de spam, "Já confirmei, quero entrar", "Não recebi, reenviar o e-mail" via `auth.resend`); login com `email_not_confirmed` leva à mesma tela; e-mail já cadastrado (Supabase devolve usuário sem `identities`) → mensagem clara; `emailRedirectTo: window.location.origin`; frase no formulário avisando do link. Estilos `.login-confirmar*` e `.login-ok` em `src/styles/hub.css`.
- Prévia só em dev: `http://localhost:5173/login?previa=confirmar` (`import.meta.env.DEV`; funciona logado; não vai para produção).

**Negócios do CRM (dado corrigido em produção; fluxo ainda não)**
- Causa: o fluxo n8n `crm_atendimentos` (`v2opiXsT9CXVJPXm`, diário 19h) não envia data de fechamento no `HTTP Request2`. E o campo `datafechamento` da API do Imoview vem **vazio em 100%** dos atendimentos: a data real é `imoveisnegocio[].datanegocio` (`dd/MM/yyyy HH:mm`), que bate com as 82 datas antigas do Hub (vindas de uma importação antiga). A API não tem nome de fase (`fase_nome` não tem origem).
- Setembro no Imoview: venda **5982** (15/09); locações **6063** (04/09), **6136** (08/09), **6166** (15/09), **6179** (16/09). 6136 e 6166 nem existiam no Hub; 5982 e 6179 estavam paradas em Proposta.
- Corrigido por SQL (upsert, só preenchendo): 5649, 5747, 5832, 5843, 5840, 6099, 6063, 6136, 5982, 6166, 6179 → fase 6, "Negócio realizado", `data_fechamento` = data do negócio.
- Fluxo de teste só leitura `rWVvOpZO353nB0e4` usado para ler o Imoview; **já arquivado**.
- Docs: PRD (regra da esteira), `docs/03-app-flow.md` (Login + fluxo do novo colaborador + destinatários §5).

### Estado atual
- `npx vite build` ok; oxlint sem erros. Dev server rodando em `localhost:5173` (pode ter caído ao fechar a sessão).
- **Nada commitado** deste sprint. `main` segue 6 commits à frente do origin (push pendente, Eduardo).
- **Edge Function `esteira-locacao` NÃO publicada** (produção segue v18): notificação ao administrativo e detalhes no e-mail só valem após o deploy. Portal e Login só mudam após o push.
- Não testado: portal logado como locatário; cadastro real com e-mail @imovit novo (se `localhost` não estiver nas Redirect URLs do Supabase, o link cai na Site URL de produção). Confirmação de e-mail está ligada no Supabase.
- Negócios: **verificado** `kpis_tv().comercial.negocios_fechados_mes` = 5 (1 venda + 4 locações) simulando login da Gestão. Mas o fluxo diário **ainda não foi corrigido**: os próximos fechamentos voltam a ficar sem data até o Eduardo colar a mudança abaixo.

### Decisões e contexto
- Data de fechamento = `imoveisnegocio[].datanegocio` do negócio "Realizado" (a mais recente, se houver mais de um). `datafechamento` da API não serve.
- O corpo novo só manda `data_fechamento` quando existe, para o upsert (`merge-duplicates`) não apagar datas já gravadas (inclusive de descartados, usadas em `analiseAtendimentos.js`). `JSON.stringify` evita JSON quebrado por aspas em campanha/nome (hipótese para 6136/6166 nunca terem entrado, **não confirmada**).
- Tirar o `dataInicial` do `HTTP Request1`: vai como `yyyy-MM-dd` (Imoview usa `dd/MM/yyyy`) e fechamentos escapam. Sem filtro o fluxo relê tudo; no teste, as fases 5–6 levaram ~14 s.
- Edições de fluxo n8n: Eduardo cola no editor (o conector recria credenciais). Fluxo novo pelo conector precisa que ele vincule a credencial Header Auth do Imoview.
- Segredo em texto no n8n: a versão publicada do `crm_atendimentos` tem a `chave` do Imoview e o MD5 da senha em texto; o "Repique leads > 11D/30D" também tem o MD5. Mover para credenciais.

### Pendências / próximos passos
- [ ] **Eduardo cola no `crm_atendimentos`**: (a) apagar o parâmetro `dataInicial` do `HTTP Request1`; (b) JSON Body do `HTTP Request2`:
  ```
  ={{ JSON.stringify(Object.assign({
    codigo: $json.codigo,
    corretor: $json.corretor,
    data_de_entrada: $json.datahoraentradalead ? DateTime.fromFormat($json.datahoraentradalead, 'dd/MM/yyyy HH:mm').toISODate() : null,
    fase: $json.fase,
    funil: $json.funil,
    campanha: $json.campanha,
    midia: $json.midia,
    situacao: $json.situacao,
    finalidade: $json.finalidade
  }, (() => {
    const d = ($json.imoveisnegocio || []).filter(n => n.situacaonegocio === 'Realizado' && n.datanegocio).map(n => DateTime.fromFormat(n.datanegocio, 'dd/MM/yyyy HH:mm').toISODate()).sort().pop();
    return d ? { data_fechamento: d } : {};
  })())) }}
  ```
  Depois rodar uma vez e conferir a execução (`get_execution`), e se setembro continua 1 + 4.
- [ ] Investigar por que 6136/6166 nunca entraram, junto com "CRM não sincroniza desde 22/09".
- [ ] Mais alterações da esteira (Eduardo) → commit único (esteira + confirmação de e-mail) → deploy da `esteira-locacao` pelo conector do Supabase → push, quando o Eduardo liberar.
- [ ] Testar cadastro real com e-mail @imovit novo; conferir Redirect URLs no Supabase (Authentication → URL Configuration).
- [ ] Mover `chave`/MD5 do Imoview para credenciais no n8n (`crm_atendimentos` publicado e "Repique leads").

### Como retomar
- `cd C:\Users\eduar\hub-imovit` → `npm run dev -- --port 5173 --strictPort`.
- Supabase pelo conector MCP (projeto `vlsrmtryzwddqkwqugfr`); CLI não está logado. n8n pelo conector (`n8n.srv1552977.hstgr.cloud`); se pedir login, `/mcp`.
- Conferir negócios do mês: `select finalidade, to_char(data_fechamento,'YYYY-MM'), count(*) from dashboard_atendimentos_crm where situacao='Negócio realizado' and data_fechamento >= '2026-09-01' group by 1,2;`
- Tarefas no Obsidian: 🟡 Dados de Performance e Conversões Google (fluxo do CRM) e 🟡 Níveis de Acesso e Perfil (confirmação de e-mail).

---

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
