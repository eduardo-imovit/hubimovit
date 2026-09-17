export const FILTROS_MIDIA_VAZIOS = { canal: '', dataInicio: '', dataFim: '' }

export function dentroPeriodo(linha, filtros) {
  return (!filtros.dataInicio || linha.data >= filtros.dataInicio) && (!filtros.dataFim || linha.data <= filtros.dataFim)
}

export default function MidiaFiltros({ filtros, setFiltros }) {
  return (
    <div className="filters-bar">
      <select value={filtros.canal} onChange={(e) => setFiltros((f) => ({ ...f, canal: e.target.value }))}>
        <option value="">Canal: todos</option>
        <option value="Meta">Meta Ads</option>
        <option value="Google">Google Ads</option>
      </select>
      <input
        type="date"
        value={filtros.dataInicio}
        onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
        title="Período a partir de"
      />
      <input
        type="date"
        value={filtros.dataFim}
        onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
        title="Período até"
      />
      {(filtros.canal || filtros.dataInicio || filtros.dataFim) && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiltros(FILTROS_MIDIA_VAZIOS)}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}
