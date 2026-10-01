import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CaixaTooltip } from './Graficos'
import { CORES, LABEL_FINALIDADE } from '../../lib/painelGestao'
import { CORES_TIPO } from '../../lib/painelComercial'
import { fmtMoeda, fmtNum, fmtPct } from '../../lib/paineis'

const EIXO = { fontSize: 11, fill: 'var(--grafite-soft)' }
const GRADE = 'var(--champagne)'

/** Subtexto obrigatório de cada gráfico: o que está sendo mostrado e o recorte aplicado. */
export function Recorte({ oque, recorte }) {
  return (
    <p className="pg-recorte">
      <strong>{oque}</strong> · {recorte}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Funil de 7 etapas, com a coluna de tempo na etapa
// ---------------------------------------------------------------------------

export function FunilEtapas({ grupos }) {
  return (
    <div className={`pg-funis pg-funis--${grupos.length}`}>
      {grupos.map((g) => {
        const max = g.etapas[0].n || 1
        return (
          <div key={g.finalidade} className="pg-funil pg-funil--7">
            <div className="pg-funil-titulo">
              <span className={`pg-ponto pg-ponto--${g.finalidade}`} aria-hidden="true" />
              {LABEL_FINALIDADE[g.finalidade]}
              <span className="pg-funil-conv">
                {fmtPct(g.conversao, 1)} viram negócio
                {g.cicloMedio != null && ` · ${fmtNum(g.cicloMedio)} dias em média até o negócio (${g.nGanhos})`}
              </span>
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
                          {' '}({e.delta > 0 ? '+' : ''}{fmtNum(e.delta, 0)} p.p. vs período anterior)
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
                    <span className="pg-funil-tempo" title="Tempo médio na etapa: começa a ser medido com o histórico diário de etapas">
                      —
                    </span>
                  </div>
                </div>
              )
            })}
            <div className="pg-funil-legenda-tempo">
              Última coluna: tempo médio em cada etapa. Começa a ser medido quando o histórico diário de etapas entrar no ar.
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ritmo de leads dentro do período
// ---------------------------------------------------------------------------

const ROTULO_GRAN = { dia: 'por dia', semana: 'por semana', mes: 'por mês' }

export function GraficoRitmo({ serie, finalidades, gran }) {
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Leads que entraram, {ROTULO_GRAN[gran]}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={8} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return <CaixaTooltip titulo={label} linhas={finalidades.map((f) => ({ rotulo: LABEL_FINALIDADE[f], valor: p[f], cor: CORES[f] }))} />
            }}
          />
          {finalidades.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              payload={finalidades.map((f) => ({ value: LABEL_FINALIDADE[f], type: 'circle', color: CORES[f], id: f }))}
            />
          )}
          {finalidades.map((f, i) => (
            <Bar key={f} dataKey={f} name={LABEL_FINALIDADE[f]} stackId="a" fill={CORES[f]} stroke="#fff" strokeWidth={2} radius={i === finalidades.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Canais: tabela com barras (volume e eficiência lado a lado)
// ---------------------------------------------------------------------------

export function TabelaCanais({ canais, destaque }) {
  const max = Math.max(...canais.map((c) => c.leads), 1)
  return (
    <div className="painel-tabela-wrap">
      <table className="data-table pg-canais">
        <thead>
          <tr>
            <th>Mídia</th>
            <th>Leads</th>
            <th className="num">Qualificados</th>
            <th className="num">Chegaram à visita</th>
            <th className="num">Negócios</th>
            <th className="num">Lead → negócio</th>
          </tr>
        </thead>
        <tbody>
          {canais.map((c) => (
            <tr key={c.canal} className={destaque === c.canal ? 'is-selecionado' : undefined}>
              <td>{c.canal}</td>
              <td>
                <div className="pg-canal-volume">
                  <div className="pg-funil-trilho">
                    <div className="pg-funil-barra" style={{ width: `${Math.max(2, (c.leads / max) * 100)}%`, background: destaque === c.canal ? 'var(--coral)' : CORES.contexto }} />
                  </div>
                  <span className="pg-funil-n">{fmtNum(c.leads)}</span>
                </div>
              </td>
              <td className="num">{fmtPct(c.pctQualificado, 0)}</td>
              <td className="num">{fmtPct(c.pctVisita, 0)}</td>
              <td className="num">{fmtNum(c.negocios)}</td>
              <td className="num">{c.leads >= 10 ? fmtPct(c.conversao) : <span className="is-muted" title="Menos de 10 leads: taxa pouco confiável">{`${c.negocios} de ${c.leads}`}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leads da coorte que seguem em atendimento, por etapa atual
// ---------------------------------------------------------------------------

export function EmAtendimentoEtapas({ dados, finalidades }) {
  const max = Math.max(...dados.map((d) => finalidades.reduce((s, f) => s + d[f], 0)), 1)
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Em atendimento hoje, pela etapa atual</div>
      {finalidades.length > 1 && (
        <div className="pp-legenda">
          {finalidades.map((f) => (
            <span key={f}>
              <span className={`pg-ponto pg-ponto--${f}`} aria-hidden="true" /> {LABEL_FINALIDADE[f]}
            </span>
          ))}
        </div>
      )}
      <div className="pg-hbarras">
        {dados.map((d) => {
          const total = finalidades.reduce((s, f) => s + d[f], 0)
          return (
            <div key={d.etapa} className="pg-hbarra pg-hbarra--larga" title={finalidades.map((f) => `${LABEL_FINALIDADE[f]}: ${d[f]}`).join(' · ')}>
              <span className="pg-hbarra-rotulo">{d.etapa}</span>
              <div className="pg-funil-trilho pg-trilho-empilhado">
                {finalidades.map((f) =>
                  d[f] > 0 ? <div key={f} className="pg-funil-barra" style={{ width: `${(d[f] / max) * 100}%`, background: CORES[f] }} /> : null
                )}
              </div>
              <span className="pg-funil-n">{fmtNum(total)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Visitas por bairro (período × período anterior) e por tipo ao longo do tempo
// ---------------------------------------------------------------------------

export function VisitasBairro({ linhas }) {
  const max = Math.max(...linhas.map((l) => Math.max(l.n, l.anterior)), 1)
  if (linhas.length === 0) return <div className="pg-vazio">Nenhuma visita com bairro identificado neste recorte.</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Bairros mais visitados · barra clara = período anterior</div>
      <div className="pg-hbarras">
        {linhas.map((l) => (
          <div key={l.bairro} className="pg-hbarra pg-hbarra--larga" title={`${l.bairro}: ${l.n} no período, ${l.anterior} no anterior`}>
            <span className="pg-hbarra-rotulo">{l.bairro}</span>
            <div className="pg-trilho-duplo">
              <div className="pg-funil-trilho pg-trilho-fino">
                <div className="pg-funil-barra" style={{ width: `${Math.max(2, (l.n / max) * 100)}%`, background: 'var(--grafite-mid)' }} />
              </div>
              <div className="pg-funil-trilho pg-trilho-fino">
                <div className="pg-funil-barra" style={{ width: `${l.anterior ? Math.max(2, (l.anterior / max) * 100) : 0}%`, background: CORES.contexto }} />
              </div>
            </div>
            <span className="pg-funil-n">
              {fmtNum(l.n)} <span className="is-muted">({fmtNum(l.anterior)})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VisitasTipo({ serie, tipos, totais, total, gran }) {
  if (total === 0) return <div className="pg-vazio">Nenhuma visita neste recorte.</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Visitas por tipo de imóvel, {ROTULO_GRAN[gran]}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={8} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return <CaixaTooltip titulo={label} linhas={tipos.map((t) => ({ rotulo: t, valor: p[t], cor: CORES_TIPO[t] }))} />
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} payload={tipos.map((t) => ({ value: t, type: 'circle', color: CORES_TIPO[t], id: t }))} />
          {tipos.map((t, i) => (
            <Bar key={t} dataKey={t} stackId="a" fill={CORES_TIPO[t]} stroke="#fff" strokeWidth={2} radius={i === tipos.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <table className="pg-tabela-mini" aria-label="Visitas por tipo de imóvel no período">
        <tbody>
          {totais
            .filter((t) => t.n > 0)
            .map((t) => (
              <tr key={t.tipo}>
                <td>
                  <span className="pg-ponto" style={{ background: CORES_TIPO[t.tipo] }} aria-hidden="true" /> {t.tipo}
                </td>
                <td className="num">{fmtNum(t.n)}</td>
                <td className="num is-muted">{fmtPct((t.n / total) * 100, 0)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Propostas do Hub: volume e valor na mesa
// ---------------------------------------------------------------------------

export function PropostasMesa({ porFinalidade }) {
  return (
    <div className="pg-mesa">
      {porFinalidade.map((p) => (
        <div key={p.finalidade} className="pg-mesa-card">
          <div className="pg-funil-titulo">
            <span className={`pg-ponto pg-ponto--${p.finalidade}`} aria-hidden="true" />
            {LABEL_FINALIDADE[p.finalidade]}
          </div>
          <div className="pg-mesa-valor">{fmtMoeda(p.valorMesa)}</div>
          <div className="pg-mesa-texto">
            na mesa em {p.abertas} {p.abertas === 1 ? 'proposta aberta' : 'propostas abertas'} · {p.total} {p.total === 1 ? 'criada' : 'criadas'} no período
          </div>
        </div>
      ))}
    </div>
  )
}
