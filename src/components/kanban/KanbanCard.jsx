import { SITUACAO_BADGE_CLASSE } from '../../lib/atendimentos'

const FINALIDADE_COR = { Venda: 'var(--investidores)', Aluguel: 'var(--ninho-cheio)' }

function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

/**
 * Dias no funil: da entrada até hoje (em atendimento) ou até o encerramento.
 * O tempo na etapa atual só existe quando houver histórico de etapas (PRD §5.8).
 */
function diasNoFunil(a) {
  if (!a.data_de_entrada) return null
  // datas do CRM sem fuso: comparar só o dia, em data local
  const dia = (iso) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const agora = new Date()
  const encerrado = a.situacao !== 'Em atendimento' && a.data_fechamento
  const fim = encerrado ? dia(a.data_fechamento) : new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  return Math.max(0, Math.round((fim - dia(a.data_de_entrada)) / 86400000))
}

/** Faixa do tempo no funil, sempre com texto (nunca só cor). */
function faixaTempo(dias) {
  if (dias == null) return ''
  if (dias > 30) return 'kanban-tempo--alerta'
  if (dias > 14) return 'kanban-tempo--atencao'
  return ''
}

export default function KanbanCard({ atendimento }) {
  const cor = FINALIDADE_COR[atendimento.finalidade] ?? 'var(--grafite-fade)'
  const entrada = atendimento.data_de_entrada ? new Date(atendimento.data_de_entrada) : null
  const badgeClasse = SITUACAO_BADGE_CLASSE[atendimento.situacao] ?? 'badge-gray'
  const dias = diasNoFunil(atendimento)
  const aberto = atendimento.situacao === 'Em atendimento'

  return (
    <div className="kanban-card">
      <div className="kanban-card-seg" style={{ background: cor }} />
      <div className="kanban-card-codigo">Atendimento #{atendimento.codigo}</div>
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
        <span className="kanban-date">
          {entrada ? entrada.toLocaleDateString('pt-BR') : '—'}
          {dias != null && (
            <span
              className={`kanban-tempo ${aberto ? faixaTempo(dias) : ''}`}
              title={aberto ? 'Dias desde a entrada no funil' : 'Dias da entrada até o encerramento'}
            >
              {' · '}
              {dias === 0 ? 'entrou hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}${aberto ? ' no funil' : ' até encerrar'}`}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
