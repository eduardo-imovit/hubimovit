// n8n · crm_jornada_diaria v4 (integração) · nó "Classificar resposta" (Code, Run Once for All Items)
// Regra de erro do Imoview (doc imoview-auth-arquitetura §4.4), versão SÓ CHAVE (sem sessão).
// 200 → guarda a página; acabou? (lista vazia, página incompleta ou total atingido) → fim
// 404 → consulta vazia / fim das páginas → fim
// 429 → espera segundosparaliberar (ou Retry-After), teto 120 s, até 3× seguidas
// 5xx → 2 novas tentativas (5 s, 20 s)
// 401/403/400/resto → ERRO com a mensagem do Imoview (o fluxo para; nada é gravado pela metade)
// v4b (26/11): as páginas viajam NO PRÓPRIO ITEM (_acum), como no coletor v2b. Antes eram
// remontadas das execuções anteriores do HTTP por índice de run ($('…').all(0, run)), e essa
// releitura voltava vazia → toda consulta terminava com lista [].
// Para o item não pesar (domingo lê ~5.400, a maior consulta ~1.200), cada atendimento já
// entra no _acum ENXUTO (mesma regra que o "Marcar fase" usava; o Marcar agora não enxuga de novo).
const r = $input.first().json;
const ctx = $('Contexto da página').last().json;
const pg = ctx._pg;
const acum = Array.isArray(ctx._acum) ? ctx._acum : [];
const status = Number(r.statusCode) || 0;
let corpo = r.body;
if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { /* texto: fica string */ } }
const b = (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) ? corpo : {};
const msg = b.mensagem || b.Message || (typeof corpo === 'string' ? corpo.slice(0, 300) : '') || '';
const onde = 'RetornarAtendimentos (finalidade ' + ctx.finalidade + ', fase ' + ctx.fase + ', situação ' + ctx.situacao + ', página ' + pg.pagina + ')';

// Payload enxuto (regra da v5 do "Marcar fase", 07/10): campos simples (texto até 300),
// imoveisnegocio e imoveisproposta inteiros, interacoes inteiras nos encerrados (situação 2 ou 3);
// o resto das listas e objetos vira só o tamanho em _aninhados.
const GUARDAR_SEMPRE = ['imoveisnegocio', 'imoveisproposta'];
const encerrado = ctx.situacao === 2 || ctx.situacao === 3;
const enxuto = (a) => {
  const simples = {};
  const aninhados = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      simples[k] = typeof v === 'string' && v.length > 300 ? `${v.slice(0, 300)}…` : v;
    } else if (GUARDAR_SEMPRE.includes(k) || (encerrado && k === 'interacoes')) {
      simples[k] = v;
    } else {
      aninhados[k] = Array.isArray(v) ? `lista(${v.length})` : `objeto(${Object.keys(v).length})`;
    }
  }
  return { ...simples, _aninhados: aninhados };
};
const listaDe = (x) => (Array.isArray(x) ? x : Array.isArray(x.lista) ? x.lista : []);
const enxugar = (lista) => lista.filter((a) => a && typeof a === 'object').map(enxuto);

const fim = (pagina) => {
  const { _pg, _acum, acao, espera, ...orig } = ctx;
  return [{ json: { ...orig, acao: 'fim', paginas: pg.pagina, lista: [...acum, ...enxugar(pagina)] } }];
};
const seguir = (acao, espera, pgNovo, novoAcum) => [{ json: { ...ctx, acao, espera, _acum: novoAcum ?? acum, _pg: { ...pg, ...pgNovo } } }];

if (status >= 200 && status < 300) {
  const lista = listaDe(Array.isArray(corpo) ? corpo : b);
  const porPagina = Number(ctx.query?.numeroRegistros) || 20;
  const total = Number(b.quantidade);
  const acabou = lista.length === 0 || lista.length < porPagina || (Number.isFinite(total) && total > 0 && pg.pagina * porPagina >= total);
  if (acabou) return fim(lista);
  if (pg.pagina >= 200) throw new Error('Imoview ' + onde + ': passou de 200 páginas sem terminar. Nada foi gravado; conferir o filtro.');
  return seguir('proxima', 0, { pagina: pg.pagina + 1, n429: 0, n5xx: 0 }, [...acum, ...enxugar(lista)]);
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
