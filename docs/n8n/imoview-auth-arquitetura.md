# Imoview × n8n: inventário de autenticação e arquitetura proposta

**Data:** 25/11/2026 (revisto em 26/11: chave geral única, usuário 111, App_ fora, §7 próxima leva, §8 o que foi montado) · **Autor:** Asimov · **Base:** seção "Autenticação" da skill `imoview-api` (revisada em 25/11 com a doc oficial) e leitura de cada fluxo pelo MCP do n8n.
**Escopo:** análise e proposta. Nenhum fluxo, credencial ou banco foi alterado.

> Segredos: este documento não traz nenhuma chave, senha ou token. Onde um fluxo tem segredo em texto, está marcado com ⚠️ e descrito só como "chave em texto" ou "senha em texto".

---

## 1. Resumo

- **16 fluxos lidos, 43 nós HTTP do Imoview.** Ativos: 8 fluxos com 22 nós (8 de login + 14 de dados). Inativos: 8 fluxos com 21 nós.
- **Todos os fluxos usam o mesmo usuário (código 79, o login pessoal do Eduardo) com `App_ValidarAcesso`.** Nenhum usa ainda o `Integracao_ValidarAcesso`.
- **O login é refeito a cada execução**, e às vezes várias vezes na mesma execução. Como cada login novo derruba o código anterior, os fluxos derrubam a sessão uns dos outros (detalhes no §3).
- **Vai quebrar quando o login de integração virar obrigatório:**
  - `carteira_locacao_diaria`: Contratos e Financeiro hoje vão só com a chave.
  - `wpp_entrada`: o `RetornarDadosCliente` vai com o código de acesso do App_, que não é o código do login de integração. É o nó que decide se o lead é novo, então **a entrada de leads para inteira**.
- **⚠️ Segredos em texto (6 fluxos inativos):** a chave e/ou a senha MD5 aparecem direto nos nós. A API aceita o MD5 como senha, então **ver o MD5 já basta para entrar como o Eduardo**. Os fluxos ativos já usam credencial.
- **O erro de hoje no `wpp_entrada`** ("Chave inválida", no "Buscar lead no sistema") é a mensagem "a chave informada não existe ou está desativada". A chave guardada na credencial **Header Auth** que esse nó usa foi desativada ou trocada. O login veio antes e passou, ou seja, a chave dentro do **Custom Auth** do login ainda vale. Há duas cópias da chave em duas credenciais, e elas divergiram (§4.2).

---

## 2. Inventário

Legenda:
- **Acesso** = forma de acesso exigida pela regra nova: Site · Integração · Integração com login · Aplicativo.
- **Auth hoje** = como o nó autentica hoje:
  - **HA:** credencial Header Auth;
  - **CA:** credencial Custom Auth, que contém a chave, o e-mail e a senha;
  - **texto:** segredo escrito direto no nó.
- **Login:** todos os fluxos fazem `App_ValidarAcesso` com o usuário 79. A coluna diz se o código de acesso é **usado** pelo nó, ou só **enviado sem necessidade**.
- ⚠️ marca: chave ou senha em texto, endpoint App_ que tem equivalente de Integração, login concorrente e o que quebra com o login de integração obrigatório.

### 2.1 Fluxos ativos

| Fluxo | Nó | Método · endpoint | Acesso · assunto | Auth hoje | Login / observações |
|---|---|---|---|---|---|
| **wpp_entrada** (webhook, `IA36OKJMvSCGmvMP`) | Solicitar acesso API | GET `/Usuario/App_ValidarAcesso` | Aplicativo (login) | CA | 1 login por lead. ⚠️ concorre com todos os outros fluxos (mesmo usuário) |
| | Buscar lead no sistema | GET `/Cliente/RetornarDadosCliente` | **Integração com login · Clientes** | No ar: HA + header `codigoAcesso` do App_. Rascunho (não publicado): **CA** + `codigousuario: 79` fixo | **Erro "Chave inválida" de hoje.** ⚠️ quebra com o login obrigatório. ⚠️ o rascunho com CA manda e-mail e senha para um endpoint de dados |
| | Retornar Atendimento | GET `/Atendimento/App_DetalhesAtendimentos` | Aplicativo | HA + `codigoacesso`; `codigoUsuario` 79 fixo | Usa o código. ⚠️ talvez dê para trocar por `/Atendimento/RetornarAtendimentos` (Integração · Atendimentos), se ele filtrar por código (confirmar) |
| | Criar atividade | POST `/Atendimento/App_IncluirAtividade` | Aplicativo | HA + `codigoAcesso` | Usa o código. ⚠️ equivalente provável: `/Agenda/IncluirAtividade` (Integração · Agenda); confirmar se aceita `codigoatendimento` |
| | Incluir lead | POST `/Lead/IncluirLead` | **Site** (chave Site, ou Integração com assunto Site) | HA + `codigoAcesso` | O código vai sem necessidade |
| | Buscar atendimento criado | GET `/Cliente/RetornarDadosCliente` | **Integração com login · Clientes** | HA + `codigoAcesso` | ⚠️ quebra com o login obrigatório. ⚠️ `continueRegularOutput`: um 401 passa calado e o `Gravar atendimento` grava vazio |
| **crm_jornada_diaria v3** (6h, `OrueN2tGYYqploMp`) | Validar acesso Imoview | GET `App_ValidarAcesso` | Aplicativo | CA | ⚠️ login às 6h, junto com o Coletor |
| | Buscar atendimentos da consulta | GET `/Atendimento/RetornarAtendimentos` (48 consultas, paginado) | Integração · Atendimentos | HA + `codigoAcesso` e `codigoUsuario` | O código vai sem necessidade, então **o login pode sair**. Retry de 5 s que não lê o 429 |
| **Coletor atividades Imoview** (6h, `Sm7HAKQiHWHWt4PB`) | Imoview: validar acesso | GET `App_ValidarAcesso` | Aplicativo | CA | ⚠️ **1 login por dia da janela:** 2 por execução diária, 8 na manual. Cada um derruba o anterior |
| | Imoview: retornar atividades | GET `/Agenda/RetornarAtividades` | Integração · Agenda | HA + `codigoAcesso` | O código vai sem necessidade, então o login pode sair. Supabase com `continueRegularOutput` (serve para o duplicado, mas engole qualquer outro erro) |
| **carteira_locacao_diaria** (6h30, `5fGPj1tBxlqbB0N2`) | Solicitar acesso API | GET `App_ValidarAcesso` | Aplicativo | CA | ⚠️ o login é feito **e não é usado** por ninguém, mas derruba a sessão dos outros |
| | Buscar contratos | GET `/ContratoAluguel/RetornarContratos` | **Integração com login · Contratos** | Só HA | ⚠️ **quebra com o login obrigatório** (painel Adm locação) |
| | Buscar cobranças vencidas | GET `/Movimento/RetornarMovimentos` | **Integração com login · Financeiro** | Só HA | ⚠️ **quebra com o login obrigatório** |
| **estoque_imoveis_diario** (5h30, `1hNdOFqnmJTwpVXi`) | Acesso API | GET `App_ValidarAcesso` | Aplicativo | CA | Só o sub-fluxo de captadores usa o código, e ele faz o próprio login |
| | Acesso (captadores) | GET `App_ValidarAcesso` | Aplicativo | CA | Só no gatilho manual "Só captadores" |
| | Contar imóveis | POST `/Imovel/RetornarImoveisDisponiveis` (`naoconsiderarmeusite: true`) | Site (vitrine) | HA + `codigoAcesso` | O código vai sem necessidade. Para o cadastro inteiro, o caminho certo é `/Imovel/RetornarImoveis` (Integração · Imóveis) |
| | Buscar publicados no site | POST `/Imovel/RetornarImoveisDisponiveis` | Site | HA + `codigoAcesso` | O código vai sem necessidade |
| **estoque_imoveis_bloco** (sub, `e2kQmRqbEDa3mWgy`) | Buscar páginas | POST `/Imovel/RetornarImoveisDisponiveis` | Site (ou Integração · Imóveis com `RetornarImoveis`) | HA + `codigoacesso` recebido | O código vai sem necessidade |
| **estoque_captadores_bloco** (sub, `SVdD48qznnXLOqtu`) | Acesso do bloco | GET `App_ValidarAcesso` | Aplicativo | CA | ⚠️ **1 login a cada 100 imóveis** (até 20 por execução) |
| | Detalhe do imóvel | GET `/Imovel/App_RetornarDetalhesImovel` | Aplicativo | HA + `codigoacesso` | Usa o código. ⚠️ talvez dê para trocar por `/Imovel/RetornarImoveis` (Integração · Imóveis), se trouxer o nome dos captadores (confirmar). ⚠️ `neverError`: um 401 vira só "falha" na contagem |
| **severino_database_crm_imoveis** (agenda no padrão do nó, provavelmente 1×/dia à 0h, `B4YlJm46uutvlgPT`) | HTTP Request (login) | GET `App_ValidarAcesso` | Aplicativo | CA | O código vai sem necessidade, então o login pode sair |
| | Buscar imóveis | POST `/Imovel/RetornarImoveisDisponiveis` | Site | HA + `codigoAcesso` | Fora do assunto auth: páginas fixas (10 de locação, 35 de venda) |
| **wpp_gtm** (`yOMkY9Q9N2EPthZy`) | — | — | — | — | **Não chama o Imoview** (só grava no Supabase). Agora o MCP lê este fluxo |

### 2.2 Fluxos inativos

| Fluxo | Nó | Método · endpoint | Acesso | Auth hoje | Observações |
|---|---|---|---|---|---|
| **Repique 3.0** (`4wQRK0lOBk2vuFwP`, pronto para ligar) | Acessar API | GET `App_ValidarAcesso` | Aplicativo | HA + **⚠️ e-mail e senha em texto** | ⚠️ ligado, faria **1 login a cada 5 min** (9h–19h) e derrubaria a sessão de qualquer outro fluxo nesse horário |
| | Buscar atendimentos (últimas 2 h) | GET `/Atendimento/RetornarAtendimentos` | Integração · Atendimentos | HA | O código vai sem necessidade |
| | Repique (transferir no Imoview) | POST `/Atendimento/App_Transferir` | Aplicativo | HA + `codigoacesso` | Usa o código. Não há equivalente de Integração conhecido. Tem saída de erro (bom) |
| **teste repique** (`n6NEH8TiFRs2yQor`) | Acessar API | GET `App_ValidarAcesso` | Aplicativo | **⚠️ chave e senha em texto** | Substituído pelo 3.0. Arquivar |
| | Buscar atendimentos | GET `RetornarAtendimentos` | Integração | HA | |
| | Repique | POST `App_Transferir` | Aplicativo | HA | |
| **Distribuição de leads** (`x6GXf1Prlh2xJt8R`) | HTTP Request (login) | GET `App_ValidarAcesso` | Aplicativo | CA | ⚠️ o nó foi renomeado para "HTTP Request" e os outros procuram `acesso api`: está quebrado (o mesmo bug de 09/11) |
| | buscar atendimento | GET `App_DetalhesAtendimentos` | Aplicativo | HA | |
| | transferir | POST `/Atendimento/App_AlterarCorretor` | Aplicativo | HA | |
| **Repique leads > 11D/30D** (`w9DVMv0euN0yBSSJ`) | HTTP Request (login) | GET `App_ValidarAcesso` | Aplicativo | HA + **⚠️ e-mail e senha em texto** | |
| | Busca atendimentos | GET `/Atendimento/App_RetornarAtendimentos` | Aplicativo | HA | ⚠️ há o equivalente `RetornarAtendimentos` (Integração) |
| **Repique 2.0** (`5fBTcS8cOcIollyj`) | Acesso API, Busca Aluguel, Busca Venda, Transfere | `App_ValidarAcesso`, `RetornarAtendimentos` ×2, `App_AlterarCorretor` | — | **⚠️ chave em texto nos 4 nós e senha em texto no login** | Obsoleto. Arquivar |
| **1. iniciar proposta** (`JJuN6JyoCM3WMnq8`) | HTTP Request (login) | GET `App_ValidarAcesso` | Aplicativo | HA + **⚠️ e-mail e senha em texto** | O login é desnecessário |
| | HTTP Request1 | GET `/Imovel/RetornarDetalhesImovelDisponivel` | Site | HA | Só a chave basta |
| **crm_adm_contratos** (`qvPxX4pP6GsXsnRa`) | HTTP Request (login) | GET `App_ValidarAcesso` | Aplicativo | **⚠️ chave e senha em texto** | Substituído pela `carteira_locacao_diaria`. Arquivar. Agora o MCP lê este fluxo |
| | HTTP Request1 | GET `/Locatario/App_RetornarContratos` | Área do cliente / App | **⚠️ chave em texto** | ⚠️ o equivalente é `/ContratoAluguel/RetornarContratos` |
| **Carga imóveis alugados** (`5nBsEMy7mTz7hxSK`) | Imoview: validar acesso | GET `App_ValidarAcesso` | Aplicativo | HA + e-mail e senha como placeholder | O login é desnecessário |
| | Imoview: imóveis alugados | POST `RetornarImoveisDisponiveis` (`situacao: 2`) | Site | HA | |
| `Repique`, `Repique Automático - Vendas (45min)`, `Repique Automático - Locação (5min)` | — | — | — | Não relidos hoje. A auditoria de 17/09 achou chave em texto | Obsoletos. Arquivar |

### 2.3 Fluxos que o MCP não lê

`captacao_imoveis`, `4. Esteira de documentos`, `6. Receber revisão`, `[Reativação] Proprietários no sistema`, `teste repique antigos`. Precisam ser abertos à mão no editor. Os outros fluxos que o MCP não lê (`email_mkt`, `google_ads`, `OLX E-mail automação`, `Monitor de ads`, `[Performance] Fundo de funil`) provavelmente não tocam o Imoview, mas não foram conferidos.

Dos 5 citados no pedido, **`wpp_gtm` e `crm_adm_contratos` agora são lidos pelo MCP** (veja acima).

---

## 3. Problemas principais

1. **Logins concorrentes com o mesmo usuário.** Em um dia comum:

   ```
   0h      severino (1 login)
   5h30    estoque (1) ──▶ captadores (1 a cada 100 imóveis, até 20)
   6h00    jornada (1) + coletor (2)      ← disparam juntos
   6h30    carteira (1, que nem usa o código)
   a qualquer hora  wpp_entrada (1 por lead)
   ```

   Hoje isso quase não aparece porque a maioria dos endpoints de dados **ignora** o código (Site e Integração só olham a chave). Quem usa o código de verdade são:
   - o `wpp_entrada`, em `App_Detalhes` e `App_IncluirAtividade`;
   - o `estoque_captadores_bloco`.

   Um lead que chega durante a carga de captadores derruba a sessão do bloco e transforma os imóveis em "falhas". O contrário também acontece: um bloco novo derruba o lead no meio. O usuário é o login pessoal do Eduardo, então **o Eduardo entrar pelo app do Imoview também pode derrubar as automações**. Isso precisa ser confirmado com o suporte: não está claro se o app usa o mesmo `App_ValidarAcesso`.
2. **O login de integração vai quebrar a carteira e a entrada de leads** (§1).
3. **Duas cópias da chave.** Uma está no Custom Auth do login e a outra no Header Auth dos nós de dados. Trocar a chave exige trocar as duas, e o erro de hoje é exatamente uma ter ficado diferente da outra.
4. **⚠️ Senha e chave em texto** em 6 fluxos inativos (§2.2). O MD5 é a senha para a API.
5. **Erros engolidos:**
   - `continueRegularOutput` no `wpp_entrada` (`Buscar atendimento criado`, `Gravar atendimento`, `Alimentar planilha`) e no Coletor (inserts do Supabase);
   - `neverError` nos captadores.

   Um 401 ou um 429 não aparece em lugar nenhum. O `wpp_entrada` também não guarda as execuções que deram certo, então não dá para ver depois o que aconteceu.
6. **O 429 não é lido.** Os retries são fixos (3–5 s). A API diz quanto esperar em `segundosparaliberar` / `Retry-After`.
7. **404 = vazio.** A API usa 404 para "consulta vazia / não encontrado". Um fluxo que trata 404 como erro pode parar sem motivo, e um que trata qualquer erro como vazio pode esconder um 401. A regra nova precisa distinguir os dois casos.

---

## 4. Proposta de arquitetura

### 4.1 Chaves e assuntos: **1 chave geral de Integração** (decisão do Eduardo, 26/11)

> **Mudou em 26/11.** O Eduardo criou **uma chave geral** do tipo Integração com os assuntos **Site, Clientes, Atendimentos, Agenda, Imóveis, Contratos e Financeiro**, em vez das 3 chaves por função propostas abaixo. O usuário de integração é o **código 111, "Marketing Integração"**. Testado por ele: `POST /Usuario/Integracao_ValidarAcesso` com JSON `{email, senha}` (senha em texto, no corpo) devolve `codigousuario`, `codigoacesso` e `minutossemuso: 10`; `RetornarAtendimentos` com os 3 cabeçalhos deu 200.
>
> Consequências:
> - **Credenciais no n8n:** só duas. `Imoview · chave` (Header Auth, cabeçalho `chave`) em todo nó de dados, e `Imoview · login` (Custom Auth com a chave + e-mail + senha do usuário 111) **só** no nó de login do sub-fluxo "Imoview: obter sessão".
> - **Um perfil de sessão só** (`integracao`) na tabela `imoview_sessao`. O perfil `app` (usuário robô) saiu do plano: `App_ValidarAcesso` responde "Atualize o aplicativo" (`atualizarapp: true`) e a doc diz que o usuário de integração **não acessa** o Imoview nem o aplicativo. Todo endpoint `App_*` precisa ser trocado pelo equivalente de Integração (§4.5).
> - **Risco aceito:** se a chave vazar, abre tudo (inclusive CPF e financeiro), e trocar a chave para todos os fluxos de uma vez. Mitigação: a chave só existe nas 2 credenciais; nada em texto nos nós; o sub-fluxo é o único que faz login.
>
> A tabela abaixo fica como registro da proposta original (não adotada).

| Chave | Fluxos | Assuntos |
|---|---|---|
| **n8n · leads** | `wpp_entrada` (e depois `Repique 3.0` e `Distribuição`) | Site (IncluirLead), Clientes (RetornarDadosCliente), Atendimentos, Agenda |
| **n8n · leitura** | jornada, coletor, estoque (+ bloco, captadores), severino, carga de alugados, iniciar proposta | Site (vitrine), Imóveis, Atendimentos, Agenda |
| **n8n · financeiro** | `carteira_locacao_diaria` | Contratos, Financeiro |

Por que por **função**, e não uma chave por fluxo nem uma só para tudo:
- **Uma só:** é mais simples, mas se vazar abre tudo, inclusive CPF e financeiro. Além disso, o erro de um fluxo de leitura não pode tirar a entrada de leads do ar.
- **Uma por fluxo:** isola ao máximo, mas são 10 chaves para criar e girar, e a maioria dos fluxos pede exatamente os mesmos assuntos.
- **Por função:** cada chave abre só o que aquela família precisa. O financeiro, que é o dado mais sensível, fica separado. A troca de uma chave afeta um grupo conhecido.

Analogia: são três crachás de portaria. O do atendimento abre a recepção e o arquivo de clientes. O da leitura abre o arquivo de imóveis e a agenda. O do financeiro abre só a sala do financeiro.

**A confirmar no 1º teste:** se uma chave de Integração é aceita nos endpoints `App_*` (`App_ValidarAcesso`, `App_Transferir`, `App_IncluirAtividade`, `App_Detalhes…`). A doc diz "chave + codigoacesso do App_", mas não diz o tipo da chave. Se a resposta for "Esta chave não dá acesso a este endpoint", os nós App_ continuam com a chave antiga até existir equivalente de Integração.

### 4.2 Header Auth × Custom Auth

| | Header Auth | Custom Auth |
|---|---|---|
| O que guarda | 1 header (`chave`) | JSON livre: headers + query + body (hoje: chave + e-mail + senha) |
| Onde usar | **Todos os nós de dados** | **Só o nó de login**, dentro do sub-fluxo de sessão |
| Risco se usado no lugar errado | — | Num nó de dados, manda e-mail e senha em toda requisição (URL e logs do Imoview). É o caso do rascunho atual do "Buscar lead" |

Regra: **dados = Header Auth; login = Custom Auth, num lugar só.** Os headers dinâmicos `codigousuario` / `codigoacesso` não cabem em credencial (mudam a cada sessão). Eles vêm por expressão, da saída do sub-fluxo de sessão.

As duas cópias da chave continuam existindo (Header Auth e Custom Auth), mas o Custom Auth passa a ser usado **por um nó só**, no sub-fluxo. Girar a chave vira "trocar em 2 credenciais com o mesmo nome-base". Sugestão de nomes:
- `Imoview · leads · chave` e `Imoview · leads · login`;
- `Imoview · leitura · chave`;
- `Imoview · financeiro · chave` e `Imoview · financeiro · login`.

### 4.3 Sub-fluxo único "Imoview: obter sessão"

> **Montado em 26/11 (desligado, rascunho).** Ver §8. O desenho abaixo vale com dois ajustes: um perfil só (`integracao`) e a trava com dono (`renovando_dono`), para só quem pegou a trava gravar a sessão. Além dele há um 2º sub-fluxo, "Imoview: requisição", que faz a chamada e aplica a regra de erros do §4.4.

```
fluxo X ──(perfil, forcar?)──▶ [Imoview: obter sessão]
                                   │ 1. lê a sessão do perfil no Supabase
                                   │ 2. válida e usada há < N min? → devolve
                                   │ 3. senão: pega a "trava" (update condicional, 30 s)
                                   │      ├─ conseguiu → login → grava → solta → devolve
                                   │      └─ outro está renovando → espera 2 s e relê (até 5×)
fluxo X ◀──(codigousuario, codigoacesso)─┘
fluxo X ──(chave + headers)──▶ Imoview
          401 com sessaoinvalida → chama de novo com forcar=true → repete 1×
```

- **Perfis:** `integracao` (`Integracao_ValidarAcesso`, usuário de integração) e `app` (`App_ValidarAcesso`, usuário robô). Um perfil por chave que faz login: hoje `leads·integracao`, `leads·app` e `financeiro·integracao`.
- **Onde guardar: no Supabase, não nos static data do n8n.**
  - Os static data são por fluxo, só são salvos no fim da execução e não têm trava. Duas execuções simultâneas (dois leads ao mesmo tempo, ou a jornada com o coletor) leem "sem sessão" e fazem dois logins, que é justamente o problema a resolver.
  - Uma tabela com update condicional faz a trava de graça.
  - Tabela `imoview_sessao`: `perfil` (pk), `codigousuario`, `codigoacesso`, `obtido_em`, `usado_em`, `renovando_ate`. **RLS ligada sem nenhuma policy**: só a `service_role` do n8n lê. Duas RPCs: `imoview_sessao_ler(perfil)` (atualiza `usado_em`) e `imoview_sessao_travar(perfil)`.
  - O `codigoacesso` é um token de curta duração. Guardá-lo no banco fechado é aceitável, mas ele **não deve** ir para logs nem para execuções salvas.
  - **Antes de qualquer migration:** entrar em `docs/05-backend-schema.md` e passar pelo OK do Eduardo.
- **N min:** a sessão do cliente expira com 10 min sem uso. A da integração não está documentada. Começar com 8 min e ajustar pelo primeiro 401 com `sessaoinvalida`.
- **Usuário de integração: um só, compartilhado pelo sub-fluxo**, e não um por fluxo. Com a sessão compartilhada e a trava, não há mais login concorrente, e um usuário por fluxo seria N senhas e talvez N licenças do Imoview (confirmar o custo). **Mais um usuário "robô" separado para o perfil `app`** (transferências e atividades). O código do repique já ignora interações de um usuário "ROBÔ", então é provável que ele exista. Com isso, o usuário 79 do Eduardo sai das automações: as ações ficam registradas como "integração/robô" no CRM, e o Eduardo usar o app não derruba nada.

### 4.4 Tratamento de erros

Uma regra única, que pode morar num Code depois de cada chamada (com `neverError` + resposta completa) ou num 2º sub-fluxo "Imoview: requisição" (só para os fluxos críticos):

| Resposta | Ação |
|---|---|
| 200 | segue |
| 404 | **vazio** (não é erro): segue com lista vazia |
| 401 + `sessaoinvalida: true` | renova a sessão (`forcar=true`) e repete **1×** |
| 401 de chave ("Chave inválida", "não dá acesso", `chavesemassunto: true`) | **erro fatal com mensagem clara** ("chave X sem o assunto Y") + alerta. Não adianta repetir |
| 429 | espera `segundosparaliberar` (ou `Retry-After`), com teto de 120 s, e repete até 3× |
| 5xx / timeout | repete 2× com espera crescente (5 s, 20 s) |
| 400 / 403 | erro fatal com `mensagem` (ou `Message`) no texto |

Erros que hoje são engolidos:
- **`wpp_entrada`:** trocar `continueRegularOutput` por **`continueErrorOutput`** no `Buscar atendimento criado` e no `Gravar atendimento`, com a saída de erro ligada a um alerta.
- **Coletor:** deixar o "ignora duplicado" só para o erro de chave única. Hoje ele ignora qualquer erro.
- **Captadores:** contar 401 e 429 à parte das "falhas" de imóvel e parar o bloco no 401 de chave.
- **Todos os fluxos com Imoview:** Settings → **Error Workflow** apontando para um fluxo "Alerta n8n" (e-mail), e `saveDataErrorExecution: all`.

### 4.5 Endpoint App_ × Integração

| Hoje (App_) | Trocar por | Status |
|---|---|---|
| `Locatario/App_RetornarContratos` | `ContratoAluguel/RetornarContratos` | já feito na carteira; arquivar o antigo |
| `Atendimento/App_RetornarAtendimentos` | `Atendimento/RetornarAtendimentos` | trocar quando o `Repique 11D` voltar |
| `Imovel/App_RetornarDetalhesImovel` (captadores) | `Imovel/RetornarImoveis` | confirmar se traz o nome dos captadores |
| `Atendimento/App_DetalhesAtendimentos` | `RetornarAtendimentos` filtrado | confirmar se filtra por código |
| `Atendimento/App_IncluirAtividade` | `Agenda/IncluirAtividade` | confirmar se liga a atividade ao atendimento |
| `Atendimento/App_Transferir` / `App_AlterarCorretor` | — | sem equivalente: fica no perfil `app` |

**Atualização 26/11:** o App_ morreu para as automações (ver §4.1). Conferido no Swagger:
- `RetornarAtendimentos` aceita `codigoCliente`, e com ele a `fase` fica opcional; a `finalidade` continua obrigatória (2 chamadas: 1 e 2). **Não devolve a fase** do atendimento: o v4 do `wpp_entrada` lê a fase em `vw_atendimentos_base` (1 dia de atraso).
- `Agenda/IncluirAtividade` aceita `codigoatendimento`, `codigopessoa` e `codigousuario` no corpo JSON. A confirmar no teste: `codigousuario` = corretor que recebe a atividade.
- `Imovel/RetornarImoveis` traz `captadores[]` com `nome`, `email`, `principal` e `percentual`: dá para aposentar o `App_RetornarDetalhesImovel` dos captadores.
- `App_Transferir` / `App_AlterarCorretor` (Repique 3.0, Distribuição): **sem equivalente**. Os dois ficam parados até a Universal oferecer um endpoint de Integração (perguntar ao suporte).

---

## 5. Plano de migração (do menor risco para o maior)

Tamanho: **P** ≤ 1 h · **M** 1–3 h · **G** > 3 h. Cada passo é independente e testável sozinho.

| # | Passo | Tam. | Risco | Como conferir |
|---|---|---|---|---|
| 0 | **Destravar o `wpp_entrada` hoje.** <br>1. Criar a chave Integração **n8n · leads** (Site, Clientes, Atendimentos, Agenda). <br>2. Criar 2 credenciais **novas**: `Imoview · leads · chave` (Header Auth, Name `chave`) e `Imoview · leads · login` (Custom Auth, cópia da atual com a chave nova). <br>3. Usá-las **só** nos 6 nós do `wpp_entrada`. <br>4. No rascunho, voltar o "Buscar lead" para Header Auth (sem o `codigousuario` fixo). <br>5. Publicar com OK. | P | baixo (1 fluxo, credenciais novas, as antigas ficam intactas) | Mandar 1 lead de teste. Conferir `existe`/`codigoatendimento` no "Buscar lead" e a linha em `leads_wpp_gtm` com `imoview_atendimento`. Se um nó App_ der "não dá acesso a este endpoint", esse nó volta para a credencial antiga e fica anotado (§4.1) |
| 1 | **Arquivar os fluxos com segredo em texto** (`Repique 2.0`, `teste repique`, `crm_adm_contratos`, `Repique`, `Repique Automático` ×2) e tirar a senha em texto do `Repique 3.0`, do `Repique 11D` e do `1. iniciar proposta` (CA no login, ou remover o login). **Depois trocar a senha do usuário 79 no Imoview** e atualizar o CA. | P | baixo (todos inativos) | `search_workflows` sem esses fluxos; reler os 3 restantes sem e-mail/senha nos parâmetros |
| 2 | **Leitores sem login.** Na jornada, no coletor, no severino e no estoque: remover o nó `App_ValidarAcesso` e os headers `codigoAcesso`/`codigoUsuario`, e passar para a chave **n8n · leitura**. Corta 5–6 logins por dia. | P cada | baixo (endpoints só de chave) | Próxima execução de cada um com o mesmo volume de ontem (`crm_leituras`, `atividades`, `estoque_cargas`) |
| 3 | **Usuários:** pedir/criar o usuário de **integração** e confirmar o usuário **robô** para o perfil app. Conferir o custo de licença. | P | nenhum | — |
| 4 | **Sessão compartilhada:** `05-backend-schema.md` → migration `imoview_sessao` + 2 RPCs (OK do Eduardo) → sub-fluxo "Imoview: obter sessão" → teste chamando 2× em paralelo. | M | médio (novo, mas ninguém depende dele ainda) | 2 execuções simultâneas = 1 login só (`obtido_em` igual) |
| 5 | **Carteira com login de integração** (antes de virar obrigatório): chave **n8n · financeiro** + sessão `financeiro·integracao` + headers `codigousuario`/`codigoacesso` nos 2 nós. | M | médio (painel Adm locação) | Contratos ≈ total de ontem; cobranças batendo; `carregar_carteira_locacao` sem erro |
| 6 | **`wpp_entrada` completo:** `RetornarDadosCliente` ×2 com a sessão `leads·integracao`; nós App_ com a sessão `leads·app` (usuário robô); tratamento 401/429/404 (§4.4); `continueErrorOutput` + alerta. | M | **alto** (entrada de leads) | Roteiro de 3 leads: novo, quente (< 60 d) e frio. Forçar um 401 (código velho na tabela) e ver o fluxo renovar sozinho |
| 7 | **Captadores:** testar se `/Imovel/RetornarImoveis` traz os captadores. Se trouxer, aposentar o `App_RetornarDetalhesImovel` e o login por bloco. Se não trouxer, usar a sessão `leitura·app`. | M | médio | `falhas` = 0 e o mesmo nº de captadores gravados |
| 8 | **Repique 3.0 / Distribuição** (quando forem ligar): sessão `leads·app` em vez do login a cada 5 min. Corrigir a referência `acesso api` na Distribuição. | M | alto (mexe em corretor de lead) | Teste manual com 1 lead, conferir o ponteiro e 1 transferência |
| 9 | **Error Workflow global** "Alerta n8n" em todos os fluxos com Imoview. | P | baixo | Forçar um erro num fluxo de teste e receber o e-mail |
| 10 | Fluxos que o MCP não lê (§2.3): abrir à mão e encaixar na tabela. | P | — | — |

**Ordem sugerida no calendário:** 0 hoje; 1 e 2 nesta semana; 3–5 antes do aviso de obrigatoriedade; 6–9 em seguida.

---

## 6. Pontos em aberto (confirmar com a doc ou o suporte)

Respondidos em 26/11 (Swagger + teste do Eduardo):
- ~~Chave de Integração nos `App_*`?~~ Não importa mais: o usuário de integração não acessa App_, e o `App_ValidarAcesso` do usuário 79 responde "Atualize o aplicativo".
- ~~`Integracao_ValidarAcesso`: query ou corpo? MD5?~~ **POST, JSON no corpo, senha em texto** (nunca na URL).
- ~~Tempo de inatividade?~~ **10 min** (`minutossemuso`). O sub-fluxo reaproveita até 8 min.
- ~~`RetornarAtendimentos` filtra por código?~~ Filtra por **cliente** (`codigoCliente`), não por atendimento. `Agenda/IncluirAtividade` aceita `codigoatendimento`. `RetornarImoveis` traz os captadores com nome.

Ainda abertos:
- `Agenda/IncluirAtividade`: o `codigousuario` é o dono da atividade (corretor)? A atividade aparece no atendimento como a do `App_IncluirAtividade`? (1º teste do lead quente.)
- O `IncluirLead` grava a `campanha`? (pendência da 29b)
- O usuário de integração conta como licença?
- Existe endpoint de Integração para transferir atendimento (substituto do `App_Transferir`)?
- A Custom Auth do n8n mescla o `body` da credencial no corpo JSON do `Integracao_ValidarAcesso`? (1º teste do sub-fluxo; ver §8.4)

---

## 7. Próxima leva: os 7 fluxos ativos que ainda usam o usuário 79

Base: inventório do §2.1 (lido em 25/11; nenhum desses fluxos foi alterado desde então, conferido pela data de atualização em 26/11). **Nenhum foi alterado neste sprint.** Com a chave antiga desativada e o `App_ValidarAcesso` recusando o login, **todos eles param no 1º nó** (o login), mesmo os que não precisam de login.

| # | Fluxo (id) | Endpoints | Assuntos | Precisa de sessão? | Mudança | Tam. |
|---|---|---|---|---|---|---|
| 1 | **crm_jornada_diaria v3** (`OrueN2tGYYqploMp`, 6h) | `Atendimento/RetornarAtendimentos` (48 consultas, paginado) | Atendimentos | não | apagar o `Validar acesso Imoview` e os headers `codigoAcesso`/`codigoUsuario`; credencial `Imoview · chave` | P |
| 2 | **Coletor atividades Imoview** (`Sm7HAKQiHWHWt4PB`, 6h) | `Agenda/RetornarAtividades` | Agenda | não | idem (e o "ignora duplicado" só para chave única) | P |
| 3 | **carteira_locacao_diaria** (`5fGPj1tBxlqbB0N2`, 6h30) | `ContratoAluguel/RetornarContratos`, `Movimento/RetornarMovimentos` | Contratos, Financeiro | **sim** | apagar o login App_; os 2 nós viram "Imoview: requisição" (paginação: 1 chamada por página, ou o HTTP com `codigousuario`/`codigoacesso` vindos do "obter sessão" + tratamento de 401) | M |
| 4 | **estoque_imoveis_diario** (`1hNdOFqnmJTwpVXi`, 5h30) | `Imovel/RetornarImoveisDisponiveis` (contar + publicados) | Site | não | apagar os 2 logins App_; credencial nova | P |
| 5 | **estoque_imoveis_bloco** (sub, `e2kQmRqbEDa3mWgy`) | `Imovel/RetornarImoveisDisponiveis` | Site | não | tirar o header `codigoacesso`; credencial nova | P |
| 6 | **severino_database_crm_imoveis** (`B4YlJm46uutvlgPT`, ~0h) | `Imovel/RetornarImoveisDisponiveis` | Site | não | apagar o login App_; credencial nova | P |
| 7 | **estoque_captadores_bloco** (sub, `SVdD48qznnXLOqtu`) | `Imovel/App_RetornarDetalhesImovel` + login App_ por bloco | (App_, morto) | não, depois da troca | trocar por `Imovel/RetornarImoveis` (Imóveis, traz `captadores[]`) e apagar o login | M/G |

**Ordem sugerida:**
1. **Jornada e Coletor** (P, juntos): alimentam o Hub inteiro (funil, Saúde, relatórios de atividade). Só tirar o login e trocar a credencial.
2. **Carteira** (M): painel Adm locação; é o único da leva que precisa de sessão, então usa o sub-fluxo (depois que o v4 do `wpp_entrada` provar o sub-fluxo).
3. **Estoque diário + bloco + Severino** (P): só chave (Site).
4. **Captadores** (M/G): exige trocar o endpoint e conferir que os nomes batem com os de hoje.

### 7.1 Jornada e Coletor: cópias montadas em 26/11 (DESLIGADAS)

| Fluxo original | Cópia (id) | Endpoint App_ que saiu | Endpoint de dados (igual) | Forma de acesso (Swagger) | Como chama |
|---|---|---|---|---|---|
| crm_jornada_diaria v3 (`OrueN2tGYYqploMp`) | **crm_jornada_diaria v4 (integração)** (`0RMD68fMzVNqLRl5`) | `Usuario/App_ValidarAcesso` (+ `codigoUsuario` na query e `codigoAcesso` no cabeçalho) | `Atendimento/RetornarAtendimentos` | Integração, **só chave** (assunto Atendimentos), máx. 20/pág | HTTP direto, `Imoview · chave` |
| Coletor atividades Imoview (`Sm7HAKQiHWHWt4PB`) | **Coletor atividades v2 (integração)** (`X5XEBWjRrwu8Am2N`) | `Usuario/App_ValidarAcesso` (+ `codigoAcesso` no cabeçalho) | `Agenda/RetornarAtividades` | Integração, **só chave** (assunto Agenda), máx. 100/pág (usamos 20) | HTTP direto, `Imoview · chave` |

Nenhum endpoint ficou sem equivalente: os dois fluxos só usavam o App_ para o login; o endpoint de dados já era de Integração.

**Por que HTTP direto e não o sub-fluxo "Imoview: requisição":** o sub-fluxo sempre pede sessão (login do usuário 111 + 1–3 RPCs por chamada). Endpoint só de chave não precisa disso, e a leitura não deve cair se o login de integração cair. A regra de erro (§4.4) foi copiada para um Code "Classificar resposta", sem a parte de sessão.

**O que mudou no desenho (só o acesso):**
- A paginação nativa do nó HTTP (jornada) e a página única de 500 (coletor) viraram um laço `Contexto da página → HTTP (resposta completa, nunca erro) → Classificar resposta → terminou? / esperar?`. 200 → próxima página até a lista vir vazia, incompleta ou bater a `quantidade`; 404 → vazio; 429 → espera `segundosparaliberar` (teto 120 s, 3×); 5xx → 2× (5 s, 20 s); 401/403/400 → **erro com a mensagem do Imoview** (o fluxo para antes de gravar). Limite de páginas (200 jornada / 100 por dia no coletor) dá erro em vez de cortar calado.
- ~~As páginas não viajam de volta pelo laço: no fim, o Classificar junta as saídas do HTTP desde o 1º run daquela consulta/dia (`$('…').all(0, run)`).~~ **Falhou no 1º teste do coletor (26/11):** o HTTP trouxe as atividades, mas o item "fim" chegou ao `Separar resposta em dias` com `atividades: []` (só o dia), e o fluxo terminou sem erro e sem saída. Ler runs antigas de outro nó por índice é frágil. **Correção (coletor, v2b):** as páginas viajam no próprio item (`_acum`), o `Contexto da página` repassa, e o `fim` entrega `_acum` + a última página. O body também é aceito como texto JSON. Só o Code `Classificar resposta` mudou, colado à mão (sem `update_workflow`, para não perder a credencial). A jornada v4 tinha o mesmo `all(0, run)`.
- **Correção (jornada, v4b, 26/11; colar à mão, sem `update_workflow`):** 3 Codes. (1) `Classificar resposta` (`jornada_v4_classificar_resposta.code.js`): `_acum` como no coletor, mas cada atendimento já entra **enxuto** (a regra da v5 do Marcar), porque o item volta pelo laço a cada página e o domingo lê ~5.400 (a maior consulta, ~1.200). (2) `Marcar fase da consulta` (`jornada_v4_marcar_fase_da_consulta.code.js`): não enxuga de novo; o payload gravado é o mesmo da v5 (simulado: 48/48 consultas iguais). (3) `Juntar leitura` (`jornada_v4_juntar_leitura.code.js`): **trava de volume**. A RPC sempre cria a linha do dia em `crm_leituras` com `lidos` = o que chegou (não apaga ausentes, mas a foto do dia sai errada). Com 0 o Juntar já parava; agora para também abaixo do piso: **600 na diária, 4.000 na semanal** (histórico de nov.: 889–1.002 e ~5.400).
- **Igual ao original:** gatilhos e horários (6h), `Montar consultas`, RPC `registrar_atendimentos_crm`; `Gerar lista de dias`, `Normalizar`, inserts em `atividades` e `atividades_notas` com o "ignora duplicado" (`continueRegularOutput` nos 2 nós Supabase: é erro do banco, não do Imoview).

**Credenciais a selecionar à mão:** jornada → `Buscar página de atendimentos` = `Imoview · chave`; `Registrar leitura no Supabase` = a credencial Supabase do v3. Coletor → `Imoview: retornar atividades` = `Imoview · chave` (os 2 nós Supabase vieram com "Supabase account").

**Reprocessar 24–26/11:**
- **Coletor:** a "Carga manual histórica" já lê 7 dias (D-7 até hoje), então 1 execução manual cobre 19–26/11. Duplicados são ignorados pelo insert (o que já existe não muda).
- **Jornada:** não dá para reprocessar "por dia". A RPC grava a foto **de hoje** (`crm_leituras.dia = hoje`, eventos com `data_evento = hoje`, entradas com a data do CRM). Uma execução hoje captura todas as mudanças de 24–26/11 de uma vez, datadas de hoje. Os dias 25 e 26 ficam sem linha em `crm_leituras` (o buraco 18–22/11, anterior a esta pane, também continua).

**A conferir no 1º teste:** (1) se o `RetornarAtividades` só com a chave traz as atividades de **todos** os usuários (antes vinha a visão do usuário 79); (2) o `dataInicial` da jornada vai em `yyyy-MM-dd` (o Swagger diz `dd/MM/yyyy`). Funcionou até 24/11 (dia útil lia ~900, domingo ~5.400), então ficou igual; se vier 400, o fluxo para com a mensagem.

### 7.2 Carteira: cópia montada em 26/11 (DESLIGADA)

| Nó do original | Endpoint | Equivalente na cópia | Sessão? (Swagger) | Como chama |
|---|---|---|---|---|
| Solicitar acesso API | `Usuario/App_ValidarAcesso` | **removido** (o código era obtido e não era usado por nenhum nó) | — | — |
| Buscar contratos | `ContratoAluguel/RetornarContratos` (Integração · Contratos) | igual, máx. 50/pág | **sim** ("Exige o login de integração") | sub-fluxo "Imoview: requisição" (`Contar contratos` + `Buscar contratos`) |
| Buscar cobranças vencidas | `Movimento/RetornarMovimentos` (Integração · Financeiro) | igual, 200/pág (máx. 1.000) | **sim** | sub-fluxo "Imoview: requisição" (`Contar cobranças vencidas` + `Buscar cobranças vencidas`) |

Cópia: **carteira_locacao_diaria v2 (integração)** (`hIWkwG3XVB2gDb7d`). Fonte: `docs/n8n/carteira_locacao_v2_integracao.sdk.js`. Nenhum endpoint ficou sem equivalente.

- **Paginação sem laço:** "Contar" (`numeroRegistros=1`, só para ler `quantidade`) → Code gera 1 item por página → o sub-fluxo roda 1× por item (`mode: each`) numa execução só do nó. O `Juntar` lê `$('Buscar …').all()` de uma run única. Nada de `all(0, run)` nem `_acum`. O `numeroPagina` é o nº da página (1, 2, …), igual ao original e à Edge `carteira-locacao`, apesar de o Swagger de contratos falar em "registros já retornados".
- **Erros:** quem trata é o sub-fluxo (§4.4). 404 numa página = vazia; o `Juntar` confere `itens == quantidade` e para se faltar algo.
- **Trava de volume (no `Juntar`, antes da RPC):** contratos ≥ 780 (banco: 822), ativos ≥ 140 (fotos 15–24/11: 154–158), cobranças de locação vencidas ≥ 30 (banco: 82). Abaixo disso para sem gravar. Motivo: a RPC **apaga e regrava** `contratos_locacao_cobrancas` e grava a foto do dia.
- **Igual ao original:** 6h30, filtro das cobranças (pendentes, 01/01/2010 até ontem), o enxugamento, a RPC `carregar_carteira_locacao({contratos, cobrancas})` (sem `pagas`) e as tabelas `contratos_locacao`, `contratos_locacao_cobrancas` e `contratos_locacao_fotos`.
- **Credencial a selecionar à mão:** só `Gravar carteira no Supabase` (Supabase). Os nós do Imoview não têm credencial: ela está dentro do sub-fluxo.

**Achado** (migração da Edge no §7.3): quem gravou as fotos diárias até 24/11 foi a **Edge Function `carteira-locacao`** (pg_cron 6h45, `lido_em` às 09:45 UTC), que também lê as **pagas**. Ela falha desde 26/11 com `RetornarMovimentos página 1: HTTP 401` (`net._http_response` 79): só usa a chave (`IMOVIEW_API_KEY`), sem login. Precisa da mesma migração (fora deste sprint).

**Recuperar 24–26/11:** a carteira é **foto do dia**. A RPC grava `contratos_locacao_fotos.data = current_date` (UTC no Postgres) e substitui as cobranças em aberto. Por isso:
- **dá:** 1 execução manual hoje grava a foto de **26/11** e põe contratos e cobranças em dia. Rodar antes das 21h de Brasília, porque depois disso `current_date` já é 27 em UTC;
- **não dá:** a foto de **25/11** (inadimplência daquele dia não volta). 24/11 já existe (Edge, 09:45 UTC). As **pagas** (recebimentos) não entram por este fluxo; voltam quando a Edge for migrada, porque ela lê do mês anterior até hoje.

Conferência (só SELECT), antes e depois:

```sql
select data, ativos, em_ativacao, inadimplentes, inadimplentes_valor, atencao, encerrados_debito, lido_em
from contratos_locacao_fotos where data >= '2026-11-20' order by data;
select count(*) contratos, count(*) filter (where situacao = 'Ativo') ativos, max(atualizado_em) ultimo,
       (select count(*) from contratos_locacao_cobrancas) cobrancas_abertas,
       (select max(lido_em) from contratos_locacao_cobrancas) cobrancas_lidas
from contratos_locacao;
```

Antes (26/11, 16h): fotos 20–24/11 (24/11 com 155 ativos, 10 inadimplentes); **25 e 26 ausentes**; 822 contratos, 155 ativos, último em 24/11 09:45 UTC; 82 cobranças. Depois: uma linha **26/11** com `lido_em` de hoje e ativos ≈ 150–160; contratos ≈ 822 (ou mais) com `max(atualizado_em)` de hoje; cobranças com `lido_em` de hoje.

### 7.3 Edge `carteira-locacao`: migrada em 27/11 (v9 publicada; seco OK: 823 contratos, 154 ativos, 80 cobranças, 2.265 pagas; gravação aguarda OK)

Por quê: é ela (pg_cron `carteira-locacao-receita`, 09:45 UTC = 6h45) que lê as **pagas** e grava `contratos_locacao_recebimentos`. Dá 401 desde 26/11 (só mandava a chave antiga). Último `lido_em` dos recebimentos: 24/11 09:45 UTC; último `data_pagamento`: 23/11. Por isso a receita e a inadimplência do Saúde estão desatualizadas. As fotos de 26 e 27/11 já vêm da carteira v2 do n8n (contratos e cobranças; sem pagas).

**O que mudou** (`supabase/functions/carteira-locacao/`):
- `imoview.ts` (novo): cliente do Imoview com a **mesma sessão do n8n**. Nunca loga por conta própria: chama `imoview_sessao_obter` → `usar` (usa) · `esperar` (espera 1–5 s e pergunta de novo, até 15×) · `login` (faz `Integracao_ValidarAcesso` com `{email, senha}` e o cabeçalho `chave` → `imoview_sessao_gravar`; se o login falhar → `imoview_sessao_liberar` e erro). 401 com `sessaoinvalida` → `obter` com `p_forcar` + `p_recusado` (1× por requisição; páginas em paralelo pedem **um** relogin só). Reconfirma a sessão na RPC a cada 1 min (mantém `usado_em` e pega a renovação do n8n). Regra do §4.4: 404 vazio, 429 `segundosparaliberar` (teto 60 s, 3×), 5xx/rede 2× (5 s, 20 s), resto = erro com a mensagem do Imoview. Prazo total de 120 s (o pg_net espera 150 s): passou disso, erro claro em vez de morrer calado. Nunca põe chave, senha ou `codigoacesso` em log/erro.
- `volume.ts` (novo): **trava de volume antes da RPC**. Contratos ≥ 780, ativos ≥ 140, cobranças vencidas de locação ≥ 30 (iguais ao n8n v2) e **pagas ≥ 80 % do que já está no banco na mesma janela de vencimento** (SELECT; em 27/11: 308 na janela do mês anterior, 2.173 na de 13 meses). Pagas = 0 sempre para. Abaixo disso: erro, nada gravado.
- `index.ts`: secrets novas, 3 leituras **em sequência** (antes em paralelo, até 18 conexões) com 3 páginas por vez; movimentos a 200/pág (Swagger: máx. 1.000; contratos: máx. 50); só pagas com `datapagamento`. Modo **`seco: true`**: lê tudo e aplica a trava, devolve os números e **não grava** (para o teste depois do deploy). Erro volta na resposta (`{erro, etapa}`, 502 se for do Imoview) e no log (`[carteira-locacao] erro em "<etapa>"`). Gravação igual: `carregar_carteira_locacao({contratos, cobrancas, pagas})`.
- Teste local (node, Imoview e RPCs simulados, 32 checagens OK): sem sessão → 1 login e 822 em 17 páginas; sessão do n8n → 0 login; esperar 2×; 6 páginas com 401 → 1 obter forçado e 1 login; 429 e 5xx com nova tentativa; 5xx 3× → erro; 404 = vazio; página do meio 404 → "772 de 822"; login recusado → libera a trava e a senha não aparece; 401 de chave → fatal sem relogin; 429 de 300 s e prazo esgotado → erro; 200 não-JSON → erro; trava de volume. **Não rodou no Deno nem contra o Imoview real** (sem Deno na máquina; `index.ts` sem checagem de tipos).

**Secrets** (supabase.com ▸ projeto do Hub ▸ Edge Functions ▸ Secrets ▸ Add new secret; valem para todas as funções): `IMOVIEW_CHAVE` (a chave geral de Integração), `IMOVIEW_EMAIL` e `IMOVIEW_SENHA` (usuário 111). `IMOVIEW_API_KEY` fica como está (a `esteira-locacao` lê esse nome). `AGENDADOR_CHAVE` não muda.

**Convivência com o n8n:** a carteira v2 roda às 6h30 e a Edge às 6h45, os dois com o usuário 111. Pela tabela, a Edge reaproveita a sessão do n8n (usada há < 8 min) ou, se ela venceu, faz o login com a trava; um fluxo do n8n que levar 401 depois disso força com `p_recusado` e recebe a sessão nova, sem novo login. A Edge também regrava contratos/cobranças/foto do dia (como fazia até 24/11): a foto das 6h45 substitui a das 6h30.

**Reler os pagamentos desde 24/11:** não precisa de período novo. O modo `completo` lê as pagas por **vencimento** dos últimos 13 meses (de 01/11/2025 até hoje), o que cobre todo pagamento feito de 24/11 em diante (o upsert por `codigo` só acrescenta/atualiza). O modo normal (mês anterior) cobre vencimentos desde 01/10: pega quase tudo, mas não um atraso antigo pago agora. Então: 1 chamada com `{"completo": true}` depois do deploy (o domingo 29/11 também roda completo sozinho).

**Teste depois do deploy** (SQL Editor, mesmo formato do pg_cron; a resposta fica em `net._http_response`):

```sql
-- 1) seco: lê e confere, NÃO grava
select net.http_post(
  url := 'https://vlsrmtryzwddqkwqugfr.supabase.co/functions/v1/carteira-locacao',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
    'x-agendador', (select decrypted_secret from vault.decrypted_secrets where name = 'carteira_agendador_chave')),
  body := '{"seco": true, "completo": true}'::jsonb, timeout_milliseconds := 150000);
-- 1 a 2 min depois:
select id, status_code, left(content::text, 600) from net._http_response order by id desc limit 3;
-- esperado: 200 com "seco":true, volume.contratos ≈ 823, ativos ≈ 154, cobrancas ≈ 80, pagas ≥ 2.173
-- 2) se o seco passou: a mesma chamada com body '{"completo": true}' (grava)
```

Esperado no log da Edge (Edge Functions ▸ carteira-locacao ▸ Logs): `[carteira-locacao] … contratos, … em aberto, … pagas (01/11/2025 a 27/11/2026 (13 meses)) · {"logins":0 ou 1,…}`. Em `imoview_sessao.logins` o contador sobe no máximo 1 por chamada.

**Conferência (só SELECT), antes e depois:**

```sql
select count(*) recebimentos, max(lido_em) ultimo_lido, max(data_pagamento) ultimo_pagamento,
       count(*) filter (where data_pagamento >= '2026-11-24') pagos_desde_24_11,
       sum(taxa_adm) filter (where data_pagamento >= '2026-11-01') adm_recebida_nov
from contratos_locacao_recebimentos;
select data, ativos, inadimplentes, inadimplentes_valor, lido_em from contratos_locacao_fotos where data >= '2026-11-23' order by data;
select logins, obtido_em, usado_em, renovando_ate from imoview_sessao where perfil = 'integracao';
```

Antes (27/11, 9h20 SP): 2.398 recebimentos, `lido_em` 24/11 09:45 UTC, último pagamento 23/11, **0 pagos desde 24/11**. Depois: `lido_em` de hoje, último pagamento ≥ 26/11, pagos desde 24/11 > 0, recebimentos ≥ 2.398.

Depois da leva: `Repique 3.0` e `Distribuição` (inativos) dependem de um substituto do `App_Transferir`; os inativos com segredo em texto continuam no passo 1 do §5 (arquivar).

---

## 8. O que foi montado em 26/11 (tudo DESLIGADO, nada publicado)

### 8.1 Peças

| Peça | Id | O que faz |
|---|---|---|
| Migration `supabase/migrations/20261126122845_imoview_sessao.sql` | aplicada 26/11 | tabela `imoview_sessao` + RPCs `imoview_sessao_obter/gravar/liberar`; tabela `wpp_entrada_reserva` + RPCs `wpp_entrada_reservar/concluir`. Schema §2.24 |
| Sub-fluxo **Imoview: obter sessão** | `BN7laXW9hnzNt0xq` | único login. Lê a sessão (RPC com `for update`): **usar** (sessão com < 8 min sem uso), **esperar** (outro está logando: 2 s e relê, até 10×) ou **login** (pegou a trava de 30 s → `Integracao_ValidarAcesso` → grava → devolve). Entrada `forcar` + `codigoacesso_recusado`: se a sessão guardada já é outra, alguém renovou antes e ela é usada sem novo login |
| Sub-fluxo **Imoview: requisição** | `eeBeBvPVCwnm3XWU` | entrada `metodo`, `caminho`, `query`, `corpo`, `rotulo`. Pede a sessão, chama com os 3 cabeçalhos e aplica o §4.4: 200 ok · 404 vazio · 401 `sessaoinvalida` → relogin 1× · 429 → espera `segundosparaliberar` (teto 60 s, até 3×) · 5xx/rede → 2× (5 s, 20 s) · resto → **erro com a mensagem do Imoview**. Devolve `{resultado, status, dados, mensagem}`, nunca a sessão. Recusa chamar `*ValidarAcesso` |
| **wpp_entrada v4 (integração)** | `TQ1EWzw1e2lAfvjT` | cópia do `wpp_entrada`; webhook em `/webhook/wpp-entrada-v4-integracao` (caminho novo). Detalhes em `docs/n8n/wpp_entrada__v4_integracao.md` |

Fonte (SDK) em `docs/n8n/imoview_obter_sessao.sdk.js`, `docs/n8n/imoview_requisicao.sdk.js` e `docs/n8n/wpp_entrada_v4_integracao.sdk.js`.

### 8.2 Por que a sessão ficou numa tabela e não nos static data

| | Static data do n8n | Tabela `imoview_sessao` |
|---|---|---|
| Quem enxerga | só o próprio fluxo | todos os fluxos (pelo sub-fluxo) |
| Quando grava | no fim da execução | na hora |
| Dois leads ao mesmo tempo | os dois leem "sem sessão" → **2 logins, um derruba o outro** | `select … for update`: o 2º espera a trava e reaproveita |
| Execução manual/teste | não salva | salva |

A tabela custa uma migration e 3 chamadas ao Supabase por login (1 por reaproveitamento). Compensa: o problema a resolver é exatamente a concorrência.

### 8.3 Segredos
- Chave, e-mail e senha só nas credenciais `Imoview · chave` e `Imoview · login`. Exceção (27/11): a Edge `carteira-locacao` tem as suas como secrets (`IMOVIEW_CHAVE`, `IMOVIEW_EMAIL`, `IMOVIEW_SENHA`) e faz login **só** pela trava da `imoview_sessao` (§7.3).
- O `codigoacesso` mora na tabela (RLS fechada, só `service_role`) e passa pelos 2 sub-fluxos, que **não salvam execução de sucesso**. As execuções com erro dos sub-fluxos guardam o código (vale 10 min sem uso). O `wpp_entrada v4` salva as execuções de sucesso: ele nunca recebe a sessão.

### 8.4 Riscos conhecidos
- **Custom Auth + corpo JSON:** o nó de login manda `{}` e conta com a Custom Auth mesclando `{"body":{"email","senha"}}`. Se a 1ª execução der "E-mail ou senha não informados" (400), a 1ª alternativa é desligar "Send Body" no nó `Login de integração` (aí o corpo é só o da credencial). Nunca colar e-mail/senha no nó.
- **Sub-fluxo não publicado:** se o n8n recusar chamar um sub-fluxo não publicado em produção, os 2 sub-fluxos precisam ser publicados (não têm gatilho próprio, publicar não dispara nada). Precisa do OK do Eduardo.
- **Trava presa:** se o n8n cair no meio do login, a trava vence sozinha em 30 s.
