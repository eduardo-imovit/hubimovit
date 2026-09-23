import { STATUS_LABEL } from '../../lib/esteiraLabels'

const numero = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const percentual = (v) => `${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const dias = (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`)

function nomeDoMes(mesISO) {
  if (!mesISO) return ''
  const nome = new Date(`${mesISO}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', dia_inteiro: 'Dia inteiro' }

function Card({ rotulo, valor, sub, children }) {
  return (
    <div className="kpi-tv-card">
      <div className="kpi-tv-rotulo">{rotulo}</div>
      {valor != null && <div className="kpi-tv-valor">{valor}</div>}
      {children}
      {sub && <div className="kpi-tv-sub">{sub}</div>}
    </div>
  )
}

function Carregando({ titulo, erro }) {
  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">{titulo}</div>
      <div className="agenda-fotografo-tv-vazio">{erro ? 'Não foi possível carregar os indicadores.' : 'Carregando indicadores…'}</div>
    </section>
  )
}

/** KPIs 1 · Comercial do mês: leads (× meta ou × mês anterior), negócios, conversão e ciclo. */
export function KpisComercialTV({ kpis, erro }) {
  const titulo = `📊 Comercial — ${nomeDoMes(kpis?.mes_referencia)}`
  if (!kpis) return <Carregando titulo="📊 Comercial do mês" erro={erro} />
  const c = kpis.comercial
  const pctMeta = c.meta_leads ? Math.min(100, Math.round((c.leads_novos / c.meta_leads) * 100)) : null

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">{titulo}</div>
      <div className="kpis-tv-grid">
        <Card
          rotulo="Leads novos"
          valor={numero(c.leads_novos)}
          sub={c.meta_leads ? `meta ${numero(c.meta_leads)} · ${pctMeta}%` : `mês anterior: ${numero(c.leads_mes_anterior)}`}
        >
          {pctMeta != null && (
            <div className="kpi-tv-barra"><div className="kpi-tv-barra-fill" style={{ width: `${pctMeta}%` }} /></div>
          )}
        </Card>
        <Card rotulo="Negócios fechados" valor={numero(c.negocios)} sub={`mês anterior: ${numero(c.negocios_mes_anterior)}`} />
        <Card rotulo="Taxa de conversão" valor={percentual(c.taxa_conversao)} sub={`mês anterior: ${percentual(c.taxa_conversao_mes_anterior)}`} />
        <Card rotulo="Ciclo até o fechamento" valor={dias(c.ciclo_medio_ganho)} sub={`mês anterior: ${dias(c.ciclo_medio_mes_anterior)}`} />
      </div>
    </section>
  )
}

/** KPIs 2 · Operação: esteira de locação, leads parados, venda × aluguel e plantão de hoje. */
export function KpisOperacaoTV({ kpis, erro }) {
  if (!kpis) return <Carregando titulo="⚙️ Operação" erro={erro} />
  const o = kpis.operacao
  const etapas = Object.entries(o.propostas_por_etapa ?? {})
  const totalPropostas = etapas.reduce((soma, [, n]) => soma + n, 0)
  const totalFinalidade = o.leads_venda + o.leads_aluguel
  const pctVenda = totalFinalidade ? Math.round((o.leads_venda / totalFinalidade) * 100) : 0

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">⚙️ Operação — hoje</div>
      <div className="kpis-tv-grid">
        <Card rotulo="Propostas de locação em andamento" valor={numero(totalPropostas)}>
          <div className="kpi-tv-chips">
            {etapas.length === 0 && <span className="kpi-tv-sub">nenhuma em andamento</span>}
            {etapas.map(([status, n]) => (
              <span className="kpi-tv-chip" key={status}>{STATUS_LABEL[status] ?? status}: {n}</span>
            ))}
          </div>
        </Card>
        <Card rotulo="Leads parados há 30+ dias" valor={numero(o.leads_parados_30d)} sub="sem movimentação no CRM" />
        <Card rotulo="Leads do mês por finalidade" valor={`${numero(o.leads_venda)} · ${numero(o.leads_aluguel)}`} sub="venda · aluguel">
          <div className="kpi-tv-barra kpi-tv-barra--dupla">
            <div className="kpi-tv-barra-fill" style={{ width: `${pctVenda}%` }} />
          </div>
        </Card>
        <Card rotulo="Plantão de hoje">
          {o.plantao_hoje.length === 0
            ? <div className="kpi-tv-sub">Sem plantão escalado hoje</div>
            : (
              <div className="kpi-tv-plantao">
                {o.plantao_hoje.map((p) => (
                  <div key={`${p.nome}-${p.turno}`}>
                    <span className="kpi-tv-plantao-nome">{p.nome}</span>
                    <span className="kpi-tv-sub"> · {TURNO_LABEL[p.turno] ?? p.turno}</span>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>
    </section>
  )
}
