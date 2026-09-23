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
  marketing: 'Dashboards e metas, e conteúdo da Home: avisos, links, banners, plantão, agenda do fotógrafo e datas.',
  corretor: 'Cria propostas e acompanha as suas em Propostas, Esteira e Processos.',
  user: 'Home e Perfil. Solicite um nível para liberar o resto.',
  tvaccess: 'Conta da TV Display.',
}

/** Níveis que alguém pode pedir na página de Perfil. */
export const PAPEIS_SOLICITAVEIS = ['corretor', 'adm', 'marketing', 'gestao']

/** Níveis que a Gestão pode atribuir em Usuários & Acessos. */
export const PAPEIS_ATRIBUIVEIS = ['gestao', 'adm', 'marketing', 'corretor', 'user', 'tvaccess']

export const ACESSO = {
  esteira: ['gestao', 'adm', 'corretor'], // Propostas / Esteira / Processos (corretor: só as dele)
  esteiraDecidir: ['gestao', 'adm'], // aprovar, descartar, decidir documentos, solicitar ajustes, finalizar
  kanban: ['gestao', 'adm'],
  dash: ['gestao', 'marketing'],
  configuracoes: ['gestao', 'marketing'],
  usuarios: ['gestao'],
  tv: ['gestao', 'adm', 'tvaccess'],
  spotify: ['gestao'],
}

export function pode(perfil, acesso) {
  return !!perfil?.role && ACESSO[acesso].includes(perfil.role)
}
