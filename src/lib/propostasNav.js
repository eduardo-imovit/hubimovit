// Menu "Propostas": duas áreas separadas (locação e venda), cada uma com as
// próprias páginas. Fonte única para a navbar, a página /propostas e a
// subnavegação dentro de cada área. As URLs antigas continuam as mesmas
// porque os e-mails das Edge Functions apontam para elas.

import { pode } from './acessos'

export const AREAS_PROPOSTAS = [
  {
    chave: 'locacao',
    label: 'Locação',
    acesso: 'esteira',
    descricao: 'Proposta, esteira de documentos e processos de aluguel.',
    paginas: [
      { to: '/admin/propostas', label: 'Propostas' },
      { to: '/admin/esteiras', label: 'Esteira' },
      { to: '/admin/processos', label: 'Processos' },
      { to: '/admin/cadastros', label: 'Cadastros' },
      { to: '/admin/distratos', label: 'Distratos', acesso: 'distratos' },
      { to: '/admin/processo-locacao', label: 'Guia do processo', acesso: 'processoLocacao' }, // RF33; "Guia" para não confundir com "Processos" (linha do tempo das propostas)
    ],
  },
  {
    chave: 'venda',
    label: 'Venda',
    acesso: 'vendas',
    descricao: 'Propostas de compra assinadas pelo proponente, com PDF.',
    paginas: [
      { to: '/admin/vendas', label: 'Propostas' },
      { to: '/admin/vendas/processos', label: 'Processos' },
    ],
  },
]

export const areaPropostas = (chave) => AREAS_PROPOSTAS.find((a) => a.chave === chave)

/**
 * Páginas da área que o perfil pode ver. Uma página com `acesso` próprio usa só o dela
 * (pode ser mais restrito, como Distratos, ou mais amplo, como Processo, que o corretor lê);
 * as outras herdam o `acesso` da área.
 */
export const paginasVisiveis = (area, perfil) => area.paginas.filter((p) => pode(perfil, p.acesso ?? area.acesso))

/** A área aparece no menu se o perfil puder ver ao menos uma página dela (RF33.4). */
export const areaVisivel = (area, perfil) => paginasVisiveis(area, perfil).length > 0
