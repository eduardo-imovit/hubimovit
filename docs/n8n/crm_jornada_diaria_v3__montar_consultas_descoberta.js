// n8n · crm_jornada_diaria v3 · nó "Montar consultas" (Code)
// VERSÃO DE DESCOBERTA (28/10) — TEMPORÁRIA.
// A fase "Agendamento" existe no Imoview, mas não estava na lista (ponto cego achado com o 5735).
// Não sabemos o código dela, então esta versão pergunta também pelas fases 8, 9 e 10.
// Depois de achar o código, trocar pela versão definitiva (só as fases que existem).

// Situação 1 = Em atendimento (conferido no nó 'Marcar fase'); 2 e 3 = encerrados.
// Dia a dia: em atendimento completo + encerrados com dataInicial = 60 dias atrás.
// Domingo: leitura completa (conferência semanal), sem filtro de data.
const EM_ATENDIMENTO = 1;
const FASES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 8–10: descoberta do Agendamento (28/10)
const semanal = $now.setZone('America/Sao_Paulo').weekday === 7;
const dataInicial = $now.setZone('America/Sao_Paulo').minus({ days: 60 }).toFormat('yyyy-MM-dd');
const consultas = [];
for (const finalidade of [1, 2]) {
  for (const fase of FASES) {
    for (const situacao of [1, 2, 3]) {
      const query = { numeroRegistros: 20, finalidade, fase, situacao };
      if (!semanal && situacao === 2) query.dataInicial = dataInicial;
      consultas.push({ json: { finalidade, fase, situacao, modo: semanal ? 'semanal' : 'diaria', query } });
    }
  }
}
return consultas;
