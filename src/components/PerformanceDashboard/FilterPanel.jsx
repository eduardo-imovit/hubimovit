// Sidebar de filtros do Dashboard de Performance.
// Props vêm direto de usePerformanceFilters().
//
// Período define o tamanho da janela de comparação (atual × anterior); a data de
// referência é o fim da janela. Canal / Etapa / Finalidade são checkboxes com
// estado single-select (marcar troca, desmarcar volta para 'todos').

import { PERIODOS } from '../../hooks/usePerformanceFilters'

const PERIODO_OPCOES = PERIODOS

const CANAL_OPCOES = [
  { valor: 'google', label: 'Google' },
  { valor: 'meta', label: 'Meta' },
  { valor: 'whatsapp', label: 'WhatsApp' },
]

const ETAPA_OPCOES = [
  { valor: 'topo', label: 'Topo' },
  { valor: 'meio', label: 'Meio' },
  { valor: 'fundo', label: 'Fundo' },
]

const FINALIDADE_OPCOES = [
  { valor: 'venda', label: 'Venda' },
  { valor: 'locacao', label: 'Locação' },
  { valor: 'institucional', label: 'Institucional' },
]

const inputData = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none'
const linhaOpcao = 'flex items-center gap-2 text-sm text-slate-700'

function toInputDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA')
}

function fromInputDate(v) {
  return v ? new Date(`${v}T00:00:00`) : null
}

function Secao({ titulo, children }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </div>
  )
}

function GrupoCheck({ titulo, opcoes, ativo, onSelect }) {
  return (
    <Secao titulo={titulo}>
      {opcoes.map((o) => (
        <label key={o.valor} className={linhaOpcao}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-slate-700"
            checked={ativo === o.valor}
            onChange={(e) => onSelect(e.target.checked ? o.valor : 'todos')}
          />
          {o.label}
        </label>
      ))}
    </Secao>
  )
}

export default function FilterPanel({
  filters,
  setPeriodo,
  setDataAncora,
  setDataCustom,
  setCanal,
  setEtapa,
  setFinalidade,
  resetFiltros,
}) {
  return (
    <aside className="flex h-full w-64 flex-col gap-6 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400" aria-hidden="true">
          <path d="M2.5 4.25A.75.75 0 0 1 3.25 3.5h13.5a.75.75 0 0 1 .59 1.21l-5.09 6.54v4.13a.75.75 0 0 1-1.08.67l-2.5-1.25a.75.75 0 0 1-.42-.67v-2.88L2.66 4.71a.75.75 0 0 1-.16-.46Z" />
        </svg>
        Filtros
      </div>

      <Secao titulo="Período">
        {PERIODO_OPCOES.map((o) => (
          <label key={o.valor} className={linhaOpcao}>
            <input
              type="radio"
              name="pd-periodo"
              className="h-4 w-4 border-slate-300 accent-slate-700"
              checked={filters.periodo === o.valor}
              onChange={() => setPeriodo(o.valor)}
            />
            {o.label}
          </label>
        ))}

        <div className="mt-1 flex flex-col gap-2 border-l border-slate-200 pl-4">
          {filters.periodo === 'customizado' ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Data início
                <input
                  type="date"
                  className={inputData}
                  value={toInputDate(filters.dataInicio)}
                  max={toInputDate(filters.dataFim) || undefined}
                  onChange={(e) => setDataCustom(fromInputDate(e.target.value), filters.dataFim)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Data fim
                <input
                  type="date"
                  className={inputData}
                  value={toInputDate(filters.dataFim)}
                  min={toInputDate(filters.dataInicio) || undefined}
                  onChange={(e) => setDataCustom(filters.dataInicio, fromInputDate(e.target.value))}
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Data de referência
              <input
                type="date"
                className={inputData}
                value={toInputDate(filters.dataAncora)}
                max={toInputDate(new Date())}
                onChange={(e) => setDataAncora(fromInputDate(e.target.value))}
              />
            </label>
          )}
        </div>
      </Secao>

      <GrupoCheck titulo="Canal" opcoes={CANAL_OPCOES} ativo={filters.canal} onSelect={setCanal} />
      <GrupoCheck titulo="Etapa de funil" opcoes={ETAPA_OPCOES} ativo={filters.etapa} onSelect={setEtapa} />
      <GrupoCheck titulo="Finalidade" opcoes={FINALIDADE_OPCOES} ativo={filters.finalidade} onSelect={setFinalidade} />

      <button
        type="button"
        onClick={resetFiltros}
        className="mt-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Limpar filtros
      </button>
    </aside>
  )
}
