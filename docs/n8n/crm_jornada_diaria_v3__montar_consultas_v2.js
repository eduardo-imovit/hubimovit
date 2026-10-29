// n8n · crm_jornada_diaria v3 · nó "Montar consultas" (Code) — v2 (28/10)
// Mudança: inclui a fase 8 (Agendamento). Ela existe no Imoview, é pouco usada e estava
// fora da lista, então os leads nela ficavam invisíveis para a jornada (achado com o 5735).
// Códigos segundo a doc da API (GET /Atendimento/RetornarAtendimentos, api.imoview.com.br):
//   finalidade: 1 Aluguel · 2 Venda
//   fase: 1 Pré-atendimento · 2 Seleção perfil · 3 Seleção imóveis · 4 Visita · 5 Proposta
//         6 Negócio · 7 Lead qualificado · 8 Agendamento
//   situacao: 1 Em atendimento · 2 Descartado · 3 Negócio
// Atenção: fase inexistente NÃO dá erro (volta lista vazia). Se o Imoview criar fase nova,
// ela precisa entrar em FASES, senão some em silêncio.

// Dia a dia: em atendimento completo + encerrados com dataInicial = 60 dias atrás.
// Domingo: leitura completa (conferência semanal), sem filtro de data.
const EM_ATENDIMENTO = 1;
const FINALIDADES = [1, 2];
const FASES = [1, 2, 3, 4, 5, 6, 7, 8];
const SITUACOES = [1, 2, 3];
const semanal = $now.setZone('America/Sao_Paulo').weekday === 7;
const dataInicial = $now.setZone('America/Sao_Paulo').minus({ days: 60 }).toFormat('yyyy-MM-dd');
const consultas = [];
for (const finalidade of FINALIDADES) {
  for (const fase of FASES) {
    for (const situacao of SITUACOES) {
      const query = { numeroRegistros: 20, finalidade, fase, situacao };
      if (!semanal && situacao === 2) query.dataInicial = dataInicial;
      consultas.push({ json: { finalidade, fase, situacao, modo: semanal ? 'semanal' : 'diaria', query } });
    }
  }
}
return consultas;
