export const FASES_FUNIL = [
  { fase: 1, label: 'Pré-atendimento' },
  { fase: 2, label: 'Seleção de perfil' },
  { fase: 3, label: 'Seleção de imóveis' },
  { fase: 7, label: 'Lead qualificado' },
  { fase: 4, label: 'Visita' },
  { fase: 5, label: 'Proposta' },
  { fase: 6, label: 'Negócio realizado' },
]

export const SITUACOES = ['Em atendimento', 'Negócio realizado', 'Descartado']

export const SITUACAO_BADGE_CLASSE = {
  'Em atendimento': 'badge-info',
  'Negócio realizado': 'badge-success',
  Descartado: 'badge-gray',
}

export const SITUACAO_COR = {
  'Em atendimento': 'var(--info)',
  'Negócio realizado': 'var(--success)',
  Descartado: 'var(--grafite-fade)',
}

export const FILTROS_VAZIOS = { situacao: '', finalidade: '', funil: '', corretor: '', midia: '', dataInicio: '', dataFim: '' }

/** Aplica os filtros do Kanban/Dados de atendimento (situação, finalidade, funil, corretor, mídia, período de entrada). */
export function filtrarAtendimentos(atendimentos, filtros) {
  return atendimentos.filter((a) => {
    if (filtros.situacao && a.situacao !== filtros.situacao) return false
    if (filtros.finalidade && a.finalidade !== filtros.finalidade) return false
    if (filtros.funil && a.funil !== filtros.funil) return false
    if (filtros.corretor && a.corretor !== filtros.corretor) return false
    if (filtros.midia && a.midia !== filtros.midia) return false
    if (filtros.dataInicio && (!a.data_de_entrada || a.data_de_entrada < filtros.dataInicio)) return false
    if (filtros.dataFim && (!a.data_de_entrada || a.data_de_entrada > `${filtros.dataFim}T23:59:59`)) return false
    return true
  })
}
