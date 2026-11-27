const j = $input.first().json;
const ex = j.execution || {};
const tr = j.trigger || {};
const wf = j.workflow || {};
const err = ex.error || tr.error || {};
const no = (err.node && err.node.name) || ex.lastNodeExecuted || (j.trigger ? 'gatilho do fluxo' : 'não informado');
const msg = String(err.message || err.description || 'sem mensagem').slice(0, 1500);
const quando = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm');
const link = ex.url || '';

// Anti-enxurrada: o mesmo fluxo + nó + mensagem só gera 1 e-mail a cada N minutos (static data só grava em execução de produção).
const memoria = $getWorkflowStaticData('global');
memoria.enviados = memoria.enviados || {};
const chave = [wf.id, no, msg.slice(0, 200)].join('|');
const agora = Date.now();
const janela = Number(j.silencio_minutos || 60) * 60000;
for (const k of Object.keys(memoria.enviados)) { if (agora - memoria.enviados[k].em > 24 * 3600000) delete memoria.enviados[k]; }
const anterior = memoria.enviados[chave];
if (anterior && agora - anterior.em < janela) { anterior.repetidos = (anterior.repetidos || 0) + 1; return []; }
const repetidos = anterior ? (anterior.repetidos || 0) : 0;
memoria.enviados[chave] = { em: agora, repetidos: 0 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const linha = (r, v) => '<tr><td style="padding:6px 12px;color:#555;white-space:nowrap;vertical-align:top"><b>' + r + '</b></td><td style="padding:6px 12px">' + v + '</td></tr>';
const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">'
  + '<p>Um fluxo do n8n deu <b>erro</b>.</p>'
  + '<table style="border-collapse:collapse;border:1px solid #ddd">'
  + linha('Fluxo', esc(wf.name || wf.id || 'não informado'))
  + linha('Nó', esc(no))
  + linha('Mensagem', '<code>' + esc(msg) + '</code>')
  + linha('Quando (Brasília)', quando)
  + linha('Execução', link ? '<a href="' + esc(link) + '">abrir a execução ' + esc(ex.id || '') + '</a>' : 'sem link (o erro foi no gatilho)')
  + (repetidos ? linha('Repetições', repetidos + ' erro(s) igual(is) silenciado(s) na última janela') : '')
  + '</table>'
  + '<p style="color:#777;font-size:12px">Alerta n8n · erro. Erros iguais são silenciados por ' + (j.silencio_minutos || 60) + ' min.</p></div>';

return [{ json: { para: j.alerta_para, assunto: '[Alerta n8n] ' + (wf.name || 'fluxo') + ' · erro em ' + no, html } }];
