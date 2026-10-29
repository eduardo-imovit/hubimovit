// n8n · crm_jornada_diaria v3 · nó "Montar consultas" (Code)
// VERSÃO NO AR ATÉ 28/10 (cópia do Eduardo). Guardada para poder voltar.
// Ponto cego achado em 28/10: a fase "Agendamento" do Imoview não está na lista de fases.

// Situação 1 = Em atendimento (conferido no nó 'Marcar fase'); 2 e 3 = encerrados.
// Dia a dia: em atendimento completo + encerrados com dataInicial = 60 dias atrás.
// Domingo: leitura completa (conferência semanal), sem filtro de data.
const EM_ATENDIMENTO = 1;
const semanal = $now.setZone('America/Sao_Paulo').weekday === 7;
const dataInicial = $now.setZone('America/Sao_Paulo').minus({ days: 60 }).toFormat('yyyy-MM-dd');
const consultas = [];
for (const finalidade of [1, 2]) {
  for (const fase of [1, 2, 3, 4, 5, 6, 7]) {
    for (const situacao of [1, 2, 3]) {
      const query = { numeroRegistros: 20, finalidade, fase, situacao };
      if (!semanal && situacao === 2) query.dataInicial = dataInicial;
      consultas.push({ json: { finalidade, fase, situacao, modo: semanal ? 'semanal' : 'diaria', query } });
    }
  }
}
return consultas;
