import { useEffect, useState } from 'react'
import KanbanCard from './KanbanCard'
import { FASES_FUNIL } from '../../lib/atendimentos'

const LOTE = 10

export default function KanbanBoard({ atendimentos }) {
  const [visiveisPorFase, setVisiveisPorFase] = useState({})

  useEffect(() => {
    setVisiveisPorFase({})
  }, [atendimentos])

  function carregarMais(fase) {
    setVisiveisPorFase((prev) => ({ ...prev, [fase]: (prev[fase] ?? LOTE) + LOTE }))
  }

  return (
    <div className="kanban">
      {FASES_FUNIL.map(({ fase, label }) => {
        const itens = atendimentos.filter((a) => a.fase === fase)
        const limite = visiveisPorFase[fase] ?? LOTE
        const visiveis = itens.slice(0, limite)
        const restantes = itens.length - visiveis.length

        return (
          <div className="kanban-col" key={fase}>
            <div className="kanban-col-header">
              <span className="kanban-col-title">{label}</span>
              <span className="kanban-count">{itens.length}</span>
            </div>
            {visiveis.map((a) => (
              <KanbanCard key={a.id} atendimento={a} />
            ))}
            {restantes > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => carregarMais(fase)}
              >
                Carregar mais ({restantes} restantes)
              </button>
            )}
            {itens.length === 0 && (
              <div className="empty" style={{ padding: 'var(--space-5) var(--space-3)' }}>
                <div className="empty-sub">Nenhum atendimento nesta etapa com os filtros atuais.</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
