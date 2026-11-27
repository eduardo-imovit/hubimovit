// n8n · crm_jornada_diaria v4 (integração) · nó "Marcar fase da consulta" (Code, Run Once for All Items)
// v6 (26/11): igual à v5, mas SEM enxugar: o "Classificar resposta" (v4b) já entrega cada
// atendimento enxuto (mesma regra da v5: simples + imoveisnegocio/imoveisproposta inteiros +
// interacoes nos encerrados; o resto vira só o tamanho em _aninhados). O payload gravado é o mesmo.
const consulta = $('Uma consulta por vez').first().json;
if (consulta?.fase == null) throw new Error('Consulta do lote sem fase. Nada foi gravado.');

const paraData = (txt) => {
  if (!txt) return null;
  const m = String(txt).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
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
      payload: a
    } });
  }
}
if (saida.length === 0) saida.push({ json: { vazio: true, consulta } });
return saida;
