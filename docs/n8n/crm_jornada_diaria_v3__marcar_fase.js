// n8n · crm_jornada_diaria v3 · nó "Marcar fase da consulta" (Code, Run Once for All Items)
// v5 (07/10): payload enxuto, mas guarda por inteiro as listas que interessam:
// - imoveisnegocio e imoveisproposta (imóvel e valor do negócio/proposta; 0–1 item cada);
// - interacoes nos encerrados (situação 2 = descartado, 3 = negócio): data do
//   fechamento e MOTIVO DO DESCARTE para a análise de perdas da jornada.
// O resto das listas e objetos internos vira só o tamanho.
const consulta = $('Uma consulta por vez').first().json;
if (consulta?.fase == null) throw new Error('Consulta do lote sem fase. Nada foi gravado.');

const paraData = (txt) => {
  if (!txt) return null;
  const m = String(txt).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const GUARDAR_SEMPRE = ['imoveisnegocio', 'imoveisproposta'];

const enxuto = (a, encerrado) => {
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

const saida = [];
for (const pagina of $input.all()) {
  for (const a of pagina.json.lista ?? []) {
    if (!a || a.codigo == null) continue;
    if (consulta.situacao === 1 && a.situacao && a.situacao !== 'Em atendimento') {
      throw new Error(`Situação 1 do Imoview não é 'Em atendimento' (veio '${a.situacao}'). Ajustar EM_ATENDIMENTO em 'Montar consultas'. Nada foi gravado.`);
    }
    saida.push({ json: {
      codigo: Number(a.codigo),
      fase_crm: consulta.fase,
      situacao_codigo: consulta.situacao,
      finalidade_codigo: consulta.finalidade,
      situacao: a.situacao ?? null,
      finalidade: a.finalidade ?? null,
      corretor: a.corretor ?? null,
      data_entrada: paraData(a.datahoraentradalead),
      funil: a.funil ?? null,
      midia: a.midia ?? null,
      campanha: a.campanha || null,
      payload: enxuto(a, consulta.situacao === 2 || consulta.situacao === 3)
    } });
  }
}
if (saida.length === 0) saida.push({ json: { vazio: true, consulta } });
return saida;
