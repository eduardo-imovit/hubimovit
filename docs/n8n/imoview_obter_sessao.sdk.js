import { workflow, node, trigger, newCredential, expr, ifElse, switchCase } from '@n8n/workflow-sdk';
// Sub-fluxo "Imoview: obter sessão" (26/11, Asimov). Único ponto de login do Imoview (Integracao_ValidarAcesso).
// Entrada: forcar (bool), codigoacesso_recusado (texto, o código que levou 401), contexto (objeto devolvido intacto).
// Saída: { codigousuario, codigoacesso, contexto }. Sessão e trava na tabela imoview_sessao (migration 20261126122845).
const SETTINGS = { settings: { executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' } };
const RPC = 'https://vlsrmtryzwddqkwqugfr.supabase.co/rest/v1/rpc/';

const entrada = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1, config: { name: 'Quando chamado', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [ { name: 'forcar', type: 'boolean' }, { name: 'codigoacesso_recusado', type: 'string' }, { name: 'contexto', type: 'any' } ] } }, position: [0, 0] }, output: [{ forcar: false, codigoacesso_recusado: '', contexto: {} }] });

const ler = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Ler sessão (RPC)', parameters: { method: 'POST', url: RPC + 'imoview_sessao_obter', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_perfil: "integracao", p_forcar: $("Quando chamado").first().json.forcar === true, p_recusado: $("Quando chamado").first().json.codigoacesso_recusado || null, p_ocioso_seg: 480 }) }}'), options: { timeout: 15000 } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [220, 0] }, output: [{ acao: 'login', dono: 'uuid' }] });

const decidir = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Decidir', parameters: { mode: 'runOnceForAllItems', jsCode: "// usar = devolve a sessão guardada · esperar = outro está fazendo login · login = pegamos a trava\nconst r = $input.first().json;\nif (!['usar', 'esperar', 'login'].includes(r.acao)) throw new Error('imoview_sessao_obter respondeu algo inesperado (acao=' + r.acao + ')');\nif (r.acao === 'esperar' && $runIndex >= 10) throw new Error('Imoview: outro login não terminou em ~20 s (trava presa?). Ver tabela imoview_sessao.');\nreturn [{ json: r }];" }, position: [440, 0] }, output: [{ acao: 'login', dono: 'uuid' }] });

const rota = switchCase({ version: 3.2, config: { name: 'Usar, esperar ou logar?', parameters: { mode: 'rules', rules: { values: [
  { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), rightValue: 'usar', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'usar' },
  { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), rightValue: 'esperar', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'esperar' },
  { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.acao }}'), rightValue: 'login', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'login' }
] } }, position: [660, 0] } });

const esperar = node({ type: 'n8n-nodes-base.wait', version: 1.1, config: { name: 'Esperar 2 s', parameters: { resume: 'timeInterval', amount: 2, unit: 'seconds' }, position: [880, 120] }, output: [{}] });

// Custom Auth "Imoview · login": {"headers":{"chave":"<chave>"},"body":{"email":"<e-mail do usuário 111>","senha":"<senha>"}}
const login = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Login de integração', parameters: { method: 'POST', url: 'https://api.imoview.com.br/Usuario/Integracao_ValidarAcesso', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: false, options: { timeout: 15000, response: { response: { fullResponse: true, neverError: true } } } }, credentials: { httpCustomAuth: newCredential('Imoview · login') }, position: [880, 300] }, output: [{ statusCode: 200, body: { codigousuario: 111, codigoacesso: 'x', minutossemuso: 10 } }] });

const loginOk = ifElse({ version: 2.2, config: { name: 'Login deu certo?', parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [ { leftValue: expr('{{ $json.statusCode }}'), rightValue: 200, operator: { type: 'number', operation: 'equals' } }, { leftValue: expr('{{ $json.body && $json.body.codigoacesso ? "sim" : "" }}'), rightValue: 'sim', operator: { type: 'string', operation: 'equals' } } ], combinator: 'and' } }, position: [1100, 300] } });

const gravar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gravar sessão (RPC)', parameters: { method: 'POST', url: RPC + 'imoview_sessao_gravar', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_perfil: "integracao", p_dono: $("Decidir").last().json.dono, p_codigousuario: $json.body.codigousuario, p_codigoacesso: $json.body.codigoacesso }) }}'), options: { timeout: 15000 } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [1320, 220] }, output: [{ gravado: true }] });

const sessaoNova = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sessão nova', parameters: { mode: 'runOnceForAllItems', jsCode: "if ($input.first().json.gravado !== true) throw new Error('Imoview: login feito, mas a trava expirou antes de gravar (login > 30 s?). O próximo chamador refaz o login.');\nconst b = $('Login de integração').last().json.body;\nreturn [{ json: { acao: 'login', codigousuario: b.codigousuario, codigoacesso: b.codigoacesso } }];" }, position: [1540, 220] }, output: [{ codigousuario: 111, codigoacesso: 'x' }] });

const liberar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Liberar trava (RPC)', parameters: { method: 'POST', url: RPC + 'imoview_sessao_liberar', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_perfil: "integracao", p_dono: $("Decidir").last().json.dono }) }}'), options: { timeout: 15000 } }, credentials: { supabaseApi: newCredential('Supabase Hub') }, position: [1320, 400] }, output: [{ liberado: true }] });

const falhou = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Login falhou', parameters: { mode: 'runOnceForAllItems', jsCode: "const r = $('Login de integração').last().json;\nconst b = r.body || {};\nconst msg = b.mensagem || b.Message || (typeof b === 'string' ? b.slice(0, 200) : '') || r.error?.message || 'sem mensagem';\nconst dica = b.senhafraca ? ' (senha fraca: o Imoview mandou e-mail para trocar)' : b.chavesemassunto ? ' (chave sem o assunto)' : '';\nthrow new Error('Imoview: login de integração recusado. HTTP ' + (r.statusCode ?? '?') + ': ' + msg + dica + '. Conferir a credencial \"Imoview · login\".');" }, position: [1540, 400] }, output: [{}] });

const devolver = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Devolver sessão', parameters: { mode: 'runOnceForAllItems', jsCode: "// Saída do sub-fluxo. Não logar nem copiar o codigoacesso para outro lugar.\nconst s = $input.first().json;\nreturn [{ json: { codigousuario: s.codigousuario, codigoacesso: s.codigoacesso, sessao: s.acao === 'login' ? 'nova' : 'reaproveitada', contexto: $('Quando chamado').first().json.contexto ?? null } }];" }, position: [1760, 0] }, output: [{ codigousuario: 111, codigoacesso: 'x', sessao: 'reaproveitada', contexto: {} }] });

export default workflow('imoview-obter-sessao', 'Imoview: obter sessão', SETTINGS)
  .add(entrada)
  .to(ler)
  .to(decidir)
  .to(rota
    .onCase(0, devolver)
    .onCase(1, esperar.to(ler))
    .onCase(2, login.to(loginOk
      .onTrue(gravar.to(sessaoNova.to(devolver)))
      .onFalse(liberar.to(falhou)))));
