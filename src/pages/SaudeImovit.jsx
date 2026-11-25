import { Component, useState } from 'react'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { useSaudeImovit } from '../hooks/useSaudeImovit'
import { useListaAtendimentos, useListaPagos } from '../hooks/useListaPagos'
import { CAMPO_PARADO, FASES_AGORA, funilAgoraDoCanal, useListaAgora } from '../hooks/useFunilAgora'
import { SaudeDados } from '../components/painel/Graficos'
import {
  BolhasMidia,
  degrausPagos,
  EscadaPagos,
  GaugesResposta,
  GraficoConversoes,
  GraficoOrganico,
  LINHAS_ORGANICO,
  ETAPAS_SAUDE,
  FunilColunas,
  Pizza,
  GraficoCampanhas,
  IndiceSaude,
  Kpi,
  Kpis,
} from '../components/painel/GraficosSaude'
import { fmtNum, fmtPct, isoLocal, saudeDados, somarDias } from '../lib/paineis'
import { LABEL_FINALIDADE, nomeCanal } from '../lib/painelGestao'
import {
  ddmm,
  ddmmaa,
  FILTROS_SAUDE,
  FINALIDADES,
  FORMATO,
  intervalo,
  nomeRede,
  plural,
  PERIODOS,
  variacaoCurta,
} from '../lib/saudeImovit'

/*
 * Saúde Imovit (Fase 29a S3, PRD §5.23 v2, Schema §2.22): a página da reunião semanal.
 * Tudo vem de uma chamada (`saude_imovit`); a tela só escolhe o período, mostra e explica.
 * Classes do Hub: pg-filtros, pg-manchete/pg-indice, pg-capitulo, pg-mesa, data-table, badge.
 */

const { moeda, moedaCurta, num, pct } = FORMATO
const LINHA = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }
const LINHA_ESQ = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

/** Bloco recolhível: a pergunta em cima, a conclusão como título; o detalhe abre com um clique. */
function Bloco({ id, numero, pergunta, conclusao, aberto, onToggle, children }) {
  return (
    <details className="pg-capitulo" open={aberto} onToggle={(e) => onToggle(id, e.currentTarget.open)}>
      <summary style={{ ...LINHA, cursor: 'pointer', listStyle: 'none' }} aria-label={`${pergunta}: ${conclusao}`}>
        <div className="pg-capitulo-cabeca" style={{ marginBottom: 0, flex: '1 1 280px' }}>
          <div className="pg-capitulo-pergunta">
            <span className="pg-capitulo-numero">{numero}</span>
            {pergunta}
          </div>
          <h2 className="pg-capitulo-conclusao">{conclusao}</h2>
        </div>
        <span className="btn btn-ghost btn-sm" aria-hidden="true">{aberto ? 'Recolher ▴' : 'Abrir ▾'}</span>
      </summary>
      <div className="pg-espaco">{children}</div>
    </details>
  )
}

/** Célula de número em tabela; com `anterior`, mostra o período anterior e a variação embaixo. */
function Celula({ n, fmt = num, anterior }) {
  if (!n) return '—'
  const v = variacaoCurta(n)
  return (
    <>
      <span title={n.anterior != null ? `anterior ${fmt(n.anterior)}` : undefined}>{fmt(n.valor)}</span>
      {anterior && (
        <div className="pg-sub is-muted">
          ant {fmt(n.anterior)}
          {v && <span className={v.classe}> {v.texto}</span>}
        </div>
      )}
    </>
  )
}

function Tabela({ titulo, colunas, linhas, vazio = 'Nada neste período.', limite = 10, nota }) {
  const corpo = (itens) => (
    <div className="painel-tabela-wrap">
      <table className="data-table pg-tabela-compacta">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.rotulo} className={c.num ? 'num' : undefined}>{c.rotulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((l, i) => (
            <tr key={`${l.pai ?? ''}|${l.chave ?? i}`}>
              {colunas.map((c) => (
                <td key={c.rotulo} className={c.num ? 'num' : undefined}>{c.valor(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  return (
    <div className="pg-grafico pg-lista">
      <div className="pg-grafico-titulo">{titulo}</div>
      {linhas.length === 0 ? (
        <div className="pg-vazio">{vazio}</div>
      ) : (
        <>
          {corpo(linhas.slice(0, limite))}
          {linhas.length > limite && (
            <details className="pg-lista-mais">
              <summary>Ver os outros {fmtNum(linhas.length - limite)}</summary>
              {corpo(linhas.slice(limite))}
            </details>
          )}
        </>
      )}
      {nota && <p className="pg-nota" style={{ marginTop: 'var(--space-2)' }}>{nota}</p>}
    </div>
  )
}

/** Colunas da lista de atendimentos (escada paga e fatias das pizzas). */
const ROTULO_ETAPA_LISTA = { leads: 'Leads', qualificados: 'Qualificados', visitas: 'Visitas', propostas: 'Propostas', negocios: 'Negócios', descartados: 'Descartados' }
const ROTULO_QUANDO = { visitas: 'Visita em', qualificados: 'Qualificou em', propostas: 'Proposta em', descartados: 'Descartado em' }
function colunasLista(etapa) {
  return [
    { rotulo: 'Atendimento (Imoview)', valor: (l) => <span className="kanban-card-codigo">{l.codigo}</span> },
    { rotulo: 'Lead', valor: (l) => l.nome ?? <span className="is-muted">sem nome no Hub</span> },
    { rotulo: '1ª resposta', num: true, valor: (l) => (l.respostaMin == null ? '—' : l.respostaMin < 60 ? `${fmtNum(l.respostaMin)} min` : `${fmtNum(l.respostaMin / 60, 1)} h`) },
    { rotulo: ROTULO_QUANDO[etapa] ?? 'Entrada', valor: (l) => (l.quando ? String(l.quando).slice(0, 16) : ddmmaa(String(l.data_entrada).slice(0, 10))) },
    ...(etapa === 'descartados' ? [{ rotulo: 'Motivo', valor: (l) => l.motivo ?? '—' }] : []),
    { rotulo: 'Corretor', valor: (l) => l.quem ?? l.corretor ?? '—' },
    { rotulo: 'Canal', valor: (l) => nomeCanal(l.canal) ?? '—' },
    { rotulo: 'Mídia', valor: (l) => l.midia_raw ?? '—' },
    { rotulo: 'Finalidade', valor: (l) => LABEL_FINALIDADE[l.finalidade] ?? l.finalidade ?? '—' },
    { rotulo: 'Etapa hoje', valor: (l) => l.fase_label ?? '—' },
    { rotulo: 'Situação', valor: (l) => l.situacao ?? '—' },
  ]
}

/** Colunas do comercial (por finalidade, canal e mídia), sempre com o período anterior. */
const colunasComercial = [
  { rotulo: 'Leads', num: true, valor: (l) => <Celula n={l.leads} anterior /> },
  { rotulo: 'Qualificados', num: true, valor: (l) => <Celula n={l.qualificados} anterior /> },
  { rotulo: '% qualif.', num: true, valor: (l) => <Celula n={l.pct_qualificados} fmt={pct} anterior /> },
  { rotulo: 'Visitas', num: true, valor: (l) => <Celula n={l.visitas} anterior /> },
  { rotulo: 'Propostas', num: true, valor: (l) => <Celula n={l.propostas} anterior /> },
  { rotulo: 'Descartados', num: true, valor: (l) => <Celula n={l.descartados} anterior /> },
  { rotulo: 'Negócios', num: true, valor: (l) => <Celula n={l.negocios} anterior /> },
  { rotulo: 'Valor fechado', num: true, valor: (l) => <Celula n={l.valor_fechado} fmt={moedaCurta} anterior /> },
]

const colunasPlataforma = [
  { rotulo: 'Investido', num: true, valor: (l) => <Celula n={l.investimento} fmt={moeda} /> },
  { rotulo: 'Impressões', num: true, valor: (l) => <Celula n={l.impressoes} /> },
  { rotulo: 'Cliques', num: true, valor: (l) => <Celula n={l.cliques} /> },
  { rotulo: 'CTR', num: true, valor: (l) => <Celula n={l.ctr} fmt={pct} /> },
  { rotulo: 'CPC', num: true, valor: (l) => <Celula n={l.cpc} fmt={moeda} /> },
  { rotulo: 'Conversões na plataforma', num: true, valor: (l) => <Celula n={l.conv_plataforma} /> },
  { rotulo: 'Custo por conversão', num: true, valor: (l) => <Celula n={l.custo_conv_plataforma} fmt={moeda} /> },
]

const seloPlataforma = (p) => (
  <span className={`badge ${p === 'Meta' ? 'badge-coral' : 'badge-info'}`} title={p}>{p === 'Meta' ? 'M' : p === 'Google' ? 'G' : p}</span>
)

function Filtros({ filtros, setFiltro, periodo, todosAbertos, alternarTodos, canais }) {
  const [copiado, setCopiado] = useState(false)
  const personalizado = filtros.periodo === 'personalizado'
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setCopiado(false)
    }
  }
  const abrirPersonalizado = () => {
    // começa com o período que está na tela, para só ajustar as datas
    if (!filtros.de) setFiltro('de', periodo.inicio)
    if (!filtros.ate) setFiltro('ate', periodo.fim)
    setFiltro('periodo', 'personalizado')
  }
  return (
    <div className="pg-filtros" role="toolbar" aria-label="Filtros da Saúde Imovit">
      <div className="pg-segmentado" role="radiogroup" aria-label="Finalidade">
        {FINALIDADES.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={filtros.finalidade === o.valor}
            className={filtros.finalidade === o.valor ? 'is-ativo' : undefined}
            onClick={() => setFiltro('finalidade', o.valor)}
          >
            {o.ponto && <span className={`pg-ponto pg-ponto--${o.ponto}`} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>

      <div className="pg-campo">
        <span id="saude-periodo">Período (dias até ontem)</span>
        <div className="pg-segmentado" role="radiogroup" aria-labelledby="saude-periodo">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={filtros.periodo === p}
              aria-label={`${p} dias`}
              className={filtros.periodo === p ? 'is-ativo' : undefined}
              onClick={() => setFiltro('periodo', p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={`btn btn-sm ${personalizado ? 'btn-dark' : 'btn-secondary'}`} aria-pressed={personalizado} onClick={abrirPersonalizado}>
        Personalizado
      </button>

      {personalizado && (
        <>
          <label className="pg-campo">
            <span>De</span>
            <input type="date" value={filtros.de} max={filtros.ate || undefined} onChange={(e) => setFiltro('de', e.target.value)} />
          </label>
          <label className="pg-campo">
            <span>Até</span>
            <input type="date" value={filtros.ate} min={filtros.de || undefined} max={isoLocal()} onChange={(e) => setFiltro('ate', e.target.value)} />
          </label>
        </>
      )}

      <label className="pg-campo">
        <span>Canal</span>
        <select value={filtros.canal} onChange={(e) => setFiltro('canal', e.target.value)}>
          <option value="todos">Todos</option>
          {canais.map((c) => (
            <option key={c} value={c}>{nomeCanal(c)}</option>
          ))}
        </select>
      </label>
      {filtros.canal !== 'todos' && (
        <label className="pg-campo">
          <span>Comparar com</span>
          <select value={filtros.comparar} onChange={(e) => setFiltro('comparar', e.target.value)}>
            <option value="">Nenhum</option>
            {canais.filter((c) => c !== filtros.canal).map((c) => (
              <option key={c} value={c}>{nomeCanal(c)}</option>
            ))}
          </select>
        </label>
      )}

      <div className="pg-filtros-acoes">
        <button type="button" className="btn btn-ghost btn-sm" onClick={alternarTodos}>
          {todosAbertos ? 'Recolher os blocos' : 'Abrir todos os blocos'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiarLink}>
          {copiado ? 'Link copiado' : 'Copiar link desta visão'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

// Blocos abertos ao abrir (24/11, versão visual); recolher continua a um clique.
const BLOCOS_INICIO = { perf: true, com: true, cart: true, soc: true }

function PaginaSaude() {
  const { filtros, setFiltro } = useFiltrosUrl(FILTROS_SAUDE)
  const periodo = intervalo(filtros)
  const { dados, erro, carregando, segundos } = useSaudeImovit({
    inicio: periodo.inicio,
    fim: periodo.fim,
    finalidade: filtros.finalidade,
    pular: !!periodo.erro,
  })
  const [abertos, setAbertos] = useState(BLOCOS_INICIO)
  const [degrauSel, setDegrauSel] = useState(null)
  const lista = useListaPagos({ inicio: periodo.inicio, fim: periodo.fim, finalidade: filtros.finalidade, etapa: degrauSel })
  const alternar = (id, aberto) => setAbertos((a) => (a[id] === aberto ? a : { ...a, [id]: aberto }))
  const comCarteira = dados && !dados.carteira?.oculta
  const ids = comCarteira ? ['perf', 'com', 'cart', 'soc'] : ['perf', 'com', 'soc']
  const todosAbertos = ids.every((k) => abertos[k])
  const alternarTodos = () => setAbertos(Object.fromEntries(Object.keys(BLOCOS_INICIO).map((k) => [k, !todosAbertos])))

  const p = dados?.periodo
  const cab = dados?.cabecalho
  const pt = dados?.performance?.total
  const com = dados?.comercial
  const agora = com?.agora
  const cart = dados?.carteira
  const lei = dados?.leituras ?? {}
  const soc = dados?.midias_sociais
  const socTot = soc?.total
  const socCapturando = soc?.status === 'capturando'
  const fechaEm = p?.qualificados_parcial ? p.qualificados_fecha_em : null
  const finalidadeNeg = (chave) => com?.por_finalidade?.find((f) => f.chave === chave)?.negocios?.valor ?? 0
  const negociosSemCanal = com ? (com.total?.negocios?.valor ?? 0) - (com.por_canal ?? []).reduce((s, c) => s + (c.negocios?.valor ?? 0), 0) : 0
  const vf = cab?.valor_fechado
  const mesa = agora?.dinheiro_mesa
  const garg = agora?.gargalo
  const hoje = isoLocal()
  const [etapa, setEtapaBruta] = useState(null)
  const [fatiaSel, setFatiaSel] = useState(null)
  const [parado, setParado] = useState(0)
  const [faseSel, setFaseSel] = useState(null)
  // Sprint B (24/11): as contas vêm prontas da saude_imovit; a tela só escolhe o recorte
  const serieConv = { serie: dados?.performance?.serie_conversoes ?? null, erro: null }
  const tempoResp = { dados: dados?.performance?.tempo_resposta ?? null, erro: null }
  const coorteBase = dados?.comercial?.coorte
  const coorte = !coorteBase
    ? null
    : filtros.canal === 'todos'
      ? coorteBase.total
      : (coorteBase.por_canal ?? []).find((l) => l.chave === filtros.canal) ?? null
  const porFase = funilAgoraDoCanal(agora?.parado, filtros.canal)
  const itensAgora = FASES_AGORA.map((f) => {
    const linha = porFase[f.ordem] ?? {}
    const n = Number(linha[CAMPO_PARADO[parado]] ?? 0)
    const todos = Number(linha.abertos ?? 0)
    return {
      chave: `f${f.ordem}`,
      label: f.label,
      n,
      detalhe: parado ? `${fmtNum(n)} de ${fmtNum(todos)} em aberto estão parados há mais de ${parado} dias` : `${fmtNum(todos)} em aberto nesta etapa`,
      pergunta: 'Quem precisa de um empurrão agora?',
    }
  })
  const listaAgora = useListaAgora({
    finalidade: filtros.finalidade,
    canal: filtros.canal,
    posicao: faseSel ? Number(faseSel.slice(1)) : null,
    parado,
  })
  const setEtapa = (e) => {
    setEtapaBruta(e)
    setFatiaSel(null)
  }
  const escolherFatia = (campo, d) =>
    setFatiaSel((atual) => (atual && atual.campo === campo && atual.chave === d?.chave ? null : d ? { campo, chave: d.chave, nome: d.nome } : null))
  const linhaCanal = (c) => (com?.por_canal ?? []).find((l) => l.chave === c)
  const linhaA = filtros.canal === 'todos' ? com?.total : linhaCanal(filtros.canal) ?? { chave: filtros.canal }
  const canalB = filtros.canal !== 'todos' && filtros.comparar ? linhaCanal(filtros.comparar) : null
  const porMidia = filtros.canal !== 'todos'
  const rotuloEtapa = (ETAPAS_SAUDE.find((e) => e.chave === (etapa ?? 'leads')) ?? { label: 'Leads' }).label
  const fatias = (campo) =>
    (porMidia ? (com?.por_midia ?? []).filter((l) => l.pai === filtros.canal) : com?.por_canal ?? []).map((l) => ({
      nome: porMidia ? l.chave : nomeCanal(l.chave),
      chave: l.chave,
      valor: Number(l[campo]?.valor ?? 0),
    }))
  const listaFatia = useListaAtendimentos({
    inicio: periodo.inicio,
    fim: periodo.fim,
    finalidade: filtros.finalidade,
    etapa: fatiaSel?.campo ?? null,
    canal: fatiaSel ? (porMidia ? filtros.canal : fatiaSel.chave) : null,
    midia: fatiaSel && porMidia ? fatiaSel.chave : null,
  })
  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dados</div>
          <div className="page-title">Saúde Imovit</div>
          <div className="page-sub">
            A página da reunião semanal: o que fechou, de onde veio e onde travou.
            {p && (
              <>
                {' '}Período {ddmmaa(p.inicio)} a {ddmmaa(p.fim)} ({fmtNum(p.dias)} {p.dias === 1 ? 'dia' : 'dias'}), comparado com {ddmmaa(p.anterior_inicio)} a {ddmmaa(p.anterior_fim)}.
              </>
            )}
          </div>
        </div>
      </header>

      <Filtros filtros={filtros} setFiltro={setFiltro} periodo={periodo} todosAbertos={todosAbertos} alternarTodos={alternarTodos} canais={(com?.por_canal ?? []).map((l) => l.chave)} />

      {periodo.erro && <div className="pg-aviso" role="alert">{periodo.erro}</div>}
      {erro && <div className="hub-error">Não foi possível carregar a Saúde Imovit: {erro}</div>}
      {carregando && !dados && <div className="hub-loading">Calculando o período…</div>}
      {carregando && dados && <div className="pg-aviso" role="status">Recalculando para o novo filtro…</div>}

      {dados && (
        <>
          {dados.revisadas?.length > 0 && (
            <div className="pg-aviso" role="status">
              <strong>Semana revisada.</strong>{' '}
              {dados.revisadas.map((r, i) => (
                <span key={r.semana}>
                  {i > 0 && ' · '}
                  {ddmm(r.semana)} a {ddmm(somarDias(r.semana.slice(0, 10), 6))}: negócios {fmtNum(Number(r.negocios_antes))} → {fmtNum(Number(r.negocios_agora))}, valor fechado {moedaCurta(r.valor_fechado_antes)} → {moedaCurta(r.valor_fechado_agora)}
                </span>
              ))}
              . Algo foi lançado no CRM depois que a semana fechou (foto de domingo), com data dentro dela.
            </div>
          )}

          {/* Cabeçalho: a manchete é o valor fechado (venda + locação) */}
          <section className="pg-manchete" aria-label="Cabeçalho do período">
            <div className="pg-indices">
              <IndiceSaude
                rotulo="Valor fechado"
                n={vf}
                fmt={moedaCurta}
                regra={vf?.regra}
                detalhe={vf ? `venda ${moedaCurta(vf.venda)} · locação ${moedaCurta(vf.locacao)}` : null}
              />
              <IndiceSaude rotulo="Negócios" n={cab?.negocios} detalhe={`${fmtNum(finalidadeNeg('Venda'))} venda · ${fmtNum(finalidadeNeg('Aluguel'))} locação`} />
              <IndiceSaude rotulo="Investimento em mídia" n={cab?.investimento} fmt={moeda} detalhe="Meta + Google" />
              <IndiceSaude rotulo="Atendimentos em aberto" n={cab?.atendimentos_abertos} detalhe={`em ${ddmm(p.fim)}`} />
            </div>
            <p className="pg-recorte pg-recorte--escuro">
              Passe o mouse em cada número para ver a referência e a régua. Cor só quando a base tem 5 casos ou mais; abaixo disso, ⚪ poucos casos.
            </p>
          </section>

          {/* 1. Performance (mídia paga) */}
          <Bloco
            id="perf"
            numero="1"
            pergunta="Performance (mídia paga)"
            conclusao={pt ? `${moeda(pt.investimento?.valor)} investidos, ${plural(pt.leads?.valor, 'lead pago', 'leads pagos')} no CRM e ${plural(pt.qualificados?.valor, 'qualificado', 'qualificados')}.` : 'Sem mídia paga neste recorte.'}
            aberto={abertos.perf}
            onToggle={alternar}
          >
            {pt && (
              <>
                <Kpis>
                  <Kpi rotulo="Investido" n={pt.investimento} fmt={moeda} />
                  <Kpi rotulo="Leads pagos no CRM" n={pt.leads} />
                  <Kpi rotulo="Qualificados" n={pt.qualificados} parcialAte={fechaEm} />
                  <Kpi rotulo="Visitas" n={pt.visitas} />
                </Kpis>
                {/* Ordem (Eduardo, 24/11): resumo do dinheiro → onde o lead se perde → resposta → o que dá resultado → onde foi o dinheiro */}
                <div className="pg-espaco">
                  <div className="pg-grafico-titulo">Investimento → leads pagos no CRM → qualificados → visitas → negócios (custo de cada degrau)</div>
                  <EscadaPagos investimento={Number(pt.investimento?.valor ?? 0)} degraus={degrausPagos(pt)} selecionado={degrauSel} onSelecionar={setDegrauSel} />
                  {degrauSel && (
                    <Tabela
                      titulo={`Quem são: ${{ leads: 'leads pagos', qualificados: 'qualificados em até 7 dias', visitas: 'visitas realizadas' }[degrauSel]}${lista.linhas ? ` · ${fmtNum(lista.linhas.length)}` : ''}`}
                      linhas={(lista.linhas ?? []).map((l, i) => ({ ...l, chave: `${l.codigo}-${i}` }))}
                      limite={15}
                      vazio={lista.erro ? `Não deu para carregar: ${lista.erro}` : lista.linhas ? 'Ninguém neste recorte.' : 'Carregando…'}
                      colunas={colunasLista(degrauSel)}
                      nota="Mesma regra dos números da escada. O código é o número do atendimento no Imoview. Nome: vem das atividades do CRM, então só aparece para quem já tem atividade registrada; 1ª resposta é a que o Imoview grava."
                    />
                  )}
                </div>
                <div className="pg-espaco">
                  <GraficoConversoes serie={serieConv.serie} erro={serieConv.erro} />
                </div>
                <div className="pg-espaco">
                  <GaugesResposta dados={tempoResp.dados} erro={tempoResp.erro} />
                </div>
              </>
            )}
            <div className="pg-espaco">
              <BolhasMidia linhas={dados.performance?.por_midia ?? []} />
              <details className="pg-lista-mais">
                <summary>Ver tabela por mídia paga (com o período anterior)</summary>
                <Tabela
                  titulo="O que deu resultado no CRM, por mídia paga"
                  linhas={dados.performance?.por_midia ?? []}
                  colunas={[{ rotulo: 'Mídia', valor: (l) => l.chave }, ...colunasComercial.slice(0, 7)]}
                />
              </details>
              <p className="pg-nota">Por anúncio ainda não dá: o lead chega ao CRM sem a campanha e sem o anúncio. Abaixo, o que as plataformas mostram por campanha.</p>
            </div>
            <div className="pg-espaco">
              <GraficoCampanhas linhas={dados.performance?.por_campanha ?? []} />
            </div>
            <details className="pg-lista-mais pg-espaco">
              <summary>Ver tabelas: plataforma, campanha, anúncio e mídia</summary>
              <Tabela titulo="Por plataforma" linhas={dados.performance?.por_plataforma ?? []} colunas={[{ rotulo: 'Plataforma', valor: (l) => l.chave }, ...colunasPlataforma]} />
              <Tabela
                titulo="Por campanha"
                linhas={dados.performance?.por_campanha ?? []}
                colunas={[{ rotulo: 'Campanha', valor: (l) => <span style={LINHA_ESQ}>{seloPlataforma(l.pai)} {l.chave}</span> }, ...colunasPlataforma]}
              />
              <Tabela
                titulo="Por anúncio (só Meta)"
                linhas={dados.performance?.por_anuncio ?? []}
                colunas={[{ rotulo: 'Campanha', valor: (l) => l.pai }, { rotulo: 'Anúncio', valor: (l) => l.chave }, ...colunasPlataforma]}
                nota="O Google só informa até a campanha. A captura do Meta grava o anúncio como “N/A” na maior parte das linhas."
              />
              <p className="pg-nota">Impressões, nunca “alcance”: a coluna de alcance do Meta guarda impressões. Finalidade da mídia pelo nome da campanha (Brand e Engajamento só em “Tudo”).</p>
            </details>
          </Bloco>

          {/* 2. Comercial */}
          <Bloco
            id="com"
            numero="2"
            pergunta="Comercial"
            conclusao={`${plural(com.total?.leads?.valor, 'atendimento', 'atendimentos')}, ${plural(com.total?.visitas?.valor, 'visita', 'visitas')} e ${plural(com.total?.negocios?.valor, 'negócio', 'negócios')}${garg ? `; gargalo em ${garg.etapa}, ${fmtNum(garg.parados)} parados acima do prazo` : ''}.`}
            aberto={abertos.com}
            onToggle={alternar}
          >
            {filtros.canal !== 'todos' && (
              <p className="pg-recorte">
                <strong>Canal: {nomeCanal(filtros.canal)}</strong>
                {canalB ? ` × ${nomeCanal(canalB.chave)}` : ''} · KPIs, funil e pizzas deste canal. Cabeçalho, funil agora e dinheiro na mesa continuam da empresa toda.
              </p>
            )}
            {/* Cards de abertura (Eduardo, 24/11): sempre coorte, sem troca para evento */}
            <p className="pg-recorte">
              <strong>Coorte: o que entrou no período.</strong> Dos atendimentos que chegaram entre {ddmm(p.inicio)} e {ddmm(p.fim)}, quantos já foram qualificados, visitaram e receberam proposta até hoje.
            </p>
            {!coorteBase ? (
              <div className="pg-vazio">A coorte não veio do banco (aplicar a migration do Sprint B).</div>
            ) : (
              <Kpis>
                {[
                  ['atendimentos', 'Atendimentos', null],
                  ['qualificados', 'Qualificados', 'atendimentos'],
                  ['visitas', 'Visitas', 'atendimentos'],
                  ['propostas', 'Propostas', 'atendimentos'],
                ].map(([k, rotulo, base]) => (
                  <Kpi
                    key={k}
                    rotulo={rotulo}
                    n={coorte?.[k] ?? { valor: 0, regua: 'entrada' }}
                    detalhe={base ? `${fmtPct(coorte?.[base]?.valor ? (coorte[k].valor / coorte[base].valor) * 100 : null, 0)} dos que entraram` : 'entraram no período'}
                  />
                ))}
              </Kpis>
            )}
            <p className="pg-nota" style={{ marginTop: 'var(--space-2)' }}>
              A coorte anterior ({ddmm(p.anterior_inicio)} a {ddmm(p.anterior_fim)}) teve mais tempo para andar no funil; a comparação tende a favorecer o período anterior.
            </p>

            {/* Funil no modelo "Funil de vendas" (Eduardo, 24/11); pizzas abaixo, em duas colunas */}
            {canalB ? (
              <div className="pg-espaco">
                <FunilColunas titulo={nomeCanal(filtros.canal)} linha={linhaA} etapa={etapa} onEtapa={setEtapa} />
                <FunilColunas titulo={nomeCanal(canalB.chave)} linha={canalB} cor="var(--investidores)" etapa={etapa} onEtapa={setEtapa} />
              </div>
            ) : (
              <>
                <div className="pg-espaco">
                  <FunilColunas
                    titulo={`Funil do período${filtros.canal !== 'todos' ? ` · ${nomeCanal(filtros.canal)}` : ''} (evento; clique numa etapa para filtrar as pizzas)`}
                    linha={linhaA}
                    etapa={etapa}
                    onEtapa={setEtapa}
                  />
                </div>
                <div className="pg-duas pg-espaco">
                  <Pizza
                    titulo={`${rotuloEtapa} por ${porMidia ? 'mídia' : 'canal'} (clique numa fatia para ver os atendimentos)`}
                    fatias={fatias(etapa ?? 'leads')}
                    onFatia={(d) => escolherFatia(etapa ?? 'leads', d)}
                    selecionada={fatiaSel && fatiaSel.campo === (etapa ?? 'leads') ? fatiaSel.nome : null}
                  />
                  <Pizza
                    titulo={`Descartados por ${porMidia ? 'mídia' : 'canal'} (clique numa fatia)`}
                    fatias={fatias('descartados')}
                    vazio="Nenhum descarte neste recorte."
                    onFatia={(d) => escolherFatia('descartados', d)}
                    selecionada={fatiaSel && fatiaSel.campo === 'descartados' ? fatiaSel.nome : null}
                  />
                </div>
                {fatiaSel && (
                  <Tabela
                    titulo={`${ROTULO_ETAPA_LISTA[fatiaSel.campo]} · ${fatiaSel.nome}${listaFatia.linhas ? ` · ${fmtNum(listaFatia.linhas.length)}` : ''}`}
                    linhas={(listaFatia.linhas ?? []).map((l, i) => ({ ...l, chave: `${l.codigo}-${i}` }))}
                    limite={15}
                    vazio={listaFatia.erro ? `Não deu para carregar: ${listaFatia.erro}` : listaFatia.linhas ? 'Ninguém neste recorte.' : 'Carregando…'}
                    colunas={colunasLista(fatiaSel.campo)}
                    nota={<>Mesma regra da fatia. <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFatiaSel(null)}>Fechar lista</button></>}
                  />
                )}
              </>
            )}
            {canalB && (
              <Tabela
                titulo="Comparação de canais"
                linhas={[linhaA, canalB].filter(Boolean)}
                colunas={[{ rotulo: 'Canal', valor: (l) => nomeCanal(l.chave) }, ...colunasComercial]}
              />
            )}
            <p className="pg-nota">Funil do período = o que aconteceu em cada etapa dentro do período (evento), não os mesmos leads do começo ao fim. Clique de novo na etapa para tirar o filtro.</p>

            {/* Funil agora com tempo parado (Eduardo, 24/11): um gráfico só no lugar dos 3 soltos */}
            <div className="pg-espaco">
              <div className="pg-titulo-com-acao" style={{ marginBottom: 'var(--space-3)' }}>
                <div className="pg-grafico-titulo" style={{ marginBottom: 0 }}>
                  Funil agora: atendimentos em aberto hoje por etapa{parado ? `, parados há mais de ${parado} dias` : ''}
                </div>
                <div className="pg-segmentado" role="radiogroup" aria-label="Tempo parado">
                  {[0, 7, 15, 30].map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={parado === d} className={parado === d ? 'is-ativo' : undefined} onClick={() => setParado(d)}>
                      {d === 0 ? 'Todos' : `+${d} dias`}
                    </button>
                  ))}
                </div>
              </div>
              {!agora?.parado ? (
                <div className="pg-vazio">O funil de hoje não veio do banco (aplicar a migration do Sprint B).</div>
              ) : (
                <FunilColunas
                  itens={itensAgora}
                  etapa={faseSel}
                  onEtapa={setFaseSel}
                  dicaClique="Clique para ver quem está parado aqui"
                  vazioSemFoco={`${fmtNum(itensAgora.reduce((t, i) => t + i.n, 0))} atendimentos em aberto${parado ? ` parados há mais de ${parado} dias` : ''}. Passe o mouse numa etapa; clique para ver a lista.`}
                />
              )}
              {faseSel && (
                <Tabela
                  titulo={`${itensAgora.find((i) => i.chave === faseSel)?.label ?? ''}${parado ? ` · parados há mais de ${parado} dias` : ''}${listaAgora.linhas ? ` · ${fmtNum(listaAgora.linhas.length)}` : ''}`}
                  linhas={(listaAgora.linhas ?? []).map((l) => ({ ...l, chave: l.codigo }))}
                  vazio={listaAgora.erro ? `Não deu para carregar: ${listaAgora.erro}` : listaAgora.linhas ? 'Ninguém neste recorte.' : 'Carregando…'}
                  limite={15}
                  colunas={[
                    { rotulo: 'Atendimento (Imoview)', valor: (l) => <span className="kanban-card-codigo">{l.codigo}</span> },
                    { rotulo: 'Parado há', num: true, valor: (l) => plural(l.dias_parado, 'dia', 'dias') },
                    { rotulo: 'Corretor', valor: (l) => l.corretor ?? '—' },
                    { rotulo: 'Canal', valor: (l) => nomeCanal(l.canal) ?? '—' },
                    { rotulo: 'Mídia', valor: (l) => l.midia_raw ?? '—' },
                    { rotulo: 'Finalidade', valor: (l) => LABEL_FINALIDADE[l.finalidade] ?? l.finalidade ?? '—' },
                    { rotulo: 'Entrada', valor: (l) => ddmmaa(String(l.data_entrada).slice(0, 10)) },
                  ]}
                  nota="Ordenado pelo mais parado. Dias parado como estão na base do CRM."
                />
              )}
            </div>

            {/* Depois do funil agora: o dinheiro na mesa (Eduardo, 24/11) */}
            <div className="pg-espaco">
              <div>
                <div className="pg-grafico-titulo">Dinheiro na mesa (propostas em aberto)</div>
                <Kpis>
                  <Kpi rotulo="Na mesa" n={agora?.referencia?.dinheiro_mesa} fmt={moedaCurta} detalhe={mesa ? plural(mesa.propostas, 'proposta em aberto', 'propostas em aberto') : null} />
                  {mesa && filtros.finalidade !== 'locacao' && (
                    <div className="stat-card" title="valor da proposta (ou do imóvel)">
                      <div className="stat-label">Venda</div>
                      <div className="stat-value">{moedaCurta(mesa.venda)}</div>
                      <div className="stat-sub is-muted">{plural(mesa.propostas_venda, 'proposta', 'propostas')}</div>
                    </div>
                  )}
                  {mesa && filtros.finalidade !== 'venda' && (
                    <div className="stat-card" title="1 aluguel por proposta">
                      <div className="stat-label">Locação</div>
                      <div className="stat-value">{moedaCurta(mesa.locacao)}</div>
                      <div className="stat-sub is-muted">{plural(mesa.propostas_locacao, 'proposta', 'propostas')}</div>
                    </div>
                  )}
                </Kpis>
                {mesa?.com_imovel_vendido > 0 && (
                  <div className="pg-aviso pg-espaco" role="note" style={{ marginBottom: 0 }}>
                    {plural(mesa.com_imovel_vendido, 'proposta está', 'propostas estão')} com imóvel já vendido ({moedaCurta(mesa.valor_com_imovel_vendido)} na conta): corrigir no CRM.
                  </div>
                )}
              </div>
            </div>

            <details className="pg-lista-mais pg-espaco">
              <summary>Ver tabelas: finalidade, canal, mídia e etapas</summary>
              <Tabela
                titulo="Por finalidade"
                linhas={com.por_finalidade ?? []}
                colunas={[{ rotulo: 'Finalidade', valor: (l) => <span style={LINHA_ESQ}><span className={`pg-ponto pg-ponto--${l.chave}`} aria-hidden="true" />{LABEL_FINALIDADE[l.chave] ?? l.chave}</span> }, ...colunasComercial]}
              />
              <Tabela
                titulo="Por canal"
                linhas={com.por_canal ?? []}
                colunas={[{ rotulo: 'Canal', valor: (l) => nomeCanal(l.chave) }, ...colunasComercial]}
                nota={negociosSemCanal > 0 ? `${plural(negociosSemCanal, 'negócio não aparece', 'negócios não aparecem')} nos canais: contrato de locação não tem canal no Imoview, entra só no total e na finalidade.` : null}
              />
              <Tabela titulo="Por mídia" limite={12} linhas={com.por_midia ?? []} colunas={[{ rotulo: 'Canal', valor: (l) => nomeCanal(l.pai) }, { rotulo: 'Mídia', valor: (l) => l.chave }, ...colunasComercial]} />
              <Tabela
                titulo={`Funil agora (foto de ${agora?.calculado_em ? new Date(agora.calculado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'})`}
                linhas={(agora?.funil ?? []).map((f) => ({ ...f, chave: f.etapa }))}
                colunas={[
                  { rotulo: 'Etapa', valor: (f) => <span style={LINHA_ESQ}>{f.etapa}{garg?.etapa === f.etapa && <span className="badge badge-danger">gargalo</span>}</span> },
                  { rotulo: 'Em aberto', num: true, valor: (f) => fmtNum(f.ativos) },
                  { rotulo: 'Prazo (mediana)', num: true, valor: (f) => `${fmtNum(Number(f.mediana), 1)} dias` },
                  { rotulo: 'Parados', num: true, valor: (f) => fmtNum(f.parados) },
                ]}
              />
            </details>
          </Bloco>

          {/* 3. Carteira de locação (some no filtro venda) */}
          {comCarteira && (
            <Bloco
              id="cart"
              numero="3"
              pergunta="Carteira de locação"
              conclusao={`${moedaCurta(cart.taxa_adm?.valor)} de taxa de administração no período e ${moedaCurta(cart.atraso?.valor)} em atraso em ${ddmm(cart.em)}.`}
              aberto={abertos.cart}
              onToggle={alternar}
            >
              <Kpis>
                <Kpi rotulo="Taxa de adm recebida" n={cart.taxa_adm} fmt={moedaCurta} detalhe="pela data do pagamento" />
                <Kpi rotulo="Intermediação" n={cart.intermediacao} fmt={moedaCurta} />
                <Kpi rotulo="Contratos ativos" n={cart.contratos_ativos} detalhe={`em ${ddmm(cart.em)}`} />
                <Kpi rotulo="Em atraso" n={cart.atraso} fmt={moedaCurta} detalhe={`${plural(cart.atraso?.contratos, 'contrato', 'contratos')} · mais é pior`} />
                <Kpi rotulo="Saídas avisadas" n={cart.saidas_avisadas} detalhe="mais é pior" />
                <Kpi
                  rotulo="Novos no trimestre"
                  n={cart.contratos_trimestre}
                  detalhe={`no período: ${fmtNum(cart.contratos_trimestre?.no_periodo)} (ant ${fmtNum(cart.contratos_trimestre?.no_periodo_anterior)})`}
                />
              </Kpis>
            </Bloco>
          )}

          {/* 4. Mídias sociais (29e, 24/11): a conta é da saude_midias_sociais; não segue finalidade nem canal */}
          <Bloco
            id="soc"
            numero={comCarteira ? '4' : '3'}
            pergunta="Mídias sociais (orgânico)"
            conclusao={
              socCapturando
                ? `${fmtNum(socTot?.alcance?.valor)} de alcance e ${fmtNum(socTot?.interacoes?.valor)} interações · ${fmtNum(socTot?.dias_com_dado)} de ${plural(soc?.periodo?.dias, 'dia capturado', 'dias capturados')}.`
                : 'Aguardando a primeira captura do orgânico.'
            }
            aberto={abertos.soc}
            onToggle={alternar}
          >
            {!socCapturando ? (
              <div className="pg-vazio">Nenhum dia do orgânico foi capturado ainda (fase {soc?.fase ?? '29e'}).</div>
            ) : (
              <>
                <div className="pg-aviso" role="note">
                  <strong>{fmtNum(socTot?.dias_com_dado)} de {plural(soc?.periodo?.dias, 'dia capturado', 'dias capturados')}</strong>
                  {socTot?.dias_com_dado_anterior > 0 ? ` (período anterior: ${fmtNum(socTot.dias_com_dado_anterior)})` : ' (período anterior: nenhum)'}
                  {' · '}última captura {ddmm(soc?.ultima_captura)}. Estes números não seguem os filtros de finalidade nem de canal.
                  {' '}Com menos de 5 dias capturados em um dos períodos, a comparação fica ⚪ acumulando.
                </div>
                <Kpis>
                  <Kpi rotulo="Alcance" n={socTot?.alcance} detalhe="soma dos dias (não é alcance único)" />
                  <Kpi rotulo="Visualizações" n={socTot?.visualizacoes} />
                  <Kpi rotulo="Interações" n={socTot?.interacoes} />
                  <Kpi rotulo="Engajamento" n={socTot?.engajamento} fmt={FORMATO.pct} detalhe="interações ÷ alcance" />
                  <Kpi rotulo="Visitas ao perfil" n={socTot?.visitas_perfil} />
                  <Kpi rotulo="Cliques no site" n={socTot?.cliques_site} />
                  <Kpi rotulo="Seguidores novos" n={socTot?.seguidores_novos} />
                  <Kpi rotulo="Seguidores" n={socTot?.seguidores} detalhe={`em ${ddmm(socTot?.ultima_data)}`} />
                </Kpis>
                <div className="pg-duas pg-espaco">
                  <GraficoOrganico serie={soc?.serie} titulo="Alcance e visualizações por dia" linhas={LINHAS_ORGANICO.vistas} />
                  <GraficoOrganico serie={soc?.serie} titulo="Interações, visitas, cliques e seguidores novos por dia" linhas={LINHAS_ORGANICO.acoes} />
                </div>
                <Tabela
                  titulo="Por rede"
                  linhas={(soc?.por_rede ?? []).map((l) => ({ ...l, chave: l.rede }))}
                  vazio="Nenhuma rede capturada neste período."
                  colunas={[
                    { rotulo: 'Rede', valor: (l) => nomeRede(l.rede) },
                    { rotulo: 'Dias capturados', num: true, valor: (l) => `${fmtNum(l.dias_com_dado)} de ${fmtNum(soc?.periodo?.dias)}` },
                    { rotulo: 'Alcance', num: true, valor: (l) => <Celula n={l.alcance} anterior /> },
                    { rotulo: 'Visualizações', num: true, valor: (l) => <Celula n={l.visualizacoes} anterior /> },
                    { rotulo: 'Interações', num: true, valor: (l) => <Celula n={l.interacoes} anterior /> },
                    { rotulo: 'Engajamento', num: true, valor: (l) => <Celula n={l.engajamento} fmt={FORMATO.pct} anterior /> },
                    { rotulo: 'Seguidores', num: true, valor: (l) => <Celula n={l.seguidores} anterior /> },
                  ]}
                  nota="Variação das somas pela média por dia capturado, para buraco de captura não parecer queda. Facebook e TikTok entram aqui sozinhos quando o fluxo começar a gravar."
                />
              </>
            )}
          </Bloco>

          {/* Ainda sem captura */}
          <section className="pg-capitulo" aria-label="Fontes aguardando captura">
            <div className="pg-mesa pg-mesa--linha">
              <div className="pg-mesa-card">
                <div style={LINHA}>
                  <span className="pg-mesa-texto" style={{ marginTop: 0, fontWeight: 500, color: 'var(--grafite)' }}>Site (GA4)</span>
                  <span className="badge badge-info">{dados.ga4?.status ?? 'aguardando captura'}</span>
                </div>
                <div className="pg-mesa-texto">{(dados.ga4?.blocos ?? ['acessos', 'melhores páginas']).join(' e ').replace(/^./, (c) => c.toUpperCase())}. Ainda não há captura do GA4.</div>
              </div>
            </div>
          </section>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados
              fontes={saudeDados(
                [
                  { fonte: 'CRM (atendimentos e jornada)', ultima: lei.crm ?? null, toleranciaDias: 1 },
                  { fonte: 'Atividades (visitas)', ultima: lei.atividades ?? null, toleranciaDias: 1 },
                  { fonte: 'Meta Ads', ultima: lei.meta ?? null, toleranciaDias: 2 },
                  { fonte: 'Google Ads', ultima: lei.google ?? null, toleranciaDias: 2 },
                  ...(comCarteira ? [{ fonte: 'Imoview · carteira', ultima: lei.carteira ?? null, toleranciaDias: 1 }] : []),
                  ...(lei.organico ? [{ fonte: 'Orgânico (Instagram)', ultima: lei.organico, toleranciaDias: 2 }] : []),
                ],
                hoje,
              )}
            />
            <p className="pg-nota">
              Régua de cada número: <strong>entrada</strong> (leads que entraram no período), <strong>evento</strong> (o que aconteceu no período) ou <strong>agora</strong> (foto na data fim). Passe o mouse na etiqueta para ver a regra.
              Números de período comparam com o período anterior de mesmo tamanho; os de “agora”, com a semana anterior e a média de até 8 semanas.
              {segundos != null && ` Calculado em ${fmtNum(segundos, 1)} s.`}
            </p>
          </section>
        </>
      )}
    </div>
  )
}


/**
 * Se algo na tela quebrar, mostra o erro em vez de deixar a página em branco
 * (o React desmonta tudo num erro de renderização).
 */
class ProtecaoErro extends Component {
  state = { erro: null }
  static getDerivedStateFromError(erro) {
    return { erro }
  }
  componentDidCatch(erro, info) {
    console.error('Saúde Imovit quebrou:', erro, info?.componentStack)
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="hub-error" role="alert">
        A Saúde Imovit encontrou um erro ao montar a tela: <strong>{String(this.state.erro?.message ?? this.state.erro)}</strong>. Mande esta mensagem para o Asimov.
      </div>
    )
  }
}

export default function SaudeImovit() {
  return (
    <ProtecaoErro>
      <PaginaSaude />
    </ProtecaoErro>
  )
}
