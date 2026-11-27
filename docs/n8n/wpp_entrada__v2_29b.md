# wpp_entrada — conserto da 29b (24/11, Asimov) — NÃO PUBLICADO

Fluxo n8n `wpp_entrada` (id `IA36OKJMvSCGmvMP`). Aplicar só com OK do Eduardo.

## Por que quebrou (versão ativa `e6c22380…`, publicada em 23/11 14:09 UTC)

```
Deduplicar ─┬─▶ Alimentar planilha GTM/WPP        (ramo A: grava no Supabase)
            └─▶ Solicitar acesso API ─▶ Buscar lead ─▶ If ─▶ … ─▶ Incluir lead ─▶ Buscar atendimento criado ─▶ Gravar atendimento Imoview
                                                                                   (ramo B)
```

- `Gravar atendimento Imoview` filtra por `$('Alimentar planilha GTM/WPP').item.json.lead_id`. O `.item` só
  enxerga nós **anteriores no mesmo caminho**; Alimentar está no ramo vizinho, então a expressão falha
  ("paired item") **antes** de chamar o Supabase. Como o nó tem `onError: continueRegularOutput`, o erro some.
  Prova: 0 requisições PATCH em `leads_wpp_gtm` desde 23/11 14:09 UTC (logs do Supabase), com 5 leads do Severino
  e 2 atendimentos novos no CRM (6613, 6614) no mesmo minuto.
- Pelo mesmo motivo, `Incluir lead` manda `midia` do nó "extrair IDs" (mídia bruta), e não a mídia conciliada
  pelo trigger (`site_google_ads` / `site_meta_ads`). O Imoview nunca recebeu `site_*`.
- `Incluir lead` não manda `campanha`, embora o `/Lead/IncluirLead` aceite `campanha` e `utm`. Por isso
  `vw_atendimentos_base.campanha` fica vazia em todos os "Campanhas pagas".

## O que mudar (4 pontos)

1. **Ligações:** `Deduplicar telefone → Alimentar planilha GTM/WPP → Solicitar acesso API` (em fila, não em
   paralelo). O rascunho salvo em 24/11 12:21 UTC (versão `7925fd33…`, ainda não publicada) já faz isso.
2. **`Incluir lead` → JSON Body** (troca `midia` e acrescenta `campanha`):

```js
={{ JSON.stringify({
  nome: $('extrair IDs e definir finalidade').item.json.nome,
  telefone: $('extrair IDs e definir finalidade').item.json.telefone,
  anotacoes: ($('extrair IDs e definir finalidade').item.json.mensagem_testada || '') + ($('extrair IDs e definir finalidade').item.json.codigo_imovel ? '\n\nImóvel de interesse: ' + $('extrair IDs e definir finalidade').item.json.codigo_imovel : ''),
  codigoimovel: ($('extrair IDs e definir finalidade').item.json.midia || '').startsWith('campanha_') ? undefined : $('extrair IDs e definir finalidade').item.json.codigo_imovel,
  finalidade: $('extrair IDs e definir finalidade').item.json.finalidade,
  // mídia conciliada pelo trigger do banco (site_google_ads / site_meta_ads); se o insert falhou, a do código
  midia: $('Alimentar planilha GTM/WPP').item.json.utm_campaign || $('extrair IDs e definir finalidade').item.json.midia,
  // campanha só para pagos: "<mídia> · COD <nº>" (regra a confirmar com o Eduardo)
  campanha: (() => {
    const m = $('Alimentar planilha GTM/WPP').item.json.utm_campaign || $('extrair IDs e definir finalidade').item.json.midia || '';
    if (!/^(campanha_|site_google_ads|site_meta_ads)/.test(m)) return undefined;
    const cod = $('extrair IDs e definir finalidade').item.json.midia_fonte === 'cod_campanha' ? ' · COD ' + $('extrair IDs e definir finalidade').item.json.codigo_imovel : '';
    return m + cod;
  })()
}) }}
```

3. **`Gravar atendimento Imoview` → campos:** manter `imoview_atendimento` como está e acrescentar
   `imoview_vinculo = n8n` (coluna nova da migration `20261124170000`).
   `={{ $json.codigoatendimento || $('Buscar lead no sistema').item.json.codigoatendimento }}` cobre os 2 caminhos
   (lead novo: retorno do `RetornarDadosCliente`; lead existente: atendimento achado na busca).
4. **Configurações do fluxo:** "Save successful production executions" = **Save**. Hoje só as execuções com erro
   ficam guardadas, e não dá para conferir um lead que "funcionou".

## Como conferir depois de publicar

1. Mandar uma mensagem de teste pelo WhatsApp do Severino (ou esperar o próximo lead).
2. No Supabase: `select lead_id, utm_campaign, imoview_atendimento, imoview_vinculo from leads_wpp_gtm order by created_at desc limit 3;`
   → `imoview_atendimento` preenchido e `imoview_vinculo = 'n8n'`.
3. No dia seguinte (captura do CRM): `select codigo, midia_raw, campanha from vw_atendimentos_base where codigo = <nº>;`
   → `campanha` preenchida quando for pago.

## Ainda não verificado

- Se o `RetornarDadosCliente` logo depois do `IncluirLead` devolve o atendimento **novo** no caso "lead frio"
  (ou o antigo). Conferir no 1º lead frio com a execução salva (ponto 4).
- Se o Imoview grava `campanha` vinda do `/Lead/IncluirLead` quando o cliente já existe (caminho "Criar atividade"
  não passa por aqui: nesse caso a campanha do atendimento antigo continua).
