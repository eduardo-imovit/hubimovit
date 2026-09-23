import { ETAPAS_JORNADA } from '../../lib/esteiraLabels'

function IconeCheck() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeCadeado() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * Trilha "gamificada" da jornada do locatário: etapas feitas com check, a
 * atual em destaque e as futuras com cadeado. `recemLiberada` (índice) anima
 * o destravamento da etapa que acabou de abrir.
 */
export default function JornadaLocatario({ etapa, recemLiberada }) {
  const total = ETAPAS_JORNADA.length
  const concluida = etapa >= total
  const percentual = Math.round((Math.min(etapa, total) / total) * 100)

  return (
    <div className="jornada">
      <div className="jornada-topo">
        <div className="page-eyebrow" style={{ marginBottom: 0 }}>Sua jornada</div>
        <span className="jornada-percentual">{percentual}%</span>
      </div>
      <div
        className="jornada-barra"
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da sua locação"
      >
        <div className="jornada-barra-fill" style={{ width: `${percentual}%` }} />
      </div>

      <ol className="jornada-etapas">
        {ETAPAS_JORNADA.map((e, i) => {
          const estado = concluida || i < etapa ? 'feito' : i === etapa ? 'atual' : 'bloqueado'
          const destravando = i === recemLiberada && estado === 'atual'
          return (
            <li key={e.chave} className={`jornada-etapa is-${estado}${destravando ? ' is-destravando' : ''}`}>
              <span className="jornada-marcador">
                {estado === 'feito' && <IconeCheck />}
                {estado === 'bloqueado' && <IconeCadeado />}
              </span>
              <div className="jornada-texto">
                <div className="jornada-nome">
                  {e.label}
                  {destravando && <span className="jornada-tag">Liberada!</span>}
                </div>
                {estado === 'atual' && <div className="jornada-sub">{e.aguardando}</div>}
                {estado === 'bloqueado' && i === etapa + 1 && (
                  <div className="jornada-sub">Libera ao concluir “{ETAPAS_JORNADA[etapa].label}”</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {concluida && <div className="jornada-final">Jornada completa: seu processo de locação foi concluído.</div>}
    </div>
  )
}
