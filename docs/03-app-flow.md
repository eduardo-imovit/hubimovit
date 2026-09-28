# App Flow — Hub Imovit
**Base:** PRD v0.1 · **Data:** 2026-09-24 · retroativo (reflete `src/App.jsx`, `src/lib/acessos.js` e `Navbar.jsx`)

## 1. Mapa de telas
```
/login ─┬─> / (Home) ── todos com perfil
        │     ├─ Navbar ─┬─ Locação ▾   Propostas · Esteiras · Processos     (gestao, adm, corretor)
        │     │          ├─ Dash ▾      Negócio ▸ Visão Geral · Leads        (gestao, marketing)
        │     │          │              Performance ▸ Performance · Campanhas
        │     │          │              Funil
        │     │          │              Kanban ▸ Quadro · Dados · Atividades (gestao, adm)
        │     │          ├─ Vendas      /admin/vendas                         (gestao, adm, corretor) — RF21, não publicado
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

### Esteira de locação (corretor, ADM, locatário)
Status em `propostas_locacao.status`:
```
nova_proposta (corretor/adm)
  └─> aguardando_locatario ──(locatário confirma dados + oferta)──> aguardando_aprovacao_interna
        ▲                                                             │ decisao_interna (adm/gestao)
        └──────────────── reprovado / pedir correção ─────────────────┤
                                                                      └─ aprovado ─> criada
criada ──(locatário completa cadastro: PF/PJ, cônjuge, renda)──> aguardando_docs
aguardando_docs ──(envia todos os obrigatórios)──> docs_em_analise
docs_em_analise ──decisao_adm por documento──┬─ todos aprovados ─> docs_aprovados
                                             └─ algum reprovado ─> aguardando_docs
                                                (ADM usa "Solicitar ajustes" → 1 e-mail com a lista)
docs_aprovados ──Finalizar (baixa .zip, limpa Storage) + sincronizar_imoview──> sincronizada
Em qualquer etapa aberta: descartar ─> rejeitada · prazo do link vencido ─> expirada
```
Portal do locatário: 5 etapas com cadeado (Proposta → Aprovação → Cadastro → Documentos → Conclusão). A tela se atualiza sozinha a cada 20 s com a aba visível e avisa "Nova etapa liberada".

### Esteira de locação v4 — proposta (PRD §5.6, RF22), aguardando aprovação
Substitui o trecho inicial do fluxo acima (até `criada`); o resto não muda.
```
nova_proposta (corretor preenche tudo: locatário, imóvel, valor negociado, detalhes)
  └─> aguardando_locatario ──e-mail──> locatário abre o portal (proposta só leitura)
        ├─ "Validar proposta" ──> criada  ── e-mail ao ADM "esteira aberta"; portal libera Cadastro
        └─ "Algo está errado" + motivo ──> correcao_solicitada ── e-mail ao corretor
                correcao_solicitada ──(corretor corrige e reenvia)──> aguardando_locatario
criada ──(locatário completa cadastro)──> aguardando_docs ──> … (igual ao atual) … ──> sincronizada
```
Portal: 4 etapas (Validação → Cadastro → Documentos → Conclusão); some a etapa "Aprovação".
Telas afetadas: `/admin/propostas` (form completo + "Corrigir e reenviar" + selo "Correção pedida"), `PortalStatus` (etapa 1 vira leitura + 2 botões), `/admin/esteiras` (sem a fila de aprovação interna).
E-mails: `nova_proposta` → locatário ("proposta pronta para validar"); `correcao_solicitada` → corretor (`criado_por`); validação → ADM (lista a confirmar).

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

## 4. Estados de tela
| Tela | Vazio | Carregando | Erro | Sem permissão |
|---|---|---|---|---|
| Rotas protegidas | — | `ProtectedRoute` segura a tela até o perfil chegar | — | Redireciona para a Home; suspenso vê aviso próprio |
| Home / agenda | Mensagens vazias por bloco (`.empty`) | ⚠ conferir | ⚠ conferir | — |
| TV (KPIs) | "Sem plantão escalado hoje"; sem meta → compara com o mês anterior | Mantém o último valor | Mantém o último valor | — |
| Portal | "Link inválido ou expirado" | Atualização silenciosa não troca a tela | ⚠ conferir | Só a própria proposta (RLS) |
| Dashboards | ⚠ conferir por gráfico | ⚠ conferir | ⚠ conferir | RLS devolve vazio para quem não é gestao/marketing |

⚠ Os estados vazio/erro de cada tela não foram auditados. Vale uma passada tela a tela antes do próximo sprint de UI.

## 5. Notificações e e-mails (Brevo, pela `esteira-locacao`)
| Gatilho | Para quem | Conteúdo |
|---|---|---|
| `nova_proposta` | Locatário | Link do portal para confirmar dados |
| `confirmar_dados_locatario` | `gabriel@`, `daniele@`, **`administrativo@`, `administrativo3@`** (lista `DESTINATARIOS_NOVA_ESTEIRA`, 24/09) | "Nova proposta aguardando revisão interna", com caixa **Detalhes da proposta** (valor ofertado × anúncio e o texto do locatário) |
| `decisao_interna` | Locatário | Aprovada (segue para o cadastro) ou pedido de correção |
| `completar_cadastro` / `docs_enviados` | ADM/Gestão | Documentos para analisar |
| `solicitar_ajustes` | Locatário | E-mail único com os documentos reprovados e os motivos |
| `sincronizar_imoview` | Locatário | Processo concluído |

⚠ A lista acima é um resumo dos 9 templates de `supabase/functions/esteira-locacao/emails.ts`; confira destinatários exatos no código antes de mudar algo.
