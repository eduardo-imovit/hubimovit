import { useView } from '../hooks/useView'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import LeadsKpiCards from '../components/dashboard/LeadsKpiCards'
import LeadsFunilChart from '../components/dashboard/LeadsFunilChart'
import LeadsTendenciaChart from '../components/dashboard/LeadsTendenciaChart'
import LeadsCanaisChart from '../components/dashboard/LeadsCanaisChart'
import LeadsAgingCards from '../components/dashboard/LeadsAgingCards'
import LeadsDescartesChart from '../components/dashboard/LeadsDescartesChart'
import LeadsTempoResposta from '../components/dashboard/LeadsTempoResposta'

export default function DashboardLeads() {
  const { data: kpisMensais, loading: carregandoKpis, error: erroKpis } = useView('vw_kpis_mensais')
  const { data: funil, loading: carregandoFunil, error: erroFunil } = useView('vw_funil_acumulado')
  const { data: atendimentosOrigem, loading: carregandoOrigem, error: erroOrigem } = useView('vw_atendimentos_base', { is_ruido: false, is_interno: false })
  const { data: agingAtivos, loading: carregandoAging, error: erroAging } = useView('vw_aging_ativos')
  const { data: descartes, loading: carregandoDescartes, error: erroDescartes } = useView('vw_atendimentos_base', { is_descartado: true, is_ruido: false })
  const { data: coberturaAtividades, loading: carregandoCobertura, error: erroCobertura } = useView('vw_cobertura_atividades')
  const { data: propostasAtivas, loading: carregandoPropostas, error: erroPropostas } = useView('vw_atendimentos_base', { is_ativo: true, fase_ordem: 6 })

  const carregando = carregandoKpis || carregandoFunil || carregandoOrigem || carregandoAging || carregandoDescartes || carregandoCobertura || carregandoPropostas
  const erro = erroKpis || erroFunil || erroOrigem || erroAging || erroDescartes || erroCobertura || erroPropostas

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o dashboard de leads: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Leads</div>
                <div className="dash-section-sub">Resumo do mês mais recente já fechado.</div>
              </div>
            </div>
            <LeadsKpiCards dados={kpisMensais} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Funil por etapa</div>
                <div className="dash-section-sub">Volume e conversão etapa a etapa.</div>
              </div>
            </div>
            <LeadsFunilChart dados={funil} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Tendência mensal</div>
                <div className="dash-section-sub">Leads e negócios ao longo do tempo.</div>
              </div>
            </div>
            <LeadsTendenciaChart dados={kpisMensais} propostasAtivas={propostasAtivas} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Mídias de entrada</div>
                <div className="dash-section-sub">Performance por mídia de origem, agrupada.</div>
              </div>
            </div>
            <LeadsCanaisChart dados={atendimentosOrigem} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Leads parados</div>
                <div className="dash-section-sub">Atendimentos em aberto, por tempo sem avanço.</div>
              </div>
            </div>
            <LeadsAgingCards dados={agingAtivos} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Onde os leads morrem</div>
                <div className="dash-section-sub">Fase de descarte, por finalidade.</div>
              </div>
            </div>
            <LeadsDescartesChart dados={descartes} />
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Tempo de resposta</div>
                <div className="dash-section-sub">Tempo até a primeira atividade registrada.</div>
              </div>
            </div>
            <LeadsTempoResposta dados={coberturaAtividades} />
          </div>
        </div>
      )}
    </div>
  )
}
