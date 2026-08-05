import { useAtividadesHoje } from '../../hooks/useAtividadesHoje'
import { formatarHora } from '../../lib/dateUtils'

export default function AgendaHoje() {
  const { atividades, carregando, erro } = useAtividadesHoje()

  if (carregando) return <div className="hub-loading">Carregando agenda…</div>
  if (erro) return <div className="hub-error">Não foi possível carregar a agenda: {erro}</div>

  if (atividades.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Nenhum compromisso hoje</div>
        <div className="empty-sub">A agenda do dia aparece aqui assim que houver atividades cadastradas.</div>
      </div>
    )
  }

  return (
    <div className="agenda-list">
      {atividades.map((a) => (
        <div className="agenda-item" key={a.codigo}>
          <span className="agenda-time">{formatarHora(a.datahorainicio)}</span>
          <span className="agenda-dot" style={{ background: a.cortipo || 'var(--champagne)' }} />
          <div className="agenda-info">
            <div className="agenda-title">{a.titulo || a.nometipo}</div>
            <div className="agenda-sub">
              {a.nomeusuario}
              {a.nomepessoa ? ` · ${a.nomepessoa}` : ''}
              {a.resumoimovel ? ` · ${a.resumoimovel}` : ''}
            </div>
          </div>
          {a.nometipo && <span className="badge badge-gray">{a.nometipo}</span>}
        </div>
      ))}
    </div>
  )
}
