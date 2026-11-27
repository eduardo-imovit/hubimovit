# wpp_entrada — v3: campanha no formato `COD <nº> <finalidade>` (25/11, Asimov) — NÃO PUBLICADO

Fluxo n8n `wpp_entrada` (id `IA36OKJMvSCGmvMP`). Substitui a proposta `<mídia> · COD <nº>` do v2
(`wpp_entrada__v2_29b.md`). Aplicar só com OK do Eduardo.

## Versão publicada hoje (`7925fd33…` = o rascunho de 24/11 12:21 UTC)

| Ponto do v2 | Situação |
|---|---|
| 1. Supabase em fila antes do Imoview | **Feito.** `Deduplicar → Alimentar planilha → Solicitar acesso API → …`. O "Supabase no final da linha" é o `Gravar atendimento Imoview` (update), que é o lugar certo. |
| 2. `Incluir lead` com mídia conciliada + `campanha` | **Não feito.** Ainda manda `midia` do "extrair IDs" e não manda `campanha`. |
| 3. `Gravar atendimento` lê `lead_id` e grava `imoview_vinculo` | `lead_id` agora está no mesmo caminho (a expressão deve resolver). **Não grava `imoview_vinculo`** — o que é bom enquanto a migration `20261124170000` não for aplicada (a coluna não existe e o nó falharia). |
| 4. Salvar execuções de sucesso | **Não feito.** Settings sem `saveDataSuccessExecution`; nenhuma execução do fluxo está guardada. |

Banco (25/11): depois de 24/11 12:21 UTC entraram os leads 613 (24/11 16:14) e 614 (25/11 10:23), ambos com
`imoview_atendimento` vazio, e **0 PATCH** em `leads_wpp_gtm` nos logs (só os POST 201). Ou a publicação foi depois
de 10:23 de hoje, ou o `Gravar atendimento` ainda erra em silêncio (`onError: continueRegularOutput`). Sem execução
salva não dá para saber — por isso o ponto 4 vem primeiro.

## Bug achado: `COD <nº> locação` cai em `wpp_nao_identificado`

O "extrair IDs" publicado só reconhece locação por `alugar|aluguel`. Com o formato novo, "COD 12345 locação" vira
`wpp_nao_identificado` (`midia_fonte = cod_sem_palavra`). Testado localmente com o código publicado. Coincide com o
banco: desde 23/11 18:28 UTC todos os leads do Severino (608–614) estão `wpp_nao_identificado`, vários com código
de imóvel (10244, 12646) — provável campanha perdida. (Não provado: o texto da mensagem não fica no banco.)

## O que mudar (4 nós/ajustes)

1. **`extrair IDs e definir finalidade`** → colar `docs/n8n/wpp_entrada__extrair_ids_v3.js` inteiro.
   - Finalidade = palavra logo depois do número (`locação/locacao/locar/aluguel/alugar` ou `venda/compra`);
     se não estiver colada no número, procura na mensagem toda (só um dos lados).
   - Saída nova `campanha`: `"COD 12345 locação"` ou `"COD 12345 venda"` (padronizado, com acento), `null` fora de campanha.
   - Testes locais (11 mensagens): locação/locacao/Locação com hífen/aluguel/alugar → `campanha_locacao`;
     venda → `campanha_venda`; "COD 12345 vi o anúncio" e "COD 12345 localização" → `wpp_nao_identificado`; site GTM igual.
2. **`Incluir lead` → JSON Body:**

```js
={{ JSON.stringify({
  nome: $('extrair IDs e definir finalidade').item.json.nome,
  telefone: $('extrair IDs e definir finalidade').item.json.telefone,
  anotacoes: ($('extrair IDs e definir finalidade').item.json.mensagem_testada || '') + ($('extrair IDs e definir finalidade').item.json.codigo_imovel ? '\n\nImóvel de interesse: ' + $('extrair IDs e definir finalidade').item.json.codigo_imovel : ''),
  codigoimovel: ($('extrair IDs e definir finalidade').item.json.midia || '').startsWith('campanha_') ? undefined : $('extrair IDs e definir finalidade').item.json.codigo_imovel,
  finalidade: $('extrair IDs e definir finalidade').item.json.finalidade,
  midia: $('Alimentar planilha GTM/WPP').item.json.utm_campaign || $('extrair IDs e definir finalidade').item.json.midia,
  campanha: $('extrair IDs e definir finalidade').item.json.campanha || undefined
}) }}
```

   - `midia`: a conciliada pelo trigger (`site_google_ads`/`site_meta_ads`) que volta no retorno do insert;
     se o insert falhou, a do código.
   - `campanha`: `undefined` some do JSON, então lead que não é de campanha não manda o campo.
3. **`Gravar atendimento Imoview`**: deixar como está (só `imoview_atendimento`). Acrescentar `imoview_vinculo = n8n`
   **só depois** de aplicar a `20261124170000`, senão o update falha (erro silencioso).
4. **Settings → "Save successful production executions" = Save.** Atenção: os nós do Imoview guardam o
   `codigoacesso` nas execuções; vale ligar a redação de dados ou apagar as execuções depois de conferir.

Opcional: copiar `campanha` também para `leads_wpp_gtm` (não há coluna hoje; exige migration — fora deste ajuste).

## Como conferir depois de publicar

1. Mandar pelo WhatsApp do Severino: `COD <nº real> locação`.
2. Execução salva → nó "extrair IDs": `midia = campanha_locacao`, `campanha = "COD <nº> locação"`. Nó "Incluir lead"
   (ou "Criar atividade" se o lead for quente) e "Gravar atendimento" sem erro.
3. Supabase: `select lead_id, utm_campaign, imoview_atendimento from leads_wpp_gtm order by created_at desc limit 3;`
   → `campanha_locacao` e `imoview_atendimento` preenchido. Logs: um PATCH em `leads_wpp_gtm`.
4. Dia seguinte: `select codigo, midia_raw, campanha from vw_atendimentos_base where codigo = <nº>;` → `campanha` preenchida.

## Ainda não verificado
- Se o Imoview grava `campanha` vinda do `/Lead/IncluirLead` (o v2 já listava). Lead quente passa por "Criar atividade",
  que não leva mídia nem campanha.
- Por que 613/614 ficaram sem `imoview_atendimento` (ver acima).
