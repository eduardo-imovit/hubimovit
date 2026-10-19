import { useMemo, useState } from 'react'
import { usePainelGestao } from '../hooks/usePaineis'
import { usePerfil } from '../hooks/usePerfil'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { BarraFiltros, Capitulo, Indice } from '../components/painel/Estrutura'
import { AtividadesPainel, CarteiraCaptadores, Descartes, EstoqueDisponivel, FunilLinhas, JornadaLinha, MapaPessoas, MotivosDescarte, PerdaComparada, SaudeDados } from '../components/painel/Graficos'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados } from '../lib/paineis'
import { fmtMoedaCurta } from '../lib/admLocacao'
import {
  atividadesPainel,
  AVISO_JORNADA_ATE,
  capituloPessoas,
  carteiraPorCaptador,
  estoqueDisponivel,
  cicloMediano,
  conversaoSafra,
  DIAS_DESATUALIZADO,
  descartesPorEtapa,
  emAtendimento,
  equipesComerciais,
  ETAPAS_JORNADA,
  filtrarBase,
  fmtDecimal,
  jornadaLead,
  MIN_PASSAGENS_TEMPO,
  NA_ETAPA,
  motivosDescarte,
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
  // etapa clicada na linha de descartes da jornada → motivos só dela
  const [etapaDescarte, setEtapaDescarte] = useState(null)

  // canais com o nome de exibição (a view grava alguns sem acento)
  const baseNorm = useMemo(() => (dados ? dados.base.map((a) => ({ ...a, canal: nomeCanal(a.canal) })) : null), [dados])
  const equipes = useMemo(() => (dados ? equipesComerciais(dados.colaboradores) : new Map()), [dados])

  const opcoes = useMemo(() => {
    if (!baseNorm) return { canais: [], corretores: [] }
    const validos = baseNorm.filter((a) => !a.is_ruido && !a.is_interno)
    // só corretores ativos (equipe comercial, cargo vendas ou locação), pedido de 15/10
    const corretores = [...equipes.values()].map((v) => v.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return { canais: listaDistinta(validos, 'canal'), corretores }
  }, [baseNorm, equipes])

  const h = useMemo(() => {
    if (!dados || !baseNorm) return null
    const base = filtrarBase(baseNorm, filtros)
    const finalidades = filtros.finalidade === 'todas' ? ['Venda', 'Aluguel'] : [filtros.finalidade]
    const periodo = resolverPeriodo(filtros.periodo, hoje)
    const propostas = filtros.finalidade === 'Venda' ? [] : dados.propostas
    const soCorretor = (linhas, campo) => (filtros.corretor === 'todos' ? linhas : linhas.filter((l) => l[campo] === filtros.corretor))
    const atendimento = emAtendimento(base)
    const origem = funilPorOrigem(base, periodo)
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
      jornada: jornadaLead({ base, etapas: dados.jornadaEtapas, descartes: dados.jornadaDescartes, periodo }),
      motivos: motivosDescarte({ base, descartes: dados.jornadaDescartes, periodo, posicao: etapaDescarte }),
      atividades,
      pessoasCap,
      // carteira por captador: o estoque só é lido pela Gestão (RLS)
      carteira: ehGestao ? carteiraPorCaptador(dados.estoque, filtros.finalidade) : null,
      disponivel: ehGestao ? estoqueDisponivel(dados.estoque, filtros.finalidade) : null,
      saude: saudeDados(
        [
          { fonte: 'CRM · atendimentos', ultima: dados.ultimaCrm, toleranciaDias: 1 },
          { fonte: 'CRM · atividades', ultima: dados.ultimaAtividades, toleranciaDias: 1 },
          ...(ehGestao ? [{ fonte: 'Imoview · estoque de imóveis', ultima: dados.ultimaEstoque, toleranciaDias: 1 }] : []),
        ],
        hoje
      ),
      comparar,
      frases: mancheteAtendimento({ atendimento, perda, atividades, pessoasCap, corretor: comCorretor ? filtros.corretor : null }),
    }
  }, [dados, baseNorm, equipes, filtros, hoje, ehGestao, etapaDescarte])

  const recorte = [
    filtros.finalidade !== 'todas' && LABEL_FINALIDADE[filtros.finalidade],
    filtros.canal !== 'todos' && filtros.canal,
    filtros.corretor !== 'todos' && filtros.corretor,
  ].filter(Boolean)

  const selecionar = (c) => setFiltro('corretor', filtros.corretor === c ? 'todos' : c)
  // o captador vem do Imoview; só vira filtro quando é um corretor da lista (mesmo nome, sem diferenciar maiúsculas)
  const corretorDoCaptador = (nome) => opcoes.corretores.find((c) => c.trim().toLowerCase() === nome.trim().toLowerCase()) ?? null
  const [inbound, outbound] = FUNIS
  const avisoJornada = hoje <= AVISO_JORNADA_ATE && (
    <div className="pg-aviso" role="note">
      <strong>Base de dados em construção.</strong> A jornada é medida desde 06/10: os números ainda são poucos e vão ganhar amostra nas próximas semanas.
    </div>
  )

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
            pergunta={`Como foi o funil ${h.periodo.label}?`}
            conclusao={(() => {
              const parte = (g) =>
                `${g.rotulo}: ${fmtNum(g.total)} ${g.total === 1 ? 'entrou' : 'entraram'}, ${fmtNum(g.proposta)} ${g.proposta === 1 ? 'chegou' : 'chegaram'} a proposta${
                  g.conversao != null ? ` (${fmtPct(g.conversao, 0)})` : ''
                } e ${fmtNum(g.negocios)} ${g.negocios === 1 ? 'virou negócio' : 'viraram negócio'}`
              if (!h.origem.grupos.some((g) => g.total)) return 'Nenhum lead entrou no período neste recorte.'
              return h.origem.grupos.map(parte).join('. ') + '.'
            })()}
            rodape={`Cada linha é um funil com os leads que entraram ${h.periodo.label}, divididos pela etapa mais avançada que alcançaram (pela fase atual no CRM, que não guarda o histórico de fases); os valores estão na legenda ao lado. Abaixo da linha, a conversão de cada passagem (em vermelho, a mais fraca) e, entre parênteses, a diferença para o período anterior. Em períodos curtos ou no mês corrente a conversão parece menor: muitos leads ainda estão em andamento. Inbound e outbound vêm do campo "funil" do CRM.`}
          >
            <FunilLinhas grupos={h.origem.grupos} />
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
            <div className="pg-empilhado">
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

          {/* 3 — Jornada do lead: volume por etapa, dias para avançar, descartados (PRD §5.12) */}
          <Capitulo
            numero="3"
            pergunta="Quanto tempo o lead leva em cada etapa?"
            conclusao={(() => {
              const j = h.jornada
              if (!j.n[0]) return `Nenhum lead andou na jornada ${h.periodo.label} neste recorte (a jornada é medida desde 06/10).`
              if (j.lento == null) return `Tempos ainda acumulando: cada etapa precisa de ${MIN_PASSAGENS_TEMPO} passagens no período para ter média.`
              return `O lead trava ${NA_ETAPA[j.lento]}: ${fmtDecimal(j.dias[j.lento].media)} dias em média para avançar.`
            })()}
            rodape={`Quadro: leads que chegaram até a etapa ${h.periodo.label} (pela etapa mais avançada; quem pulou etapa conta nas que pulou). Seta: dias em média entre entrar na etapa e passar para uma etapa à frente, nas passagens concluídas no período; "acum." = menos de ${MIN_PASSAGENS_TEMPO} passagens (passe o mouse para ver quantas). Em coral, a transição mais lenta. Em vermelho, os descartados na etapa, pela data do descarte; clique para ver os motivos no capítulo 4. A jornada é lida do CRM todo dia desde 06/10 (precisão de 1 dia); leads que já estavam no meio do funil nessa data ficam fora.`}
          >
            {avisoJornada}
            <p className="jl-como">Leads em cada etapa · dias em média para avançar · <b>descartados</b></p>
            <JornadaLinha dados={h.jornada} etapaSel={etapaDescarte} onEtapa={setEtapaDescarte} />
          </Capitulo>

          {/* 4 — Motivos de descarte (todas as etapas ou a clicada no capítulo 3) */}
          <Capitulo
            numero="4"
            pergunta="Por que os leads são descartados?"
            conclusao={(() => {
              const m = h.motivos
              if (!m.total) return `Nenhum descarte com motivo ${h.periodo.label} neste recorte.`
              const onde = etapaDescarte ? `${NA_ETAPA[etapaDescarte - 1].charAt(0).toUpperCase()}${NA_ETAPA[etapaDescarte - 1].slice(1)}, o` : 'O'
              return `${onde} motivo mais comum é "${m.motivos[0].motivo}": ${fmtNum(m.motivos[0].n)} de ${fmtNum(m.total)} descartes (${fmtPct((m.motivos[0].n / m.total) * 100, 0)}).`
            })()}
            rodape="Motivo padrão que o corretor escolhe no Imoview ao descartar (o texto antes da vírgula; a observação livre fica de fora). Conta os descartes vistos pela jornada desde 06/10, pela data do descarte."
          >
            {avisoJornada}
            {etapaDescarte && (
              <p className="jl-como">
                Só {ETAPAS_JORNADA[etapaDescarte - 1].toLowerCase()} ·{' '}
                <button type="button" className="btn-link" onClick={() => setEtapaDescarte(null)}>
                  ver todas as etapas
                </button>
              </p>
            )}
            <MotivosDescarte dados={h.motivos} titulo={etapaDescarte ? `Motivos ${NA_ETAPA[etapaDescarte - 1]}` : 'Motivos de todas as etapas'} />
          </Capitulo>

          {/* 5 — Atividades: volume e variedade × média da equipe */}
          <Capitulo
            numero="5"
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

          {/* 6 — Estoque disponível + mapa de calor (só Gestão) */}
          {h.disponivel && (
            <Capitulo
              numero="6"
              pergunta="Quanto temos disponível?"
              conclusao={(() => {
                const d = h.disponivel
                if (!d.total) return 'Nenhum imóvel vago/disponível neste recorte.'
                const partes = ['Venda', 'Aluguel']
                  .filter((f) => d.porFinalidade[f].n > 0)
                  .map((f) => `${fmtNum(d.porFinalidade[f].n)} ${f === 'Venda' ? 'à venda' : 'para locação'}`)
                const tipo = d.tipos[0] ? ` ${d.tipos[0].tipo} é o tipo com mais imóveis (${fmtNum(d.tipos[0].n)}).` : ''
                const onde = d.bairrosTop.length ? ` O estoque se concentra em ${d.bairrosTop.map((b) => b.bairro).join(', ')}.` : ''
                return `Temos ${fmtNum(d.total)} imóveis vagos/disponíveis: ${partes.join(' e ')}.${tipo}${onde}`
              })()}
              rodape="Clique num tipo para abrir a busca do Estoque com ele. Disponível = situação Vago/Disponível no Imoview, lido todo dia (em moderação, reforma e desocupação ficam fora deste card, mas entram no mapa). Valores: soma e mediana do preço pedido; locação em R$/mês, nunca somada à venda. O mapa mostra o estoque inteiro de hoje pela localização cadastrada no Imoview; quanto mais quente, mais imóveis. Mapa © OpenStreetMap."
            >
              <EstoqueDisponivel dados={h.disponivel} finalidade={filtros.finalidade} />
            </Capitulo>
          )}

          {/* 7 — Carteira de imóveis por captador (só Gestão) */}
          {h.carteira && (
            <Capitulo
              numero="7"
              pergunta="A carteira está atualizada?"
              conclusao={(() => {
                const c = h.carteira
                // venda em R$ e locação em R$/mês, nunca somados
                const valorDesat = (l) =>
                  [
                    l.valorDesat.Venda ? `${fmtMoedaCurta(l.valorDesat.Venda)} em venda` : null,
                    l.valorDesat.Aluguel ? `${fmtMoedaCurta(l.valorDesat.Aluguel)}/mês em locação` : null,
                  ].filter(Boolean).join(' e ')
                if (!c.total) return 'Ainda não há imóveis em estoque carregados do Imoview.'
                const geral = `${fmtPct(c.pctAtualizado, 0)} dos ${fmtNum(c.total)} imóveis em estoque foram atualizados nos últimos ${DIAS_DESATUALIZADO} dias.`
                const sel = filtros.corretor !== 'todos' ? c.linhas.find((l) => l.captador.trim().toLowerCase() === filtros.corretor.trim().toLowerCase()) : null
                if (filtros.corretor !== 'todos') {
                  return sel
                    ? `${geral} ${filtros.corretor} capta ${fmtNum(sel.n)}: ${fmtNum(sel.atualizados)} atualizados e ${fmtNum(sel.desatualizados)} desatualizados${valorDesat(sel) ? `, somando ${valorDesat(sel)}` : ''}.`
                    : `${geral} ${filtros.corretor} não aparece como captador de nenhum imóvel em estoque.`
                }
                return c.pior
                  ? `${geral}${valorDesat(c) ? ` Os desatualizados somam ${valorDesat(c)}.` : ''} ${c.pior.captador} tem mais imóveis desatualizados: ${fmtNum(c.pior.desatualizados)} de ${fmtNum(c.pior.n)}.`
                  : `${geral} Nenhum captador tem imóvel desatualizado.`
              })()}
              rodape={`Imóveis em estoque no Imoview (Vago/Disponível, Em moderação, Em reforma e Em desocupação), lidos todo dia. Atualizado = alterado ou validado nos últimos ${DIAS_DESATUALIZADO} dias. Imóvel com mais de um captador conta para cada um, então a soma por captador pode passar do total. Valor desatualizado soma o preço pedido dos imóveis desatualizados; venda e locação (R$/mês) ficam separadas. Selo: 80% ou mais em verde, de 50% a 79% em amarelo, abaixo de 50% em vermelho.${
                h.carteira.semCaptador.n ? ` ${fmtNum(h.carteira.semCaptador.n)} imóveis ainda sem captador lido (a leitura do detalhe vem no dia seguinte).` : ''
              } Clique num captador (quando ele é um corretor da equipe) para filtrar o painel por ele.`}
            >
              <CarteiraCaptadores
                dados={h.carteira}
                finalidade={filtros.finalidade}
                selecionado={filtros.corretor === 'todos' ? null : h.carteira.linhas.find((l) => corretorDoCaptador(l.captador) === filtros.corretor)?.captador ?? null}
                podeSelecionar={(nome) => corretorDoCaptador(nome) != null}
                onSelecionar={(nome) => selecionar(corretorDoCaptador(nome))}
              />
            </Capitulo>
          )}

          {/* 8 — Pessoas */}
          <Capitulo
            numero={h.carteira ? '8' : '6'}
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
