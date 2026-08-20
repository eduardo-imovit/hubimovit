import { useCampanhas } from '../hooks/useCampanhas'
import { useMetas } from '../hooks/useMetas'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import CampanhasChart from '../components/dashboard/CampanhasChart'
import MetaVsRealizado from '../components/dashboard/MetaVsRealizado'

export default function DashboardCampanhas() {
  const { meta, google, carregando, erro } = useCampanhas()
  const { metasCampanhas, carregando: carregandoMetas } = useMetas()

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as campanhas: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <CampanhasChart meta={meta} google={google} />
          <div style={{ marginTop: 'var(--space-7)' }}>
            <div className="page-eyebrow">Meta × Realizado</div>
            {!carregandoMetas && <MetaVsRealizado metasCampanhas={metasCampanhas} meta={meta} google={google} />}
          </div>
        </div>
      )}
    </div>
  )
}
