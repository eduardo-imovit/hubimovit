import { useMemo, useState } from 'react'
import { useCampanhas } from '../hooks/useCampanhas'
import { useMetas } from '../hooks/useMetas'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import MidiaFiltros, { FILTROS_MIDIA_VAZIOS, dentroPeriodo } from '../components/dashboard/MidiaFiltros'
import CampanhasChart from '../components/dashboard/CampanhasChart'
import MetaVsRealizado from '../components/dashboard/MetaVsRealizado'

export default function DashboardCampanhas() {
  const [filtrosMidia, setFiltrosMidia] = useState(FILTROS_MIDIA_VAZIOS)
  const { meta, google, carregando, erro } = useCampanhas()
  const { metasCampanhas, carregando: carregandoMetas } = useMetas()

  const metaFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Google' ? [] : meta.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [meta, filtrosMidia]
  )
  const googleFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Meta' ? [] : google.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [google, filtrosMidia]
  )

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as campanhas: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <MidiaFiltros filtros={filtrosMidia} setFiltros={setFiltrosMidia} />

          <CampanhasChart meta={metaFiltrado} google={googleFiltrado} />
          <div style={{ marginTop: 'var(--space-7)' }}>
            <div className="page-eyebrow">Meta × Realizado</div>
            <div className="stat-sub is-muted" style={{ marginBottom: 'var(--space-3)' }}>
              Comparado sempre contra o período completo de cada meta cadastrada — o filtro de canal/período acima não se aplica aqui.
            </div>
            {!carregandoMetas && <MetaVsRealizado metasCampanhas={metasCampanhas} meta={meta} google={google} />}
          </div>
        </div>
      )}
    </div>
  )
}
