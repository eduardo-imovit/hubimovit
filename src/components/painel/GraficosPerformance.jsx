import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { CORES_PLATAFORMA, ETAPAS_CAMPANHA, FINALIDADES_CAMPANHA } from '../../lib/painelPerformance'
import { fmtMoeda, fmtNum, fmtPct } from '../../lib/paineis'

const EIXO = { fontSize: 11, fill: 'var(--grafite-soft)' }
const GRADE = 'var(--champagne)'

function CaixaTooltip({ titulo, linhas }) {
  return (
    <div className="pg-tooltip">
      <div className="pg-tooltip-titulo">{titulo}</div>
      {linhas.map((l) => (
        <div key={l.rotulo} className="pg-tooltip-linha">
          {l.cor && <span className="pg-ponto" style={{ background: l.cor }} aria-hidden="true" />}
          <span>{l.rotulo}</span>
          <strong>{l.valor}</strong>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Gasto acumulado × orçamento × projeção (um eixo, três linhas)
// ---------------------------------------------------------------------------

export function GraficoRitmoGasto({ ritmo, rotuloOrcamento }) {
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Investimento acumulado no mês (R$)</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={ritmo.pontos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              const linhas = []
              if (p.realizado != null) linhas.push({ rotulo: 'Realizado', valor: fmtMoeda(p.realizado), cor: 'var(--grafite)' })
              if (p.projecao != null && p.realizado == null) linhas.push({ rotulo: 'Projeção (ritmo 30 dias)', valor: fmtMoeda(p.projecao), cor: 'var(--coral)' })
              if (p.orcamento != null) linhas.push({ rotulo: rotuloOrcamento, valor: fmtMoeda(p.orcamento), cor: 'var(--grafite-fade)' })
              return <CaixaTooltip titulo={`Dia ${label}`} linhas={linhas} />
            }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
          {ritmo.orcamento > 0 && (
            <Line type="linear" dataKey="orcamento" name={rotuloOrcamento} stroke="var(--grafite-fade)" strokeWidth={2} dot={false} activeDot={false} />
          )}
          <Line type="monotone" dataKey="realizado" name="Realizado" stroke="var(--grafite)" strokeWidth={2} dot={false} connectNulls={false} />
          {ritmo.corrente && (
            <Line type="linear" dataKey="projecao" name="Projeção (ritmo 30 dias)" stroke="var(--coral)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Atenção: três gráficos pequenos (CPM, CTR, CPC), Meta × Google
// ---------------------------------------------------------------------------

const METRICAS_ATENCAO = [
  { chave: 'cpm', titulo: 'CPM · custo por mil impressões', fmt: (v) => fmtMoeda(v), eixo: (v) => `R$${Math.round(v)}` },
  { chave: 'ctr', titulo: 'CTR · cliques ÷ impressões', fmt: (v) => fmtPct(v, 2), eixo: (v) => `${v.toFixed(1).replace('.', ',')}%` },
  { chave: 'cpc', titulo: 'CPC · custo por clique', fmt: (v) => `R$ ${v.toFixed(2).replace('.', ',')}`, eixo: (v) => `R$${v.toFixed(1).replace('.', ',')}` },
]

export function PequenosAtencao({ serie, plataformas }) {
  return (
    <div className="pp-tres">
      {METRICAS_ATENCAO.map((m) => (
        <div key={m.chave} className="pg-grafico">
          <div className="pg-grafico-titulo">{m.titulo}</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={serie} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRADE} />
              <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis tick={EIXO} axisLine={false} tickLine={false} width={44} tickFormatter={m.eixo} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  return (
                    <CaixaTooltip
                      titulo={label}
                      linhas={plataformas.map((pl) => ({ rotulo: pl, valor: p[`${m.chave}${pl}`] == null ? '—' : m.fmt(p[`${m.chave}${pl}`]), cor: CORES_PLATAFORMA[pl] }))}
                    />
                  )
                }}
              />
              {plataformas.map((pl) => (
                <Line key={pl} type="linear" dataKey={`${m.chave}${pl}`} name={pl} stroke={CORES_PLATAFORMA[pl]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CORES_PLATAFORMA[pl] }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  )
}

export function LegendaPlataformas({ plataformas }) {
  return (
    <div className="pp-legenda">
      {plataformas.map((p) => (
        <span key={p}>
          <span className="pg-ponto" style={{ background: CORES_PLATAFORMA[p] }} aria-hidden="true" /> {p}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Campanhas: gasto × orçamento (barra com marca) e CPL × meta
// ---------------------------------------------------------------------------

const STATUS = {
  bom: { classe: 'badge-success', texto: 'no alvo', icone: '✓' },
  atencao: { classe: 'badge-warning', texto: 'acima da meta', icone: '!' },
  ruim: { classe: 'badge-danger', texto: 'fora da meta', icone: '✕' },
  neutro: { classe: 'badge-gray', texto: 'sem meta', icone: '–' },
}

export function TabelaCampanhas({ campanhas, onSelecionar, selecionada }) {
  const maxGasto = Math.max(...campanhas.map((c) => Math.max(c.investimento, c.orcamento ?? 0)), 1)
  return (
    <div className="painel-tabela-wrap">
      <table className="data-table pp-campanhas">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Gasto × orçamento do mês</th>
            <th className="num">Conversões</th>
            <th className="num">CPL</th>
            <th className="num">Meta de CPL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {campanhas.map((c) => {
            const s = STATUS[c.status]
            return (
              <tr
                key={`${c.plataforma}|${c.campanha}`}
                className={selecionada === c.campanha ? 'is-selecionado' : undefined}
                onClick={() => onSelecionar(c.campanha)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelecionar(c.campanha)}
                title="Clique para filtrar o painel por esta campanha"
              >
                <td>
                  <div className="pp-campanha-nome">
                    <span className="pg-ponto" style={{ background: CORES_PLATAFORMA[c.plataforma] }} aria-label={c.plataforma} />
                    {c.campanha}
                  </div>
                  <div className="pp-campanha-meta">
                    {c.plataforma} · {ETAPAS_CAMPANHA[c.etapa]} · {FINALIDADES_CAMPANHA[c.finalidade]}
                  </div>
                </td>
                <td className="pp-gasto">
                  <div className="pp-gasto-trilho">
                    <div className="pp-gasto-barra" style={{ width: `${(c.investimento / maxGasto) * 100}%`, background: CORES_PLATAFORMA[c.plataforma] }} />
                    {c.orcamento != null && <div className="pp-gasto-marca" style={{ left: `${(c.orcamento / maxGasto) * 100}%` }} title={`Orçamento: ${fmtMoeda(c.orcamento)}`} />}
                  </div>
                  <div className="pp-gasto-texto">
                    {fmtMoeda(c.investimento)}
                    {c.orcamento != null && <span className="is-muted"> de {fmtMoeda(c.orcamento)}</span>}
                  </div>
                </td>
                <td className="num">{fmtNum(c.conversoes)}</td>
                <td className="num">{fmtMoeda(c.cpl)}</td>
                <td className="num">{c.metaCpl == null ? '—' : fmtMoeda(c.metaCpl)}</td>
                <td>
                  <span className={`badge ${s.classe}`}>
                    <span aria-hidden="true">{s.icone}</span> {s.texto}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Cascata do dinheiro ao negócio
// ---------------------------------------------------------------------------

export function CascataDinheiro({ investimento, degraus }) {
  // só concorre a "maior perda" o degrau cuja etapa anterior tem volume (>= 10)
  const maiorQueda = degraus.slice(1).reduce((m, d) => (d.taxa != null && d.anterior >= 10 && (m == null || d.taxa < m.taxa) ? d : m), null)
  return (
    <div className="pp-cascata">
      <div className="pp-degrau pp-degrau--inicio">
        <div className="pp-degrau-label">Investimento</div>
        <div className="pp-degrau-n">{fmtMoeda(investimento)}</div>
      </div>
      {degraus.map((d) => (
        <div key={d.chave} className={`pp-degrau ${maiorQueda === d ? 'is-queda' : ''} ${['leads', 'qualificados', 'visitas', 'negocios'].includes(d.chave) ? 'pp-degrau--crm' : ''}`}>
          {d.taxa != null && (
            <div className="pp-degrau-taxa">
              <span aria-hidden="true">→</span> {fmtPct(d.taxa, d.taxa > 0 && d.taxa < 1 ? 2 : 0)}
            </div>
          )}
          <div className="pp-degrau-label">{d.label}</div>
          <div className="pp-degrau-n">{fmtNum(d.n)}</div>
          <div className="pp-degrau-custo">{d.custoTexto ?? (d.custo == null ? '—' : `${fmtMoeda(d.custo)} cada`)}</div>
          {maiorQueda === d && <span className="badge badge-danger">maior perda</span>}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Matriz de campanhas: gasto × CPL (bolha = conversões, cor = plataforma)
// ---------------------------------------------------------------------------

export function MatrizCampanhas({ campanhas, plataformas }) {
  const dados = campanhas.filter((c) => c.cpl != null && c.investimento >= 50)
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Gasto × custo por conversão (tamanho = conversões)</div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
          <CartesianGrid stroke={GRADE} />
          <XAxis type="number" dataKey="investimento" name="Gasto" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${Math.round(v)}`} />
          <YAxis type="number" dataKey="cpl" name="CPL" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${Math.round(v)}`} width={48} />
          <ZAxis type="number" dataKey="conversoes" range={[60, 500]} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const c = payload[0].payload
              return (
                <CaixaTooltip
                  titulo={c.campanha}
                  linhas={[
                    { rotulo: c.plataforma, valor: ETAPAS_CAMPANHA[c.etapa], cor: CORES_PLATAFORMA[c.plataforma] },
                    { rotulo: 'Gasto', valor: fmtMoeda(c.investimento) },
                    { rotulo: 'Conversões', valor: fmtNum(c.conversoes) },
                    { rotulo: 'CPL', valor: fmtMoeda(c.cpl) },
                    { rotulo: 'Meta de CPL', valor: c.metaCpl == null ? '—' : fmtMoeda(c.metaCpl) },
                  ]}
                />
              )
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {plataformas.map((p) => (
            <Scatter key={p} name={p} data={dados.filter((c) => c.plataforma === p)} fill={CORES_PLATAFORMA[p]} stroke="#fff" strokeWidth={2} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

const ICONE_REC = { bom: '↑', ruim: '↓', atencao: '!' }

export function Recomendacoes({ itens }) {
  if (!itens.length) return <p className="pg-nota">Nenhuma recomendação clara com os dados deste recorte.</p>
  return (
    <ul className="pp-recs">
      {itens.map((r) => (
        <li key={r.texto} className={`pp-rec pp-rec--${r.tipo}`}>
          <span className="pp-rec-icone" aria-hidden="true">{ICONE_REC[r.tipo]}</span>
          <span>{r.texto}</span>
        </li>
      ))}
    </ul>
  )
}

