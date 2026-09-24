# Design System — Hub Imovit
**Data:** 2026-09-24 · **Versão do DS:** v2.0 (a mesma de `src/styles/tokens.css`)

> Fonte da marca: pasta `OneDrive\Desktop\00 - Padrão\Imovit_brand_guidelines\` e a nota do Obsidian
> "Design System - Imovit". No código, a fonte única é `src/styles/tokens.css` (tokens) +
> `src/styles/components.css` (componentes) + `src/styles/hub.css` (telas do Hub).
> **Não inventar valores fora destes tokens.**

## 1. Princípios
- **"Lares com a sua alma."** Calor e curadoria: fundo creme, serifa editorial nos títulos, coral só onde há ação.
- **Denso e calmo para uso diário:** a equipe abre o Hub todo dia; informação primeiro, decoração depois.
- **A TV é outro meio:** leitura a 3–5 m, sem interação, com movimento lento e contínuo.

## 2. Tokens
### Cores — base
| Token | Hex | Uso |
|---|---|---|
| `--pergaminho` | `#FAF6EF` | Overlays, fundo mais claro |
| `--creme` | `#F5F0E8` | Fundo padrão da página |
| `--champagne` | `#EDE7D9` | Bordas e separadores |
| `--grafite` | `#2D2D2D` | Texto padrão |
| `--grafite-mid` / `-soft` / `-fade` | `#444` / `#888` / `#B8B5B0` | Texto secundário, legendas, desabilitado |
| `--branco` | `#FFFFFF` | Cards, células de tabela |

### Cores — marca e semânticas
| Token | Hex | Uso |
|---|---|---|
| `--coral` | `#E8593C` | Ação principal, link, foco. **Nunca** fundo extenso, **nunca** erro |
| `--coral-dark` / `-light` / `-soft` | `#B93A18` / `#F5C4B3` / `#FDE8E0` | Hover, destaques suaves |
| `--success` + `-soft` | `#2E7D4F` / `#E5F1EA` | Aprovado, concluído |
| `--warning` + `-soft` | `#B8741A` / `#FBEFD6` | Aguardando alguém |
| `--danger` + `-soft` | `#C13E2C` / `#FBE5E0` | Erro, reprovado, excluir |
| `--info` + `-soft` | `#2C5F8D` / `#E2EBF4` | Em análise, neutro informativo |

### Cores — segmentos de cliente (barra fina, badge, dot; nunca a tela inteira)
`--solteiros` Argila `#D4755A` · `--casais` Rosé `#C9909A` · `--ninho-cheio` Sálvia `#5C8A6B` (também = blocos do fotógrafo na agenda) · `--ninho-vazio` Gold `#C9A96E` · `--investidores` Petróleo `#2B4A6B`. Cada um tem um par `-soft`.

### Tipografia
| Token | Valor | Uso |
|---|---|---|
| `--font-serif` | Noto Serif Display (300/400, itálico) | Títulos de página e números de destaque |
| `--font-sans` | DM Sans (300–600) | Todo o resto |
| `--font-mono` | JetBrains Mono | Códigos, IDs |
| Escala | `--text-xs` 11 · `sm` 13 · `base` 15 · `md` 17 · `lg` 20 · `xl` 26 px (+ tamanhos maiores no arquivo) | |
| Pesos | 300 · 400 · 500 · 600 | 600 é o máximo |

### Espaço, raio, sombra, movimento
- Espaço: `--space-1..10` = 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 px. Grid de 12 colunas, gap 24 px; containers de 640/900/1200/1440 px.
- Raio: `xs` 2 · `sm` 4 · `md` 8 · `lg` 14 · `xl` 20 · `full`.
- Sombra: `--shadow-xs..xl` em grafite a 5–18%; `--shadow-coral` só em CTA de destaque.
- Movimento: `instant` 80 · `fast` 160 · `base` 220 · `slow` 360 · `poetic` 600 ms; `--ease-out` como padrão. Sempre respeitar `prefers-reduced-motion`.
- Camadas: sticky 100 · drawer 200 · modal 300 · toast 400 · tooltip 500.

## 3. Componentes (`components.css`)
| Componente | Classes | Regras de uso |
|---|---|---|
| Botão | `.btn` + `-primary` `-secondary` `-ghost` `-dark` `-danger` `-link` · `-sm` `-lg` · `.btn-icon` | Um primário por tela/área. `-danger` só para ação destrutiva |
| Badge | `.badge` + `-success` `-warning` `-danger` `-info` `-gray` `-coral` + segmentos | Status da esteira vêm de `src/lib/esteiraLabels.js` (`STATUS_VARIANT`) + `StatusBadge.jsx`. Não criar mapa de status novo |
| Card / estatística | `.card` `.card-body` · `.stat-card` `.stat-value` `.stat-label` | |
| Tabela | `.data-table` · `.mini-bar-track/.mini-bar-fill` | ⚠ `.mini-bar-track` usa fundo creme: fora de tabela fica invisível; usar `--champagne` |
| Formulário | `.field` `.field-hint` `.field-error` `.input-group` `.search-bar` `.segmented` · `CurrencyInput.jsx` | |
| Modal / drawer | `.modal*` · `.drawer*` · `ReasonModal.jsx` · `ModalPortal.jsx` | **Nunca** `window.prompt/alert/confirm`: pedir motivo sempre com `ReasonModal` |
| Toast | `.toast` + `-success` `-info` `-warning` `-danger` | |
| Abas | `.tabs` `.tab` | |
| Vazio | `.empty` `.empty-icon` `.empty-title` `.empty-sub` | Toda lista precisa de estado vazio |
| Linha do tempo / upload | `.timeline*` · `.upload*` `.upload-list` `.upload-item` | Usados no portal |
| Kanban | `.kanban*` | |
| Avatar | `.avatar` `-sm/-md/-lg/-xl` `.avatar-group` `.user-chip` | |
| Navegação | `.navbar*` (dropdown + flyout) · `.navbar-tv*` · `.pagination` | |
| TV | `.sky-card-tv*`, `.spotify-card-tv*`, carrossel do rodapé (`hub.css`) | Só em `/tv-display` |

## 4. Padrões de tela
- **Layout base:** `AppShell` = Navbar no topo (menu por nível) + conteúdo em container. Título de página com `.page-title`.
- **Lista + filtro:** filtros no topo (`KanbanFiltros`, `MidiaFiltros`, `FilterPanel`), conteúdo em cards ou `.data-table`.
- **Dashboard:** linha de KPIs (`KpiCard`) → gráficos recharts em cards. Cores de série a partir dos tokens.
- **Decisão com motivo:** botão → `ReasonModal` → toast de retorno.
- **Portal do cliente:** `PortalShell` sem a navbar interna, jornada com etapas (`JornadaLocatario`), linguagem para quem não conhece o processo.

## 5. Tom de voz
- Português claro, frases curtas, sem jargão interno com o cliente ("Aguardando seus dados", e não "aguardando_locatario").
- Botões com verbo: "Solicitar ajustes", "Finalizar processo".
- Erros dizem o que fazer a seguir. Destrutivo diz que não tem volta e oferece a alternativa (ex.: Excluir sugere Suspender).

## 6. Divergências em aberto
- [ ] E-mails usam coral `#ff5e4d` e preto `#000` (template do Obsidian), e não `--coral #E8593C` / `--grafite #2D2D2D`. Decidir qual vale.
- [ ] Tailwind v4 está instalado e é usado pontualmente. Decidir: só CSS do DS, ou Tailwind mapeado para os tokens.
- [ ] Não há tema escuro. A TV usa fundos próprios.
- [ ] Acessibilidade (contraste de `--grafite-soft` sobre `--creme`, foco visível) nunca foi auditada.
