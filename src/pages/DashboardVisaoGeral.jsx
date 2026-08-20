import { useMemo, useState } from 'react'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { useCampanhas, agregarPorCampanha, agruparPorEtapaFunil } from '../hooks/useCampanhas'
import { useClassificacaoCampanhas } from '../hooks/useMetas'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import KpiCard from '../components/dashboard/KpiCard'
import CampanhasPorEtapaFunil from '../components/dashboard/CampanhasPorEtapaFunil'
import MiniFunilEtapas from '../components/dashboard/MiniFunilEtapas'

const FILTROS_MIDIA_VAZIOS = { canal: '', dataInicio: '', dataFim: '' }

function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function dentroPeriodo(linha, filtros) {
  return (!filtros.dataInicio || linha.data >= filtros.dataInicio) && (!filtros.dataFim || linha.data <= filtros.dataFim)
}

export default function DashboardVisaoGeral() {
  const [filtrosMidia, setFiltrosMidia] = useState(FILTROS_MIDIA_VAZIOS)
  const { atendimentos, carregando: carregandoAtendimentos, erro: erroAtendimentos } = useAtendimentos()
  const { meta, google, carregando: carregandoCampanhas, erro: erroCampanhas } = useCampanhas()
  const { classificacao } = useClassificacaoCampanhas()

  const resumo = useMemo(() => {
    const total = atendimentos.length
    const negocios = atendimentos.filter((a) => a.situacao === 'Negócio realizado').length
    const conversao = total > 0 ? (negocios / total) * 100 : 0
    const vendas = atendimentos.filter((a) => a.finalidade === 'Venda').length
    const aluguel = atendimentos.filter((a) => a.finalidade === 'Aluguel').length
    const investimentoTotal = [...meta, ...google].reduce((acc, l) => acc + (l.investimento ?? 0), 0)
    return { total, negocios, conversao, vendas, aluguel, investimentoTotal }
  }, [atendimentos, meta, google])

  const metaFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Google' ? [] : meta.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [meta, filtrosMidia]
  )
  const googleFiltrado = useMemo(
    () => (filtrosMidia.canal === 'Meta' ? [] : google.filter((l) => dentroPeriodo(l, filtrosMidia))),
    [google, filtrosMidia]
  )

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

            <div className="filters-bar">
              <select value={filtrosMidia.canal} onChange={(e) => setFiltrosMidia((f) => ({ ...f, canal: e.target.value }))}>
                <option value="">Canal: todos</option>
                <option value="Meta">Meta Ads</option>
                <option value="Google">Google Ads</option>
              </select>
              <input
                type="date"
                value={filtrosMidia.dataInicio}
                onChange={(e) => setFiltrosMidia((f) => ({ ...f, dataInicio: e.target.value }))}
                title="Período a partir de"
              />
              <input
                type="date"
                value={filtrosMidia.dataFim}
                onChange={(e) => setFiltrosMidia((f) => ({ ...f, dataFim: e.target.value }))}
                title="Período até"
              />
              {(filtrosMidia.canal || filtrosMidia.dataInicio || filtrosMidia.dataFim) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiltrosMidia(FILTROS_MIDIA_VAZIOS)}>
                  Limpar filtros
                </button>
              )}
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
