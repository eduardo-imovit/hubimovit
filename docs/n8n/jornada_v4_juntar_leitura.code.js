// n8n · crm_jornada_diaria v4 (integração) · nó "Juntar leitura" (Code, Run Once for All Items)
// v2 (26/11): trava de volume. A RPC registrar_atendimentos_crm SEMPRE cria a linha do dia em
// crm_leituras (lidos = o que chegou) e não apaga ausentes. Leitura incompleta = foto de hoje
// errada no painel. Histórico (nov/26): dia útil 889–1.002, domingo (semanal) ~5.400.
// Abaixo do piso o fluxo PARA com erro e nada é gravado. Se a carteira encolher de verdade,
// baixar o piso aqui.
const PISO = { diaria: 600, semanal: 4000 };
const porCodigo = new Map();
let vazias = 0;
for (const item of $input.all()) {
  if (item.json.vazio) { vazias += 1; continue; }
  porCodigo.set(item.json.codigo, item.json);
}
const itens = [...porCodigo.values()];
const modo = $('Montar consultas (diária ou semanal)').first().json.modo;
if (itens.length === 0) throw new Error('Nenhum atendimento lido do Imoview (' + vazias + ' consultas vazias). Nada foi gravado.');
const piso = PISO[modo] ?? PISO.diaria;
if (itens.length < piso) throw new Error('Leitura ' + modo + ' com só ' + itens.length + ' atendimentos (piso ' + piso + '; ' + vazias + ' consultas vazias). Parece incompleta: nada foi gravado. Conferir as páginas no Classificar.');
return [{ json: { itens, total: itens.length, consultas_vazias: vazias, modo, lido_em: new Date().toISOString() } }];
