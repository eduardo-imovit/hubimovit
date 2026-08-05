import { SITUACAO_BADGE_CLASSE } from '../../lib/atendimentos'

const FINALIDADE_COR = { Venda: 'var(--investidores)', Aluguel: 'var(--ninho-cheio)' }

function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

export default function KanbanCard({ atendimento }) {
  const cor = FINALIDADE_COR[atendimento.finalidade] ?? 'var(--grafite-fade)'
  const entrada = atendimento.data_de_entrada ? new Date(atendimento.data_de_entrada) : null
  const badgeClasse = SITUACAO_BADGE_CLASSE[atendimento.situacao] ?? 'badge-gray'

  return (
    <div className="kanban-card">
      <div className="kanban-card-seg" style={{ background: cor }} />
      <div className="kanban-card-title">{atendimento.finalidade ?? 'Sem finalidade'} · {atendimento.midia ?? 'Mídia não informada'}</div>
      <div className="kanban-card-sub">
        {atendimento.funil?.replace(/\s*\(.*\)/, '') ?? '—'}
        {atendimento.campanha ? ` · ${atendimento.campanha}` : ''}
      </div>
      {atendimento.situacao && (
        <span className={`badge ${badgeClasse}`} style={{ marginBottom: 'var(--space-2)' }}>{atendimento.situacao}</span>
      )}
      <div className="kanban-card-footer">
        <span className="avatar avatar-sm tt" data-tt={atendimento.corretor ?? 'Sem corretor'}>{iniciais(atendimento.corretor)}</span>
        <span className="kanban-date">{entrada ? entrada.toLocaleDateString('pt-BR') : '—'}</span>
      </div>
    </div>
  )
}
