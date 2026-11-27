// n8n · Coletor atividades v2 (integração) · nó "Normalizar atividade" (26/11, Brooks)
// Correção: o nó recebia 1 item por DIA ({ data, atividades: [...] }) e esperava 1 item por ATIVIDADE,
// então pulava tudo (a.codigo não existe no item do dia) e saía sem output.
// Agora aceita os dois formatos: se o item tem "atividades", abre a lista; senão trata o item como atividade.
const parseBrDate = (s) => {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const hora = hh ? (hh + ':' + mi + ':' + (ss || '00')) : '00:00:00';
  return yyyy + '-' + mm + '-' + dd + ' ' + hora;
};
const zeroToNull = (v) => (v === 0 || v === '0' || v === '' ? null : v);
const out = [];
const vistos = new Set();
for (const it of $input.all()) {
  const j = it.json || {};
  const lista = Array.isArray(j.atividades) ? j.atividades : [j];
  for (const a of lista) {
    if (!a || !a.codigo) continue;
    if (vistos.has(a.codigo)) continue; // a mesma atividade pode vir em mais de um dia
    vistos.add(a.codigo);
    const dhi = parseBrDate(a.datahorainicio);
    out.push({
      json: {
        codigo: a.codigo,
        titulo: a.titulo ?? null,
        datahorainicio: dhi,
        datahorafim: parseBrDate(a.datahorafim),
        datahoraultimaalteracao: parseBrDate(a.datahoraultimaalteracao),
        diainteiro: a.diainteiro ?? false,
        codigotipo: a.codigotipo ?? null,
        nometipo: (a.nometipo ?? '').trim() || null,
        cortipo: a.cortipo ?? null,
        codigousuario: a.codigousuario ?? null,
        nomeusuario: a.nomeusuario ?? null,
        fotousuario: a.fotousuario ?? null,
        codigopessoa: zeroToNull(a.codigopessoa),
        nomepessoa: a.nomepessoa || null,
        resumopessoa: a.resumopessoa || null,
        codigoimovel: zeroToNull(a.codigoimovel),
        resumoimovel: a.resumoimovel || null,
        codigocontratoaluguel: zeroToNull(a.codigocontratoaluguel),
        resumocontratoaluguel: a.resumocontratoaluguel || null,
        codigoatendimento: zeroToNull(a.codigoatendimento),
        resumoatendimento: a.resumoatendimento || null,
        realizada: a.realizada ?? false,
        podeveratendimento: a.podeveratendimento ?? false,
        data_referencia: dhi ? dhi.slice(0, 10) : null,
        _notas: Array.isArray(a.notas) ? a.notas.map(n => ({
          codigo: n.codigo,
          codigo_atividade: a.codigo,
          datahora: parseBrDate(n.datahora),
          codigousuario: n.codigousuario ?? null,
          nomeusuario: n.nomeusuario ?? null,
          fotousuario: n.fotousuario ?? null,
          texto: n.texto ?? null
        })) : []
      }
    });
  }
}
return out;
