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
  corretor: 'Cria propostas e acompanha as suas em Propostas, Esteira e Processos. Vê os próprios números no Dash Comercial.',
  user: 'Home e Perfil. Solicite um nível para liberar o resto.',
  tvaccess: 'Conta da TV Display.',
}

/** Níveis que alguém pode pedir na página de Perfil. */
export const PAPEIS_SOLICITAVEIS = ['corretor', 'adm', 'marketing', 'gestao']

/** Níveis que a Gestão pode atribuir em Usuários & Acessos. */
export const PAPEIS_ATRIBUIVEIS = ['gestao', 'adm', 'marketing', 'corretor', 'user', 'tvaccess']

/**
 * Módulo de Propostas (locação, venda, esteira, processos): por enquanto só no
 * ambiente de teste (VITE_MODULO_PROPOSTAS=on, branch `teste` na Vercel). Em
 * produção os níveis abaixo ficam vazios, e somem menu, atalho, busca e rota.
 * O portal do cliente (/portal, /venda) continua acessível pelo link do e-mail.
 */
export const PROPOSTAS_ATIVAS = import.meta.env.VITE_MODULO_PROPOSTAS === 'on'
const soComPropostas = (papeis) => (PROPOSTAS_ATIVAS ? papeis : [])

export const ACESSO = {
  esteira: soComPropostas(['gestao', 'adm', 'corretor']), // Propostas / Esteira / Processos (corretor: só as dele)
  esteiraDecidir: soComPropostas(['gestao', 'adm']), // aprovar, descartar, decidir documentos, solicitar ajustes, finalizar
  vendas: soComPropostas(['gestao', 'adm', 'corretor']), // Propostas de venda (corretor: só as dele)
  vendasDecidir: soComPropostas(['gestao', 'adm']), // descartar proposta de venda
  propostas: soComPropostas(['gestao', 'adm', 'corretor']), // menu Propostas (locação ou venda)
  formularios: ['gestao', 'adm', 'corretor'], // Ferramentas: Captações e Feedback de visita (corretor: os dele)
  kanban: ['gestao', 'adm'],
  dash: ['gestao', 'marketing'], // Painel da Gestão, Performance e Comercial com todos os corretores
  dashComercial: ['gestao', 'marketing', 'corretor'],
  campanha: ['gestao', 'adm', 'marketing', 'corretor', 'tvaccess'], // trilha da campanha na Home (PRD §5.9, C3) // Comercial (corretor: só os dados dele, PRD §5.8)
  configuracoes: ['gestao', 'marketing'],
  usuarios: ['gestao'],
  tv: ['gestao', 'adm', 'marketing', 'tvaccess'],
  spotify: ['gestao'],
}

export function pode(perfil, acesso) {
  return !!perfil?.role && ACESSO[acesso].includes(perfil.role)
}
