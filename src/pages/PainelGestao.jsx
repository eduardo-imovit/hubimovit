import { useMemo } from 'react'
import { usePainelGestao } from '../hooks/usePaineis'
import { usePerfil } from '../hooks/usePerfil'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { BarraFiltros, Capitulo, Indice } from '../components/painel/Estrutura'
import { AtividadesPainel, Descartes, FunilLinhas, MapaPessoas, PerdaComparada, SaudeDados } from '../components/painel/Graficos'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados, somarDias } from '../lib/paineis'
import {
  atividadesPainel,
  capituloPessoas,
  cicloMediano,
  conversaoSafra,
  descartesPorEtapa,
  emAtendimento,
  equipesComerciais,
  filtrarBase,
  FILTROS_PADRAO_GESTAO,
  FUNIS,
  funilPorOrigem,
  LABEL_FINALIDADE,
  listaDistinta,
  mancheteAtendimento,
  nomeCanal,
  perdaComparada,
  resolverPeriodo,
  resultadoPeriodo,
} from '../lib/painelGestao'

const fmtData = (iso) => iso.split('-').reverse().join('/')

// Painel da Gestão v2 (PRD §5.0c, 15/10): foco no atendimento, não na entrada de leads.
export default function PainelGestao() {
  const hoje = isoLocal()
  const { filtros, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_PADRAO_GESTAO)
  const { perfil } = usePerfil()
  // comparar corretor × corretor: só a Gestão (pedido de 15/10)
  const ehGestao = perfil?.role === 'gestao'
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
    // onde perdemos: respeita o filtro; com corretor, a referência é a equipe dele (sem nomes)
    const comCorretor = filtros.corretor !== 'todos'
    const equipeSel = comCorretor ? equipes.get(filtros.corretor.trim().toLowerCase())?.equipe : null
    const baseEquipe = comCorretor
      ? filtrarBase(baseNorm, { ...filtros, corretor: 'todos' }).filter((a) => equipeSel && equipes.get((a.corretor ?? '').trim().toLowerCase())?.equipe === equipeSel)
      : null
    const comparar = ehGestao && filtros.comparar !== 'nenhum' && filtros.comparar !== filtros.corretor ? filtros.comparar : 'nenhum'
    const perda = perdaComparada({
      base,
      baseEquipe,
      baseComparar: comparar !== 'nenhum' ? filtrarBase(baseNorm, { ...filtros, corretor: comparar }) : null,
      hoje,
      corretor: comCorretor ? filtros.corretor : null,
    })
    const atividades = atividadesPainel(dados.feitas, equipes, periodo, filtros)
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
      comparar,
      frases: mancheteAtendimento({ atendimento, perda, atividades, pessoasCap, corretor: comCorretor ? filtros.corretor : null }),
    }
  }, [dados, baseNorm, equipes, filtros, hoje, ehGestao])

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
                variacao={h.atividades.anterior >= 10 ? ((h.atividades.total - h.atividades.anterior) / h.atividades.anterior) * 100 : null}
                contexto={h.atividades.anterior >= 10 ? 'vs período anterior' : `período anterior: ${h.atividades.anterior}`}
                detalhe={
                  h.atividades.modo === 'corretor'
                    ? h.atividades.media == null
                      ? 'sem equipe no cadastro'
                      : `${h.atividades.selo?.label ?? 'Na média'} (equipe: ${fmtNum(h.atividades.media, 0)})`
                    : h.atividades.abaixo.length
                      ? `${h.atividades.abaixo.length} abaixo da média da equipe`
                      : 'ninguém abaixo da média'
                }
                formula="Atividades marcadas como realizadas no CRM, pela data da atividade. Não contam as Anotações. Média da equipe = total da equipe ÷ corretores da equipe comercial ativa (inclui quem fez zero)."
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
            rodape={`Cada linha é um funil, com quem está ativo hoje em cada etapa; os valores estão na legenda ao lado. Abaixo da linha, a conversão de cada passagem (em vermelho, a mais fraca): leads que entraram de ${fmtData(h.origem.janela.inicio)} a ${fmtData(h.origem.janela.fim)} (já tiveram tempo de fechar), pela fase atual de cada atendimento; o CRM não guarda o histórico de fases. Inbound e outbound vêm do campo "funil" do CRM.`}
          >
            <FunilLinhas etapas={h.atendimento.etapas} grupos={h.origem.grupos} />
          </Capitulo>

          {/* 2 — Onde perdemos: respeita os filtros; Gestão compara com outro corretor */}
          <Capitulo
            numero="2"
            pergunta="Onde perdemos mais?"
            conclusao={
              h.perda.pior
                ? `A maior perda está entre ${h.perda.pior.de.toLowerCase()} e ${h.perda.pior.para.toLowerCase()}: só ${fmtPct(h.perda.pior.taxa, 0)} avançam${
                    h.perda.pior.dif != null ? ` (${h.perda.rotuloRef.toLowerCase()}: ${fmtPct(h.perda.pior.ref, 0)})` : ''
                  }.`
                : 'Amostra pequena demais para apontar onde perdemos neste recorte.'
            }
            rodape={`Safra madura (mesma janela do funil). ${
              filtros.corretor !== 'todos'
                ? 'A referência é a média da equipe do corretor (venda ou locação, pelo cadastro de colaboradores).'
                : 'A referência é o semestre anterior.'
            } Com menos de ${h.perda.minimo} leads na etapa de origem, a diferença não é calculada.${ehGestao ? ' "Comparar com" aparece só para a Gestão.' : ''}`}
          >
            <div className="pg-duas">
              <PerdaComparada
                perda={h.perda}
                rotuloSel={filtros.corretor !== 'todos' ? filtros.corretor : 'Recorte atual'}
                comparar={h.comparar}
                opcoesComparar={opcoes.corretores.filter((c) => c !== filtros.corretor)}
                onComparar={ehGestao ? (v) => setFiltro('comparar', v) : null}
              />
              <Descartes dados={h.descartes} />
            </div>
          </Capitulo>

          {/* 3 — Atividades: volume e variedade × média da equipe */}
          <Capitulo
            numero="3"
            pergunta="Quem está atendendo?"
            conclusao={
              h.atividades.modo === 'corretor'
                ? h.atividades.media == null
                  ? `${fmtNum(h.atividades.total)} atividades realizadas ${h.periodo.label}.`
                  : `${fmtNum(h.atividades.total)} atividades em ${fmtNum(h.atividades.variedade)} tipos ${h.periodo.label}; a média da equipe é ${fmtNum(h.atividades.media, 0)}.`
                : h.atividades.abaixo.length
                  ? `${h.atividades.abaixo.length} ${h.atividades.abaixo.length === 1 ? 'corretor fez' : 'corretores fizeram'} menos atividades que a média da equipe ${h.periodo.label}.`
                  : `Todos os corretores estão na média da equipe ou acima ${h.periodo.label}.`
            }
            rodape="Atividades realizadas no CRM, sem as Anotações. Na média = até 10% acima ou abaixo da média da equipe. Clique num corretor para filtrar o painel por ele."
          >
            <AtividadesPainel dados={h.atividades} selecionado={filtros.corretor} onSelecionar={selecionar} />
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
