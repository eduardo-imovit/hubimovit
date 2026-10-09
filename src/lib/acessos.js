// Níveis de acesso do Hub -- fonte única pra rotas, menu e botões de ação.
// As regras de verdade (o que cada um lê/grava) estão no banco (RLS), ver
// migration 20260923190000_niveis_acesso_perfil.sql; aqui é só o que a tela mostra.

export const PAPEL_LABEL = {
  gestao: 'Gestão',
  adm: 'Admin',
  marketing: 'Marketing',
  corretor: 'Corretor',
  user: 'Sem nível',
  tvaccess: 'Acesso TV',
}

export const PAPEL_DESCRICAO = {
  gestao: 'Acesso geral, inclusive usuários e níveis de acesso.',
  adm: 'Propostas, esteira e processos de todos os corretores, e Kanban.',
  marketing: 'Dashboards e metas, TV Display, e conteúdo da Home: avisos, links, banners, plantão, agenda do fotógrafo e datas.',
  corretor: 'Vê os próprios números, atendimentos e atividades no Dash, a Performance da mídia e as Ferramentas.',
  user: 'Home e Perfil. Solicite um nível para liberar o resto.',
  tvaccess: 'Conta da TV Display.',
}

/** Níveis que alguém pode pedir na página de Perfil. */
export const PAPEIS_SOLICITAVEIS = ['corretor', 'adm', 'marketing', 'gestao']

/** Níveis que a Gestão pode atribuir em Usuários & Acessos. */
export const PAPEIS_ATRIBUIVEIS = ['gestao', 'adm', 'marketing', 'corretor', 'user', 'tvaccess']

/**
 * Módulo de Propostas (locação, venda, esteira, processos, cadastros de
 * locador): em produção desde 09/10 (RF28), só gestão e adm. O corretor
 * volta depois (decisão do Eduardo). O portal do cliente (/portal, /venda)
 * continua acessível pelo link do e-mail.
 */
export const PROPOSTAS_ATIVAS = true
const soComPropostas = (papeis) => papeis

export const ACESSO = {
  esteira: soComPropostas(['gestao', 'adm']), // Propostas / Esteira / Processos / Cadastros locador
  esteiraDecidir: soComPropostas(['gestao', 'adm']), // aprovar, descartar, decidir documentos, solicitar ajustes, finalizar
  vendas: soComPropostas(['gestao', 'adm']), // Propostas de venda
  vendasDecidir: soComPropostas(['gestao', 'adm']), // descartar proposta de venda
  propostas: soComPropostas(['gestao', 'adm']), // menu Propostas (locação ou venda)
  formularios: ['gestao', 'adm', 'corretor'], // Ferramentas: Captações e Feedback de visita (corretor: os dele)
  kanban: ['gestao', 'adm', 'corretor'], // corretor: só os atendimentos e atividades dele (RLS)
  dash: ['gestao', 'marketing'], // Painel da Gestão (pessoas da equipe) e Comercial com todos os corretores
  dashPerformance: ['gestao', 'marketing', 'corretor'], // mídia e leads pagos da imobiliária inteira (decisão de 06/10)
  dashComercial: ['gestao', 'marketing', 'corretor'],
  dashAdmLocacao: ['gestao'], // carteira de contratos de locação (PRD §5.13); só a Gestão por enquanto (07/10); RLS: is_gestao()
  campanha: ['gestao', 'adm', 'marketing', 'corretor', 'tvaccess'], // trilha da campanha na Home (PRD §5.9, C3) // Comercial (corretor: só os dados dele, PRD §5.8)
  configuracoes: ['gestao', 'marketing'],
  usuarios: ['gestao'],
  tv: ['gestao', 'adm', 'marketing', 'tvaccess'],
  spotify: ['gestao'],
}

export function pode(perfil, acesso) {
  return !!perfil?.role && ACESSO[acesso].includes(perfil.role)
}
