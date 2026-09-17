import { useAvisos } from '../../hooks/useAvisos'
import { formatarDiaCurto } from '../../lib/dateUtils'

const TIPO_LABEL = {
  aviso: 'Aviso',
  data_importante: 'Data importante',
  processo: 'Processo',
  link: 'Link',
}

export default function AvisosFeed() {
  const { avisos, carregando, erro } = useAvisos()

  if (carregando) return <div className="hub-loading">Carregando…</div>
  if (erro) return <div className="hub-error">Não foi possível carregar avisos: {erro}</div>

  if (avisos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Nenhum aviso ativo</div>
        <div className="empty-sub">Comunicados, datas importantes e processos aparecem aqui.</div>
      </div>
    )
  }

  return (
    <div className="avisos-list">
      {avisos.map((a) => (
        <div className="avisos-item" key={a.id}>
          <div className="avisos-item-body">
            <span className="badge badge-gray" style={{ marginRight: 'var(--space-2)' }}>{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
            <span className="avisos-item-title">{a.titulo}</span>
            {a.corpo && <div className="avisos-item-sub">{a.corpo}</div>}
            <div className="avisos-item-sub">
              {a.data_referencia ? formatarDiaCurto(a.data_referencia) : null}
              {a.link_url && (
                <a href={a.link_url} target="_blank" rel="noreferrer" style={{ color: 'var(--coral)', marginLeft: a.data_referencia ? 'var(--space-2)' : 0 }}>
                  Abrir link ↗
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
