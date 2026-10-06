import { useMemo } from 'react'
import { usePainelComercial } from '../hooks/usePaineis'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { usePerfil } from '../hooks/usePerfil'
import { PROPOSTAS_ATIVAS } from '../lib/acessos'
import { BarraFiltros, Capitulo, Indice } from '../components/painel/Estrutura'
import { Descartes, SaudeDados, Simulador } from '../components/painel/Graficos'
import { EmAtendimentoEtapas, FunilEtapas, GraficoRitmo, PropostasMesa, Recorte, TabelaCanais, VisitasBairro, VisitasTipo } from '../components/painel/GraficosComercial'
import { fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados } from '../lib/paineis'
import { fmtDecimal, LABEL_FINALIDADE, listaDistinta } from '../lib/painelGestao'
import {
  aplicarFiltros,
  baseComercial,
  canaisCoorte,
  descartesCoorte,
  descreverRecorte,
  emAtendimentoPorEtapa,
  FILTROS_COMERCIAL,
  funilComercial,
  indicesComercial,
  OPCOES_PERIODO_COMERCIAL,
  prepararVisitas,
  propostasNaMesa,
  resolverPeriodoComercial,
  ritmoLeads,
  visitasPorBairro,
  visitasPorTipo,
} from '../lib/painelComercial'

export default function PainelComercial() {
  const hoje = isoLocal()
  const { filtros: filtrosUrl, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_COMERCIAL)
  const { dados, carregando, erro } = usePainelComercial()
  const { perfil, carregando: carregandoPerfil } = usePerfil()
  const ehCorretor = perfil?.role === 'corretor'

  // filtro geral: só a equipe comercial ativa (PRD §5.8)
  const comerciais = useMemo(
    () => (dados ? dados.colaboradores.filter((c) => c.equipe === 'comercial' && c.ativo) : []),
    [dados]
  )
  // Corretor vê só os próprios dados (PRD §5.8): o filtro de corretor fica
  // travado no nome do CRM ligado ao e-mail do login, e a URL não muda isso.
  const meuNome = useMemo(() => {
    if (!ehCorretor || !perfil?.email) return null
    return comerciais.find((c) => (c.email_oficial ?? '').toLowerCase() === perfil.email.toLowerCase())?.nome_completo ?? null
  }, [ehCorretor, perfil, comerciais])
  const filtros = useMemo(() => (ehCorretor ? { ...filtrosUrl, corretor: meuNome ?? '—' } : filtrosUrl), [ehCorretor, filtrosUrl, meuNome])

  const base = useMemo(() => (dados ? baseComercial(dados.base, comerciais.map((c) => c.nome_completo)) : null), [dados, comerciais])

  const opcoes = useMemo(
    () => ({ canais: base ? listaDistinta(base, 'canal') : [], corretores: comerciais.map((c) => c.nome_completo).sort((a, b) => a.localeCompare(b, 'pt-BR')) }),
    [base, comerciais]
  )

  const h = useMemo(() => {
    if (!dados || !base || carregandoPerfil || (ehCorretor && !meuNome)) return null
    const periodo = resolverPeriodoComercial(filtros.periodo, hoje)
    const filtrada = aplicarFiltros(base, filtros)
    const finalidades = filtros.finalidade === 'todas' ? ['Venda', 'Aluguel'] : [filtros.finalidade]
    const visitas = prepararVisitas(dados.visitas, filtrada)
    const funil = funilComercial(filtrada, periodo, finalidades)
    const meses = Math.max(1, periodo.dias / 30.4)
    return {
      periodo,
      finalidades,
      recorte: descreverRecorte(filtros, periodo),
      indices: indicesComercial(filtrada, visitas, periodo),
      funil,
      ritmo: ritmoLeads(filtrada, periodo, hoje),
      descartes: descartesCoorte(filtrada, periodo),
      leadsPorMes: funil.pior ? Math.round(filtrada.filter((a) => a.finalidade === funil.pior.finalidade && a.data_entrada >= periodo.inicio && a.data_entrada <= periodo.fim).length / meses) : 0,
      canais: canaisCoorte(filtrada, periodo),
      emAtendimento: emAtendimentoPorEtapa(filtrada, periodo),
      bairros: visitasPorBairro(visitas, periodo),
      tipos: visitasPorTipo(visitas, periodo),
      mesa: propostasNaMesa(
        { venda: dados.propostasVenda, locacao: dados.propostasLocacao, perfis: dados.perfis, colaboradores: comerciais },
        filtros,
        periodo
      ),
      saude: saudeDados(
        [
          { fonte: 'CRM · atendimentos', ultima: dados.ultimaCrm, toleranciaDias: 1 },
          { fonte: 'CRM · atividades', ultima: dados.ultimaAtividades, toleranciaDias: 1 },
        ],
        hoje
      ),
    }
  }, [dados, base, comerciais, filtros, hoje, carregandoPerfil, ehCorretor, meuNome])

  const coorteTxt = h ? `Leads que entraram ${h.periodo.label}` : ''

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">{ehCorretor ? 'Meus números' : 'Comercial'}</div>
          <div className="page-sub">
            {ehCorretor
              ? 'Os seus atendimentos, visitas e propostas. Todos os números seguem os filtros abaixo.'
              : 'Todos os números seguem os filtros abaixo. Só entram atendimentos de corretores da equipe comercial ativa.'}
          </div>
        </div>
      </header>

      <BarraFiltros
        filtros={filtros}
        setFiltro={setFiltro}
        limpar={limpar}
        canais={opcoes.canais}
        corretores={opcoes.corretores}
        alterados={alterados}
        opcoesPeriodo={OPCOES_PERIODO_COMERCIAL}
        rotuloCanal="Mídia"
        corretorFixo={ehCorretor ? meuNome ?? 'não identificado' : null}
      />

      {dados && ehCorretor && !meuNome && (
        <div className="hub-error">
          Não encontramos você na equipe comercial ativa do CRM pelo e-mail {perfil?.email}. Peça à Gestão para conferir o seu cadastro no Imoview.
        </div>
      )}

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
          <section className="pg-manchete" aria-label="Índices do período">
            <div className="pg-indices">
              <Indice
                rotulo={`Leads que entraram ${h.periodo.label}`}
                valor={fmtNum(h.indices.leads)}
                variacao={h.indices.leadsVar}
                contexto={`vs período anterior (${fmtNum(h.indices.leadsAnt)})`}
                detalhe={`${fmtNum(h.indices.emAtendimento)} seguem em atendimento`}
                formula="Atendimentos pela data de entrada, sem ruído e sem captação interna."
              />
              <Indice
                rotulo="Leads qualificados"
                valor={fmtNum(h.indices.qualificados)}
                variacao={h.indices.qualificadosVar}
                contexto={`vs período anterior (${fmtNum(h.indices.qualificadosAnt)})`}
                detalhe={`${fmtPct((h.indices.qualificados / (h.indices.leads || 1)) * 100, 0)} dos leads que entraram`}
                formula="Leads que entraram no período e já chegaram a Lead qualificado ou além."
              />
              <Indice
                rotulo="Visitas agendadas"
                valor={fmtNum(h.indices.visitas)}
                variacao={h.indices.visitasVar}
                contexto={`vs período anterior (${fmtNum(h.indices.visitasAnt)})`}
                detalhe={`${fmtNum(h.indices.visitasRealizadas)} já realizadas`}
                formula="Atividades do tipo Visita com data no período, ligadas a um atendimento do recorte (qualquer data de entrada)."
              />
              <Indice
                rotulo="Chegaram à proposta"
                valor={fmtNum(h.indices.propostas)}
                variacao={h.indices.propostasVar}
                contexto={h.indices.propostasAnt >= 3 ? `vs período anterior (${fmtNum(h.indices.propostasAnt)})` : `período anterior: ${h.indices.propostasAnt}`}
                detalhe={`${fmtPct((h.indices.propostas / (h.indices.leads || 1)) * 100, 0)} dos leads que entraram`}
                formula="Leads que entraram no período e já chegaram a Proposta ou Negócio."
              />
            </div>
            <p className="pg-recorte pg-recorte--escuro">{h.recorte}</p>
          </section>

          <Capitulo
            numero="1"
            pergunta="Como o lead avança no funil?"
            conclusao={
              h.funil.pior
                ? (() => {
                    const g = h.funil.pior
                    const i = g.etapas.findIndex((e) => e.ordem === g.gargalo.ordem)
                    return `A maior queda está entre ${g.etapas[i - 1].label.toLowerCase()} e ${g.gargalo.label.toLowerCase()} na ${LABEL_FINALIDADE[g.finalidade].toLowerCase()}: só ${fmtPct(g.gargalo.passagem, 0)} avançam.`
                  })()
                : 'Amostra pequena demais para apontar a maior queda neste recorte.'
            }
            rodape="Cada etapa conta os leads do período que já passaram por ela (fase atual ou negócio realizado). Leads recentes ainda estão avançando, então períodos curtos e o mês atual mostram taxas mais baixas nas etapas finais. A comparação é com os leads do período anterior de mesmo tamanho."
          >
            <Recorte oque={coorteTxt} recorte={h.recorte} />
            <FunilEtapas grupos={h.funil.grupos} />
          </Capitulo>

          <Capitulo
            numero="2"
            pergunta="Estamos no ritmo?"
            conclusao={
              h.ritmo.projecaoMes != null
                ? `${fmtDecimal(h.ritmo.porDia)} leads por dia; nesse ritmo o mês fecha com cerca de ${fmtNum(h.ritmo.projecaoMes)} leads.`
                : `${fmtDecimal(h.ritmo.porDia)} leads por dia ${h.periodo.label} (antes: ${fmtDecimal(h.ritmo.porDiaAnterior)}).`
            }
            rodape="Ritmo = leads que entraram no período ÷ dias decorridos. A projeção só aparece no mês atual: realizado + dias restantes × ritmo."
          >
            <Recorte oque={coorteTxt} recorte={h.recorte} />
            <GraficoRitmo serie={h.ritmo.serie} finalidades={h.finalidades} gran={h.ritmo.gran} />
          </Capitulo>

          <Capitulo
            numero="3"
            pergunta="Onde o lead se perde e quanto custa?"
            conclusao={(() => {
              if (h.descartes.total === 0) return 'Nenhum lead do período foi descartado até agora.'
              const maior = h.descartes.porEtapa.reduce((m, e) => (e.n > m.n ? e : m), h.descartes.porEtapa[0])
              return `${fmtPct((maior.n / h.descartes.total) * 100, 0)} dos descartes acontecem ${maior.etapa.toLowerCase()}: ${fmtNum(maior.n)} de ${fmtNum(h.descartes.total)}.`
            })()}
            rodape="Descartes dos leads que entraram no período, pela etapa em que estavam ao ser descartados. A simulação usa as passagens do funil acima e o volume mensal de leads do período."
          >
            <Recorte oque={`Descartes entre os ${coorteTxt.toLowerCase()}`} recorte={h.recorte} />
            <div className="pg-duas">
              <Descartes dados={h.descartes} />
              {h.funil.pior && h.leadsPorMes > 0 && h.funil.pior.etapas.at(-1).n > 0 && <Simulador grupo={h.funil.pior} leadsPorMes={h.leadsPorMes} />}
            </div>
          </Capitulo>

          <Capitulo
            numero="4"
            pergunta="Quais mídias trazem resultado?"
            conclusao={(() => {
              const rel = h.canais.filter((c) => c.leads >= 10)
              if (rel.length === 0) return 'Poucos leads por mídia neste recorte para comparar eficiência.'
              const melhor = rel.reduce((m, c) => ((c.pctVisita ?? 0) > (m.pctVisita ?? 0) ? c : m), rel[0])
              if (h.canais.length === 1 || melhor.canal === h.canais[0].canal)
                return `${h.canais[0].canal}: ${fmtNum(h.canais[0].leads)} leads, ${fmtPct(h.canais[0].pctVisita, 0)} chegam à visita.`
              return `${h.canais[0].canal} traz mais leads (${fmtNum(h.canais[0].leads)}); ${melhor.canal} leva mais leads à visita (${fmtPct(melhor.pctVisita, 0)}).`
            })()}
            rodape="Eficiência medida sobre os leads do período. Taxas de mídias com menos de 10 leads aparecem como contagem. Leads de anúncio que entram pelo bot do WhatsApp ainda chegam ao CRM como “WhatsApp”."
          >
            <Recorte oque={coorteTxt} recorte={h.recorte} />
            <TabelaCanais canais={h.canais} destaque={filtros.canal !== 'todos' ? filtros.canal : null} />
          </Capitulo>

          <Capitulo
            numero="5"
            pergunta="Onde e o que os clientes estão visitando?"
            conclusao={
              h.tipos.total === 0
                ? 'Nenhuma visita neste recorte.'
                : (() => {
                    const topTipo = [...h.tipos.totais].sort((a, b) => b.n - a.n)[0]
                    const topBairro = h.bairros.linhas[0]
                    return `${fmtNum(h.tipos.total)} visitas ${h.periodo.label}; ${topTipo.tipo.toLowerCase()} lidera (${fmtPct((topTipo.n / h.tipos.total) * 100, 0)})${topBairro ? ` e ${topBairro.bairro} é o bairro mais visitado (${topBairro.n})` : ''}.`
                  })()
            }
            rodape={`Visitas registradas no CRM como atividade "Visita", pela data da visita, com o bairro e o tipo tirados do imóvel. Há registros desde 15/05/2026. Visitas sem atendimento vinculado ficam fora${h.bairros.semBairro ? `; ${h.bairros.semBairro} sem bairro legível` : ''}. ${h.bairros.totalBairros} bairros no período.`}
          >
            <Recorte oque="Visitas com data no período" recorte={h.recorte} />
            <div className="pg-duas">
              <VisitasBairro linhas={h.bairros.linhas} />
              <VisitasTipo {...h.tipos} />
            </div>
          </Capitulo>

          <Capitulo
            numero="6"
            pergunta="O que está em jogo agora?"
            conclusao={(() => {
              const valor = h.mesa.porFinalidade.reduce((s, p) => s + p.valorMesa, 0)
              const ativos = h.emAtendimento.reduce((s, e) => s + h.finalidades.reduce((t, f) => t + e[f], 0), 0)
              return `${fmtNum(ativos)} leads do período seguem em atendimento${h.mesa.total > 0 ? ` e ${fmtMoeda(valor)} estão na mesa em propostas abertas no Hub` : ''}.`
            })()}
            rodape={PROPOSTAS_ATIVAS ? "Valor na mesa: propostas criadas no Hub no período e ainda abertas (venda: aguardando o proponente ou confirmada; locação: fora de rejeitada, expirada e concluída). O corretor da proposta é quem a criou. O filtro de mídia não se aplica às propostas, que não têm mídia. Só aparecem as propostas que o seu nível de acesso permite ver. O valor fica completo quando as propostas passarem a ser feitas no sistema." : "Leads que entraram no período e seguem em atendimento, pela etapa atual no CRM."}
          >
            <Recorte oque={PROPOSTAS_ATIVAS ? `${coorteTxt} e propostas criadas no período` : coorteTxt} recorte={h.recorte} />
            <div className="pg-duas">
              <EmAtendimentoEtapas dados={h.emAtendimento} finalidades={h.finalidades} />
              {PROPOSTAS_ATIVAS && <PropostasMesa porFinalidade={h.mesa.porFinalidade} />}
            </div>
          </Capitulo>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados fontes={h.saude} />
            <p className="pg-nota">
              Enquanto o histórico diário de etapas não existe, as etapas contam a fase atual de cada lead. Com o histórico, passam a contar quando o lead chegou em cada etapa, e o tempo médio por etapa aparece no funil.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
