import { workflow, node, trigger, newCredential, expr, ifElse } from '@n8n/workflow-sdk';
// "wpp_entrada v4 (integração)" (26/11, Asimov) — CÓPIA do wpp_entrada (IA36OKJMvSCGmvMP), DESLIGADA.
// Diferenças para o v3 publicado:
//  - Todo nó do Imoview vira chamada ao sub-fluxo "Imoview: requisição" (eeBeBvPVCwnm3XWU), que pede a sessão ao
//    "Imoview: obter sessão" (BN7laXW9hnzNt0xq, único login) e manda chave + codigousuario + codigoacesso.
//    401 sessaoinvalida → relogin 1× · 429 → espera · erro → a execução PARA (nada de continueRegularOutput no Imoview).
//  - App_ saiu (o usuário de integração não acessa App_; o App_ValidarAcesso responde "Atualize o aplicativo"):
//      App_DetalhesAtendimentos → /Atendimento/RetornarAtendimentos (codigoCliente, as 2 finalidades) + fase lida no Hub
//      App_IncluirAtividade     → /Agenda/IncluirAtividade (codigoatendimento no corpo)
//  - Deduplicação no Supabase (wpp_entrada_reserva): bloqueia 30 min só depois de CONCLUIR; falha libera em 5 min.
//  - Gravar atendimento com imoview_vinculo = 'n8n'. Execuções de sucesso salvas (o codigoacesso não passa por este fluxo).
//  - Webhook em caminho NOVO (wpp-entrada-v4-integracao), para não brigar com o v3 no ar.
const SETTINGS = { settings: { executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' } };
const REQ = { __rl: true, value: 'eeBeBvPVCwnm3XWU', mode: 'list', cachedResultName: 'Imoview: requisição' };
const RPC = 'https://vlsrmtryzwddqkwqugfr.supabase.co/rest/v1/rpc/';
const SCHEMA_REQ = ['metodo', 'caminho', 'query', 'corpo', 'rotulo'].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: ['query', 'corpo'].includes(id) ? 'object' : 'string' }));
const imoview = (name, position, metodo, caminho, query, corpo, rotulo, extra = {}) => node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.2, config: { name, ...extra, parameters: { source: 'database', workflowId: REQ, mode: 'each', workflowInputs: { mappingMode: 'defineBelow', value: { metodo, caminho, query, corpo, rotulo }, matchingColumns: [], schema: SCHEMA_REQ, attemptToConvertTypes: false, convertFieldsToString: false }, options: { waitForSubWorkflow: true } }, position }, output: [{ resultado: 'ok', status: 200, dados: {}, mensagem: '' }] });
const X = "$('extrair IDs e definir finalidade')";

const webhook = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Webhook', parameters: { httpMethod: 'POST', path: 'wpp-entrada-v4-integracao', options: {} }, position: [0, 0] }, output: [{ body: { nome: 'Teste', whatsapp: '5551999990000', mensagem_completa: 'COD 12345 locação' } }] });

// O código do nó é o arquivo docs/n8n/wpp_entrada__extrair_ids_v3.js, idêntico ao publicado no v3 (injetado na geração).
const EXTRAIR_JS = require_v3_extrair();

const extrair = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'extrair IDs e definir finalidade', parameters: { mode: 'runOnceForEachItem', jsCode: EXTRAIR_JS }, position: [220, 0] }, output: [{ telefone: '(51) 99999-0000', nome: 'Teste', midia: 'campanha_locacao', finalidade: 1, codigo_imovel: '12345', campanha: 'COD 12345 locação', mensagem_testada: 'COD 12345 locação' }] });

const reservar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Reservar telefone (RPC)', parameters: { method: 'POST', url: RPC + 'wpp_entrada_reservar', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_telefone: $json.telefone || null }) }}'), options: { timeout: 15000 } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [440, 0] }, output: [{ reservado: true }] });

const livre = ifElse({ version: 2.2, config: { name: 'Telefone livre?', parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.reservado }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }, position: [660, 0] } });

const alimentar = node({ type: 'n8n-nodes-base.supabase', version: 1, config: { name: 'Alimentar planilha GTM/WPP', onError: 'continueRegularOutput', parameters: { tableId: 'leads_wpp_gtm', fieldsUi: { fieldValues: [
  { fieldId: 'nome', fieldValue: expr(`{{ ${X}.item.json.nome }}`) },
  { fieldId: 'codigo_atendimento', fieldValue: expr(`{{ ${X}.item.json.codigo_atendimento }}`) },
  { fieldId: 'whatsapp', fieldValue: expr(`{{ ${X}.item.json.telefone ? Number(${X}.item.json.telefone.replace(/\\D/g, '')) : null }}`) },
  { fieldId: 'utm_campaign', fieldValue: expr(`{{ ${X}.item.json.midia }}`) },
  { fieldId: 'interesse', fieldValue: expr(`{{ ${X}.item.json.finalidade }}`) },
  { fieldId: 'imovel_codigo', fieldValue: expr(`{{ ${X}.item.json.codigo_imovel }}`) },
  { fieldId: 'tipo_conversao', fieldValue: 'whatsapp_bot' },
  { fieldId: 'origem_registro', fieldValue: 'bot_severino' }
] } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [880, 0] }, output: [{ lead_id: 1, utm_campaign: 'campanha_locacao' }] });

const buscarLead = imoview('Buscar lead no sistema', [1100, 0], 'GET', 'Cliente/RetornarDadosCliente', expr(`{{ { emailOuTelefone: ${X}.item.json.telefone } }}`), expr('{{ {} }}'), 'wpp_entrada: buscar lead');

const temAtendimento = ifElse({ version: 2.2, config: { name: 'Já tem atendimento?', parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.resultado === "ok" && $json.dados && $json.dados.existe === true && Number($json.dados.codigoatendimento) > 0 ? "sim" : "nao" }}'), rightValue: 'sim', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }, position: [1320, 0] } });

const montarConsulta = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Montar consulta do atendimento', parameters: { mode: 'runOnceForAllItems', jsCode: "// RetornarAtendimentos exige a finalidade: consulta as duas (locação e venda) do cliente.\nconst d = $input.first().json.dados;\nif (!d.codigo) throw new Error('RetornarDadosCliente sem o código do cliente: não dá para ler o atendimento ' + d.codigoatendimento);\nreturn [1, 2].map((finalidade) => ({ json: { finalidade, codigoCliente: d.codigo, codigoatendimento: d.codigoatendimento }, pairedItem: { item: 0 } }));" }, position: [1540, -200] }, output: [{ finalidade: 1, codigoCliente: 1, codigoatendimento: 1 }] });

const retornarAtendimento = imoview('Retornar Atendimento', [1760, -200], 'GET', 'Atendimento/RetornarAtendimentos', expr('{{ { numeroPagina: 1, numeroRegistros: 20, finalidade: $json.finalidade, situacao: 0, codigoCliente: $json.codigoCliente } }}'), expr('{{ {} }}'), 'wpp_entrada: ler atendimento');

const faseHub = node({ type: 'n8n-nodes-base.supabase', version: 1, config: { name: 'Fase no Hub', alwaysOutputData: true, executeOnce: true, parameters: { operation: 'getAll', tableId: 'vw_atendimentos_base', limit: 1, filters: { conditions: [{ keyName: 'codigo', condition: 'eq', keyValue: expr("{{ $('Buscar lead no sistema').first().json.dados.codigoatendimento }}") }] } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [1980, -200] }, output: [{ codigo: 1, fase: 3 }] });

const ANALISAR_JS = "// Mesma regra do v3 (60 dias / fase), agora com RetornarAtendimentos (Integração) + fase do Hub.\n// RetornarAtendimentos não devolve a fase; a fase vem de vw_atendimentos_base (leitura diária das 6h; 1 dia de atraso não muda a regra).\nfunction parseDataBR(s) {\n  if (!s) return null;\n  const [d, h = '00:00'] = String(s).split(' ');\n  const [dia, mes, ano] = d.split('/');\n  const [hora, minuto] = h.split(':');\n  const dt = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto));\n  return isNaN(dt) ? null : dt;\n}\nconst alvo = Number($('Buscar lead no sistema').first().json.dados.codigoatendimento);\nconst lista = $('Retornar Atendimento').all().flatMap((i) => (i.json.resultado === 'ok' && i.json.dados && Array.isArray(i.json.dados.lista)) ? i.json.dados.lista : []);\nconst at = lista.find((a) => Number(a.codigo) === alvo);\nconst fh = $input.first().json || {};\nconst fase = Number(fh.fase) || null;\n\nlet acao, motivo;\nif (!at) {\n  acao = 'incluir_lead';\n  motivo = 'Atendimento ' + alvo + ' não veio no RetornarAtendimentos do cliente (' + lista.length + ' na lista): inclui como lead';\n} else {\n  const ultima = parseDataBR(at.datahoraultimainteracao);\n  const tempoExcedido = !ultima || ultima < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);\n  const faseConta = fase || 1; // sem fase no Hub (atendimento de hoje) = trata como início do funil\n  if (tempoExcedido && faseConta <= 3) { acao = 'incluir_lead'; motivo = 'Lead frio - 60+ dias sem interação, fase ' + faseConta; }\n  else if (!tempoExcedido) { acao = 'criar_atividade'; motivo = 'Lead quente - interação recente → atividade para ' + (at.corretor || '?'); }\n  else { acao = 'criar_atividade'; motivo = 'Lead avançado - fase ' + faseConta + ' → atividade para ' + (at.corretor || '?'); }\n  if (acao === 'criar_atividade' && !Number(at.corretorcodigo)) { acao = 'incluir_lead'; motivo += ' (sem corretor no atendimento: inclui como lead)'; }\n}\nreturn [{ json: { acao, motivo, codigoatendimento: alvo, fase, codigoCorretor: at ? Number(at.corretorcodigo) || 0 : 0, nomeCorretor: at?.corretor || '', lead: at?.lead || {}, datahoraultimainteracao: at?.datahoraultimainteracao || null }, pairedItem: { item: 0 } }];";

const analisar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Analisar atendimento', parameters: { mode: 'runOnceForAllItems', jsCode: ANALISAR_JS }, position: [2200, -200] }, output: [{ acao: 'criar_atividade', motivo: '', codigoatendimento: 1, codigoCorretor: 1, lead: { codigo: 1, nome: 'x', telefone1: 'x' } }] });

const quente = ifElse({ version: 2.2, config: { name: 'Está atualizado 60D?', parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), rightValue: 'criar_atividade', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }, position: [2420, -200] } });

const criarAtividade = imoview('Criar atividade', [2640, -300], 'POST', 'Agenda/IncluirAtividade', expr('{{ {} }}'), expr(`{{ { codigousuario: $json.codigoCorretor, CodigoTipo: 1, datahorainicio: $now.toFormat('dd/MM/yyyy HH:mm'), datahorafim: $now.plus({ minutes: 30 }).toFormat('dd/MM/yyyy HH:mm'), titulo: $json.lead.nome || ${X}.item.json.nome, texto: (${X}.item.json.mensagem_testada || '') + '\\n\\nTelefone: ' + ($json.lead.telefone1 || ${X}.item.json.telefone), codigoatendimento: $json.codigoatendimento, codigopessoa: $json.lead.codigo || undefined } }}`), 'wpp_entrada: atividade no atendimento existente');

// JSON Body da 29b (docs/n8n/wpp_entrada__v3_campanha_cod.md), agora como objeto (o sub-fluxo faz o JSON.stringify).
const incluirLead = imoview('Incluir lead', [2640, 0], 'POST', 'Lead/IncluirLead', expr('{{ {} }}'), expr(`{{ {
  nome: ${X}.item.json.nome,
  telefone: ${X}.item.json.telefone,
  anotacoes: (${X}.item.json.mensagem_testada || '') + (${X}.item.json.codigo_imovel ? '\\n\\nImóvel de interesse: ' + ${X}.item.json.codigo_imovel : ''),
  codigoimovel: (${X}.item.json.midia || '').startsWith('campanha_') ? undefined : ${X}.item.json.codigo_imovel,
  finalidade: ${X}.item.json.finalidade,
  midia: $('Alimentar planilha GTM/WPP').item.json.utm_campaign || ${X}.item.json.midia,
  campanha: ${X}.item.json.campanha || undefined
} }}`), 'wpp_entrada: incluir lead');

const buscarCriado = imoview('Buscar atendimento criado', [2860, 0], 'GET', 'Cliente/RetornarDadosCliente', expr(`{{ { emailOuTelefone: ${X}.item.json.telefone } }}`), expr('{{ {} }}'), 'wpp_entrada: atendimento criado');

const atendNovo = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Atendimento (lead novo)', parameters: { mode: 'runOnceForAllItems', jsCode: "const r = $input.first().json;\nconst cod = r.resultado === 'ok' && r.dados ? Number(r.dados.codigoatendimento) || null : null;\n// Lead entrou (IncluirLead deu 200), mas o atendimento pode ainda não existir (fila do Imoview): grava null e avisa.\nreturn [{ json: { imoview_atendimento: cod, aviso: cod ? '' : 'IncluirLead ok, mas RetornarDadosCliente ainda sem atendimento' }, pairedItem: { item: 0 } }];" }, position: [3080, 0] }, output: [{ imoview_atendimento: 1 }] });

const atendAtividade = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Atendimento (atividade)', parameters: { mode: 'runOnceForAllItems', jsCode: "return [{ json: { imoview_atendimento: Number($('Analisar atendimento').first().json.codigoatendimento) || null, aviso: '' }, pairedItem: { item: 0 } }];" }, position: [3080, -300] }, output: [{ imoview_atendimento: 1 }] });

const gravar = node({ type: 'n8n-nodes-base.supabase', version: 1, config: { name: 'Gravar atendimento Imoview', parameters: { operation: 'update', tableId: 'leads_wpp_gtm', filters: { conditions: [{ keyName: 'lead_id', condition: 'eq', keyValue: expr("{{ $('Alimentar planilha GTM/WPP').first().json.lead_id }}") }] }, fieldsUi: { fieldValues: [ { fieldId: 'imoview_atendimento', fieldValue: expr('{{ $json.imoview_atendimento }}') }, { fieldId: 'imoview_vinculo', fieldValue: 'n8n' } ] } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [3300, -150] }, output: [{ lead_id: 1 }] });

const concluir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Concluir reserva (RPC)', parameters: { method: 'POST', url: RPC + 'wpp_entrada_concluir', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr(`{{ JSON.stringify({ p_telefone: ${X}.first().json.telefone || '' }) }}`), options: { timeout: 15000 } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [3520, -150] }, output: [{ concluido: true }] });

export default workflow('wpp-entrada-v4', 'wpp_entrada v4 (integração)', SETTINGS)
  .add(webhook)
  .to(extrair)
  .to(reservar)
  .to(livre.onTrue(alimentar.to(buscarLead.to(temAtendimento
    .onTrue(montarConsulta.to(retornarAtendimento.to(faseHub.to(analisar.to(quente
      .onTrue(criarAtividade.to(atendAtividade.to(gravar.to(concluir))))
      .onFalse(incluirLead))))))
    .onFalse(incluirLead)))))
  .add(incluirLead)
  .to(buscarCriado.to(atendNovo.to(gravar)));
