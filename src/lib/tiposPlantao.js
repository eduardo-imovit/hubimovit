// Os dois plantões do Hub (docs/01-prd.md §5.3). Cada um aparece sempre com
// três sinais juntos — cor, ícone e rótulo — para não confundir de relance.
// Cores: as mesmas de Venda/Aluguel no resto do Hub (classes .plantao-tag--*).

export const TIPOS_PLANTAO = {
  venda: { rotulo: 'Vendas', icone: '🏠', pdf: 'PLANTAO VENDAS' },
  locacao: { rotulo: 'Locação', icone: '🔑', pdf: 'PLANTAO LOCAÇÃO' },
}

export const ORDEM_TIPOS = ['venda', 'locacao']

/** Tipo de um plantão; registros sem tipo são de vendas (o default do banco). */
export const tipoDe = (p) => (p?.tipo === 'locacao' ? 'locacao' : 'venda')

/** Ordena Vendas antes de Locação, mantendo a ordem original dentro de cada tipo. */
export const ordenarPorTipo = (lista) =>
  [...lista].sort((a, b) => ORDEM_TIPOS.indexOf(tipoDe(a)) - ORDEM_TIPOS.indexOf(tipoDe(b)))
