# wpp_entrada v4 (integração) — 26/11 (Asimov) — DESLIGADO, NÃO PUBLICADO

Cópia do `wpp_entrada` (`IA36OKJMvSCGmvMP`, que continua como está) usando o login de integração do Imoview.
Fluxo novo: **`TQ1EWzw1e2lAfvjT`**. Sub-fluxos: **Imoview: obter sessão** (`BN7laXW9hnzNt0xq`) e **Imoview: requisição** (`eeBeBvPVCwnm3XWU`).
Arquitetura: `docs/n8n/imoview-auth-arquitetura.md` §4 e §8. Banco: `docs/05-backend-schema.md` §2.24 (migration `20261126122845`, aplicada 26/11).

## Caminho

```
Webhook (/webhook/wpp-entrada-v4-integracao)
 → extrair IDs (= v3 publicado, sem mudança)
 → Reservar telefone (RPC)  ── já reservado? ──▶ para (duplicado)
 → Alimentar planilha GTM/WPP (insert em leads_wpp_gtm)
 → Buscar lead no sistema            [Imoview: requisição → GET Cliente/RetornarDadosCliente]
 → Já tem atendimento?
    ├─ sim → Montar consulta (finalidade 1 e 2)
    │        → Retornar Atendimento   [GET Atendimento/RetornarAtendimentos?codigoCliente=…&situacao=0]
    │        → Fase no Hub            [vw_atendimentos_base.fase]
    │        → Analisar atendimento   (regra de 60 dias / fase, igual ao v3)
    │        → Está atualizado 60D?
    │            ├─ quente/avançado → Criar atividade [POST Agenda/IncluirAtividade] → Atendimento (atividade)
    │            └─ frio            → Incluir lead ↓
    └─ não → Incluir lead             [POST Lead/IncluirLead, JSON Body da 29b]
             → Buscar atendimento criado [GET Cliente/RetornarDadosCliente] → Atendimento (lead novo)
 → Gravar atendimento Imoview (imoview_atendimento + imoview_vinculo = 'n8n')
 → Concluir reserva (RPC)
```

O que mudou em relação ao v3, e por quê:

| Mudança | Por quê |
|---|---|
| Os 5 nós do Imoview chamam o sub-fluxo "Imoview: requisição" | ele pede a sessão ao "obter sessão" (único login), manda `chave` + `codigousuario` + `codigoacesso`, refaz o login 1× no 401 `sessaoinvalida`, espera no 429 e **para a execução** em qualquer outro erro |
| Sem `Solicitar acesso API` (App_ValidarAcesso) | responde "Atualize o aplicativo"; o login agora é o do usuário 111, dentro do sub-fluxo |
| `App_DetalhesAtendimentos` → `RetornarAtendimentos` + fase do Hub | o usuário de integração não acessa App_. O `RetornarAtendimentos` não devolve a fase, por isso ela vem de `vw_atendimentos_base` (leitura das 6h; para a regra de 60 dias, 1 dia de atraso não muda nada). Atendimento sem fase no Hub (criado hoje) conta como fase 1 |
| `App_IncluirAtividade` → `Agenda/IncluirAtividade` | mesmo motivo. Corpo: `codigousuario` = corretor do atendimento, `CodigoTipo` 1, início agora / fim +30 min, `titulo`, `texto` (mensagem + telefone), `codigoatendimento`, `codigopessoa` |
| Sem `continueRegularOutput` nos nós do Imoview e no `Gravar atendimento` | foi o que escondeu a falha de 24/11. Só o insert inicial (`Alimentar planilha`) continua seguindo em caso de erro, para o lead chegar ao Imoview mesmo com o Supabase fora |
| `Deduplicar telefone` (static data) → `Reservar telefone` / `Concluir reserva` (Supabase) | o antigo marcava o telefone na chegada: se o Imoview falhasse, a nova tentativa do mesmo lead em 30 min era descartada. Agora: concluído bloqueia 30 min; "processando" bloqueia 5 min (uma execução que falhou libera sozinha). E é atômico (dois webhooks no mesmo segundo, só um passa) |
| `Gravar atendimento` grava `imoview_vinculo = 'n8n'` | pendência da 29b (a coluna já existe) |
| Execuções de sucesso salvas | para conferir o que aconteceu com cada lead. O `codigoacesso` não passa por este fluxo (fica nos sub-fluxos, que não salvam sucesso) |
| Webhook em caminho novo | não brigar com o v3 no ar |

Ficou igual: o código do "extrair IDs" (v3), o JSON Body do `Incluir lead` (29b: `midia` conciliada, `campanha`, `codigoimovel` só fora de campanha), a regra frio/quente/avançado.

## Credenciais: onde selecionar (o MCP não atribui credencial a nó HTTP)

Criar antes, em **Credentials → Add credential**:
1. **`Imoview · chave`** — tipo **Header Auth**. Name = `chave`, Value = a chave geral de Integração.
2. **`Imoview · login`** — tipo **Custom Auth**. JSON:
   ```json
   {"headers": {"chave": "<chave geral>", "Content-Type": "application/json"}, "body": {"email": "<e-mail do usuário 111>", "senha": "<senha do usuário 111>"}}
   ```
   Senha em texto, como no teste de vocês (a API não aceita MD5 aqui).

Depois, nó por nó:

| Fluxo | Nó | Credencial |
|---|---|---|
| Imoview: obter sessão | `Ler sessão (RPC)` | Supabase (a mesma *service role* dos outros fluxos; o nó pede "Supabase API") |
| | `Login de integração` | **Custom Auth → `Imoview · login`** |
| | `Gravar sessão (RPC)` | Supabase |
| | `Liberar trava (RPC)` | Supabase |
| Imoview: requisição | `Imoview GET` | **Header Auth → `Imoview · chave`** |
| | `Imoview POST` | **Header Auth → `Imoview · chave`** |
| wpp_entrada v4 (integração) | `Reservar telefone (RPC)` | Supabase |
| | `Concluir reserva (RPC)` | Supabase |
| | `Alimentar planilha GTM/WPP`, `Fase no Hub`, `Gravar atendimento Imoview` | já vieram com "Supabase account" (o MCP atribuiu); conferir se é a mesma do `wpp_entrada` |

Os nós `Buscar lead`, `Retornar Atendimento`, `Criar atividade`, `Incluir lead` e `Buscar atendimento criado` **não têm credencial**: são chamadas ao sub-fluxo.

## Como testar (com um lead de teste; nada disso liga o fluxo)

Antes: **OK para aplicar a migration `20261126122845_imoview_sessao`** (sem ela as RPCs não existem). Não rodar o fluxo "Teste imoview 26/11/2026" durante o teste: cada login dele derruba a sessão do sub-fluxo.

1. **Sessão sozinha.** Abrir "Imoview: obter sessão" → *Execute workflow*. Esperado: nó `Devolver sessão` com `sessao: "nova"`. Executar de novo: `sessao: "reaproveitada"`. No Supabase:
   `select perfil, codigousuario, obtido_em, usado_em, logins from imoview_sessao;` → `codigousuario = 111`, `logins = 1`. (Não selecionar a coluna `codigoacesso`.)
   - Se `Login de integração` voltar 400 "e-mail ou senha não informados": desligar *Send Body* nesse nó e repetir (doc de arquitetura §8.4).
2. **Lead novo.** Abrir "wpp_entrada v4 (integração)" → *Execute workflow* (fica ouvindo o webhook de teste) e mandar:
   ```bash
   curl -X POST https://n8n.srv1552977.hstgr.cloud/webhook-test/wpp-entrada-v4-integracao \
     -H "Content-Type: application/json" \
     -d '{"nome":"Teste Integracao","whatsapp":"<seu número de teste, com 55>","mensagem_completa":"COD <nº real> locação"}'
   ```
   Esperado: caminho `Já tem atendimento? → não → Incluir lead → Buscar atendimento criado → Gravar → Concluir`. Conferir:
   - `select lead_id, utm_campaign, imoview_atendimento, imoview_vinculo from leads_wpp_gtm order by created_at desc limit 1;` → `campanha_locacao`, atendimento preenchido, `n8n`.
   - `select * from wpp_entrada_reserva;` → o telefone com `status = ok`.
   - No Imoview: o atendimento novo com mídia `campanha_locacao` e campanha "COD <nº> locação".
   - `imoview_sessao.logins` continua 1 (reaproveitou a sessão do passo 1, se foi há menos de 8 min).
3. **Duplicado.** Mandar o mesmo `curl` de novo (dentro de 30 min). Esperado: para em `Telefone livre?` (saída falsa), nada no Imoview, nenhuma linha nova em `leads_wpp_gtm`.
4. **Lead quente.** Liberar a reserva e mandar de novo:
   `delete from wpp_entrada_reserva where telefone = '<telefone formatado, ex. (51) 99999-0000>';`
   Esperado: `Já tem atendimento? → sim → … → Analisar atendimento` com `acao = criar_atividade` e `motivo` "Lead quente…" → `Criar atividade`. No Imoview: a atividade no atendimento do passo 2, para o corretor dele. **Este é o teste que confirma o `Agenda/IncluirAtividade`** (se a atividade não aparecer no atendimento, ou cair no usuário errado, parar e me chamar).
5. **401 forçado (relogin).** `update imoview_sessao set codigoacesso = 'invalido' where perfil = 'integracao';` → liberar a reserva (passo 4) → mandar de novo. Esperado: execução com sucesso, `logins` sobe 1 (um relogin só). Na execução do "Imoview: requisição" que falhou a 1ª vez não fica nada salvo (só erro é salvo); conferir pelo `logins`.
6. **Limpeza:** descartar o atendimento de teste no Imoview; `delete from leads_wpp_gtm where lead_id in (<ids do teste>);` `delete from wpp_entrada_reserva where telefone = '<…>';`

## Para pôr no ar (só com OK)
- Duas opções: (a) trocar a URL do webhook no Severino para `/webhook/wpp-entrada-v4-integracao` e ativar o v4; ou (b) desativar o v3, mudar o caminho do webhook do v4 para o do v3 (`1dbd510f-…`) e ativar. A (b) não depende do prestador do Severino.
- Se o n8n recusar chamar sub-fluxo não publicado em produção, publicar os 2 sub-fluxos (não têm gatilho; publicar não dispara nada).
- Depois de 1 dia no ar: `select imoview_vinculo, count(*), count(imoview_atendimento) from leads_wpp_gtm where created_at > now() - interval '1 day' group by 1;`
