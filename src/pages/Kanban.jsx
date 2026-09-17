import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { FILTROS_KANBAN_PADRAO, filtrarAtendimentos } from '../lib/atendimentos'
import KanbanFiltros from '../components/kanban/KanbanFiltros'
import KanbanBoard from '../components/kanban/KanbanBoard'

export default function Kanban() {
  const { atendimentos, carregando, erro } = useAtendimentos()
  const [filtros, setFiltros] = useState(FILTROS_KANBAN_PADRAO)

  const filtrados = useMemo(() => filtrarAtendimentos(atendimentos, filtros), [atendimentos, filtros])

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Vendas & Locação</div>
          <div className="page-title">Kanban de atendimentos</div>
          <div className="page-sub">Somente leitura — espelho do CRM, atualizado por sincronização.</div>
        </div>
        <Link to="/kanban/dados" className="btn btn-ghost btn-sm">Dados de atendimento →</Link>
      </header>

      {carregando && <div className="hub-loading">Carregando atendimentos…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os atendimentos: {erro}</div>}

      {!carregando && !erro && (
        <>
          <KanbanFiltros atendimentos={atendimentos} filtros={filtros} setFiltros={setFiltros} valoresPadrao={FILTROS_KANBAN_PADRAO} />
          <KanbanBoard atendimentos={filtrados} />
        </>
      )}
    </div>
  )
}
