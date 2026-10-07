# App Flow — Hub Imovit
**Base:** PRD v0.1 · **Data:** 2026-09-24 · retroativo (reflete `src/App.jsx`, `src/lib/acessos.js` e `Navbar.jsx`)

## 1. Mapa de telas
```
/login ─┬─> / (Home) ── todos com perfil
        │     ├─ Navbar ─┬─ Propostas ▾ ─> /propostas (escolher)             (gestao, adm, corretor)
        │     │          │   ├─ Locação ▸  Propostas · Esteira · Processos
        │     │          │   └─ Venda ▸    Propostas · Processos            — áreas separadas (28/09)
        │     │          ├─ Dash ▾      Negócio ▸ Visão Geral · Leads        (gestao, marketing)
        │     │          │              Performance ▸ Performance · Campanhas
        │     │          │              Funil
        │     │          │              Adm locação  (gestao) — RF26
        │     │          │              Kanban ▸ Quadro · Dados · Atividades (gestao, adm)
        │     │          ├─ TV Display                                         (gestao, adm, marketing, tvaccess)
        │     │          └─ Configurações                                      (gestao, marketing)
        │     └─ rodapé da navbar: foto + nome + nível ─> /perfil (todos)
        └─> /redefinir-senha

/portal/entrar (magic link) ─> /portal  ── locatário, sem Navbar do Hub
/venda/entrar (magic link) ─> /venda    ── proponente da compra, sem Navbar do Hub
/tv-display ── NavbarTV própria, sem padding, sem rolagem
/spotify-callback ── só gestao (conexão única do Spotify)
```

## 2. Telas
| Tela | Rota | Papéis | Objetivo | Ações principais |
|---|---|---|---|---|
| Login | `/login` | público | Entrar | Entrar, criar conta, esqueci a senha; explica quando o bloqueio é suspensão. Depois do cadastro (ou login sem confirmar) mostra **"Confirme seu e-mail"** com reenvio do link |
| Redefinir senha | `/redefinir-senha` | público (link do e-mail) | Nova senha | Salvar |
| Home | `/` | todos com perfil | Porta de entrada por nível (PRD §5.4) | Buscar; atalhos; pendências que levam à tela certa; plantão e compromissos; avisos e links |
| Agenda | `/agenda` | todos com perfil | Calendário completo (saiu da Home) | Navegar mês/semana/dia |
| Perfil | `/perfil` | todos com perfil | Dados pessoais | Editar nome, telefone, cargo, foto; pedir troca de nível; cancelar o pedido |
| TV Display | `/tv-display` | gestao, adm, tvaccess | Tela fixa do escritório | Nenhuma (carrossel automático) |
| Kanban | `/kanban` | gestao, adm | Pipeline de atendimentos | Filtrar |
| Dados de Atendimento | `/kanban/dados` | gestao, adm | Análise da carteira | Filtrar |
| Relatório de Atividades | `/kanban/atividades` | gestao, adm | Atividades × meta diária | Filtrar período |
| Dash · Painel da Gestão | `/dashboard/gestao` (e `/dashboard`, que redireciona) | gestao, marketing | História em cascata (PRD §5.0): manchete, ritmo, funil, custo da perda, canais, pessoas, saúde dos dados | Filtros na URL: `periodo`, `finalidade`, `canal`, `corretor` |
| Dash · Painel de Performance | `/dashboard/performance` | gestao, marketing | História do dinheiro (PRD §5.0b): ritmo de gasto × orçamento, atenção, campanhas, cascata até o negócio, onde investir | Filtros na URL: `periodo`, `plataforma`, `etapa`, `finalidade`, `campanha` |
| Endereços antigos do Dash | `/dashboard/leads`, `/funil`, `/campanhas`, `/performance-v2`, `/comercial`, `/operacional` | — | Redirecionam para os painéis novos, mantendo os filtros da URL (removidos em 24/09) | — |
| Configurações | `/configuracoes` | gestao, marketing | Conteúdo da Home | Abas: Avisos & Links, Banners, Plantão (com **Importar escala (PDF)** → prévia → Importar, PRD §5.3), Fotógrafo, Datas; **Usuários & Acessos só gestao** |
| Propostas | `/admin/propostas` | gestao, adm, corretor | Criar e acompanhar propostas | Nova proposta; aprovar/descartar/pedir correção (**gestao, adm**) |
| Esteiras | `/admin/esteiras` | gestao, adm, corretor | Documentos por proposta | Aprovar/reprovar documento, Solicitar ajustes, Finalizar (**gestao, adm**) |
| Processos | `/admin/processos` | gestao, adm, corretor | Histórico e concluídos | Ver detalhe |
| Portal · entrar | `/portal/entrar` | locatário | Receber magic link | Enviar link |
| Portal · status | `/portal` | locatário | Jornada da proposta | Confirmar dados, completar cadastro, enviar documentos, definir senha |

Corretor: em Propostas/Esteiras/Processos a RLS só devolve as propostas que ele criou, e os botões de decisão ficam escondidos (`ACESSO.esteiraDecidir`).

## 3. Fluxos por papel

### Novo colaborador: do cadastro ao nível
1. Cria a conta com e-mail `@imovit.com.br` → tela "Confirme seu e-mail" → clica no link do e-mail → entra → perfil `user` ("Sem nível").
2. Vê só Home e Perfil. Em Perfil, pede um nível com motivo.
3. A Gestão vê o pedido em Configurações → Usuários & Acessos e aprova ou recusa (`decidir_solicitacao_acesso`).
4. O menu se monta de novo pelo novo nível (evento `hub:perfil-atualizado`).

### Formulários no Hub (PRD §5.7) — proposta
**Captação (proprietário, público):** corretor copia o link fixo `/captacao/<id>` → proprietário abre (sem login) → preenche em etapas (contato → natureza → endereço → valores → atributos → lazer) → lê a declaração e assina → "Enviar" → tela de sucesso com **Baixar PDF da autorização** → e-mail para o corretor e a equipe → aparece em `/captacoes`.
Estados: link de corretor inexistente/inativo → formulário sem corretor pré-escolhido; envio com erro → mensagem e dados preservados na tela.
**Captações (equipe):** `/captacoes` lista (data, proprietário, imóvel, finalidade, corretor, status "nova / cadastrada no Imoview"); detalhe com todos os dados e **Baixar PDF**; botão para copiar o link fixo de cada corretor.
**Feedback de visita (corretor):** Ferramentas → Feedback de visita → formulário → "Gerar PDF" (download) → salvo no histórico (`/feedbacks`, o corretor vê os dele).
**Home:** bloco "Ferramentas" (forms do Hub + links externos restantes) no lugar de "Links úteis".

### Menu Propostas (pedido do Eduardo, 28/09)
Locação e venda são processos separados. Navbar **Propostas ▾** → Locação ▸ / Venda ▸; o clique em "Propostas" abre `/propostas`, com um cartão por área. Dentro de cada área, o topo da página tem o caminho "Propostas › Locação" e abas: Locação = Propostas (`/admin/propostas`) · Esteira (`/admin/esteiras`) · Processos (`/admin/processos`); Venda = Propostas (`/admin/vendas`, só as que aguardam assinatura, e o botão de criar) · Processos (`/admin/vendas/processos`, histórico completo com o PDF). As URLs antigas foram mantidas porque os e-mails apontam para elas. Definição única em `src/lib/propostasNav.js`.

### Esteira de locação v4 (gestor, locatário, ADM) — PRD §5.6, 28/09
Status em `propostas_locacao.status`:
```
nova_proposta (gestor registra as condições negociadas) ─> aguardando_locatario
aguardando_locatario ──(locatário) "Validar proposta"──> aguardando_docs  ── e-mail "esteira aberta" à equipe; prazo +30 dias
                     └─(locatário) "Algo está errado" + motivo──> correcao_solicitada ── e-mail a quem registrou
correcao_solicitada ──(gestor) "Corrigir e reenviar"──> aguardando_locatario ── e-mail "proposta corrigida"; prazo +7 dias
aguardando_locatario ──(gestor) "Editar e reenviar"──> aguardando_locatario (mesmo efeito)
aguardando_docs ──(locatário completa cadastro)──> aguardando_docs ──(envia todos)──> docs_em_analise
docs_em_analise ──decisao_adm por documento──┬─ todos aprovados ─> docs_aprovados
                                             └─ algum reprovado ─> aguardando_docs ("Solicitar ajustes" → 1 e-mail)
docs_aprovados ──Finalizar (baixa .zip, limpa Storage) + sincronizar_imoview──> sincronizada
Em qualquer etapa aberta: descartar ─> rejeitada · validação vencida (7 dias) ─> expirada · correção pedida não expira
```
Portal do locatário: 4 etapas com cadeado (Validação → Cadastro → Documentos → Conclusão). Em `correcao_solicitada` mostra o motivo que ele mandou e avisa que o corretor vai reenviar. A tela se atualiza sozinha a cada 20 s.
Condições negociadas (componente `TermosProposta`): no detalhe da proposta, no painel da Esteira e em Processos (equipe, com a taxa de administração, exceto Processos) e no portal (locatário, sem a taxa).
Propostas de locação (gestor): formulário com locatário, imóvel e condições negociadas (corretor responsável, valor, garantia, posse, prazo, vencimento, rescisão, negociação específica, outros combinados, taxa); fila "Correções pedidas pelo locatário" no topo; "Editar"/"Corrigir" na linha e no detalhe enquanto não validou. Home: pendência "correção pedida" para Admin e para o corretor dono.

### Proposta de venda (corretor, ADM, proponente) — RF21, PRD §5.5
Status em `propostas_venda.status`:
```
nova_proposta (corretor/adm/gestao) ─> aguardando_cliente
aguardando_cliente ──(proponente: telefone + valor + descrição + assinatura)──> confirmada
                                                         └─ navegador gera o PDF → documento_path
aguardando_cliente / confirmada ──descartar (adm/gestao)──> descartada
aguardando_cliente com link vencido (7 dias) ─> expirada (calculado na leitura)
```
Ordem no portal ao assinar: envia `assinatura.png` → Edge Function confirma → gera o PDF → envia `documento.pdf` → RPC `registrar_documento_venda`. Se o PDF falhar, a proposta continua confirmada, só sem `documento_path`.
E-mails (Brevo, pela `proposta-venda`): criação → proponente; assinatura → `daniel@`, `gabriela@` (gabriela@ não tem login no Hub; é só caixa de e-mail).

### Gestão: suspender colaborador
Configurações → Usuários & Acessos → Suspender (confirmação) → o acesso cai na hora; a pessoa vê "acesso suspenso" e só tem o botão Sair. Excluir avisa que não tem volta e sugere Suspender.

### Marketing: atualizar a Home
Configurações → aba → criar/editar/desativar item → aparece na Home e na TV (agenda e eventos) na próxima leitura.

### Campanha Km 32 na Home (RF25, PRD §5.9) — 06/10
- **Onde:** Home, logo abaixo dos atalhos. Só para quem tem nível (gestao, adm, marketing, corretor, tvaccess); o "Sem nível" não vê o bloco.
- **Interação:** abas Venda | Locação. Sem filtro e sem navegação para outra tela nesta versão.
- **Conteúdo por aba:**
  - "Km N de 42";
  - a trilha com as paradas Out/Nov/Dez, o marcador "hoje" e o ponto do realizado;
  - 4 números: valor realizado de R$ meta (%), negócios de meta, ticket médio e ritmo (± pontos contra o calendário).
- **Rodapé:** "Negócios realizados no CRM desde 06/10/2026 · atualizado em dd/mm às hh:mm".
- **Estados:**
  - **carregando:** a trilha aparece vazia, sem números (sem "pulo" de layout);
  - **vazio (0 negócios):** "A largada foi dada em 06/10. Nenhum negócio realizado ainda." A trilha fica no Km 32 e o ticket mostra "—";
  - **erro:** o bloco mostra "Não foi possível carregar a campanha agora." sem quebrar a Home;
  - **atraso:** se a última leitura do CRM tiver mais de 1 dia, aviso "Dados do CRM de dd/mm";
  - **negócio sem valor:** "N negócios sem valor no CRM", contados no volume e fora do valor e do ticket;
  - **fora do período:** antes do início ou depois do fim, o bloco não aparece.

### Adm locação — carteira de locação (RF26, PRD §5.13) — no localhost, 07/10
Gestão → Dash ▸ Adm locação (`/dashboard/adm-locacao`) → manchete (administração recebida, ativos, inadimplência, novos × encerrados) → 8 capítulos (PRD §5.13). As listas mostram 8 linhas e abrem as demais em "Ver os outros".

Ao abrir, a página chama a função `carteira-locacao`, que lê o Imoview se a última leitura tem mais de 12 h; "Atualizar agora" força a leitura.

Estados:
- carregando;
- lendo o Imoview (aviso);
- falha na leitura (aviso compacto: "os números são da última leitura");
- vazio ("Nenhum contrato lido do Imoview ainda");
- saúde dos dados no rodapé.

Outros níveis não veem o item, e a rota redireciona para a Home.

## 4. Estados de tela
| Tela | Vazio | Carregando | Erro | Sem permissão |
|---|---|---|---|---|
| Rotas protegidas | — | `ProtectedRoute` segura a tela até o perfil chegar | — | Redireciona para a Home; suspenso vê aviso próprio |
| Home / agenda | Mensagens vazias por bloco (`.empty`) | ⚠ conferir | ⚠ conferir | — |
| TV (KPIs) | "Sem plantão escalado hoje"; sem meta → compara com o mês anterior | Mantém o último valor | Mantém o último valor | — |
| Portal | "Link inválido ou expirado" | Atualização silenciosa não troca a tela | ⚠ conferir | Só a própria proposta (RLS) |
| Dashboards | ⚠ conferir por gráfico | ⚠ conferir | ⚠ conferir | RLS devolve vazio para quem não é gestao/marketing |

⚠ Os estados vazio/erro de cada tela não foram auditados. Vale uma passada tela a tela antes do próximo sprint de UI.

## 5. Notificações e e-mails (Brevo, pela `esteira-locacao`, v4)
| Gatilho | Para quem | Conteúdo |
|---|---|---|
| `nova_proposta` | Locatário | "Sua proposta de locação está pronta para validar", com os termos (valor negociado, observações) |
| `editar_proposta` | Locatário | "Sua proposta foi corrigida: valide de novo", com os termos |
| `pedir_correcao` | Quem registrou (`criado_por`); sem dono: `gabriel@`, `daniele@` | "Locatário pediu correção", com o motivo |
| `validar_proposta` | `gabriel@`, `daniele@`, `administrativo@`, `administrativo3@` | "Nova esteira aberta", com os termos |
| `docs_enviados` (todos enviados) | `gabriel@`, `daniele@` | Documentos para revisar |
| `solicitar_ajustes` | Locatário | E-mail único com os documentos reprovados e os motivos |
| `decisao_adm` (todos aprovados) | Locatário + `gabriel@`, `daniele@` | Documentação aprovada / pronta para o Imoview |
| `sincronizar_imoview` | Locatário | Processo concluído |

Templates em `supabase/functions/esteira-locacao/emails.ts`.
