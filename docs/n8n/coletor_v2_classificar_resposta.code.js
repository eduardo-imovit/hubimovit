// Regra de erro do Imoview (doc imoview-auth-arquitetura §4.4), versão SÓ CHAVE (sem sessão).
// 200 → guarda a página; acabou? (lista vazia, página incompleta ou total atingido) → fim
// 404 → consulta vazia / fim das páginas → fim
// 429 → espera segundosparaliberar (ou Retry-After), teto 120 s, até 3× seguidas
// 5xx → 2 novas tentativas (5 s, 20 s)
// 401/403/400/resto → ERRO com a mensagem do Imoview (o fluxo para; nada é gravado pela metade)
// v2b (26/11): as páginas viajam NO PRÓPRIO ITEM (_acum), em vez de serem remontadas
// das execuções anteriores do HTTP por índice de run (vinha vazio → "Separar" sem saída).
const r = $input.first().json;
const ctx = $('Contexto da página').last().json;
const pg = ctx._pg;
const acum = Array.isArray(ctx._acum) ? ctx._acum : [];
const status = Number(r.statusCode) || 0;
let corpo = r.body;
if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { /* texto: fica string */ } }
const b = (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) ? corpo : {};
const msg = b.mensagem || b.Message || (typeof corpo === 'string' ? corpo.slice(0, 300) : '') || '';
const onde = 'RetornarAtividades (dia ' + ctx.dia + ', página ' + pg.pagina + ')';
const listaDe = (x) => Array.isArray(x) ? x : Array.isArray(x.atividades) ? x.atividades : Array.isArray(x.lista) ? x.lista : [];

const fim = (pagina) => {
  const { _pg, _acum, acao, espera, ...orig } = ctx;
  return [{ json: { ...orig, acao: 'fim', paginas: pg.pagina, atividades: [...acum, ...pagina] } }];
};
const seguir = (acao, espera, pgNovo, novoAcum) => [{ json: { ...ctx, acao, espera, _acum: novoAcum ?? acum, _pg: { ...pg, ...pgNovo } } }];

if (status >= 200 && status < 300) {
  const lista = listaDe(Array.isArray(corpo) ? corpo : b);
  const porPagina = 20;
  const total = Number(b.quantidade);
  const acabou = lista.length === 0 || lista.length < porPagina || (Number.isFinite(total) && total > 0 && pg.pagina * porPagina >= total);
  if (acabou) return fim(lista);
  if (pg.pagina >= 100) throw new Error('Imoview ' + onde + ': passou de 100 páginas sem terminar. Nada foi gravado; conferir o filtro.');
  return seguir('proxima', 0, { pagina: pg.pagina + 1, n429: 0, n5xx: 0 }, [...acum, ...lista]);
}
if (status === 404) return fim([]);
if (status === 429 && pg.n429 < 3) {
  const h = r.headers || {};
  const seg = Number(b.segundosparaliberar) || Number(h['retry-after']) || 10;
  if (seg > 120) throw new Error('Imoview ' + onde + ': HTTP 429, limite ' + (b.janela || '') + ' só libera em ' + seg + ' s. ' + msg);
  return seguir('esperar', Math.max(1, Math.ceil(seg)), { n429: pg.n429 + 1 });
}
if (status >= 500 && pg.n5xx < 2) {
  return seguir('esperar', pg.n5xx === 0 ? 5 : 20, { n5xx: pg.n5xx + 1 });
}
let tipo = '';
if (status === 401) tipo = b.chavesemassunto ? ' (a chave não tem o assunto deste endpoint)' : b.atualizarapp ? ' (recusado como aplicativo)' : b.sessaoinvalida ? ' (pediu sessão: endpoint não é só de chave?)' : ' (chave recusada)';
throw new Error('Imoview ' + onde + ': HTTP ' + (status || 'sem resposta') + tipo + '. ' + (msg || 'sem mensagem'));
