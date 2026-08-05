import { useMemo, useState } from 'react'
import { useAtendimentos } from '../hooks/useAtendimentos'
import KanbanFiltros from '../components/kanban/KanbanFiltros'
import KanbanBoard from '../components/kanban/KanbanBoard'

const FILTROS_VAZIOS = { finalidade: '', funil: '', corretor: '', midia: '', dataInicio: '', dataFim: '' }

export default function Kanban() {
  const { atendimentos, carregando, erro } = useAtendimentos()
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)

  const filtrados = useMemo(() => {
    return atendimentos.filter((a) => {
      if (filtros.finalidade && a.finalidade !== filtros.finalidade) return false
      if (filtros.funil && a.funil !== filtros.funil) return false
      if (filtros.corretor && a.corretor !== filtros.corretor) return false
      if (filtros.midia && a.midia !== filtros.midia) return false
      if (filtros.dataInicio && (!a.data_de_entrada || a.data_de_entrada < filtros.dataInicio)) return false
      if (filtros.dataFim && (!a.data_de_entrada || a.data_de_entrada > `${filtros.dataFim}T23:59:59`)) return false
      return true
    })
  }, [atendimentos, filtros])

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Vendas & Locação</div>
          <div className="page-title">Kanban de atendimentos</div>
          <div className="page-sub">Somente leitura — espelho do CRM, atualizado por sincronização.</div>
        </div>
      </header>

      {carregando && <div className="hub-loading">Carregando atendimentos…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os atendimentos: {erro}</div>}

      {!carregando && !erro && (
        <>
          <KanbanFiltros atendimentos={atendimentos} filtros={filtros} setFiltros={setFiltros} />
          <KanbanBoard atendimentos={filtrados} />
        </>
      )}
    </div>
  )
}
