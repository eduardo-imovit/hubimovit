import { useMemo, useState } from 'react'
import { usePainelPerformance } from '../hooks/usePaineis'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { Capitulo, Indice } from '../components/painel/Estrutura'
import { SaudeDados } from '../components/painel/Graficos'
import { CascataDinheiro, GraficoRitmoGasto, LegendaPlataformas, MatrizCampanhas, PequenosAtencao, Recomendacoes, TabelaCampanhas } from '../components/painel/GraficosPerformance'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, nomeMes, pct, saudeDados } from '../lib/paineis'
import { listaDistinta, OPCOES_PERIODO } from '../lib/painelGestao'
import {
  cascata,
  ETAPAS_CAMPANHA,
  FILTROS_PERF_PADRAO,
  filtrarAnuncios,
  FINALIDADES_CAMPANHA,
  manchetePerformance,
  normalizarAnuncios,
  orcamentoDoMes,
  PLATAFORMAS,
  recomendacoes,
  resolverPeriodo,
  ritmoGasto,
  serieAtencao,
  somar,
  tabelaCampanhas,
  variacao,
} from '../lib/painelPerformance'

const noIntervalo = (d, { inicio, fim }) => !!d && d >= inicio && d <= fim

export default function PainelPerformance() {
  const hoje = isoLocal()
  const { filtros, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_PERF_PADRAO)
  const { dados, carregando, erro } = usePainelPerformance()

  const todos = useMemo(() => (dados ? normalizarAnuncios(dados.meta, dados.google, dados.metasCampanhas) : null), [dados])
  const campanhasDisponiveis = useMemo(() => (todos ? listaDistinta(filtrarAnuncios(todos, { ...filtros, campanha: 'todas' }), 'campanha') : []), [todos, filtros])

  const p = useMemo(() => {
    if (!dados || !todos) return null
    const anuncios = filtrarAnuncios(todos, filtros)
    const plataformas = filtros.plataforma === 'todas' ? PLATAFORMAS : [filtros.plataforma]
    const periodo = resolverPeriodo(filtros.periodo, hoje)
    const mesRitmo = periodo.mes ?? hoje.slice(0, 7)
    const noPeriodo = anuncios.filter((l) => noIntervalo(l.data, periodo))
    const totais = somar(noPeriodo)
    const totaisAnt = somar(anuncios.filter((l) => noIntervalo(l.data, periodo.anterior)))
    const nomesNoRecorte = new Set(anuncios.map((l) => l.campanha))
    const recorteAtivo = filtros.plataforma !== 'todas' || filtros.etapa !== 'todas' || filtros.finalidade !== 'todas' || filtros.campanha !== 'todas'
    const orcamento = orcamentoDoMes(dados.metasCampanhas, mesRitmo, (c) => !recorteAtivo || nomesNoRecorte.has(c.campanha_nome))
    const ritmo = ritmoGasto(anuncios, orcamento, mesRitmo, hoje)
    const campanhas = tabelaCampanhas(anuncios, periodo, orcamento)
    const degraus = cascata(totais, dados.pagos, periodo)
    return {
      plataformas,
      periodo,
      mesRitmo,
      totais,
      totaisAnt,
      orcamento,
      ritmo,
      serie: serieAtencao(anuncios, hoje),
      campanhas,
      degraus,
      recs: recomendacoes(campanhas, totais),
      recorteAtivo,
      frases: manchetePerformance({ ritmo, orcamento, totais, totaisAnt, degraus, periodo }),
      saude: saudeDados(
        [
          { fonte: 'Meta Ads', ultima: dados.ultimaMeta, toleranciaDias: 1 },
          { fonte: 'Google Ads', ultima: dados.ultimaGoogle, toleranciaDias: 1 },
          { fonte: 'CRM · atendimentos', ultima: dados.ultimaCrm, toleranciaDias: 1 },
        ],
        hoje
      ),
    }
  }, [dados, todos, filtros, hoje])

  const leadsCrm = p?.degraus.find((d) => d.chave === 'leads')
  const convPlat = p?.degraus.find((d) => d.chave === 'conversoes')

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">Painel de Performance</div>
          <div className="page-sub">Do real investido ao negócio fechado: onde o dinheiro rende e onde vaza.</div>
        </div>
      </header>

      <FiltrosPerformance filtros={filtros} setFiltro={setFiltro} limpar={limpar} alterados={alterados} campanhas={campanhasDisponiveis} />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o painel: {erro}</div>}

      {p && p.saude.some((f) => f.status !== 'bom') && (
        <div className="pg-aviso" role="status">
          <strong>Atenção aos dados:</strong> {p.saude.filter((f) => f.status !== 'bom').map((f) => `${f.fonte} sem informação nova há ${f.dias} dias`).join('; ')}.
        </div>
      )}

      {p && (
        <>
          <section className="pg-manchete" aria-label="Manchete">
            <div className="pg-manchete-texto">
              {p.frases.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
            <div className="pg-indices">
              <Indice
                rotulo={`Investimento ${p.periodo.label}`}
                valor={fmtMoeda(p.totais.investimento)}
                variacao={variacao(p.totais.investimento, p.totaisAnt.investimento)}
                sentido="neutro"
                contexto="vs período anterior"
                formula="Soma do investimento diário da Meta e do Google no período, com os filtros aplicados."
              />
              <Indice
                rotulo={p.ritmo.corrente ? 'Orçamento: projeção do mês' : 'Orçamento executado'}
                valor={p.orcamento.total > 0 ? fmtPct(p.ritmo.pctOrcamento, 0) : '—'}
                contexto={
                  p.orcamento.total > 0
                    ? `${fmtMoeda(p.ritmo.projecaoFim)} de ${fmtMoeda(p.orcamento.total)}${p.orcamento.emprestado ? ` · orçamento de ${nomeMes(p.orcamento.mesReferencia)}` : ''}`
                    : 'sem orçamento cadastrado'
                }
                formula="Gasto do mês (ou projeção pelo ritmo de 30 dias, no mês atual) ÷ soma dos orçamentos das campanhas em metas_campanhas."
              />
              <Indice
                rotulo="Custo por conversão (plataforma)"
                valor={fmtMoeda(p.totais.cpl)}
                variacao={p.totais.cpl != null && p.totaisAnt.cpl != null ? variacao(p.totais.cpl, p.totaisAnt.cpl) : null}
                sentido="menor-melhor"
                contexto="vs período anterior"
                formula="Investimento ÷ conversões contadas pela Meta e pelo Google (cliques no WhatsApp e formulários)."
              />
              <Indice
                rotulo="Custo real por lead (CRM)"
                valor={fmtMoeda(leadsCrm?.custo)}
                contexto={`${fmtNum(leadsCrm?.n)} leads pagos no CRM · ${fmtPct(pct(leadsCrm?.n ?? 0, convPlat?.n ?? 0), 0)} das conversões`}
                formula="Investimento ÷ atendimentos de 'Campanhas pagas' que entraram no CRM no período."
              />
            </div>
          </section>

          <Capitulo
            numero="1"
            pergunta="Estamos gastando no ritmo certo?"
            conclusao={
              p.orcamento.total > 0
                ? p.ritmo.corrente
                  ? `Pelo ritmo atual, ${nomeMes(p.mesRitmo).split(' ')[0]} fecha com ${fmtMoeda(p.ritmo.projecaoFim)}: ${fmtPct(p.ritmo.pctOrcamento, 0)} do orçamento${p.ritmo.pctOrcamento < 85 ? ', sobra verba sem uso' : p.ritmo.pctOrcamento > 110 ? ', acima do planejado' : ', dentro do planejado'}.`
                  : `${nomeMes(p.mesRitmo)} fechou com ${fmtMoeda(p.ritmo.realizado)}: ${fmtPct(p.ritmo.pctOrcamento, 0)} do orçamento.`
                : `Sem orçamento cadastrado: gasto de ${fmtMoeda(p.ritmo.realizado)} no mês até agora.`
            }
            rodape={`${p.orcamento.emprestado ? `${nomeMes(p.mesRitmo)} não tem orçamento cadastrado em metas_campanhas; a linha usa o orçamento de ${nomeMes(p.orcamento.mesReferencia)} como referência. ` : ''}A linha tracejada é a projeção se o gasto médio diário dos últimos 30 dias (${fmtMoeda(p.ritmo.porDia)}) se mantiver. Em visões de 30 ou 90 dias, este capítulo mostra o mês atual.`}
          >
            <GraficoRitmoGasto ritmo={p.ritmo} rotuloOrcamento={p.orcamento.emprestado ? `Orçamento (ref. ${nomeMes(p.orcamento.mesReferencia).split(' ')[0]})` : 'Orçamento'} />
          </Capitulo>

          <Capitulo
            numero="2"
            pergunta="O dinheiro está virando atenção?"
            conclusao={conclusaoAtencao(p.serie, p.plataformas)}
            rodape="Seis meses, por mês. CPM mede quanto custa aparecer; CTR, quanto o anúncio atrai; CPC, quanto custa cada visita ao anúncio. Abril tem só alguns dias de dados."
          >
            <LegendaPlataformas plataformas={p.plataformas} />
            <PequenosAtencao serie={p.serie} plataformas={p.plataformas} />
          </Capitulo>

          <Capitulo
            numero="3"
            pergunta="Quais campanhas entregam?"
            conclusao={conclusaoCampanhas(p.campanhas)}
            rodape="A marca vertical na barra é o orçamento do mês da campanha. Status compara o CPL da plataforma com a meta de CPL cadastrada. Clique numa campanha para filtrar o painel inteiro por ela."
          >
            <TabelaCampanhas campanhas={p.campanhas} selecionada={filtros.campanha} onSelecionar={(c) => setFiltro('campanha', filtros.campanha === c ? 'todas' : c)} />
          </Capitulo>

          <Capitulo
            numero="4"
            pergunta="A conversão vira negócio?"
            conclusao={conclusaoCascata(p.degraus)}
            rodape={`As etapas em cinza-claro (CRM) contam todos os leads de "Campanhas pagas" do período${p.recorteAtivo ? ' e não respeitam os filtros de plataforma, etapa, finalidade ou campanha: o CRM ainda não guarda a campanha de origem' : ''}. Leads de anúncio que entram pelo bot do WhatsApp ainda chegam como "WhatsApp", então os números do CRM estão subestimados. Leads recentes ainda podem avançar para visita e negócio.`}
          >
            <CascataDinheiro investimento={p.totais.investimento} degraus={p.degraus} />
          </Capitulo>

          <Capitulo numero="5" pergunta="Onde colocar o próximo real?" conclusao={p.recs.length ? p.recs[0].texto : 'Sem recomendação clara neste recorte.'}>
            <div className="pg-duas">
              <MatrizCampanhas campanhas={p.campanhas} plataformas={p.plataformas} />
              <div>
                <div className="pg-grafico-titulo">Recomendações geradas pelos números</div>
                <Recomendacoes itens={p.recs} />
              </div>
            </div>
          </Capitulo>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados fontes={p.saude} />
          </section>
        </>
      )}
    </div>
  )
}

function conclusaoAtencao(serie, plataformas) {
  const partes = []
  for (const pl of plataformas) {
    const comDado = serie.filter((s) => s[`cpc${pl}`] != null)
    if (comDado.length < 2) continue
    const ult = comDado.at(-1)
    const ant = comDado.slice(-4, -1)
    const media = ant.reduce((s, x) => s + x[`cpc${pl}`], 0) / (ant.length || 1)
    const v = media > 0 ? ((ult[`cpc${pl}`] - media) / media) * 100 : null
    const ctr = ult[`ctr${pl}`]
    partes.push(
      `${pl}: clique a R$ ${ult[`cpc${pl}`].toFixed(2).replace('.', ',')}${v == null || Math.abs(v) < 8 ? ' (estável)' : v > 0 ? ` (${Math.round(v)}% mais caro)` : ` (${Math.round(-v)}% mais barato)`}, CTR de ${fmtPct(ctr, 1)}`
    )
  }
  return partes.length ? `${partes.join('; ')} no mês atual, contra a média dos 3 meses anteriores.` : 'Sem dados suficientes de atenção neste recorte.'
}

function conclusaoCampanhas(campanhas) {
  const comMeta = campanhas.filter((c) => c.metaCpl != null && c.cpl != null)
  if (comMeta.length) {
    const noAlvo = comMeta.filter((c) => c.status === 'bom').length
    return `${noAlvo} de ${comMeta.length} ${comMeta.length === 1 ? 'campanha com meta está' : 'campanhas com meta estão'} com o custo por conversão dentro da meta.`
  }
  if (!campanhas.length) return 'Nenhuma campanha com gasto neste recorte.'
  const melhor = campanhas.filter((c) => c.cpl != null).sort((a, b) => a.cpl - b.cpl)[0]
  return melhor ? `Nenhuma campanha tem meta cadastrada neste período; a de menor custo por conversão é ${melhor.campanha} (${fmtMoeda(melhor.cpl)}).` : 'Nenhuma campanha com conversões neste recorte.'
}

function conclusaoCascata(degraus) {
  const conv = degraus.find((d) => d.chave === 'conversoes')
  const leads = degraus.find((d) => d.chave === 'leads')
  const visitas = degraus.find((d) => d.chave === 'visitas')
  if (!conv?.n) return 'Sem conversões neste recorte.'
  return `De ${fmtNum(conv.n)} conversões na plataforma, ${fmtNum(leads.n)} viraram lead no CRM e ${fmtNum(visitas.n)} chegaram à visita${visitas.custo ? `: cada visita custou ${fmtMoeda(visitas.custo)}` : ''}.`
}

function FiltrosPerformance({ filtros, setFiltro, limpar, alterados, campanhas }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <div className="pg-filtros" role="toolbar" aria-label="Filtros do painel">
      <div className="pg-segmentado" role="radiogroup" aria-label="Plataforma">
        {['todas', ...PLATAFORMAS].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={filtros.plataforma === v} className={filtros.plataforma === v ? 'is-ativo' : undefined} onClick={() => setFiltro('plataforma', v)}>
            {v === 'todas' ? 'Todas' : v}
          </button>
        ))}
      </div>
      <label className="pg-campo">
        <span>Período</span>
        <select value={filtros.periodo} onChange={(e) => setFiltro('periodo', e.target.value)}>
          {OPCOES_PERIODO.map((o) => (
            <option key={o.valor} value={o.valor}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="pg-campo">
        <span>Etapa da campanha</span>
        <select value={filtros.etapa} onChange={(e) => setFiltro('etapa', e.target.value)}>
          <option value="todas">Todas</option>
          {Object.entries(ETAPAS_CAMPANHA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="pg-campo">
        <span>Finalidade</span>
        <select value={filtros.finalidade} onChange={(e) => setFiltro('finalidade', e.target.value)}>
          <option value="todas">Todas</option>
          {Object.entries(FINALIDADES_CAMPANHA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="pg-campo">
        <span>Campanha</span>
        <select value={filtros.campanha} onChange={(e) => setFiltro('campanha', e.target.value)}>
          <option value="todas">Todas</option>
          {campanhas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="pg-filtros-acoes">
        {alterados && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>Limpar filtros</button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiar}>{copiado ? 'Link copiado' : 'Copiar link desta visão'}</button>
      </div>
    </div>
  )
}
