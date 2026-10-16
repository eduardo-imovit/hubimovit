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
import { CORES, CORES_ETAPA, FUNIS, LABEL_FINALIDADE, simularGanho } from '../../lib/painelGestao'
import { fmtMoeda, fmtNum, fmtPct } from '../../lib/paineis'
import { fmtMoedaCurta } from '../../lib/admLocacao'

const EIXO = { fontSize: 11, fill: 'var(--grafite-soft)' }
const GRADE = 'var(--champagne)'

export function CaixaTooltip({ titulo, linhas }) {
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
          <div key={g.chave ?? g.finalidade} className="pg-funil">
            <div className="pg-funil-titulo">
              <span className={`pg-ponto pg-ponto--${g.finalidade}`} style={g.cor ? { background: g.cor } : undefined} aria-hidden="true" />
              {g.rotulo ?? LABEL_FINALIDADE[g.finalidade]}
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
                        style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: g.cor ?? CORES[g.finalidade], opacity: gargalo ? 1 : 0.78 }}
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
// v2 (PRD §5.0c): funil em linha, onde perdemos (comparado), atividades
// ---------------------------------------------------------------------------

/** Uma linha por funil (inbound, outbound) com as etapas em cores e a legenda com os valores ao lado. */
export function FunilLinhas({ grupos }) {
  const maior = Math.max(...grupos.map((g) => g.total), 1)
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Leads que entraram no período, pela etapa mais avançada que alcançaram</div>
      {grupos.map((g) => (
        <div key={g.chave} className="pg-funil-linha2">
          <div className="pg-funil-linha2-nome">
            <strong>{g.rotulo}</strong>
            <span>{fmtNum(g.total)}</span>
          </div>
          <div className="pg-funil-linha2-corpo">
            <div className="pg-funil-linha2-trilho" style={{ width: `${Math.max(4, (g.total / maior) * 100)}%` }}>
              {g.alcancadas.map((e) =>
                e.n > 0 ? (
                  <div key={e.label} className="pg-funil-linha2-seg" style={{ flexGrow: e.n, background: CORES_ETAPA[e.label] }} title={`${e.label}: ${e.n}`} />
                ) : null
              )}
            </div>
            {g.total > 0 && (
              <div className="pg-funil-linha2-conv">
                Conversão:{' '}
                {g.etapas.slice(1).map((e, j) => (
                  <span key={e.ordem} className={g.gargalo?.ordem === e.ordem ? 'is-gargalo' : undefined}>
                    {g.etapas[j].label} → {e.label} {fmtPct(e.passagem, 0)}
                    {e.delta != null && Math.abs(e.delta) >= 1 && ` (${e.delta > 0 ? '+' : ''}${Math.round(e.delta)} p.p.)`}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ul className="pg-funil-linha2-legenda">
            {g.alcancadas.map((e) => (
              <li key={e.label}>
                <span className="pg-ponto" style={{ background: CORES_ETAPA[e.label] }} aria-hidden="true" />
                {e.label}
                <strong>{fmtNum(e.n)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

const fmtTaxa = (p) => (p == null || p.taxa == null ? '—' : fmtPct(p.taxa, 0))

/** Passagens do funil do recorte contra a referência (equipe ou semestre anterior) e, para a Gestão, outro corretor. */
export function PerdaComparada({ perda, rotuloSel, comparar, opcoesComparar, onComparar }) {
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo pg-titulo-com-acao">
        <span>Quanto avança em cada passagem</span>
        {onComparar && (
          <label className="pg-campo pg-campo--inline">
            <span>Comparar com</span>
            <select value={comparar} onChange={(e) => onComparar(e.target.value)}>
              <option value="nenhum">Ninguém</option>
              {opcoesComparar.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="pg-tabela-rolagem">
        <table className="data-table pg-tabela-compacta">
          <thead>
            <tr>
              <th>Passagem</th>
              <th className="num">{rotuloSel}</th>
              <th className="num">{perda.rotuloRef}</th>
              {comparar !== 'nenhum' && <th className="num">{comparar}</th>}
              <th className="num">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {perda.linhas.map((p) => (
              <tr key={p.ordem} className={perda.pior?.ordem === p.ordem ? 'is-pior' : undefined}>
                <td>
                  {p.de} → {p.para}
                  {perda.pior?.ordem === p.ordem && <span className="badge badge-danger pg-funil-badge">maior perda</span>}
                </td>
                <td className="num">
                  {fmtTaxa(p)}
                  <div className="is-muted pg-sub">{fmtNum(p.passaram)} de {fmtNum(p.n)}</div>
                </td>
                <td className="num">{p.ref == null ? '—' : fmtPct(p.ref, 0)}</td>
                {comparar !== 'nenhum' && (
                  <td className="num">
                    {fmtTaxa(p.comp)}
                    {p.comp && <div className="is-muted pg-sub">{fmtNum(p.comp.passaram)} de {fmtNum(p.comp.n)}</div>}
                  </td>
                )}
                <td className="num">
                  {p.dif == null ? (
                    <span className="is-muted">amostra pequena</span>
                  ) : (
                    <span className={p.dif <= -5 ? 'pg-delta-ruim' : p.dif >= 5 ? 'pg-delta-bom' : undefined}>
                      {p.dif > 0 ? '+' : ''}{fmtNum(p.dif, 0)} p.p.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Barras por tipo de atividade, com a média da equipe marcada. */
function TiposAtividade({ tipos, rotuloN, rotuloMedia }) {
  const max = Math.max(...tipos.map((t) => Math.max(t.n, t.media)), 1)
  if (!tipos.length) return <p className="pg-nota">Nenhuma atividade realizada no período.</p>
  return (
    <div className="pg-hbarras">
      {tipos.map((t) => (
        <div key={t.tipo} className="pg-tipo-ativ">
          <span className="pg-hbarra-rotulo">{t.tipo}</span>
          <div className="pg-funil-trilho pg-atividade-trilho">
            <div className="pg-funil-barra" style={{ width: `${Math.max(1, (t.n / max) * 100)}%`, background: CORES.contexto }} />
            {rotuloMedia && <div className="pg-atividade-media" style={{ left: `${(t.media / max) * 100}%` }} aria-hidden="true" />}
          </div>
          <span className="pg-funil-n">
            {fmtNum(t.n)}
            {rotuloMedia && <span className="is-muted"> · {rotuloMedia} {fmtNum(t.media, t.media < 10 ? 1 : 0)}</span>}
          </span>
        </div>
      ))}
      <div className="pg-nota">{rotuloN}</div>
    </div>
  )
}

/** Atividades: volume e variedade contra a média da equipe. Com corretor filtrado, só ele (sem colegas nomeados). */
export function AtividadesPainel({ dados, selecionado, onSelecionar }) {
  if (dados.modo === 'corretor') {
    return (
      <div className="pg-duas">
        <div className="pg-grafico">
          <div className="pg-grafico-titulo">Total de atividades</div>
          <div className="pg-ativ-resumo">
            <div>
              <div className="pg-ativ-numero">{fmtNum(dados.total)}</div>
              <div className="pg-ativ-contexto">
                {dados.media == null ? 'sem equipe no cadastro de colaboradores' : `média da equipe de ${dados.equipe.toLowerCase()}: ${fmtNum(dados.media, 0)}`}
              </div>
              {dados.selo && <span className={`badge ${dados.selo.badge}`}>{dados.selo.label}</span>}
            </div>
            <div>
              <div className="pg-ativ-numero">{fmtNum(dados.variedade)}</div>
              <div className="pg-ativ-contexto">tipos de atividade (a equipe usou {fmtNum(dados.variedadeEquipe)})</div>
            </div>
            <div>
              <div className="pg-ativ-numero">{fmtNum(dados.anterior)}</div>
              <div className="pg-ativ-contexto">no período anterior</div>
            </div>
          </div>
        </div>
        <div className="pg-grafico">
          <div className="pg-grafico-titulo">Por tipo de atividade</div>
          <TiposAtividade tipos={dados.tipos} rotuloMedia="média da equipe" rotuloN="A linha escura é a média de um corretor da equipe naquele tipo." />
        </div>
      </div>
    )
  }
  return (
    <div className={`pg-duas ${dados.grupos.length === 1 ? 'pg-duas--uma' : ''}`}>
      {dados.grupos.map((g) => {
        const max = Math.max(...g.linhas.map((l) => l.n), g.media, 1)
        return (
          <div key={g.equipe} className="pg-grafico">
            <div className="pg-grafico-titulo">
              Equipe de {g.label.toLowerCase()}{' '}
              <span className="pg-grafico-ref">
                · {fmtNum(g.total)} atividades · média {fmtNum(g.media, 0)} por corretor · {fmtNum(g.tipos.length)} tipos
              </span>
            </div>
            <TiposAtividade tipos={g.tipos} rotuloMedia="por corretor" rotuloN="Total da equipe por tipo; a linha escura é a média por corretor." />
            <div className="pg-subtitulo">Por corretor</div>
            <div className="pg-hbarras">
              {g.linhas.map((l) => (
                <button
                  key={l.corretor}
                  type="button"
                  className={`pg-atividade ${selecionado === l.corretor ? 'is-selecionado' : ''}`}
                  onClick={() => onSelecionar(l.corretor)}
                  title={`${l.variedade} tipos · período anterior: ${l.anterior}`}
                >
                  <span className="pg-hbarra-rotulo">{l.corretor}</span>
                  <div className="pg-funil-trilho pg-atividade-trilho">
                    <div className="pg-funil-barra" style={{ width: `${Math.max(1, (l.n / max) * 100)}%`, background: l.selo?.chave === 'abaixo' ? 'var(--danger)' : CORES.contexto }} />
                    <div className="pg-atividade-media" style={{ left: `${(g.media / max) * 100}%` }} aria-hidden="true" />
                  </div>
                  <span className="pg-funil-n">{fmtNum(l.n)}</span>
                  {l.selo && <span className={`badge ${l.selo.badge}`}>{l.selo.label}</span>}
                </button>
              ))}
            </div>
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

// ---------------------------------------------------------------------------
// 4. Carteira de imóveis por captador (atualizados × desatualizados)
// ---------------------------------------------------------------------------

const seloCarteira = (p) => (p == null ? null : p >= 80 ? 'badge-success' : p >= 50 ? 'badge-warning' : 'badge-danger')

/** Valor desatualizado da linha: venda em R$, locação em R$/mês (nunca somados). Em "todas", a venda manda. */
function valorDesatLinha(l, finalidade) {
  if (finalidade === 'Aluguel' || (finalidade === 'todas' && !l.valorDesat.Venda && l.valorDesat.Aluguel)) {
    return l.valorDesat.Aluguel ? `${fmtMoedaCurta(l.valorDesat.Aluguel)}/mês` : '—'
  }
  return l.valorDesat.Venda ? fmtMoedaCurta(l.valorDesat.Venda) : '—'
}

function tituloValores(l) {
  const partes = []
  if (l.valor.Venda) partes.push(`venda: ${fmtMoedaCurta(l.valorDesat.Venda)} desatualizados de ${fmtMoedaCurta(l.valor.Venda)}`)
  if (l.valor.Aluguel) partes.push(`locação: ${fmtMoedaCurta(l.valorDesat.Aluguel)}/mês desatualizados de ${fmtMoedaCurta(l.valor.Aluguel)}/mês`)
  return partes.length ? ` · ${partes.join(' · ')}` : ''
}

function LinhaCarteira({ l, max, finalidade, selecionado, onSelecionar, rotulo }) {
  const conteudo = (
    <>
      <span className="pg-hbarra-rotulo">{rotulo ?? l.captador}</span>
      <div className="pg-funil-trilho">
        <div className="pg-carteira-barra" style={{ width: `${Math.max(1, (l.n / max) * 100)}%` }}>
          {l.atualizados > 0 && <div style={{ flex: l.atualizados, background: 'var(--success)' }} />}
          {l.desatualizados > 0 && <div style={{ flex: l.desatualizados, background: 'var(--danger)' }} />}
        </div>
      </div>
      <span className="pg-funil-n">{fmtNum(l.n)}</span>
      <span className="pg-carteira-valor">{valorDesatLinha(l, finalidade)}</span>
      <span className={`badge ${seloCarteira(l.pctAtualizado) ?? ''}`}>{l.pctAtualizado == null ? '—' : `${fmtPct(l.pctAtualizado, 0)} atualizados`}</span>
    </>
  )
  const titulo = `${fmtNum(l.atualizados)} atualizados · ${fmtNum(l.desatualizados)} desatualizados${tituloValores(l)}`
  if (!onSelecionar) return <div className="pg-atividade pg-carteira pg-carteira-linha" title={titulo}>{conteudo}</div>
  return (
    <button type="button" className={`pg-atividade pg-carteira ${selecionado ? 'is-selecionado' : ''}`} onClick={onSelecionar} title={titulo}>
      {conteudo}
    </button>
  )
}

export function CarteiraCaptadores({ dados, finalidade, selecionado, podeSelecionar, onSelecionar }) {
  const max = Math.max(...dados.linhas.map((l) => l.n), dados.semCaptador.n, 1)
  const mostraVenda = finalidade !== 'Aluguel' && dados.valor.Venda > 0
  const mostraAluguel = finalidade !== 'Venda' && dados.valor.Aluguel > 0
  return (
    <div className="pg-grafico">
      <div className="pg-ativ-resumo pg-carteira-resumo">
        <div>
          <div className="pg-ativ-numero">{fmtNum(dados.total)}</div>
          <div className="pg-ativ-contexto">imóveis em estoque</div>
        </div>
        <div>
          <div className="pg-ativ-numero">{fmtNum(dados.atualizados)}</div>
          <div className="pg-ativ-contexto">atualizados ({fmtPct(dados.pctAtualizado, 0)})</div>
        </div>
        <div>
          <div className="pg-ativ-numero">{fmtNum(dados.desatualizados)}</div>
          <div className="pg-ativ-contexto">desatualizados há mais de 45 dias</div>
        </div>
        {mostraVenda && (
          <div>
            <div className="pg-ativ-numero">{fmtMoedaCurta(dados.valorDesat.Venda)}</div>
            <div className="pg-ativ-contexto">em venda desatualizados, de {fmtMoedaCurta(dados.valor.Venda)}</div>
          </div>
        )}
        {mostraAluguel && (
          <div>
            <div className="pg-ativ-numero">{fmtMoedaCurta(dados.valorDesat.Aluguel)}/mês</div>
            <div className="pg-ativ-contexto">em locação desatualizados, de {fmtMoedaCurta(dados.valor.Aluguel)}/mês</div>
          </div>
        )}
      </div>
      <div className="pg-subtitulo">
        Por captador{' '}
        <span className="pg-grafico-ref">
          · <span className="pg-ponto" style={{ background: 'var(--success)' }} aria-hidden="true" /> atualizados{' '}
          <span className="pg-ponto" style={{ background: 'var(--danger)' }} aria-hidden="true" /> desatualizados · R$ = valor desatualizado{finalidade === 'todas' ? ' (venda; locação em R$/mês)' : ''}
        </span>
      </div>
      <div className="pg-hbarras">
        {dados.linhas.map((l) => (
          <LinhaCarteira
            key={l.captador}
            l={l}
            max={max}
            finalidade={finalidade}
            selecionado={selecionado === l.captador}
            onSelecionar={podeSelecionar(l.captador) ? () => onSelecionar(l.captador) : null}
          />
        ))}
        {dados.semCaptador.n > 0 && <LinhaCarteira l={dados.semCaptador} max={max} finalidade={finalidade} rotulo="Sem captador no Imoview" />}
      </div>
    </div>
  )
}
