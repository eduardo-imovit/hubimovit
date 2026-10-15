import { useMemo } from 'react'
import { usePainelGestao } from '../hooks/usePaineis'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { BarraFiltros, Capitulo, Indice } from '../components/painel/Estrutura'
import { AtividadesEquipe, Descartes, EtapasAtivas, FunilCascata, MapaPessoas, PerdaCorretores, SaudeDados } from '../components/painel/Graficos'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados, somarDias } from '../lib/paineis'
import {
  atividadesVsEquipe,
  capituloPessoas,
  cicloMediano,
  conversaoSafra,
  descartesPorEtapa,
  emAtendimento,
  equipesComerciais,
  filtrarBase,
  FILTROS_PADRAO,
  FUNIS,
  funilPorOrigem,
  LABEL_FINALIDADE,
  listaDistinta,
  mancheteAtendimento,
  nomeCanal,
  perdaPorCorretor,
  resolverPeriodo,
  resultadoPeriodo,
} from '../lib/painelGestao'

const fmtData = (iso) => iso.split('-').reverse().join('/')

// Painel da Gestão v2 (PRD §5.0c, 15/10): foco no atendimento, não na entrada de leads.
export default function PainelGestao() {
  const hoje = isoLocal()
  const { filtros, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_PADRAO)
  const { dados, carregando, erro } = usePainelGestao()

  // canais com o nome de exibição (a view grava alguns sem acento)
  const baseNorm = useMemo(() => (dados ? dados.base.map((a) => ({ ...a, canal: nomeCanal(a.canal) })) : null), [dados])
  const equipes = useMemo(() => (dados ? equipesComerciais(dados.colaboradores) : new Map()), [dados])

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
    const soCorretor = (linhas, campo) => (filtros.corretor === 'todos' ? linhas : linhas.filter((l) => l[campo] === filtros.corretor))
    const atendimento = emAtendimento(base)
    const origem = funilPorOrigem(base, hoje)
    // a comparação com a equipe precisa de todos os corretores: ignora o filtro de corretor
    const semCorretor = filtrarBase(baseNorm, { ...filtros, corretor: 'todos' })
    const perda = perdaPorCorretor(semCorretor, hoje, equipes)
    const atividades = atividadesVsEquipe(dados.feitas, equipes, periodo, filtros.finalidade)
    const pessoasCap = capituloPessoas(
      {
        base,
        tempoResposta: soCorretor(dados.tempoResposta, 'corretor'),
        aging: soCorretor(dados.aging, 'corretor'),
        atividades: soCorretor(dados.atividades, 'nomeusuario'),
      },
      hoje
    )
    return {
      finalidades,
      periodo,
      resultado: resultadoPeriodo(base, propostas, periodo),
      conversao: conversaoSafra(base, hoje),
      ciclo: cicloMediano(base, hoje),
      atendimento,
      origem,
      perda,
      descartes: descartesPorEtapa(base, hoje),
      atividades,
      pessoasCap,
      saude: saudeDados(
        [
          { fonte: 'CRM · atendimentos', ultima: dados.ultimaCrm, toleranciaDias: 1 },
          { fonte: 'CRM · atividades', ultima: dados.ultimaAtividades, toleranciaDias: 1 },
        ],
        hoje
      ),
      frases: mancheteAtendimento({ atendimento, origem, perda, atividades, pessoasCap }),
    }
  }, [dados, baseNorm, equipes, filtros, hoje])

  const recorte = [
    filtros.finalidade !== 'todas' && LABEL_FINALIDADE[filtros.finalidade],
    filtros.canal !== 'todos' && filtros.canal,
    filtros.corretor !== 'todos' && filtros.corretor,
  ].filter(Boolean)

  const selecionar = (c) => setFiltro('corretor', filtros.corretor === c ? 'todos' : c)
  const [inbound, outbound] = FUNIS

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">Painel da Gestão</div>
          <div className="page-sub">Quem está em atendimento, onde perdemos e quem está trabalhando. {recorte.length > 0 && <strong>Recorte: {recorte.join(' · ')}</strong>}</div>
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
          {/* 0 — Manchete: em atendimento agora */}
          <section className="pg-manchete" aria-label="Manchete">
            <div className="pg-manchete-texto">
              {h.frases.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
            <div className="pg-indices">
              <Indice
                rotulo="Em atendimento (qualificado → proposta)"
                valor={fmtNum(h.atendimento.total)}
                contexto={h.finalidades.map((f) => `${LABEL_FINALIDADE[f]} ${fmtNum(h.atendimento[f])}`).join(' · ')}
                detalhe={`${inbound.label} ${fmtNum(h.atendimento.porFunil[inbound.chave])} · ${outbound.label} ${fmtNum(h.atendimento.porFunil[outbound.chave])}`}
                formula="Atendimentos ativos hoje nas fases Lead qualificado, Visita e Proposta do CRM (sem ruído e sem captação interna)."
              />
              <Indice
                rotulo="Propostas em andamento"
                valor={fmtNum(h.atendimento.proposta)}
                contexto={`${fmtNum(h.atendimento.visita)} em visita`}
                formula="Atendimentos ativos hoje na fase Proposta do CRM."
              />
              <Indice
                rotulo={`Atividades ${h.periodo.label}`}
                valor={fmtNum(h.atividades.total)}
                variacao={h.atividades.totalAnterior >= 10 ? ((h.atividades.total - h.atividades.totalAnterior) / h.atividades.totalAnterior) * 100 : null}
                contexto={h.atividades.totalAnterior >= 10 ? 'vs período anterior' : `período anterior: ${h.atividades.totalAnterior}`}
                detalhe={h.atividades.abaixo.length ? `${h.atividades.abaixo.length} abaixo da média da equipe` : 'ninguém abaixo da média'}
                formula="Atividades marcadas como realizadas no CRM, pela data da atividade, dos corretores da equipe comercial ativa. Não contam as Anotações."
              />
              <Indice
                rotulo={`Negócios ${h.periodo.label}`}
                valor={fmtNum(h.resultado.negocios)}
                variacao={h.resultado.negociosAnterior >= 3 ? ((h.resultado.negocios - h.resultado.negociosAnterior) / h.resultado.negociosAnterior) * 100 : null}
                contexto={h.resultado.negociosAnterior >= 3 ? 'vs período anterior' : `período anterior: ${h.resultado.negociosAnterior}`}
                formula="Negócios realizados pela data de fechamento. O valor de venda ainda não vem do CRM."
              />
              {h.finalidades.includes('Aluguel') && (
                <Indice
                  rotulo={`Locado pela esteira ${h.periodo.label}`}
                  valor={fmtMoeda(h.resultado.valorLocado)}
                  contexto={`${h.resultado.contratos} ${h.resultado.contratos === 1 ? 'contrato' : 'contratos'}`}
                  formula="Soma do valor das propostas de locação concluídas na esteira no período."
                />
              )}
            </div>
          </section>

          {/* 1 — Funil: clientes por etapa, inbound × outbound */}
          <Capitulo
            numero="1"
            pergunta="Como está o funil?"
            conclusao={(() => {
              const i = h.atendimento.porFunil[inbound.chave]
              const o = h.atendimento.porFunil[outbound.chave]
              const total = i + o
              if (!total) return 'Nenhum cliente entre qualificado e proposta neste recorte.'
              return `${fmtPct((o / total) * 100, 0)} dos clientes entre qualificado e proposta vieram do outbound (${fmtNum(o)} de ${fmtNum(total)}).`
            })()}
            rodape={`À esquerda, quem está ativo hoje em cada etapa. À direita, a conversão: leads que entraram de ${fmtData(h.origem.janela.inicio)} a ${fmtData(h.origem.janela.fim)} (já tiveram tempo de fechar), pela fase atual de cada atendimento; o CRM não guarda o histórico de fases. Inbound e outbound vêm do campo "funil" do CRM.`}
          >
            <div className="pg-duas">
              <EtapasAtivas etapas={h.atendimento.etapas} />
              <FunilCascata grupos={h.origem.grupos} />
            </div>
          </Capitulo>

          {/* 2 — Onde perdemos: passagem mais fraca, corretor × equipe */}
          <Capitulo
            numero="2"
            pergunta="Onde perdemos mais?"
            conclusao={
              h.perda
                ? (() => {
                    const pior = h.perda.corretores.find((c) => c.dif != null && c.dif < 0)
                    const base = `A maior perda está entre ${h.perda.de.toLowerCase()} e ${h.perda.para.toLowerCase()}: só ${fmtPct(h.perda.geral, 0)} avançam.`
                    return pior ? `${base} ${pior.corretor} está ${fmtNum(Math.abs(pior.dif), 0)} p.p. abaixo da equipe.` : base
                  })()
                : 'Amostra pequena demais para apontar onde perdemos neste recorte.'
            }
            rodape="Safra madura (mesma janela do funil). A taxa de cada corretor é comparada com a da equipe dele (venda ou locação, pelo cadastro de colaboradores). Com menos de 5 leads na etapa anterior, só mostramos o número. O filtro de corretor não se aplica à tabela, para manter a comparação."
          >
            <div className="pg-duas">
              {h.perda ? <PerdaCorretores perda={h.perda} selecionado={filtros.corretor} /> : <div />}
              <Descartes dados={h.descartes} />
            </div>
          </Capitulo>

          {/* 3 — Atividades × média da equipe */}
          <Capitulo
            numero="3"
            pergunta="Quem está atendendo?"
            conclusao={
              h.atividades.abaixo.length
                ? `${h.atividades.abaixo.length} ${h.atividades.abaixo.length === 1 ? 'corretor fez' : 'corretores fizeram'} menos atividades que a média da equipe ${h.periodo.label}.`
                : `Todos os corretores estão na média da equipe ou acima ${h.periodo.label}.`
            }
            rodape="Atividades realizadas no CRM (ligações, WhatsApp, visitas, reuniões etc., sem as Anotações). A linha escura é a média da equipe; na média = até 10% acima ou abaixo dela. Passe o mouse para ver o período anterior; clique para filtrar o painel pelo corretor."
          >
            <AtividadesEquipe grupos={h.atividades.grupos} selecionado={filtros.corretor} onSelecionar={selecionar} />
          </Capitulo>

          {/* 4 — Pessoas */}
          <Capitulo
            numero="4"
            pergunta="Quem precisa agir agora?"
            conclusao={`${fmtNum(h.pessoasCap.totais.semContato)} leads ativos sem nenhum contato, ${fmtNum(h.pessoasCap.totais.abertos30)} abertos há mais de 30 dias e ${fmtNum(h.pessoasCap.totais.vencidas30)} atividades vencidas no último mês.`}
            rodape={`Quanto mais escura a célula, pior em relação aos colegas. Clique num corretor para ver o painel inteiro só com a carteira dele. Há ainda ${fmtNum(h.pessoasCap.totais.esquecidas)} atividades vencidas há mais de 30 dias (provável limpeza no CRM). "Abertos" conta dias desde a entrada do lead; o CRM não exporta a data da última interação.`}
          >
            <MapaPessoas linhas={h.pessoasCap.linhas} selecionado={filtros.corretor} onSelecionar={selecionar} />
          </Capitulo>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados fontes={h.saude} />
            <p className="pg-nota">
              Conversão lead → negócio na safra madura: {fmtPct(h.conversao.atual)} ({h.conversao.negocios} de {fmtNum(h.conversao.n)}). Ciclo mediano até o fechamento: {h.ciclo == null ? '—' : `${fmtNum(h.ciclo)} dias`}. Conversões contam só leads a partir de out/2025, quando o CRM passou a trazer os negócios.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
