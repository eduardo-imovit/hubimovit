import { useMemo } from 'react'
import { usePerformanceFilters } from '../hooks/usePerformanceFilters'
import { usePerformanceDashboard } from '../hooks/usePerformanceDashboard'
import FilterPanel from '../components/PerformanceDashboard/FilterPanel'
import ExportButton from '../components/PerformanceDashboard/ExportButton'
import ExecutiveSummary from '../components/PerformanceDashboard/ExecutiveSummary'
import PerformanceCards from '../components/PerformanceDashboard/PerformanceCards'
import FunnelAnalysis from '../components/PerformanceDashboard/FunnelAnalysis'
import AnomaliesOpportunities from '../components/PerformanceDashboard/AnomaliesOpportunities'
import Recommendations from '../components/PerformanceDashboard/Recommendations'
import { detectarAnomalias } from '../utils/performanceInsights'

function toISO(d) {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-CA') : undefined
}

function formatarTimestamp(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function PerformanceSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['s1', 's2', 's3', 's4'].map((k) => (
          <div key={k} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    </div>
  )
}

export default function DashboardPerformance() {
  const { filters, setPeriodo, setDataAncora, setDataCustom, setCanal, setEtapa, setFinalidade, resetFiltros } =
    usePerformanceFilters()

  const params = useMemo(
    () => ({
      startDate: filters.periodo === 'customizado' ? toISO(filters.dataInicio) : undefined,
      endDate: toISO(filters.dataFim),
      janelaDias: filters.janelaDias,
      canal: filters.canal !== 'todos' ? filters.canal : undefined,
      etapa: filters.etapa !== 'todos' ? filters.etapa : undefined,
      finalidade: filters.finalidade !== 'todos' ? filters.finalidade : undefined,
    }),
    [filters],
  )

  const { loading, error, data } = usePerformanceDashboard(params)
  const anomalies = useMemo(() => (data ? detectarAnomalias(data) : []), [data])

  return (
    <div className="md:flex md:gap-6">
      <div className="mb-6 md:sticky md:top-6 md:mb-0 md:h-[calc(100vh-3rem)] md:w-64 md:shrink-0 [&>aside]:w-full [&>aside]:rounded-lg">
        <FilterPanel
          filters={filters}
          setPeriodo={setPeriodo}
          setDataAncora={setDataAncora}
          setDataCustom={setDataCustom}
          setCanal={setCanal}
          setEtapa={setEtapa}
          setFinalidade={setFinalidade}
          resetFiltros={resetFiltros}
        />
      </div>

      <div className="min-w-0 md:flex-1">
        <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Relatório de Performance Premium</h1>
            <p className="mt-1 text-xs text-slate-400">
              Última atualização: {formatarTimestamp(data?.ultimaAtualizacao)}
              {loading && data && <span className="ml-2 text-accent-600">atualizando…</span>}
            </p>
          </div>
          <ExportButton data={data} periodo={data?.periodo ?? filters} />
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-danger-600/30 bg-danger-50 p-4 text-sm">
            <p className="font-semibold text-danger-700">Não foi possível carregar o relatório</p>
            <p className="mt-1 text-danger-600">{error}</p>
          </div>
        )}

        {!data && loading && <PerformanceSkeleton />}

        {!data && !loading && !error && (
          <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            Sem dados para os filtros selecionados.
          </p>
        )}

        {data && (
          <div id="performance-report" className="flex flex-col gap-8">
            <ExecutiveSummary data={data} filters={filters} />
            <PerformanceCards data={data} />
            <FunnelAnalysis data={data} filters={filters} />
            <AnomaliesOpportunities data={data} />
            <Recommendations data={data} anomalies={anomalies} />

            <footer className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">
              <p className="font-medium text-slate-500">Metodologia</p>
              <p className="mt-1">
                Mídia: <span className="font-mono">dashboard_google_ads</span> e{' '}
                <span className="font-mono">dashboard_meta_ads</span>, deduplicados por campanha + dia. O período
                (semana/mês/trimestre) define a janela de comparação: "atual" = últimos N dias até a data de
                referência, "anterior" = os N dias imediatamente antes. Meta por campanha = média das janelas
                anteriores com veiculação × 1,05; % atingido e tendência calculados sobre leads. Finalidade é
                inferida do nome da campanha. Funil do CRM:{' '}
                <span className="font-mono">dashboard_atendimentos_crm</span> por data de entrada no período.
                Cadência das fontes: Google/Meta Ads diária (~3h), CRM semanal (terça).
              </p>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
