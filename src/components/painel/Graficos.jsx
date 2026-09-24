import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { CORES, LABEL_FINALIDADE, simularGanho } from '../../lib/painelGestao'
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
// 1. Ritmo: leads e negócios por mês (dois gráficos, nunca eixo duplo)
// ---------------------------------------------------------------------------

export function GraficoMensal({ serie, finalidades, tipo, referencia }) {
  const chaves = tipo === 'leads' ? { Venda: 'leadsVenda', Aluguel: 'leadsAluguel' } : { Venda: 'negVenda', Aluguel: 'negAluguel' }
  const mostrarProjecao = tipo === 'leads'
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">
        {tipo === 'leads' ? 'Leads por mês' : 'Negócios fechados por mês'}
        {referencia != null && <span className="pg-grafico-ref"> · linha = média dos 3 meses anteriores ({fmtNum(referencia)})</span>}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          {referencia != null && (
            <ReferenceLine y={referencia} stroke="var(--grafite)" strokeWidth={1} strokeOpacity={0.55} />
          )}
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              const linhas = finalidades.map((f) => ({ rotulo: LABEL_FINALIDADE[f], valor: p[chaves[f]], cor: CORES[f] }))
              if (mostrarProjecao && p.leadsProjecao > 0) linhas.push({ rotulo: 'A entrar (ritmo 30 dias)', valor: `~${p.leadsProjecao}`, cor: CORES.projecao })
              return <CaixaTooltip titulo={`${label}${p.corrente ? ' · em andamento' : ''}`} linhas={linhas} />
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
            payload={[
              ...finalidades.map((f) => ({ value: LABEL_FINALIDADE[f], type: 'circle', color: CORES[f], id: f })),
              ...(mostrarProjecao ? [{ value: 'Projeção do mês (ritmo 30 dias)', type: 'circle', color: CORES.projecao, id: 'proj' }] : []),
            ]}
          />
          {finalidades.map((f, i) => (
            <Bar
              key={f}
              dataKey={chaves[f]}
              name={LABEL_FINALIDADE[f]}
              stackId="a"
              fill={CORES[f]}
              stroke="#fff"
              strokeWidth={2}
              radius={i === finalidades.length - 1 && !mostrarProjecao ? [4, 4, 0, 0] : 0}
              maxBarSize={26}
            />
          ))}
          {mostrarProjecao && (
            <Bar dataKey="leadsProjecao" name="Projeção do mês" stackId="a" fill={CORES.projecao} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={26} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Funil em cascata (HTML: largura proporcional, passagem entre as etapas)
// ---------------------------------------------------------------------------

export function FunilCascata({ grupos }) {
  return (
    <div className={`pg-funis pg-funis--${grupos.length}`}>
      {grupos.map((g) => {
        const max = g.etapas[0].n || 1
        return (
          <div key={g.finalidade} className="pg-funil">
            <div className="pg-funil-titulo">
              <span className={`pg-ponto pg-ponto--${g.finalidade}`} aria-hidden="true" />
              {LABEL_FINALIDADE[g.finalidade]}
              <span className="pg-funil-conv">{fmtPct(g.conversao, 1)} viram negócio</span>
            </div>
            {g.etapas.map((e) => {
              const gargalo = g.gargalo?.ordem === e.ordem
              return (
                <div key={e.ordem}>
                  {e.passagem != null && (
                    <div className={`pg-funil-passagem ${gargalo ? 'is-gargalo' : ''}`}>
                      <span aria-hidden="true">↓</span> {fmtPct(e.passagem, 0)} avançam
                      {e.delta != null && Math.abs(e.delta) >= 3 && (
                        <span className={e.delta > 0 ? 'pg-delta-bom' : 'pg-delta-ruim'}>
                          {' '}({e.delta > 0 ? '+' : ''}{fmtNum(e.delta, 0)} p.p. vs semestre anterior)
                        </span>
                      )}
                      {gargalo && <span className="badge badge-danger pg-funil-badge">maior queda</span>}
                    </div>
                  )}
                  <div className="pg-funil-linha">
                    <span className="pg-funil-etapa">{e.label}</span>
                    <div className="pg-funil-trilho">
                      <div
                        className="pg-funil-barra"
                        style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: CORES[g.finalidade], opacity: gargalo ? 1 : 0.78 }}
                      />
                    </div>
                    <span className="pg-funil-n">{fmtNum(e.n)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Descartes por etapa + simulação do ganho
// ---------------------------------------------------------------------------

export function Descartes({ dados }) {
  const max = Math.max(...dados.porEtapa.map((e) => e.n), 1)
  const maior = dados.porEtapa.reduce((m, e) => (e.n > m.n ? e : m), dados.porEtapa[0])
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Em que etapa os leads foram descartados</div>
      <div className="pg-hbarras">
        {dados.porEtapa.map((e) => (
          <div key={e.etapa} className="pg-hbarra">
            <span className="pg-hbarra-rotulo">{e.etapa}</span>
            <div className="pg-funil-trilho">
              <div className="pg-funil-barra" style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: e === maior ? 'var(--coral)' : CORES.contexto }} />
            </div>
            <span className="pg-funil-n">
              {fmtNum(e.n)} <span className="is-muted">({fmtPct((e.n / (dados.total || 1)) * 100, 0)})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Simulador({ grupo, leadsPorMes }) {
  const [pontos, setPontos] = useState(10)
  const r = simularGanho(grupo, leadsPorMes, pontos)
  if (!r) return null
  const i = grupo.etapas.findIndex((e) => e.ordem === grupo.gargalo.ordem)
  const de = grupo.etapas[i - 1].label.toLowerCase()
  const para = grupo.gargalo.label.toLowerCase()
  return (
    <div className="pg-simulador">
      <div className="pg-grafico-titulo">E se melhorássemos o gargalo?</div>
      <p className="pg-simulador-texto">
        Na {LABEL_FINALIDADE[grupo.finalidade].toLowerCase()}, hoje {fmtPct(grupo.gargalo.passagem, 0)} passam de {de} para {para}. Subindo essa passagem em
      </p>
      <div className="pg-simulador-controle">
        <input type="range" min="1" max="30" value={pontos} onChange={(e) => setPontos(Number(e.target.value))} aria-label="Pontos percentuais de melhora" />
        <span className="pg-simulador-pp">+{pontos} p.p.</span>
      </div>
      <div className="pg-simulador-resultado">
        <span className="pg-simulador-ganho">+{fmtNum(r.ganho, 1)}</span>
        <span>
          negócios de {LABEL_FINALIDADE[grupo.finalidade].toLowerCase()} por mês
          <br />
          <span className="is-muted">
            de {fmtNum(r.base, 1)} para {fmtNum(r.nova, 1)}, mantendo {fmtNum(leadsPorMes)} leads/mês e as outras etapas
          </span>
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Canais: volume × conversão (bolha = negócios) e custo real da mídia
// ---------------------------------------------------------------------------

export function MatrizCanais({ canais, destaque }) {
  const dados = canais.filter((c) => c.leads >= 30).map((c) => ({ ...c, x: c.leads, y: c.conversao ?? 0, z: Math.max(c.negocios, 1) }))
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Volume × conversão por canal (tamanho = negócios)</div>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
          <CartesianGrid stroke={GRADE} />
          <XAxis type="number" dataKey="x" name="Leads" tick={EIXO} axisLine={false} tickLine={false} label={{ value: 'leads', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: 'var(--grafite-soft)' }} />
          <YAxis type="number" dataKey="y" name="Conversão" tick={EIXO} axisLine={false} tickLine={false} unit="%" />
          <ZAxis type="number" dataKey="z" range={[60, 600]} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const c = payload[0].payload
              return (
                <CaixaTooltip
                  titulo={c.canal}
                  linhas={[
                    { rotulo: 'Leads', valor: fmtNum(c.leads) },
                    { rotulo: 'Chegaram à visita', valor: fmtPct(c.pctVisita, 0) },
                    { rotulo: 'Negócios', valor: fmtNum(c.negocios) },
                    { rotulo: 'Lead → negócio', valor: fmtPct(c.conversao) },
                  ]}
                />
              )
            }}
          />
          <Scatter data={dados} fill={CORES.contexto} stroke="#fff" strokeWidth={2} shape={(p) => <circle cx={p.cx} cy={p.cy} r={p.width / 2} fill={p.payload.canal === destaque ? 'var(--coral)' : CORES.contexto} stroke="#fff" strokeWidth={2} />}>
            <LabelList dataKey="canal" position="top" style={{ fontSize: 11, fill: 'var(--grafite-mid)' }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoCustoMidia({ dados }) {
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Custo real por lead da mídia paga (investimento ÷ leads pagos no CRM)</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 16, right: 8, left: -8, bottom: 0 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <CaixaTooltip
                  titulo={label}
                  linhas={[
                    { rotulo: 'Investimento', valor: fmtMoeda(d.investimento) },
                    { rotulo: 'Conversões nas plataformas', valor: fmtNum(d.conversoes) },
                    { rotulo: 'Leads pagos no CRM', valor: fmtNum(d.leads) },
                    { rotulo: 'Custo real por lead', valor: fmtMoeda(d.custoLead) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="custoLead" name="Custo por lead" fill="var(--coral)" radius={[4, 4, 0, 0]} maxBarSize={34}>
            <LabelList dataKey="custoLead" position="top" formatter={(v) => (v == null ? '' : fmtMoeda(v))} style={{ fontSize: 10, fill: 'var(--grafite-mid)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Pessoas: mapa de calor (intensidade relativa ao pior da coluna)
// ---------------------------------------------------------------------------

const COLUNAS_PESSOAS = [
  { chave: 'carteira', label: 'Carteira ativa', tipo: 'neutro' },
  { chave: 'semContato', label: 'Sem contato', tipo: 'ruim' },
  { chave: 'abertos30', label: 'Abertos 30+ dias', tipo: 'ruim' },
  { chave: 'vencidas30', label: 'Atividades vencidas (30d)', tipo: 'ruim' },
  { chave: 'pctContato1d', label: 'Contato em até 1 dia', tipo: 'pct' },
  { chave: 'negocios12m', label: 'Negócios (12m)', tipo: 'bom' },
]

export function MapaPessoas({ linhas, selecionado, onSelecionar }) {
  const max = Object.fromEntries(COLUNAS_PESSOAS.map((c) => [c.chave, Math.max(...linhas.map((l) => l[c.chave] ?? 0), 1)]))
  const fundo = (c, v) => {
    if (v == null || v === 0) return undefined
    const t = Math.min(1, v / max[c.chave])
    if (c.tipo === 'ruim') return `color-mix(in srgb, var(--coral) ${Math.round(8 + t * 52)}%, #fff)`
    if (c.tipo === 'bom') return `color-mix(in srgb, var(--success) ${Math.round(6 + t * 34)}%, #fff)`
    return undefined
  }
  return (
    <div className="painel-tabela-wrap">
      <table className="data-table pg-mapa">
        <thead>
          <tr>
            <th>Corretor</th>
            {COLUNAS_PESSOAS.map((c) => (
              <th key={c.chave} className="num">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.corretor}
              className={selecionado === l.corretor ? 'is-selecionado' : undefined}
              onClick={() => onSelecionar(l.corretor)}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelecionar(l.corretor)}
              title="Clique para filtrar o painel por este corretor"
            >
              <td>{l.corretor}</td>
              {COLUNAS_PESSOAS.map((c) => {
                const v = l[c.chave]
                const alertaPct = c.tipo === 'pct' && v != null && l.leads30 >= 5 && v < 30
                return (
                  <td key={c.chave} className={`num ${alertaPct ? 'painel-alerta' : ''}`} style={{ background: fundo(c, v) }}>
                    {c.tipo === 'pct' ? (l.leads30 ? `${fmtPct(v, 0)} (${l.leads30})` : '—') : fmtNum(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saúde dos dados
// ---------------------------------------------------------------------------

const ICONE_STATUS = { bom: '✓', atencao: '!', ruim: '✕' }
const TEXTO_STATUS = { bom: 'em dia', atencao: 'atrasado', ruim: 'parado' }

export function SaudeDados({ fontes }) {
  return (
    <div className="pg-saude">
      {fontes.map((f) => (
        <div key={f.fonte} className={`pg-saude-item pg-saude-item--${f.status}`}>
          <span className="pg-saude-icone" aria-hidden="true">{ICONE_STATUS[f.status]}</span>
          <div>
            <div className="pg-saude-fonte">{f.fonte}</div>
            <div className="pg-saude-texto">
              {TEXTO_STATUS[f.status]} · {f.dias == null ? 'sem dados' : f.dias === 0 ? 'atualizado hoje' : `última informação há ${f.dias} ${f.dias === 1 ? 'dia' : 'dias'}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
