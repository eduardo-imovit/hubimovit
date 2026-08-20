import { useAtendimentos } from '../hooks/useAtendimentos'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import FunilChart from '../components/dashboard/FunilChart'

export default function DashboardFunil() {
  const { atendimentos, carregando, erro } = useAtendimentos()

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o funil: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <FunilChart atendimentos={atendimentos} />
        </div>
      )}
    </div>
  )
}
