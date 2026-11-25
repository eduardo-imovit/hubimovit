// Peças visuais da Saúde Imovit (Fase 29a S3). Mesmo padrão dos outros painéis:
// stat-card para KPI, recharts com CaixaTooltip, pg-* para o resto.
import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { CaixaTooltip } from './Graficos'
import { CORES, nomeCanal } from '../../lib/painelGestao'
import { CORES_PLATAFORMA } from '../../lib/painelPerformance'
import { fmtMoeda, fmtNum, fmtPct } from '../../lib/paineis'
import { ddmm, FORMATO, referencia, REGUA_DICA, selo } from '../../lib/saudeImovit'

const EIXO = { fontSize: 11, fill: 'var(--grafite-soft)' }
const GRADE = 'var(--champagne)'
const LINHA_ESQ = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }
const v = (n) => Number(n?.valor ?? 0)

/** Texto do hover de um número: detalhe, referência e a régua. */
function dicaDe(n, fmt, detalhe) {
  return [detalhe, referencia(n, fmt), n?.regua ? REGUA_DICA[n.regua] ?? `Régua: ${n.regua}` : null].filter(Boolean).join('\n')
}

/** KPI: rótulo + régua, valor grande, selo do sinal; o resto no hover. */
export function Kpi({ rotulo, n, fmt = FORMATO.num, detalhe, parcialAte }) {
  const s = selo(n)
  return (
    <div className="stat-card" title={dicaDe(n, fmt, detalhe)}>
      <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <span>{rotulo}</span>
        {n?.regua && <span style={{ textTransform: 'none', letterSpacing: 0, cursor: 'help' }}>{n.regua}</span>}
      </div>
      <div className="stat-value">{n ? fmt(n.valor) : '—'}</div>
      <div style={{ ...LINHA_ESQ, marginTop: 'var(--space-2)' }}>
        {s && <span className={`badge ${s.classe}`}>{s.texto}</span>}
        {parcialAte && n?.parcial && <span className="badge badge-info">parcial até {ddmm(parcialAte)}</span>}
      </div>
      {detalhe && <div className="stat-sub is-muted">{detalhe}</div>}
    </div>
  )
}

/** Índice da manchete escura: valor, uma linha de contexto e o selo; referência no hover. */
export function IndiceSaude({ rotulo, n, fmt = FORMATO.num, detalhe, regra }) {
  const s = selo(n)
  return (
    <div className="pg-indice" title={[regra, dicaDe(n, fmt)].filter(Boolean).join('\n')}>
      <div className="pg-indice-rotulo">{rotulo} · {n?.regua}</div>
      <div className="pg-indice-valor">{n ? fmt(n.valor) : '—'}</div>
      {detalhe && <div className="pg-indice-contexto">{detalhe}</div>}
      {s && <span className={`badge ${s.classe}`} style={{ alignSelf: 'flex-start' }}>{s.texto}</span>}
    </div>
  )
}

/** Faixa de KPIs. */
export function Kpis({ children }) {
  return <div className="kpi-grid">{children}</div>
}

/** Degraus da cascata do dinheiro (formato da CascataDinheiro da Performance). */
export function degrausPagos(pt) {
  const inv = v(pt.investimento)
  // pedido do Eduardo (24/11): investimento → leads pagos no CRM → qualificados → visitas
  const passos = [
    ['leads', 'Leads pagos no CRM', v(pt.leads)],
    ['qualificados', 'Qualificados', v(pt.qualificados)],
    ['visitas', 'Visitas', v(pt.visitas)],
    ['negocios', 'Negócios', v(pt.negocios)],
  ]
  return passos.map(([chave, label, n], i) => {
    const anterior = i > 0 ? passos[i - 1][2] : null
    return {
      chave,
      label,
      n,
      anterior,
      taxa: anterior ? (n / anterior) * 100 : null,
      custo: n > 0 && inv > 0 ? inv / n : null, // sem investimento no recorte: '—', não 'R$ 0 cada'
      custoTexto: chave === 'impressoes' ? (n > 0 ? `${fmtMoeda((inv / n) * 1000)} por mil` : '—') : undefined,
    }
  })
}

/** Grupos do funil do período (FunilCascata): leads → qualificados → visitas → propostas → negócios. */
export function gruposFunil(linhas) {
  return linhas.map(({ finalidade, rotulo, l }) => {
    const ns = [v(l.leads), v(l.qualificados), v(l.visitas), v(l.propostas), v(l.negocios)]
    const nomes = ['Leads', 'Qualificados', 'Visitas', 'Propostas', 'Negócios']
    const etapas = ns.map((n, i) => ({ ordem: i + 1, label: nomes[i], n, // evento, não coorte: acima de 100% (mais negócios que propostas no período) não é passagem, fica sem número
      passagem: i > 0 && ns[i - 1] > 0 && n <= ns[i - 1] ? (n / ns[i - 1]) * 100 : null }))
    const gargalo = etapas.slice(1).filter((e, i) => ns[i] >= 5 && e.passagem != null).reduce((m, e) => (m == null || e.passagem < m.passagem ? e : m), null)
    return { chave: finalidade, finalidade, rotulo, etapas, gargalo, conversao: ns[0] > 0 ? (ns[4] / ns[0]) * 100 : null }
  })
}

const alturaBarras = (n) => Math.max(160, n * 38 + 50)
/** Celular: rótulo do eixo mais estreito para sobrar barra. */
const eixoY = (largo, estreito) => (typeof window !== 'undefined' && window.innerWidth < 640 ? estreito : largo)

/** Onde foi o dinheiro: investimento por campanha, cor da plataforma, tooltip com o funil da plataforma. */
export function GraficoCampanhas({ linhas }) {
  const dados = linhas
    .map((l) => ({ nome: l.chave, plataforma: l.pai, investimento: v(l.investimento), l }))
    .filter((d) => d.investimento > 0)
    .sort((a, b) => b.investimento - a.investimento)
  if (!dados.length) return <div className="pg-vazio">Sem campanha paga neste período.</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Onde foi o dinheiro: investimento por campanha</div>
      <ResponsiveContainer width="100%" height={alturaBarras(dados.length)}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRADE} />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(x) => fmtMoeda(x)} />
          <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={eixoY(190, 110)} tickFormatter={(s) => { const max = eixoY(28, 16); return s.length > max ? `${s.slice(0, max - 1)}…` : s }} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <CaixaTooltip
                  titulo={`${d.plataforma} · ${d.nome}`}
                  linhas={[
                    { rotulo: 'Investido', valor: fmtMoeda(d.investimento), cor: CORES_PLATAFORMA[d.plataforma] },
                    { rotulo: 'Impressões', valor: fmtNum(v(d.l.impressoes)) },
                    { rotulo: 'Cliques (CTR)', valor: `${fmtNum(v(d.l.cliques))} (${fmtPct(v(d.l.ctr))})` },
                    { rotulo: 'CPC', valor: fmtMoeda(v(d.l.cpc)) },
                    { rotulo: 'Conversões', valor: fmtNum(v(d.l.conv_plataforma), 1) },
                    { rotulo: 'Custo por conversão', valor: fmtMoeda(d.l.custo_conv_plataforma?.valor == null ? null : v(d.l.custo_conv_plataforma)) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="investimento" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fontSize: 11, fill: 'var(--grafite-mid)', formatter: (x) => fmtMoeda(x) }}>
            {dados.map((d) => (
              <Cell key={`${d.plataforma}|${d.nome}`} fill={CORES_PLATAFORMA[d.plataforma] ?? CORES.contexto} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Canais lado a lado: leads no período × período anterior; tooltip com o resto do funil. */
export function GraficoCanais({ linhas }) {
  const dados = linhas
    .filter((l) => v(l.leads) > 0 || Number(l.leads?.anterior ?? 0) > 0)
    .map((l) => ({ nome: nomeCanal(l.chave), atual: v(l.leads), anterior: Number(l.leads?.anterior ?? 0), l }))
    .sort((a, b) => b.atual - a.atual)
  if (!dados.length) return <div className="pg-vazio">Nenhum lead neste período.</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Leads por canal: período × anterior</div>
      <ResponsiveContainer width="100%" height={alturaBarras(dados.length) + 20}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke={GRADE} />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={eixoY(110, 84)} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              const l = d.l
              return (
                <CaixaTooltip
                  titulo={d.nome}
                  linhas={[
                    { rotulo: 'Leads', valor: `${fmtNum(d.atual)} (ant ${fmtNum(d.anterior)})`, cor: 'var(--coral)' },
                    { rotulo: 'Qualificados', valor: `${fmtNum(v(l.qualificados))} · ${fmtPct(v(l.pct_qualificados))}` },
                    { rotulo: 'Visitas', valor: fmtNum(v(l.visitas)) },
                    { rotulo: 'Propostas', valor: fmtNum(v(l.propostas)) },
                    { rotulo: 'Descartados', valor: fmtNum(v(l.descartados)) },
                    { rotulo: 'Negócios', valor: fmtNum(v(l.negocios)) },
                  ]}
                />
              )
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="atual" name="Período" fill="var(--coral)" radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: 'right', fontSize: 11, fill: 'var(--grafite-mid)' }} />
          <Bar dataKey="anterior" name="Anterior" fill={CORES.contexto} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Funil agora: por etapa, em dia × parados acima do prazo; o gargalo em vermelho. */
export function GraficoFunilAgora({ funil, gargalo }) {
  if (!funil?.length) return <div className="pg-vazio">Sem atendimentos em aberto.</div>
  const dados = funil.map((f) => ({ ...f, emDia: Math.max(0, f.ativos - f.parados), gargalo: gargalo?.etapa === f.etapa }))
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Funil agora: em dia × parados acima do prazo</div>
      <ResponsiveContainer width="100%" height={alturaBarras(dados.length) + 20}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRADE} />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="etapa" tick={EIXO} axisLine={false} tickLine={false} width={eixoY(120, 96)} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <CaixaTooltip
                  titulo={`${d.etapa}${d.gargalo ? ' · gargalo' : ''}`}
                  linhas={[
                    { rotulo: 'Em aberto', valor: fmtNum(d.ativos) },
                    { rotulo: 'Parados acima do prazo', valor: fmtNum(d.parados), cor: d.gargalo ? 'var(--danger)' : 'var(--coral)' },
                    { rotulo: 'Prazo (mediana)', valor: `${fmtNum(Number(d.mediana), 1)} dias` },
                  ]}
                />
              )
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="emDia" name="Em dia" stackId="a" fill={CORES.contexto} maxBarSize={22} />
          <Bar dataKey="parados" name="Parados" stackId="a" fill="var(--coral)" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {dados.map((d) => (
              <Cell key={d.etapa} fill={d.gargalo ? 'var(--danger)' : 'var(--coral)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Atendimentos em aberto por canal: recentes × abertos há mais de 30 dias. */
export function GraficoAtivosCanal({ linhas }) {
  if (!linhas?.length) return <div className="pg-vazio">Sem atendimentos em aberto.</div>
  const dados = linhas.map((l) => ({ nome: nomeCanal(l.canal), recentes: Math.max(0, l.ativos - l.abertos_mais_30d), velhos: l.abertos_mais_30d, ativos: l.ativos }))
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Em aberto por canal: até 30 dias × mais de 30 dias</div>
      <ResponsiveContainer width="100%" height={alturaBarras(dados.length) + 20}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRADE} />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={eixoY(110, 84)} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <CaixaTooltip
                  titulo={payload[0].payload.nome}
                  linhas={[
                    { rotulo: 'Em aberto', valor: fmtNum(payload[0].payload.ativos) },
                    { rotulo: 'Há mais de 30 dias', valor: fmtNum(payload[0].payload.velhos), cor: 'var(--warning)' },
                  ]}
                />
              ) : null
            }
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="recentes" name="Até 30 dias" stackId="a" fill={CORES.contexto} maxBarSize={18} />
          <Bar dataKey="velhos" name="Mais de 30 dias" stackId="a" fill="var(--warning)" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comercial v2 (pedido do Eduardo, 24/11): funil em forma de funil, clicável,
// e pizzas por canal/descarte que seguem a etapa escolhida.
// ---------------------------------------------------------------------------

/** Etapas do funil do período (evento) e o campo de cada uma na linha do banco. */
export const ETAPAS_SAUDE = [
  { chave: 'leads', label: 'Leads' },
  { chave: 'qualificados', label: 'Qualificados' },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'propostas', label: 'Propostas' },
  { chave: 'negocios', label: 'Negócios' },
]

/** Paleta categórica só com tokens do Hub (fatias de pizza). */
export const PALETA = [
  'var(--coral)',
  'var(--investidores)',
  'var(--ninho-cheio)',
  'var(--ninho-vazio)',
  'var(--casais)',
  'var(--info)',
  'var(--solteiros)',
  'var(--grafite-fade)',
]

/** Pizza (rosca) com legenda; hover com valor e parte do total. */
export function Pizza({ titulo, fatias, vazio = 'Nada neste recorte.', onFatia, selecionada }) {
  const dados = fatias.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor)
  const total = dados.reduce((s, f) => s + f.valor, 0)
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">{titulo} · {fmtNum(total)}</div>
      {total === 0 ? (
        <div className="pg-vazio">{vazio}</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="52%" outerRadius="82%" paddingAngle={1} stroke="var(--branco)" isAnimationActive={false} onClick={(d) => onFatia?.(d?.payload ?? d)} style={onFatia ? { cursor: 'pointer' } : undefined}>
              {dados.map((f, i) => (
                <Cell key={f.nome} fill={PALETA[i % PALETA.length]} fillOpacity={selecionada && selecionada !== f.nome ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <CaixaTooltip
                    titulo={payload[0].name}
                    linhas={[{ rotulo: 'Volume', valor: `${fmtNum(payload[0].value)} · ${fmtPct((payload[0].value / total) * 100, 0)}`, cor: payload[0].payload.fill }]}
                  />
                ) : null
              }
            />
            <Legend iconType="circle" iconSize={8} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bolhas por mídia paga (pedido do Eduardo, 24/11): leads × resultado escolhido.
// ---------------------------------------------------------------------------

const RESULTADOS = [
  { chave: 'qualificados', label: 'Qualificados' },
  { chave: 'pct_qualificados', label: '% qualif.', pct: true },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'propostas', label: 'Propostas' },
  { chave: 'descartados', label: 'Descartados' },
  { chave: 'negocios', label: 'Negócios' },
]

/** Cada mídia é uma bolha: x = leads, y = resultado escolhido, tamanho = leads. Hover com tudo. */
export function BolhasMidia({ linhas, titulo = 'Resultado no CRM por mídia paga' }) {
  const [res, setRes] = useState('qualificados')
  const r = RESULTADOS.find((x) => x.chave === res)
  const dados = linhas
    .map((l, i) => ({ nome: l.chave, leads: v(l.leads), y: v(l[res]), l, cor: PALETA[i % PALETA.length] }))
    .filter((d) => d.leads > 0 || d.y > 0)
  return (
    <div className="pg-grafico">
      <div className="pg-titulo-com-acao" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="pg-grafico-titulo" style={{ marginBottom: 0 }}>{titulo}: leads × {r.label.toLowerCase()} (tamanho = leads)</div>
        <div className="pg-segmentado" role="radiogroup" aria-label="Resultado no eixo vertical">
          {RESULTADOS.map((x) => (
            <button key={x.chave} type="button" role="radio" aria-checked={res === x.chave} className={res === x.chave ? 'is-ativo' : undefined} onClick={() => setRes(x.chave)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {dados.length === 0 ? (
        <div className="pg-vazio">Nenhum lead pago neste período.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
            <CartesianGrid stroke={GRADE} />
            <XAxis type="number" dataKey="leads" name="Leads" domain={[0, (max) => Math.ceil(max * 1.35) || 1]} tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Leads', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: 'var(--grafite-soft)' }} />
            <YAxis type="number" dataKey="y" name={r.label} domain={[0, (max) => (r.pct ? 100 : Math.ceil(max * 1.2) || 1)]} tick={EIXO} axisLine={false} tickLine={false} allowDecimals={!!r.pct} width={44} tickFormatter={(x) => (r.pct ? `${Math.round(x)}%` : fmtNum(x))} />
            <ZAxis type="number" dataKey="leads" range={[80, 900]} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const l = d.l
                const ant = (n) => ` (ant ${fmtNum(Number(n?.anterior ?? 0))})`
                return (
                  <CaixaTooltip
                    titulo={d.nome}
                    linhas={[
                      { rotulo: 'Leads', valor: fmtNum(v(l.leads)) + ant(l.leads), cor: d.cor },
                      { rotulo: 'Qualificados', valor: `${fmtNum(v(l.qualificados))} · ${fmtPct(v(l.pct_qualificados))}` },
                      { rotulo: 'Visitas', valor: fmtNum(v(l.visitas)) + ant(l.visitas) },
                      { rotulo: 'Propostas', valor: fmtNum(v(l.propostas)) + ant(l.propostas) },
                      { rotulo: 'Descartados', valor: fmtNum(v(l.descartados)) + ant(l.descartados) },
                      { rotulo: 'Negócios', valor: fmtNum(v(l.negocios)) + ant(l.negocios) },
                    ]}
                  />
                )
              }}
            />
            {dados.map((d) => (
              <Scatter key={d.nome} name={d.nome} data={[d]} fill={d.cor} fillOpacity={0.85} stroke="var(--branco)" strokeWidth={2}>
                <LabelList dataKey="nome" position="right" style={{ fontSize: 11, fill: 'var(--grafite-mid)' }} />
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ações de conversão (Meta + Google) × leads pagos no CRM, por dia (pedido do Eduardo, 24/11).
// ---------------------------------------------------------------------------

/** Agrupa por semana quando o período passa de 60 dias (linha diária vira ruído). */
function agrupar(serie) {
  if (serie.length <= 60) return serie.map((d) => ({ ...d, rotulo: ddmm(d.dia) }))
  const semanas = []
  serie.forEach((d, i) => {
    if (i % 7 === 0) semanas.push({ rotulo: ddmm(d.dia), meta: 0, google: 0, crm: 0, plataformas: 0, investimento: 0 })
    const s = semanas[semanas.length - 1]
    for (const k of ['meta', 'google', 'crm', 'plataformas', 'investimento']) s[k] += d[k]
  })
  return semanas
}

export function GraficoConversoes({ serie, erro }) {
  if (erro) return <div className="pg-vazio">Não deu para ler a série diária: {erro}</div>
  if (!serie) return <div className="pg-vazio">Carregando a série diária…</div>
  const dados = agrupar(serie)
  const tot = serie.reduce((s, d) => ({ p: s.p + d.plataformas, c: s.c + d.crm }), { p: 0, c: 0 })
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">
        Ações de conversão (Meta + Google) × leads pagos no CRM {serie.length > 60 ? 'por semana' : 'por dia'} · {fmtNum(tot.p, 1)} × {fmtNum(tot.c)}
        {tot.p > 0 && ` (${fmtPct((tot.c / tot.p) * 100, 0)} chegam ao CRM)`}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dados} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CaixaTooltip
                  titulo={label}
                  linhas={[
                    { rotulo: 'Meta (conversões)', valor: fmtNum(payload[0].payload.meta, 1), cor: CORES_PLATAFORMA.Meta },
                    { rotulo: 'Google (conversões)', valor: fmtNum(payload[0].payload.google, 1), cor: CORES_PLATAFORMA.Google },
                    { rotulo: 'Leads pagos no CRM', valor: fmtNum(payload[0].payload.crm), cor: 'var(--coral)' },
                    { rotulo: 'Investido', valor: fmtMoeda(payload[0].payload.investimento) },
                  ]}
                />
              ) : null
            }
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="meta" name="Meta (conversões)" stroke={CORES_PLATAFORMA.Meta} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="google" name="Google (conversões)" stroke={CORES_PLATAFORMA.Google} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="crm" name="Leads pagos no CRM" stroke="var(--coral)" strokeWidth={2.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mídias sociais (29e, 24/11): série diária do orgânico, pronta no banco (saude_midias_sociais).
// Dia sem captura chega como null e vira buraco na linha (não é zero).
// ---------------------------------------------------------------------------

/** Duas escalas, dois gráficos (regra dos painéis: nunca eixo duplo). */
export const LINHAS_ORGANICO = {
  vistas: [
    { chave: 'alcance', nome: 'Alcance', cor: 'var(--coral)' },
    { chave: 'visualizacoes', nome: 'Visualizações', cor: 'var(--investidores)' },
  ],
  acoes: [
    { chave: 'interacoes', nome: 'Interações', cor: 'var(--coral)' },
    { chave: 'visitas_perfil', nome: 'Visitas ao perfil', cor: 'var(--investidores)' },
    { chave: 'cliques_site', nome: 'Cliques no site', cor: 'var(--ninho-cheio)' },
    { chave: 'seguidores_novos', nome: 'Seguidores novos', cor: 'var(--info)' },
  ],
}

export function GraficoOrganico({ serie, titulo, linhas }) {
  if (!serie?.length) return <div className="pg-vazio">Nenhum dia neste período.</div>
  const dados = serie.map((d) => ({ ...d, rotulo: ddmm(d.data) }))
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">{titulo}</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={dados} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CaixaTooltip
                  titulo={label}
                  linhas={
                    payload[0].payload.redes > 0
                      ? linhas.map((l) => ({ rotulo: l.nome, valor: fmtNum(payload[0].payload[l.chave]), cor: l.cor }))
                      : [{ rotulo: 'Sem captura neste dia', valor: '—' }]
                  }
                />
              ) : null
            }
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {linhas.map((l, i) => (
            <Line key={l.chave} type="monotone" dataKey={l.chave} name={l.nome} stroke={l.cor} strokeWidth={i === 0 ? 2.5 : 1.5} dot={{ r: 3 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gauge do tempo de resposta (Eduardo, 24/11): meta 5 min locação, 30 min venda.
// ---------------------------------------------------------------------------

const fmtMin = (m) => (m == null ? '—' : m < 60 ? `${fmtNum(m, m < 10 ? 1 : 0)} min` : m < 1440 ? `${fmtNum(m / 60, 1)} h` : `${fmtNum(m / 1440, 1)} dias`)

/** Meia-lua: ponteiro = mediana; escala até 2× a meta; verde até a meta, amarelo até 2×, vermelho acima. */
function Gauge({ g }) {
  const escala = g.meta * 2
  const valor = g.mediana == null ? 0 : Math.min(g.mediana, escala)
  const cor = g.mediana == null ? CORES.contexto : g.mediana <= g.meta ? 'var(--success)' : g.mediana <= escala ? 'var(--warning)' : 'var(--danger)'
  const semRegistro = g.sem_registro ?? g.leads - g.com_registro
  const rotulo = g.finalidade === 'Aluguel' ? 'Locação' : 'Venda'
  return (
    <div className="stat-card" style={{ textAlign: 'center' }} title={`Mediana entre a entrada do lead pago e a 1ª resposta registrada pelo Imoview. Meta ${g.meta} min. ${g.com_registro} de ${g.leads} leads com 1ª resposta.`}>
      <div className="stat-label">{rotulo} · meta {g.meta} min</div>
      <div style={{ position: 'relative', height: 120 }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={[{ v: valor }, { v: escala - valor }]}
              dataKey="v"
              startAngle={180}
              endAngle={0}
              cy={110}
              innerRadius={62}
              outerRadius={86}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={cor} />
              <Cell fill="var(--champagne)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 4 }}>
          <div className="stat-value" style={{ marginTop: 0 }}>{fmtMin(g.mediana)}</div>
        </div>
      </div>
      <div style={{ ...LINHA_ESQ, justifyContent: 'center', marginTop: 'var(--space-2)' }}>
        {g.com_registro > 0 && (
          <span className={`badge ${g.dentro_meta / g.com_registro >= 0.8 ? 'badge-success' : g.dentro_meta / g.com_registro >= 0.5 ? 'badge-warning' : 'badge-danger'}`}>
            {fmtPct((g.dentro_meta / g.com_registro) * 100, 0)} dentro da meta
          </span>
        )}
        {semRegistro > 0 && <span className="badge badge-gray">{fmtNum(semRegistro)} de {fmtNum(g.leads)} sem registro</span>}
        {g.leads === 0 && <span className="badge badge-gray">sem leads pagos no período</span>}
      </div>
    </div>
  )
}

export function GaugesResposta({ dados, erro }) {
  if (erro) return <div className="pg-vazio">Não deu para calcular o tempo de resposta: {erro}</div>
  if (!dados) return <div className="pg-vazio">Calculando o tempo de resposta…</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Tempo de resposta dos leads pagos (entrada → 1ª resposta no Imoview) · sempre venda e locação</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
        {dados.map((g) => (
          <Gauge key={g.finalidade} g={g} />
        ))}
      </div>
      <p className="pg-nota" style={{ marginTop: 'var(--space-2)' }}>
        Usa a hora da 1ª resposta que o próprio Imoview grava no atendimento. Lead sem 1ª resposta fica fora da mediana e aparece como “sem registro”.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escada paga clicável (Eduardo, 24/11): ocupa a largura toda e cada degrau abre quem está nele.
// ---------------------------------------------------------------------------

const CLICAVEIS = ['leads', 'qualificados', 'visitas']

export function EscadaPagos({ investimento, degraus, selecionado, onSelecionar }) {
  const grade = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }
  return (
    <div style={grade}>
      <div className="pp-degrau pp-degrau--inicio">
        <div className="pp-degrau-label">Investimento</div>
        <div className="pp-degrau-n">{fmtMoeda(investimento)}</div>
      </div>
      {degraus.map((d) => {
        const clicavel = CLICAVEIS.includes(d.chave) && d.n > 0
        const ativo = selecionado === d.chave
        const conteudo = (
          <>
            {d.taxa != null && (
              <div className="pp-degrau-taxa">
                <span aria-hidden="true">→</span> {fmtPct(d.taxa, 0)}
              </div>
            )}
            <div className="pp-degrau-label">{d.label}</div>
            <div className="pp-degrau-n">{fmtNum(d.n)}</div>
            <div className="pp-degrau-custo">{d.custo == null ? '—' : `${fmtMoeda(d.custo)} cada`}</div>
            {clicavel && <span className="badge badge-coral">{ativo ? 'fechar lista' : 'ver quem são'}</span>}
          </>
        )
        return clicavel ? (
          <button
            key={d.chave}
            type="button"
            className="pp-degrau pp-degrau--crm"
            aria-pressed={ativo}
            onClick={() => onSelecionar(ativo ? null : d.chave)}
            style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', boxShadow: ativo ? 'inset 0 0 0 2px var(--coral)' : undefined }}
          >
            {conteudo}
          </button>
        ) : (
          <div key={d.chave} className="pp-degrau pp-degrau--crm">
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Funil em colunas (modelo "Funil de vendas" do Eduardo, 24/11), com os tokens do Hub:
// colunas com topo em onda descendo para a próxima etapa, pílula com ícone e nome,
// hover levanta a coluna e mostra o detalhe; clique filtra as pizzas.
// ---------------------------------------------------------------------------

const ICONES_ETAPA = {
  leads: 'M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M19 8v6 M16 11h6',
  qualificados: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  visitas: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  propostas: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
  negocios: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.5l3 3 5-6',
}
/** Ícones genéricos para as fases do Kanban (funil agora). */
const ICONES_FASE = [
  'M12 8v4l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  'M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
]
const PERGUNTA_ETAPA = {
  leads: 'Quantos contatos o período trouxe?',
  qualificados: 'Quem combina com o que vendemos?',
  visitas: 'Quem foi ver o imóvel?',
  propostas: 'Quantas visitas viram proposta?',
  negocios: 'Quantas propostas viram contrato?',
}

export function FunilColunas({ linha, itens, titulo, etapa, onEtapa, cor = 'var(--coral)', dicaClique = 'Clique para filtrar as pizzas', vazioSemFoco }) {
  const [hover, setHover] = useState(null)
  const uid = useId().replace(/:/g, '')
  if (!linha && !itens) return <div className="pg-vazio">Sem dados neste recorte.</div>
  // `itens` = etapas quaisquer [{ chave, label, n, detalhe, pergunta }]; sem ele, as 5 etapas do período
  const dados = itens
    ? itens.map((it, i) => ({ ...it, i, anterior: null, passagem: null }))
    : ETAPAS_SAUDE.map((e, i) => {
        const n = v(linha[e.chave])
        const antes = i > 0 ? v(linha[ETAPAS_SAUDE[i - 1].chave]) : null
        return { ...e, i, n, anterior: Number(linha[e.chave]?.anterior ?? 0), passagem: antes ? (n / antes) * 100 : null }
      })
  const max = Math.max(...dados.map((d) => d.n), 1)
  const W = 170
  const H = 300
  const R = 18
  // altura da borda pelo volume; mínimo de 70 para caber a pílula
  const alt = (n) => 70 + (n / max) * (H - 90)
  const caminho = (i) => {
    const y0 = H - alt(dados[i].n)
    const y1 = H - (i + 1 < dados.length ? alt(dados[i + 1].n) : alt(dados[i].n) * 0.85)
    const ym = (y0 + y1) / 2
    return `M0 ${y0} C ${W * 0.22} ${y0 - 20} ${W * 0.38} ${y0 + 4} ${W * 0.55} ${ym - 4} S ${W * 0.85} ${y1 - 14} ${W} ${y1} L ${W} ${H - R} Q ${W} ${H} ${W - R} ${H} L ${R} ${H} Q 0 ${H} 0 ${H - R} Z`
  }
  const idxEtapa = etapa ? dados.findIndex((d) => d.chave === etapa) : -1
  const foco = hover ?? (idxEtapa >= 0 ? idxEtapa : null)
  const det = foco != null ? dados[foco] : null
  return (
    <div className="pg-grafico">
      {titulo && <div className="pg-grafico-titulo">{titulo}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }} role="list" aria-label="Funil por etapa: clique para filtrar as pizzas">
        {dados.map((d) => {
          const ativo = foco === d.i
          const esmaecido = foco != null && !ativo
          return (
            <div
              key={d.chave}
              role="listitem"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                transition: 'opacity .25s ease, transform .25s ease',
                opacity: esmaecido ? 0.4 : 1,
                transform: ativo ? 'translateY(-10px)' : 'none',
              }}
            >
              <button
                type="button"
                aria-pressed={etapa === d.chave}
                aria-label={`${d.label}: ${fmtNum(d.n)}. Clique para filtrar as pizzas.`}
                onMouseEnter={() => setHover(d.i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.i)}
                onBlur={() => setHover(null)}
                onClick={() => onEtapa?.(etapa === d.chave ? null : d.chave)}
                style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'block' }}
              >
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
                  <defs>
                    <linearGradient id={`fc-${uid}-${d.i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" style={{ stopColor: cor, stopOpacity: 0.45 + d.i * 0.13 }} />
                      <stop offset="1" style={{ stopColor: 'var(--coral-soft)', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  <path d={caminho(d.i)} fill={`url(#fc-${uid}-${d.i})`} />
                </svg>
                <span
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px 4px 4px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--branco)',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', background: 'var(--coral-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--grafite)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={ICONES_ETAPA[d.chave] ?? ICONES_FASE[d.i % ICONES_FASE.length]} />
                    </svg>
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--grafite)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                </span>
              </button>
              <span style={{ paddingLeft: 8, fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'var(--text-2xl)', lineHeight: 1, color: 'var(--grafite)' }}>{fmtNum(d.n)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ minHeight: 72, marginTop: 'var(--space-4)' }} aria-live="polite">
        {det ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, minWidth: 160, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'var(--text-xl)' }}>{det.label}</h3>
            <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 'var(--text-base)' }}>
                {det.detalhe ?? (
                  <>
                    <strong>{fmtNum(det.n)}</strong> no período · anterior {fmtNum(det.anterior)}
                  </>
                )}
                {det.passagem != null && det.passagem <= 100 ? ` · ${fmtPct(det.passagem, 0)} da etapa anterior` : ''}
              </span>
              <span style={{ color: 'var(--coral-dark)' }}>{det.pergunta ?? PERGUNTA_ETAPA[det.chave]}</span>
            </div>
            <span className="pg-mesa-texto" style={{ marginTop: 0 }}>{etapa === det.chave ? 'Selecionado · clique de novo para tirar' : dicaClique}</span>
          </div>
        ) : (
          <span className="pg-mesa-texto">{vazioSemFoco ?? 'Passe o mouse numa coluna para ver o volume de cada etapa; clique para filtrar as pizzas.'}</span>
        )}
      </div>
    </div>
  )
}
