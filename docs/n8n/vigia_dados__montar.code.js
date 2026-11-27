// Vigia de dados · 7h30 — nó "Montar e-mail". Recebe 1 item por fonte (saída da RPC vigia_fontes).
// Atrasadas → 1 e-mail. Nenhuma atrasada → nada, a menos que o "tudo ok" semanal esteja ligado e hoje seja o dia dele.
const cfg = $('Configuração').first().json;
const linhas = $input.all().map((i) => i.json).filter((r) => r && r.chave);
if (linhas.length === 0) throw new Error('vigia_fontes não devolveu nenhuma linha (a RPC mudou ou a resposta veio vazia).');

const atrasadas = linhas.filter((r) => r.atrasada === true);
const hoje = DateTime.now().setZone('America/Sao_Paulo');
const diaTudoOk = Number(cfg.tudo_ok_dia_semana || 1);
const mandarTudoOk = cfg.tudo_ok_semanal === true && hoje.weekday === diaTudoOk;
if (atrasadas.length === 0 && !mandarTudoOk) return [];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const td = 'padding:6px 10px;border:1px solid #ddd;vertical-align:top';
const th = td + ';background:#f3f3f3;text-align:left';
const tabela = (lista, comOnde) => '<table style="border-collapse:collapse;font-size:13px">'
  + '<tr><th style="' + th + '">Fonte</th><th style="' + th + '">Situação</th>' + (comOnde ? '<th style="' + th + '">Onde olhar</th>' : '') + '</tr>'
  + lista.map((r) => '<tr><td style="' + td + '"><b>' + esc(r.fonte) + '</b></td><td style="' + td + '">' + esc(r.detalhe) + '</td>'
    + (comOnde ? '<td style="' + td + '">' + esc(r.onde_olhar) + '</td>' : '') + '</tr>').join('')
  + '</table>';

const data = hoje.toFormat('dd/MM/yyyy HH:mm');
let assunto, corpo;
if (atrasadas.length > 0) {
  const nomes = atrasadas.map((r) => r.fonte.split(':')[0].split(' (')[0]).join(', ');
  assunto = '[Vigia] ' + atrasadas.length + (atrasadas.length === 1 ? ' fonte atrasada: ' : ' fontes atrasadas: ') + nomes;
  corpo = '<p>Bom dia. O vigia das 7h30 encontrou <b>' + atrasadas.length + '</b> '
    + (atrasadas.length === 1 ? 'fonte sem o dado esperado' : 'fontes sem o dado esperado') + ':</p>'
    + tabela(atrasadas, true)
    + '<p style="color:#555">Foto do dia que não for lida hoje não volta depois (CRM e carteira). Vale rodar à mão ainda hoje.</p>';
} else {
  assunto = '[Vigia] Tudo ok · ' + hoje.toFormat('dd/MM');
  corpo = '<p>Bom dia. Resumo semanal do vigia: todas as fontes ligadas receberam o dado esperado hoje.</p>' + tabela(linhas, false);
}
const desligadas = linhas.filter((r) => r.ligada === false).map((r) => esc(r.fonte));
const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' + corpo
  + '<p style="color:#777;font-size:12px">Vigia de dados · ' + data + ' (Brasília). '
  + (desligadas.length ? 'Fora do vigia (desligadas): ' + desligadas.join(', ') + '. ' : '')
  + 'Régua de cada fonte: docs/05-backend-schema.md §2.25.</p></div>';

return [{ json: { para: cfg.alerta_para, assunto, html, atrasadas: atrasadas.length } }];
