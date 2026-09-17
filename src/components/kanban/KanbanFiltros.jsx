import { dataDiasAtras, FILTROS_VAZIOS, PERIODOS_FILTRO, SITUACOES } from '../../lib/atendimentos'

function opcoesPorFrequencia(valores) {
  const contagem = new Map()
  for (const v of valores) {
    if (!v) continue
    contagem.set(v, (contagem.get(v) ?? 0) + 1)
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([valor]) => valor)
}

export default function KanbanFiltros({ atendimentos, filtros, setFiltros, valoresPadrao = FILTROS_VAZIOS }) {
  const corretores = opcoesPorFrequencia(atendimentos.map((a) => a.corretor))
  const midias = opcoesPorFrequencia(atendimentos.map((a) => a.midia))

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function setPeriodo(dias) {
    if (!dias) {
      setFiltros((f) => ({ ...f, dataInicio: '', dataFim: '' }))
      return
    }
    setFiltros((f) => ({ ...f, dataInicio: dataDiasAtras(Number(dias)), dataFim: '' }))
  }

  const periodoAtual = PERIODOS_FILTRO.find((p) => filtros.dataInicio === dataDiasAtras(p.dias) && !filtros.dataFim)?.dias ?? ''

  const filtrosAlterados = Object.keys(FILTROS_VAZIOS).some(
    (campo) => (filtros[campo] || '') !== (valoresPadrao[campo] || '')
  )

  return (
    <div className="filters-bar">
      <select value={filtros.situacao} onChange={(e) => set('situacao', e.target.value)}>
        <option value="">Situação: todas</option>
        {SITUACOES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select value={filtros.finalidade} onChange={(e) => set('finalidade', e.target.value)}>
        <option value="">Finalidade: todas</option>
        <option value="Venda">Venda</option>
        <option value="Aluguel">Aluguel</option>
      </select>

      <select value={filtros.funil} onChange={(e) => set('funil', e.target.value)}>
        <option value="">Funil: todos</option>
        <option value="Inbound (passivo)">Inbound</option>
        <option value="Outbound (ativo)">Outbound</option>
      </select>

      <select value={filtros.corretor} onChange={(e) => set('corretor', e.target.value)}>
        <option value="">Corretor: todos</option>
        {corretores.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={filtros.midia} onChange={(e) => set('midia', e.target.value)}>
        <option value="">Mídia: todas</option>
        {midias.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select value={periodoAtual} onChange={(e) => setPeriodo(e.target.value)}>
        <option value="">Período: todos</option>
        {PERIODOS_FILTRO.map((p) => (
          <option key={p.dias} value={p.dias}>{p.label}</option>
        ))}
      </select>

      <input type="date" value={filtros.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} title="Entrada a partir de" />
      <input type="date" value={filtros.dataFim} onChange={(e) => set('dataFim', e.target.value)} title="Entrada até" />

      {filtrosAlterados && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setFiltros(valoresPadrao)}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
