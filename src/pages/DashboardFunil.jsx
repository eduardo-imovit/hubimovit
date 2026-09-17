import { useMemo, useState } from 'react'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { FILTROS_VAZIOS, filtrarAtendimentos } from '../lib/atendimentos'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import FunilChart from '../components/dashboard/FunilChart'

const FILTROS_VAZIOS_FUNIL = { midia: '', dataInicio: '', dataFim: '' }

function opcoesPorFrequencia(valores) {
  const contagem = new Map()
  for (const v of valores) {
    if (!v) continue
    contagem.set(v, (contagem.get(v) ?? 0) + 1)
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([valor]) => valor)
}

export default function DashboardFunil() {
  const { atendimentos, carregando, erro } = useAtendimentos()
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS_FUNIL)

  const midias = useMemo(() => opcoesPorFrequencia(atendimentos.map((a) => a.midia)), [atendimentos])

  const atendimentosFiltrados = useMemo(
    () => filtrarAtendimentos(atendimentos, { ...FILTROS_VAZIOS, ...filtros }),
    [atendimentos, filtros]
  )

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o funil: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <div className="filters-bar">
            <select value={filtros.midia} onChange={(e) => set('midia', e.target.value)}>
              <option value="">Canal: todos</option>
              {midias.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input type="date" value={filtros.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} title="Entrada a partir de" />
            <input type="date" value={filtros.dataFim} onChange={(e) => set('dataFim', e.target.value)} title="Entrada até" />
            {(filtros.midia || filtros.dataInicio || filtros.dataFim) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiltros(FILTROS_VAZIOS_FUNIL)}>
                Limpar filtros
              </button>
            )}
          </div>

          <FunilChart atendimentos={atendimentosFiltrados} />
        </div>
      )}
    </div>
  )
}
