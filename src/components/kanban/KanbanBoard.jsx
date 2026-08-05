import KanbanCard from './KanbanCard'

const COLUNAS = ['Em atendimento', 'Negócio realizado', 'Descartado']
const LIMITE_POR_COLUNA = 120

export default function KanbanBoard({ atendimentos }) {
  return (
    <div className="kanban">
      {COLUNAS.map((situacao) => {
        const itens = atendimentos.filter((a) => a.situacao === situacao)
        const visiveis = itens.slice(0, LIMITE_POR_COLUNA)
        const restantes = itens.length - visiveis.length

        return (
          <div className="kanban-col" key={situacao}>
            <div className="kanban-col-header">
              <span className="kanban-col-title">{situacao}</span>
              <span className="kanban-count">{itens.length}</span>
            </div>
            {visiveis.map((a) => (
              <KanbanCard key={a.id} atendimento={a} />
            ))}
            {restantes > 0 && (
              <div className="plantao-empty" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                +{restantes} — refine os filtros para ver mais
              </div>
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
