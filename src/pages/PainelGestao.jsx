import { useMemo } from 'react'
import { usePainelGestao } from '../hooks/usePaineis'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { BarraFiltros, Capitulo, Indice } from '../components/painel/Estrutura'
import { Descartes, FunilCascata, GraficoCustoMidia, GraficoMensal, MapaPessoas, SaudeDados, Simulador, MatrizCanais } from '../components/painel/Graficos'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados, somarDias } from '../lib/paineis'
import {
  capituloCanais,
  capituloFunil,
  capituloPessoas,
  cicloMediano,
  conversaoSafra,
  custoMidia,
  descartesPorEtapa,
  filtrarBase,
  FILTROS_PADRAO,
  fmtDecimal,
  LABEL_FINALIDADE,
  listaDistinta,
  manchete,
  nomeCanal,
  resolverPeriodo,
  resultadoPeriodo,
  ritmo,
  serieMensal,
  sparkLeads,
  sparkNegocios,
} from '../lib/painelGestao'

const fmtData = (iso) => iso.split('-').reverse().join('/')

export default function PainelGestao() {
  const hoje = isoLocal()
  const { filtros, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_PADRAO)
  const { dados, carregando, erro } = usePainelGestao()

  // canais com o nome de exibição (a view grava alguns sem acento)
  const baseNorm = useMemo(() => (dados ? dados.base.map((a) => ({ ...a, canal: nomeCanal(a.canal) })) : null), [dados])

  const opcoes = useMemo(() => {
    if (!baseNorm) return { canais: [], corretores: [] }
    const validos = baseNorm.filter((a) => !a.is_ruido && !a.is_interno)
    const ativosOuRecentes = validos.filter((a) => a.is_ativo || a.data_entrada >= somarDias(hoje, -365))
    return { canais: listaDistinta(validos, 'canal'), corretores: listaDistinta(ativosOuRecentes, 'corretor') }
  }, [baseNorm, hoje])

  const h = useMemo(() => {
    if (!dados || !baseNorm) return null
    const base = filtrarBase(baseNorm, filtros)
    const finalidades = filtros.finalidade === 'todas' ? ['Venda', 'Aluguel'] : [filtros.finalidade]
    const periodo = resolverPeriodo(filtros.periodo, hoje)
    const propostas = filtros.finalidade === 'Venda' ? [] : dados.propostas
    const rit = ritmo(base, hoje)
    const resultado = resultadoPeriodo(base, propostas, periodo)
    const serie = serieMensal(base, hoje, rit)
    const conversao = conversaoSafra(base, hoje)
    const funilCap = capituloFunil(base, hoje, finalidades)
    const canaisCap = capituloCanais(filtrarBase(baseNorm, { ...filtros, canal: 'todos' }), hoje)
    const soCorretor = (linhas, campo) => (filtros.corretor === 'todos' ? linhas : linhas.filter((l) => l[campo] === filtros.corretor))
    const pessoasCap = capituloPessoas(
      {
        base: filtrarBase(baseNorm, filtros),
        tempoResposta: soCorretor(dados.tempoResposta, 'corretor'),
        aging: soCorretor(dados.aging, 'corretor'),
        atividades: soCorretor(dados.atividades, 'nomeusuario'),
      },
      hoje
    )
    const leadsPorMes = { Venda: 0, Aluguel: 0 }
    for (const p of serie.slice(-4, -1)) {
      leadsPorMes.Venda += p.leadsVenda / 3
      leadsPorMes.Aluguel += p.leadsAluguel / 3
    }
    return {
      base,
      finalidades,
      periodo,
      rit,
      resultado,
      serie,
      conversao,
      ciclo: cicloMediano(base, hoje),
      funilCap,
      descartes: descartesPorEtapa(base, hoje),
      canaisCap,
      midia: custoMidia(baseNorm.filter((a) => !a.is_ruido), dados.meta, dados.google, hoje),
      pessoasCap,
      leadsPorMes,
      saude: saudeDados(
        [
          { fonte: 'CRM · atendimentos', ultima: dados.ultimaCrm, toleranciaDias: 1 },
          { fonte: 'CRM · atividades', ultima: dados.ultimaAtividades, toleranciaDias: 1 },
          { fonte: 'Meta Ads', ultima: dados.ultimaMeta, toleranciaDias: 1 },
          { fonte: 'Google Ads', ultima: dados.ultimaGoogle, toleranciaDias: 1 },
        ],
        hoje
      ),
      frases: manchete({ rit, resultado, funilCap, pessoasCap, periodo, conversao }),
    }
  }, [dados, baseNorm, filtros, hoje])

  const recorte = [
    filtros.finalidade !== 'todas' && LABEL_FINALIDADE[filtros.finalidade],
    filtros.canal !== 'todos' && filtros.canal,
    filtros.corretor !== 'todos' && filtros.corretor,
  ].filter(Boolean)

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">Painel da Gestão</div>
          <div className="page-sub">Do resultado à causa e a quem precisa agir. {recorte.length > 0 && <strong>Recorte: {recorte.join(' · ')}</strong>}</div>
        </div>
      </header>

      <BarraFiltros filtros={filtros} setFiltro={setFiltro} limpar={limpar} canais={opcoes.canais} corretores={opcoes.corretores} alterados={alterados} />

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o painel: {erro}</div>}

      {h && h.saude.some((f) => f.status !== 'bom') && (
        <div className="pg-aviso" role="status">
          <strong>Atenção aos dados:</strong>{' '}
          {h.saude
            .filter((f) => f.status !== 'bom')
            .map((f) => `${f.fonte} sem informação nova há ${f.dias} dias`)
            .join('; ')}
          . Os números abaixo podem estar incompletos.
        </div>
      )}

      {h && (
        <>
          {/* 0 — Manchete */}
          <section className="pg-manchete" aria-label="Manchete">
            <div className="pg-manchete-texto">
              {h.frases.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
            <div className="pg-indices">
              <Indice
                rotulo={`Leads ${h.periodo.label}`}
                valor={fmtNum(h.resultado.leads)}
                variacao={h.resultado.leadsVar}
                contexto="vs período anterior"
                serie={sparkLeads(h.serie)}
                formula="Atendimentos válidos (sem ruído e sem captação interna) pela data de entrada."
              />
              <Indice
                rotulo="Ritmo (média 30 dias)"
                valor={`${fmtDecimal(h.rit.porDia)}/dia`}
                variacao={h.rit.variacao}
                contexto="vs 30 dias anteriores"
                formula="Leads dos últimos 30 dias ÷ 30. Projeção do mês = realizado + dias restantes × ritmo."
              />
              <Indice
                rotulo={`Negócios ${h.periodo.label}`}
                valor={fmtNum(h.resultado.negocios)}
                variacao={h.resultado.negociosAnterior >= 3 ? ((h.resultado.negocios - h.resultado.negociosAnterior) / h.resultado.negociosAnterior) * 100 : null}
                contexto={h.resultado.negociosAnterior >= 3 ? 'vs período anterior' : `período anterior: ${h.resultado.negociosAnterior}`}
                serie={sparkNegocios(h.serie)}
                formula="Negócios realizados pela data de fechamento."
              />
              <Indice
                rotulo="Conversão lead → negócio"
                valor={fmtPct(h.conversao.atual)}
                variacao={h.conversao.anterior ? ((h.conversao.atual - h.conversao.anterior) / h.conversao.anterior) * 100 : null}
                contexto={`${h.conversao.negocios} de ${fmtNum(h.conversao.n)} · vs semestre anterior`}
                formula="Safra madura: leads que entraram entre 60 e 242 dias atrás, comparados com os 6 meses anteriores (a partir de out/2025)."
              />
              {h.finalidades.includes('Aluguel') && (
                <Indice
                  rotulo={`Locado pela esteira ${h.periodo.label}`}
                  valor={fmtMoeda(h.resultado.valorLocado)}
                  contexto={`${h.resultado.contratos} ${h.resultado.contratos === 1 ? 'contrato' : 'contratos'} · venda ainda sem valor no CRM`}
                  formula="Soma do valor das propostas de locação concluídas na esteira no período."
                />
              )}
            </div>
          </section>

          {/* 1 — Ritmo */}
          <Capitulo
            numero="1"
            pergunta="Estamos no ritmo?"
            conclusao={
              h.rit.media3m > 0
                ? `Pelo ritmo de ${fmtDecimal(h.rit.porDia)} leads/dia, o mês fecha em ~${fmtNum(h.rit.projecaoMes)} leads (média dos 3 meses anteriores: ${fmtNum(h.rit.media3m)}).`
                : 'Sem histórico suficiente para projetar o mês.'
            }
            rodape="A barra clara do mês atual é o que ainda deve entrar se o ritmo dos últimos 30 dias se mantiver. Negócios contam pelo mês de fechamento."
          >
            <div className="pg-duas">
              <GraficoMensal serie={h.serie} finalidades={h.finalidades} tipo="leads" referencia={h.rit.media3m} />
              <GraficoMensal serie={h.serie} finalidades={h.finalidades} tipo="negocios" />
            </div>
          </Capitulo>

          {/* 2 — Funil */}
          <Capitulo
            numero="2"
            pergunta="Onde o lead se perde?"
            conclusao={
              h.funilCap.pior
                ? (() => {
                    const g = h.funilCap.pior
                    const i = g.etapas.findIndex((e) => e.ordem === g.gargalo.ordem)
                    return `A maior perda está entre ${g.etapas[i - 1].label.toLowerCase()} e ${g.gargalo.label.toLowerCase()} na ${LABEL_FINALIDADE[g.finalidade].toLowerCase()}: só ${fmtPct(g.gargalo.passagem, 0)} avançam.`
                  })()
                : 'Amostra pequena demais para apontar um gargalo neste recorte.'
            }
            rodape={`Leads que entraram de ${fmtData(h.funilCap.janela.inicio)} a ${fmtData(h.funilCap.janela.fim)} (já tiveram tempo de fechar), comparados com ${fmtData(h.funilCap.anterior.inicio)}–${fmtData(h.funilCap.anterior.fim)}. Conta pela fase atual de cada atendimento: o CRM não guarda o histórico de fases.`}
          >
            <FunilCascata grupos={h.funilCap.grupos} />
          </Capitulo>

          {/* 3 — Quanto custa */}
          <Capitulo
            numero="3"
            pergunta="Quanto essa perda custa?"
            conclusao={(() => {
              const maior = h.descartes.porEtapa.reduce((m, e) => (e.n > m.n ? e : m), h.descartes.porEtapa[0])
              return `${fmtPct((maior.n / (h.descartes.total || 1)) * 100, 0)} dos descartes acontecem ${maior.etapa.toLowerCase()}: ${fmtNum(maior.n)} de ${fmtNum(h.descartes.total)} leads.`
            })()}
            rodape="Descartes da safra madura (desde out/2025), pela etapa em que o atendimento estava quando foi descartado. A simulação multiplica as passagens do funil acima pelo volume médio de leads dos últimos 3 meses."
          >
            <div className="pg-duas">
              <Descartes dados={h.descartes} />
              {h.funilCap.pior && <Simulador grupo={h.funilCap.pior} leadsPorMes={Math.round(h.leadsPorMes[h.funilCap.pior.finalidade])} />}
            </div>
          </Capitulo>

          {/* 4 — Canais */}
          <Capitulo
            numero="4"
            pergunta="Quais canais valem a pena?"
            conclusao={
              h.canaisCap.melhor && h.canaisCap.maiorVolume
                ? h.canaisCap.melhor.canal === h.canaisCap.maiorVolume.canal
                  ? `${h.canaisCap.melhor.canal} traz o maior volume e a melhor conversão (${fmtPct(h.canaisCap.melhor.conversao)}).`
                  : `${h.canaisCap.melhor.canal} converte melhor (${fmtPct(h.canaisCap.melhor.conversao)}); ${h.canaisCap.maiorVolume.canal} traz mais volume, mas converte ${fmtPct(h.canaisCap.maiorVolume.conversao)}.`
                : 'Amostra pequena demais para comparar canais neste recorte.'
            }
            rodape="Canais com 30 leads ou mais na safra madura. Leads de anúncio que entram pelo bot do WhatsApp ainda chegam ao CRM como “WhatsApp”, então o custo real da mídia paga está superestimado até a atribuição ficar pronta. O filtro de canal não se aplica a este capítulo."
          >
            <div className="pg-duas">
              <MatrizCanais canais={h.canaisCap.canais} destaque={filtros.canal !== 'todos' ? filtros.canal : h.canaisCap.melhor?.canal} />
              <GraficoCustoMidia dados={h.midia} />
            </div>
          </Capitulo>

          {/* 5 — Pessoas */}
          <Capitulo
            numero="5"
            pergunta="Quem precisa agir agora?"
            conclusao={`${fmtNum(h.pessoasCap.totais.semContato)} leads ativos sem nenhum contato, ${fmtNum(h.pessoasCap.totais.abertos30)} abertos há mais de 30 dias e ${fmtNum(h.pessoasCap.totais.vencidas30)} atividades vencidas no último mês.`}
            rodape={`Quanto mais escura a célula, pior em relação aos colegas. Clique num corretor para ver o painel inteiro só com a carteira dele. Há ainda ${fmtNum(h.pessoasCap.totais.esquecidas)} atividades vencidas há mais de 30 dias (provável limpeza no CRM). "Abertos" conta dias desde a entrada do lead; o CRM não exporta a data da última interação.`}
          >
            <MapaPessoas linhas={h.pessoasCap.linhas} selecionado={filtros.corretor} onSelecionar={(c) => setFiltro('corretor', filtros.corretor === c ? 'todos' : c)} />
          </Capitulo>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados fontes={h.saude} />
            <p className="pg-nota">
              Ciclo mediano até o fechamento: {h.ciclo == null ? '—' : `${fmtNum(h.ciclo)} dias`}. Conversões contam só leads a partir de out/2025, quando o CRM passou a trazer os negócios.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
