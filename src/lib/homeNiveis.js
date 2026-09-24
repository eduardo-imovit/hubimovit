// Home por nível de acesso (docs/01-prd.md §5.4): atalhos e páginas da busca.
// Os papéis de cada rota vêm de acessos.js; aqui é só o que a Home oferece.

import { ACESSO } from './acessos'

/** Atalhos grandes da Home, na ordem em que aparecem para cada nível. */
export const ATALHOS = {
  gestao: [
    { to: '/dashboard/gestao', titulo: 'Painel da Gestão', descricao: 'Resultado, funil e pessoas', icone: 'painel' },
    { to: '/dashboard/performance', titulo: 'Performance', descricao: 'Mídia, orçamento e campanhas', icone: 'grafico' },
    { to: '/kanban', titulo: 'Kanban', descricao: 'Atendimentos por fase', icone: 'kanban' },
    { to: '/admin/esteiras', titulo: 'Esteira de locação', descricao: 'Propostas e documentos', icone: 'documento' },
    { to: '/configuracoes?aba=usuarios', titulo: 'Usuários', descricao: 'Níveis e pedidos de acesso', icone: 'pessoas' },
  ],
  adm: [
    { to: '/admin/propostas', titulo: 'Propostas', descricao: 'Criar e acompanhar', icone: 'mais' },
    { to: '/admin/esteiras', titulo: 'Esteira', descricao: 'Decidir documentos', icone: 'documento' },
    { to: '/admin/processos', titulo: 'Processos', descricao: 'Concluídos e finalizar', icone: 'pasta' },
    { to: '/kanban', titulo: 'Kanban', descricao: 'Atendimentos por fase', icone: 'kanban' },
  ],
  marketing: [
    { to: '/dashboard/performance', titulo: 'Performance', descricao: 'Mídia, orçamento e campanhas', icone: 'grafico' },
    { to: '/dashboard/gestao', titulo: 'Painel da Gestão', descricao: 'Resultado e funil', icone: 'painel' },
    { to: '/configuracoes?aba=avisos', titulo: 'Conteúdo da Home', descricao: 'Avisos, links e banners', icone: 'megafone' },
    { to: '/configuracoes?aba=plantao', titulo: 'Plantão', descricao: 'Importar a escala do mês', icone: 'calendario' },
  ],
  corretor: [
    { to: '/admin/propostas', titulo: 'Nova proposta', descricao: 'Locação: enviar o link ao locatário', icone: 'mais' },
    { to: '/admin/esteiras', titulo: 'Minhas propostas', descricao: 'Onde cada uma está', icone: 'documento' },
    { to: '/agenda', titulo: 'Agenda', descricao: 'Plantão, reuniões e datas', icone: 'calendario' },
    { to: '#links', titulo: 'Manuais e links', descricao: 'Processos, formulários e Drive', icone: 'link' },
  ],
  user: [
    { to: '/perfil', titulo: 'Pedir meu acesso', descricao: 'Escolha seu nível; a Gestão aprova', icone: 'pessoas' },
    { to: '/agenda', titulo: 'Agenda', descricao: 'Plantão, reuniões e datas', icone: 'calendario' },
    { to: '#links', titulo: 'Manuais e links', descricao: 'Processos, formulários e Drive', icone: 'link' },
  ],
}

/** Páginas que a busca da Home encontra, filtradas pelo nível. */
const PAGINAS = [
  { titulo: 'Painel da Gestão', to: '/dashboard/gestao', acesso: 'dash', termos: 'dashboard resultado funil leads negocios conversao corretores pessoas' },
  { titulo: 'Painel de Performance', to: '/dashboard/performance', acesso: 'dash', termos: 'midia meta google anuncios campanhas orcamento cpl investimento' },
  { titulo: 'Kanban', to: '/kanban', acesso: 'kanban', termos: 'atendimentos fases crm leads quadro' },
  { titulo: 'Dados de Atendimento', to: '/kanban/dados', acesso: 'kanban', termos: 'analise atendimentos origem bairros corretor' },
  { titulo: 'Relatório de Atividades', to: '/kanban/atividades', acesso: 'kanban', termos: 'atividades ligacoes visitas relatorio' },
  { titulo: 'Propostas de locação', to: '/admin/propostas', acesso: 'esteira', termos: 'proposta locacao aluguel nova locatario' },
  { titulo: 'Esteira de locação', to: '/admin/esteiras', acesso: 'esteira', termos: 'esteira documentos aprovar reprovar ajustes' },
  { titulo: 'Processos', to: '/admin/processos', acesso: 'esteira', termos: 'processos concluidos finalizar zip imoview' },
  { titulo: 'Configurações · Avisos e links', to: '/configuracoes?aba=avisos', acesso: 'configuracoes', termos: 'avisos links manuais conteudo home' },
  { titulo: 'Configurações · Banners', to: '/configuracoes?aba=banners', acesso: 'configuracoes', termos: 'banner carrossel imagem home' },
  { titulo: 'Configurações · Plantão', to: '/configuracoes?aba=plantao', acesso: 'configuracoes', termos: 'plantao escala pdf importar' },
  { titulo: 'Configurações · Fotógrafo', to: '/configuracoes?aba=fotografo', acesso: 'configuracoes', termos: 'fotografo agenda fotos' },
  { titulo: 'Configurações · Datas', to: '/configuracoes?aba=datas', acesso: 'configuracoes', termos: 'datas comemorativas feriados' },
  { titulo: 'Usuários e acessos', to: '/configuracoes?aba=usuarios', acesso: 'usuarios', termos: 'usuarios niveis acesso pedidos suspender' },
  { titulo: 'TV Display', to: '/tv-display', acesso: 'tv', termos: 'tv tela escritorio' },
  { titulo: 'Agenda', to: '/agenda', termos: 'agenda calendario reunioes plantao aniversarios' },
  { titulo: 'Meu perfil', to: '/perfil', termos: 'perfil foto telefone nivel senha' },
]

export function paginasDoNivel(papel) {
  return PAGINAS.filter((p) => !p.acesso || ACESSO[p.acesso].includes(papel))
}

export const normalizarBusca = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Busca simples: todas as palavras digitadas precisam aparecer no título ou nos termos. */
export function buscar(consulta, paginas, links) {
  const palavras = normalizarBusca(consulta).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return []
  const casa = (texto) => palavras.every((p) => normalizarBusca(texto).includes(p))
  const resPaginas = paginas.filter((p) => casa(`${p.titulo} ${p.termos}`)).map((p) => ({ tipo: 'pagina', titulo: p.titulo, to: p.to }))
  const resLinks = links
    .filter((l) => casa(`${l.titulo} ${l.categoria ?? ''} ${l.descricao ?? ''}`))
    .map((l) => ({ tipo: 'link', titulo: l.titulo, url: l.url, sub: l.categoria }))
  return [...resPaginas, ...resLinks].slice(0, 8)
}

export const NIVEIS_PREVIA = [
  { valor: 'gestao', label: 'Gestão' },
  { valor: 'adm', label: 'Admin' },
  { valor: 'marketing', label: 'Marketing' },
  { valor: 'corretor', label: 'Corretor' },
  { valor: 'user', label: 'Sem nível' },
]
