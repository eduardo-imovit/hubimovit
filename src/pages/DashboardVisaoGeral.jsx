import { useMemo, useState } from 'react'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { useCampanhas, agregarPorCampanha, agruparPorEtapaFunil } from '../hooks/useCampanhas'
import { useClassificacaoCampanhas } from '../hooks/useMetas'
import { FILTROS_VAZIOS, filtrarAtendimentos } from '../lib/atendimentos'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import MidiaFiltros, { FILTROS_MIDIA_VAZIOS, dentroPeriodo } from '../components/dashboard/MidiaFiltros'
import KpiCard from '../components/dashboard/KpiCard'
import CampanhasPorEtapaFunil from '../components/dashboard/CampanhasPorEtapaFunil'
import MiniFunilEtapas from '../components/dashboard/MiniFunilEtapas'

function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function DashboardVisaoGeral() {
  const [filtrosMidia, setFiltrosMidia] = useState(FILTROS_MIDIA_VAZIOS)
  const { atendimentos, carregando: carregandoAtendimentos, erro: erroAtendimentos } = useAtendimentos()
  const { meta, google, carregando: carregandoCampanhas, erro: erroCampanhas } = useCampanhas()
  const { classificacao } = useClassificacaoCampanhas()

  const atendimentosFiltrados = useMemo(
    () => filtrarAtendimentos(atendimentos, { ...FILTROS_VAZIOS, dataInicio: filtrosMidia.dataInicio, dataFim: filtrosMidia.dataFim }),
    [atendimentos, filtrosMidia.dataInicio, filtrosMidia.dataFim]
  )

  const metaFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Google' ? [] : meta.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [meta, filtrosMidia]
  )
  const googleFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Meta' ? [] : google.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [google, filtrosMidia]
  )

  const resumo = useMemo(() => {
    const total = atendimentosFiltrados.length
    const negocios = atendimentosFiltrados.filter((a) => a.situacao === 'Negócio realizado').length
    const conversao = total > 0 ? (negocios / total) * 100 : 0
    const vendas = atendimentosFiltrados.filter((a) => a.finalidade === 'Venda').length
    const aluguel = atendimentosFiltrados.filter((a) => a.finalidade === 'Aluguel').length
    const investimentoTotal = [...metaFiltrado, ...googleFiltrado].reduce((acc, l) => acc + (l.investimento ?? 0), 0)
    return { total, negocios, conversao, vendas, aluguel, investimentoTotal }
  }, [atendimentosFiltrados, metaFiltrado, googleFiltrado])

  const totaisMidia = useMemo(() => {
    const linhas = [...metaFiltrado, ...googleFiltrado]
    const investimento = linhas.reduce((acc, l) => acc + (l.investimento ?? 0), 0)
    const cliques = linhas.reduce((acc, l) => acc + (l.cliques ?? 0), 0)
    const alcance = linhas.reduce((acc, l) => acc + (l.alcance_impressoes ?? 0), 0)
    const leads = linhas.reduce((acc, l) => acc + (l.leads_conversoes ?? 0), 0)
    return {
      investimento,
      cliques,
      alcance,
      leads,
      ctr: alcance > 0 ? (cliques / alcance) * 100 : 0,
      cpl: leads > 0 ? investimento / leads : null,
      cpc: cliques > 0 ? investimento / cliques : null,
    }
  }, [metaFiltrado, googleFiltrado])

  const campanhasPorEtapa = useMemo(() => {
    const metaAgg = agregarPorCampanha(metaFiltrado).map((c) => ({ ...c, canal: 'Meta' }))
    const googleAgg = agregarPorCampanha(googleFiltrado).map((c) => ({ ...c, canal: 'Google' }))
    return agruparPorEtapaFunil([...metaAgg, ...googleAgg], classificacao)
  }, [metaFiltrado, googleFiltrado, classificacao])

  const carregando = carregandoAtendimentos || carregandoCampanhas
  const erro = erroAtendimentos || erroCampanhas

  return (
    <div>
      <DashboardHeader />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o dashboard: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          <MidiaFiltros filtros={filtrosMidia} setFiltros={setFiltrosMidia} />

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Atendimentos</div>
                <div className="dash-section-sub">Resumo do funil comercial — espelho do CRM.</div>
              </div>
            </div>
            <div className="kpi-grid">
              <KpiCard label="Total de atendimentos" valor={resumo.total} />
              <KpiCard label="Taxa de conversão" valor={`${resumo.conversao.toFixed(1)}%`} corDestaque="var(--coral)" />
              <KpiCard label="Venda × Aluguel" valor={`${resumo.vendas} / ${resumo.aluguel}`} sub="atendimentos" />
              <KpiCard label="Investimento em mídia" valor={moeda(resumo.investimentoTotal)} sub="Meta Ads + Google Ads" />
            </div>
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Mídia</div>
                <div className="dash-section-sub">Performance de anúncios — Meta Ads e Google Ads.</div>
              </div>
            </div>

            <div className="dash-media-layout">
              <div className="kpi-grid">
                <KpiCard label="Alcance" valor={totaisMidia.alcance.toLocaleString('pt-BR')} sub="pessoas únicas" />
                <KpiCard label="Cliques" valor={totaisMidia.cliques.toLocaleString('pt-BR')} />
                <KpiCard label="CTR sobre alcance" valor={`${totaisMidia.ctr.toFixed(2)}%`} sub="cliques ÷ alcance, não impressões" />
                <KpiCard label="Leads" valor={Math.round(totaisMidia.leads)} />
                <KpiCard label="CPL" valor={totaisMidia.cpl != null ? moeda(totaisMidia.cpl) : '—'} />
                <KpiCard label="CPC" valor={totaisMidia.cpc != null ? moeda(totaisMidia.cpc) : '—'} />
                <KpiCard label="Investimento" valor={moeda(totaisMidia.investimento)} corDestaque="var(--coral)" />
              </div>
              <MiniFunilEtapas grupos={campanhasPorEtapa} />
            </div>
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <div>
                <div className="dash-section-title">Campanhas por etapa de funil</div>
                <div className="dash-section-sub">Clique numa etapa para abrir a lista de campanhas.</div>
              </div>
            </div>
            <CampanhasPorEtapaFunil grupos={campanhasPorEtapa} />
          </div>
        </div>
      )}
    </div>
  )
}
