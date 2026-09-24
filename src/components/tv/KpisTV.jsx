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

const decimal = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Aviso no título quando o CRM está sem dados novos há mais de 1 dia. */
function avisoCrm(kpis) {
  const ate = kpis?.crm_atualizado_ate
  if (!ate) return ''
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  const diasSemDados = Math.round((hoje - new Date(`${ate}T12:00:00`)) / 86400000)
  return diasSemDados > 1 ? ` · CRM até ${ate.slice(8, 10)}/${ate.slice(5, 7)}` : ''
}

/**
 * KPIs 1 · Comercial do mês, com as definições do Painel da Gestão (PRD §5.0):
 * leads e ritmo de 30 dias, negócios pela data de fechamento, conversão da
 * safra madura e ciclo mediano. Sem os campos novos (função antiga), cai nos
 * campos de 23/09.
 */
export function KpisComercialTV({ kpis, erro }) {
  if (!kpis) return <Carregando titulo="📊 Comercial do mês" erro={erro} />
  const c = kpis.comercial
  const titulo = `📊 Comercial — ${nomeDoMes(kpis.mes_referencia)}${avisoCrm(kpis)}`
  const novo = c.leads_mes !== undefined
  const pctRitmo = novo && c.leads_media_3m ? Math.min(100, Math.round((c.projecao_mes / c.leads_media_3m) * 100)) : null

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">{titulo}</div>
      <div className="kpis-tv-grid">
        <Card
          rotulo="Leads do mês"
          valor={numero(novo ? c.leads_mes : c.leads_novos)}
          sub={novo ? `ritmo ${decimal(c.ritmo_dia)}/dia · fecha em ~${numero(c.projecao_mes)} · média ${numero(c.leads_media_3m)}` : `mês anterior: ${numero(c.leads_mes_anterior)}`}
        >
          {pctRitmo != null && (
            <div className="kpi-tv-barra"><div className="kpi-tv-barra-fill" style={{ width: `${pctRitmo}%` }} /></div>
          )}
        </Card>
        <Card
          rotulo="Negócios no mês"
          valor={numero(novo ? c.negocios_fechados_mes : c.negocios)}
          sub={novo ? `média dos 3 meses: ${decimal(c.negocios_media_3m)}` : `mês anterior: ${numero(c.negocios_mes_anterior)}`}
        />
        <Card
          rotulo="Leads que viram negócio"
          valor={novo ? (c.conversao_safra == null ? '—' : percentual(c.conversao_safra)) : percentual(c.taxa_conversao)}
          sub={novo ? `semestre anterior: ${c.conversao_safra_anterior == null ? '—' : percentual(c.conversao_safra_anterior)} · leads com 60+ dias` : `mês anterior: ${percentual(c.taxa_conversao_mes_anterior)}`}
        />
        <Card
          rotulo="Tempo até fechar"
          valor={dias(novo ? c.ciclo_mediano_12m : c.ciclo_medio_ganho)}
          sub={novo ? 'mediana dos negócios dos últimos 12 meses' : `mês anterior: ${dias(c.ciclo_medio_mes_anterior)}`}
        />
      </div>
    </section>
  )
}

/**
 * KPIs 2 · Operação: esteira de locação, leads sem contato (e abertos há 30+
 * dias), atividades vencidas no último mês e plantão de hoje.
 */
export function KpisOperacaoTV({ kpis, erro }) {
  if (!kpis) return <Carregando titulo="⚙️ Operação" erro={erro} />
  const o = kpis.operacao
  const novo = o.sem_contato !== undefined
  const etapas = Object.entries(o.propostas_por_etapa ?? {})
  const totalPropostas = etapas.reduce((soma, [, n]) => soma + n, 0)

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">⚙️ Operação — hoje{avisoCrm(kpis)}</div>
      <div className="kpis-tv-grid">
        <Card rotulo="Propostas de locação em andamento" valor={numero(totalPropostas)}>
          <div className="kpi-tv-chips">
            {etapas.length === 0 && <span className="kpi-tv-sub">nenhuma em andamento</span>}
            {etapas.map(([status, n]) => (
              <span className="kpi-tv-chip" key={status}>{STATUS_LABEL[status] ?? status}: {n}</span>
            ))}
          </div>
        </Card>
        {novo ? (
          <Card rotulo="Leads sem nenhum contato" valor={numero(o.sem_contato)} sub={`e ${numero(o.abertos_30d)} abertos há mais de 30 dias`} />
        ) : (
          <Card rotulo="Leads abertos há 30+ dias" valor={numero(o.leads_parados_30d)} sub="desde a entrada no CRM" />
        )}
        {novo ? (
          <Card rotulo="Atividades vencidas" valor={numero(o.atividades_vencidas_30d)} sub="no último mês, ainda não feitas" />
        ) : (
          <Card rotulo="Leads do mês por finalidade" valor={`${numero(o.leads_venda)} · ${numero(o.leads_aluguel)}`} sub="venda · aluguel" />
        )}
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
