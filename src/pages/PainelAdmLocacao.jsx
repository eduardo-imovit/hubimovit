import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAdmLocacao } from '../hooks/useAdmLocacao'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import { Capitulo, Indice } from '../components/painel/Estrutura'
import { CaixaTooltip, SaudeDados } from '../components/painel/Graficos'
import { Recorte } from '../components/painel/GraficosComercial'
import { fmtDataCurta, fmtMoeda, fmtNum, fmtPct, isoLocal, saudeDados } from '../lib/paineis'
import { CORES } from '../lib/painelGestao'
import {
  aplicarFiltros,
  crescimento,
  descreverRecorte,
  FILTROS_ADM_LOCACAO,
  fmtMoedaCurta,
  inadimplencia,
  ondeEOque,
  opcoesFiltros,
  proprietarios,
  protecao,
  reajustes,
  resumoCarteira,
  rotuloMes,
  saidas,
} from '../lib/admLocacao'

const EIXO = { fontSize: 11, fill: 'var(--grafite-soft)' }
const GRADE = 'var(--champagne)'
const data = (iso) => (iso ? fmtDataCurta(iso) : '—')

// ---------------------------------------------------------------------------
// Peças da página (mesma marcação dos outros painéis: pg-hbarras, pg-mesa, data-table)
// ---------------------------------------------------------------------------

function Filtros({ filtros, setFiltro, limpar, alterados, opcoes, sincronizando, atualizar }) {
  const campos = [
    { chave: 'destinacao', rotulo: 'Destinação', todos: 'todas', opcoes: opcoes.destinacao },
    { chave: 'tipo', rotulo: 'Tipo de imóvel', todos: 'todos', opcoes: opcoes.tipo },
    { chave: 'garantia', rotulo: 'Garantia', todos: 'todas', opcoes: opcoes.garantia },
    { chave: 'indice', rotulo: 'Índice', todos: 'todos', opcoes: opcoes.indice },
  ]
  return (
    <div className="pg-filtros" role="toolbar" aria-label="Filtros do painel">
      {campos.map((c) => (
        <label key={c.chave} className="pg-campo">
          <span>{c.rotulo}</span>
          <select value={filtros[c.chave]} onChange={(e) => setFiltro(c.chave, e.target.value)}>
            <option value={c.todos}>{c.todos === 'todas' ? 'Todas' : 'Todos'}</option>
            {c.opcoes.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      ))}
      <div className="pg-filtros-acoes">
        {alterados && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>
            Limpar filtros
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={atualizar} disabled={sincronizando}>
          {sincronizando ? 'Lendo o Imoview…' : 'Atualizar agora'}
        </button>
      </div>
    </div>
  )
}

function Barras({ titulo, linhas, valor = (l) => l.n, rotuloValor, destaque, larga = true, total }) {
  if (linhas.length === 0) return <div className="pg-vazio">Nada neste recorte.</div>
  const max = Math.max(...linhas.map(valor), 1)
  const soma = total ?? linhas.reduce((s, l) => s + valor(l), 0)
  const maior = destaque ?? linhas.reduce((m, l) => (valor(l) > valor(m) ? l : m), linhas[0]).rotulo
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">{titulo}</div>
      <div className="pg-hbarras">
        {linhas.map((l) => (
          <div key={l.rotulo} className={`pg-hbarra${larga ? ' pg-hbarra--larga' : ''}`} title={`${l.rotulo}: ${rotuloValor ? rotuloValor(l) : fmtNum(valor(l))}`}>
            <span className="pg-hbarra-rotulo">{l.rotulo}</span>
            <div className="pg-funil-trilho">
              <div className="pg-funil-barra" style={{ width: `${Math.max(2, (valor(l) / max) * 100)}%`, background: l.rotulo === maior ? 'var(--coral)' : CORES.contexto }} />
            </div>
            <span className="pg-funil-n">
              {rotuloValor ? rotuloValor(l) : fmtNum(valor(l))}
              {!rotuloValor && soma > 0 && <span className="is-muted"> ({fmtPct((valor(l) / soma) * 100, 0)})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Cartoes({ itens }) {
  return (
    <div className="pg-mesa pg-mesa--linha">
      {itens.map((i) => (
        <div key={i.titulo} className="pg-mesa-card">
          <div className="pg-funil-titulo">{i.titulo}</div>
          <div className="pg-mesa-valor" style={i.alerta ? { color: 'var(--coral-dark)' } : undefined}>{i.valor}</div>
          <div className="pg-mesa-texto">{i.texto}</div>
        </div>
      ))}
    </div>
  )
}

function Lista({ titulo, colunas, linhas, vazio, limite = 8 }) {
  if (linhas.length === 0) return <div className="pg-vazio">{vazio}</div>
  const tabela = (itens) => (
    <div className="painel-tabela-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.rotulo} className={c.num ? 'num' : undefined}>{c.rotulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((l, i) => (
            <tr key={l.codigo ?? i}>
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
      <div className="pg-grafico-titulo">
        {titulo} · {fmtNum(linhas.length)}
      </div>
      {tabela(linhas.slice(0, limite))}
      {linhas.length > limite && (
        <details className="pg-lista-mais">
          <summary>Ver os outros {fmtNum(linhas.length - limite)}</summary>
          {tabela(linhas.slice(limite))}
        </details>
      )}
    </div>
  )
}

const contrato = { rotulo: 'Contrato', valor: (c) => <span title={c.imovel_resumo ?? ''}>{c.codigo}</span> }
const imovel = { rotulo: 'Imóvel', valor: (c) => [c.imovel_tipo, c.bairro].filter(Boolean).join(' · ') || '—' }
const locatario = { rotulo: 'Locatário', valor: (c) => c.locatario_nome ?? '—' }
const aluguel = { rotulo: 'Aluguel', num: true, valor: (c) => fmtMoeda(Number(c.valor_aluguel)) }

function GraficoAdm({ serie }) {
  if (serie.length === 0) return <div className="pg-vazio">Os recebimentos aparecem depois da primeira leitura das cobranças pagas.</div>
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">O que entrou por mês (pela data do pagamento)</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: 6, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CaixaTooltip
                  titulo={label}
                  linhas={[
                    { rotulo: 'Administração', valor: fmtMoeda(payload[0].payload.adm), cor: 'var(--coral)' },
                    { rotulo: 'Intermediação', valor: fmtMoeda(payload[0].payload.intermediacao), cor: CORES.contexto },
                  ]}
                />
              ) : null
            }
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="adm" name="Administração" stackId="a" fill="var(--coral)" stroke="#fff" strokeWidth={2} maxBarSize={28} />
          <Bar dataKey="intermediacao" name="Intermediação (contratos novos)" stackId="a" fill={CORES.contexto} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GraficoEntradasSaidas({ serie }) {
  return (
    <div className="pg-grafico">
      <div className="pg-grafico-titulo">Contratos novos × encerrados por mês</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={8} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--pergaminho)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CaixaTooltip
                  titulo={label}
                  linhas={[
                    { rotulo: 'Novos', valor: payload[0].payload.entradas, cor: 'var(--grafite-mid)' },
                    { rotulo: 'Encerrados', valor: payload[0].payload.saidas, cor: 'var(--coral)' },
                    { rotulo: 'Ativos no fim do mês', valor: payload[0].payload.ativos },
                  ]}
                />
              ) : null
            }
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="entradas" name="Novos" fill="var(--grafite-mid)" radius={[3, 3, 0, 0]} maxBarSize={14} />
          <Bar dataKey="saidas" name="Encerrados" fill="var(--coral)" radius={[3, 3, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function PainelAdmLocacao() {
  const hoje = isoLocal()
  const { filtros, setFiltro, limpar, alterados } = useFiltrosUrl(FILTROS_ADM_LOCACAO)
  const { dados, carregando, erro, sincronizando, erroSincronia, atualizar } = useAdmLocacao()

  const opcoes = useMemo(() => (dados ? opcoesFiltros(dados.contratos) : { destinacao: [], tipo: [], garantia: [], indice: [] }), [dados])

  const h = useMemo(() => {
    if (!dados || dados.contratos.length === 0) return null
    const contratos = aplicarFiltros(dados.contratos, filtros)
    const ultimaFoto = dados.fotos[0] ?? null
    return {
      recorte: descreverRecorte(filtros),
      filtrado: alterados,
      resumo: resumoCarteira(contratos, dados.recebimentos, hoje),
      crescimento: crescimento(contratos, dados.mensal, hoje),
      onde: ondeEOque(contratos),
      saidas: saidas(contratos, hoje),
      reajustes: reajustes(contratos, hoje),
      inad: inadimplencia(contratos, dados.cobrancas, hoje),
      protecao: protecao(contratos),
      proprietarios: proprietarios(dados.proprietarios),
      serieAtivos: dados.mensal.slice(-12).map((m) => m.ativos_fim_mes),
      lidoEm: ultimaFoto?.lido_em ?? null,
      saude: saudeDados([{ fonte: 'Imoview · contratos e cobranças', ultima: ultimaFoto?.lido_em ?? null, toleranciaDias: 1 }], hoje),
    }
  }, [dados, filtros, alterados, hoje])

  const r = h?.resumo
  const lidoTxt = h?.lidoEm ? new Date(h.lidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">Adm locação</div>
          <div className="page-sub">
            A carteira de contratos administrados: o que entra para a Imovit, quem chega, quem sai e o que precisa de atenção. Dados do Imoview{lidoTxt ? `, lidos em ${lidoTxt}` : ''}.
          </div>
        </div>
      </header>

      <Filtros filtros={filtros} setFiltro={setFiltro} limpar={limpar} alterados={alterados} opcoes={opcoes} sincronizando={sincronizando} atualizar={atualizar} />

      {carregando && <div className="hub-loading">Carregando a carteira…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o painel: {erro}</div>}
      {sincronizando && <div className="pg-aviso" role="status">Lendo contratos e cobranças no Imoview. Os números se atualizam sozinhos em seguida.</div>}
      {erroSincronia && (
        <div className="pg-aviso" role="status" title={erroSincronia}>
          {/IMOVIEW_API_KEY/.test(erroSincronia) ? (
            <>
              <strong>A leitura direta do Imoview ainda não está configurada</strong> (falta a chave da API nas configurações do Supabase), então a administração recebida não aparece.
              Os demais números vêm da carga diária{lidoTxt ? `, feita em ${lidoTxt}` : ''}.
            </>
          ) : (
            <>
              <strong>Não deu para ler o Imoview agora.</strong> Os números abaixo são da última leitura{lidoTxt ? ` (${lidoTxt})` : ''}.
            </>
          )}
        </div>
      )}
      {dados && dados.contratos.length === 0 && !sincronizando && (
        <div className="empty">
          <div className="empty-title">Nenhum contrato lido do Imoview ainda</div>
          <div className="empty-sub">Clique em “Atualizar agora” para fazer a primeira leitura.</div>
        </div>
      )}

      {h && (
        <>
          <section className="pg-manchete" aria-label="Índices da carteira">
            <div className="pg-indices">
              <Indice
                rotulo={r.admUltimoMes ? `Administração recebida em ${rotuloMes(r.admUltimoMes.mes)}` : 'Administração prevista por mês'}
                valor={fmtMoedaCurta(r.admUltimoMes ? r.admUltimoMes.valor : r.admPrevista)}
                variacao={r.admVariacao}
                contexto={r.admUltimoMes ? 'vs mês anterior' : 'aluguel × taxa de cada contrato ativo'}
                detalhe={r.admUltimoMes ? `prevista ${fmtMoedaCurta(r.admPrevista)}/mês · ${fmtMoedaCurta(r.admMesCorrente)} já neste mês` : null}
                serie={r.serieAdm.length > 1 ? r.serieAdm.map((m) => m.adm) : null}
                formula="Taxa de administração retida no repasse ao proprietário, pela data do pagamento do aluguel. Não segue os filtros."
              />
              <Indice
                rotulo="Contratos ativos"
                valor={fmtNum(r.ativos)}
                contexto={`${fmtNum(r.saudaveis)} saudáveis · ${fmtNum(r.atrasados)} em atraso`}
                detalhe={r.emAtivacao ? `+${r.emAtivacao} em ativação` : null}
                serie={h.filtrado ? null : h.serieAtivos}
                formula="Contratos com situação Ativo no Imoview. Em ativação = situação Moderação."
              />
              <Indice
                rotulo="Inadimplência"
                valor={fmtPct(h.inad.taxa)}
                contexto={`${fmtNum(h.inad.inadimplentes.length)} contratos em cobrança`}
                detalhe={`${fmtMoedaCurta(h.inad.valor)} vencidos`}
                formula="Regra do Imoview: contrato ativo marcado como Atrasado (cobrança amigável) ÷ contratos ativos."
              />
              <Indice
                rotulo="Novos × encerrados (12 meses)"
                valor={`${fmtNum(h.crescimento.entradas12)} × ${fmtNum(h.crescimento.saidas12)}`}
                contexto={`saldo ${h.crescimento.saldo12 > 0 ? '+' : ''}${fmtNum(h.crescimento.saldo12)} contratos`}
                detalhe={h.crescimento.rotatividade != null ? `rotatividade de ${fmtPct(h.crescimento.rotatividade, 0)} ao ano` : null}
                formula="Novos pela data de início; encerrados pela data de rescisão."
              />
            </div>
            <p className="pg-recorte pg-recorte--escuro">
              {h.recorte} · tamanho da carteira: {fmtMoedaCurta(r.somaAluguel)}/mês em aluguéis administrados, ticket médio {fmtMoedaCurta(r.ticketMedio)}
            </p>
          </section>

          <Capitulo
            numero="1"
            pergunta="Quanto entra para a Imovit?"
            conclusao={
              r.admUltimoMes
                ? `Em ${rotuloMes(r.admUltimoMes.mes)} entraram ${fmtMoeda(r.admUltimoMes.valor)} de administração, ${fmtPct(r.admPrevista ? (r.admUltimoMes.valor / r.admPrevista) * 100 : null, 0)} do previsto para a carteira atual.`
                : `A carteira prevê ${fmtMoeda(r.admPrevista)} de administração por mês (taxa média de ${fmtPct(r.taxaMedia)}).`
            }
            rodape="Recebido = taxa de administração e de intermediação retidas no repasse ao proprietário, pelo mês em que o locatário pagou. Previsto = aluguel × taxa de cada contrato ativo. A diferença vem de atrasos, pagamentos proporcionais, descontos e contratos que entraram ou saíram no mês. Os recebimentos não seguem os filtros."
          >
            <Recorte oque="Cobranças de locação pagas" recorte="toda a carteira, últimos 12 meses fechados" />
            <div className="pg-duas">
              <GraficoAdm serie={r.serieAdm} />
              <Cartoes
                itens={[
                  { titulo: 'Administração prevista', valor: fmtMoedaCurta(r.admPrevista), texto: `por mês · taxa média de ${fmtPct(r.taxaMedia)} sobre ${fmtMoedaCurta(r.somaAluguel)} em aluguéis` },
                  r.admUltimoMes && { titulo: `Intermediação em ${rotuloMes(r.admUltimoMes.mes)}`, valor: fmtMoedaCurta(r.admUltimoMes.intermediacao), texto: 'taxa de contratos novos, retida no primeiro aluguel' },
                  r.admUltimoMes && { titulo: `Contratos que pagaram em ${rotuloMes(r.admUltimoMes.mes)}`, valor: fmtNum(r.admUltimoMes.pagantes), texto: `de ${fmtNum(r.ativos)} ativos hoje` },
                ].filter(Boolean)}
              />
            </div>
          </Capitulo>

          <Capitulo
            numero="2"
            pergunta="A carteira está crescendo?"
            conclusao={`Nos últimos 12 meses entraram ${fmtNum(h.crescimento.entradas12)} contratos e saíram ${fmtNum(h.crescimento.saidas12)}: ${h.crescimento.saldo12 > 0 ? 'a carteira cresceu' : h.crescimento.saldo12 < 0 ? 'a carteira encolheu' : 'a carteira ficou estável'}${h.crescimento.rotatividade != null ? `, com ${fmtPct(h.crescimento.rotatividade, 0)} dela trocando por ano` : ''}.`}
            rodape="Rotatividade = encerrados nos últimos 12 meses ÷ média de contratos ativos no período. Permanência = mediana de meses entre o início e a rescisão dos contratos encerrados nos últimos 2 anos. Rescindidos sem data de rescisão usam a data de fim do contrato."
          >
            <Recorte oque="Contratos ativos e encerrados" recorte={`${h.recorte}, últimos 24 meses`} />
            <div className="pg-duas">
              <GraficoEntradasSaidas serie={h.crescimento.serie} />
              <Cartoes
                itens={[
                  { titulo: 'Aluguel médio dos novos (12 meses)', valor: fmtMoedaCurta(h.crescimento.aluguelNovos), texto: `carteira atual: ${fmtMoedaCurta(h.crescimento.aluguelCarteira)}` },
                  { titulo: 'Permanência do locatário', valor: h.crescimento.permanenciaMeses != null ? `${fmtNum(h.crescimento.permanenciaMeses)} meses` : '—', texto: `mediana de ${fmtNum(h.crescimento.permanenciaN)} contratos encerrados em 2 anos` },
                ]}
              />
            </div>
          </Capitulo>

          <Capitulo
            numero="3"
            pergunta="Onde e o que alugamos?"
            conclusao={
              h.onde.bairros[0]
                ? `${h.onde.bairros[0].rotulo} lidera com ${fmtNum(h.onde.bairros[0].n)} contratos; ${h.onde.tipos[0]?.rotulo.toLowerCase()} é ${fmtPct((h.onde.tipos[0]?.n / (h.onde.total || 1)) * 100, 0)} da carteira.`
                : 'Nenhum contrato ativo neste recorte.'
            }
            rodape={`Bairro tirado do endereço do imóvel no Imoview. ${fmtNum(h.onde.totalBairros)} bairros na carteira ativa.`}
          >
            <Recorte oque="Contratos ativos" recorte={h.recorte} />
            <div className="pg-duas">
              <Barras titulo="Bairros com mais contratos" linhas={h.onde.bairros} rotuloValor={(l) => `${fmtNum(l.n)} · ${fmtMoedaCurta(l.valor)}`} />
              <Barras titulo="Tipo de imóvel" linhas={h.onde.tipos} />
            </div>
            <div className="pg-duas pg-espaco">
              <Barras titulo="Faixa de aluguel" linhas={h.onde.faixas} destaque={h.onde.faixas.reduce((m, l) => (l.n > m.n ? l : m), h.onde.faixas[0]).rotulo} />
              <Barras titulo="Destinação" linhas={h.onde.destinacao} />
            </div>
          </Capitulo>

          <Capitulo
            numero="4"
            pergunta="Quem está saindo e por quê?"
            conclusao={`${fmtNum(h.saidas.comAviso.length)} locatários já avisaram que vão sair (${fmtMoedaCurta(h.saidas.comAvisoAdm)}/mês de administração em risco) e ${fmtNum(h.saidas.ultimoTrimestre.length)} contratos estão no último trimestre do prazo.`}
            rodape={`Último trimestre = o fim do prazo do contrato cai nos próximos 90 dias. Prazo indeterminado = o prazo já acabou e o contrato segue ativo: o locatário pode sair com 30 dias de aviso. No Imoview a renovação não gera contrato novo. "Sem administração" = o proprietário tirou o imóvel da Imovit (${fmtNum(h.saidas.semAdministracao)} em 12 meses).`}
          >
            <Recorte oque="Contratos ativos e rescisões dos últimos 12 meses" recorte={h.recorte} />
            <Cartoes
              itens={[
                { titulo: 'Aviso de desocupação', valor: fmtNum(h.saidas.comAviso.length), texto: `${fmtMoedaCurta(h.saidas.comAvisoValor)}/mês em aluguel saindo da carteira`, alerta: h.saidas.comAviso.length > 0 },
                { titulo: 'Último trimestre do contrato', valor: fmtNum(h.saidas.ultimoTrimestre.length), texto: `${fmtMoedaCurta(h.saidas.ultimoTrimestreValor)}/mês · fim do prazo em até 90 dias` },
                { titulo: 'Prazo indeterminado', valor: fmtNum(h.saidas.indeterminado), texto: `${fmtMoedaCurta(h.saidas.indeterminadoValor)}/mês · podem sair com 30 dias de aviso` },
              ]}
            />
            <div className="pg-duas pg-espaco">
              <Barras titulo={`Motivos de rescisão · ${fmtNum(h.saidas.rescindidos12)} em 12 meses`} linhas={h.saidas.motivos} />
              <Lista
                titulo="Avisaram que vão sair"
                vazio="Nenhum aviso de desocupação neste recorte."
                linhas={h.saidas.comAviso}
                colunas={[contrato, locatario, { rotulo: 'Saída prevista', valor: (c) => data(c.data_previsao_rescisao) }, aluguel]}
              />
            </div>
            <Lista
              titulo="No último trimestre do prazo"
              vazio="Nenhum contrato termina o prazo nos próximos 90 dias."
              linhas={h.saidas.ultimoTrimestre}
              colunas={[contrato, locatario, imovel, { rotulo: 'Fim do prazo', valor: (c) => `${data(c.data_fim)} (${fmtNum(c.dias_para_fim)} dias)` }, aluguel]}
            />
          </Capitulo>

          <Capitulo
            numero="5"
            pergunta="O que reajusta nos próximos meses?"
            conclusao={`${fmtNum(h.reajustes.proximos)} reajustes nos próximos 90 dias${h.reajustes.vencidos.length ? `, e ${fmtNum(h.reajustes.vencidos.length)} contratos estão com a data de reajuste vencida` : ''}.`}
            rodape="Data do próximo reajuste como está no Imoview. Uma data já passada indica reajuste ainda não aplicado no sistema. O valor reajustado oficial é o calculado no Imoview."
          >
            <Recorte oque="Contratos ativos" recorte={h.recorte} />
            <div className="pg-duas">
              <Barras titulo="Reajustes por mês" linhas={h.reajustes.porMes} larga={false} />
              <Cartoes
                itens={[
                  ...h.reajustes.porIndice.map((i) => ({ titulo: i.rotulo, valor: fmtNum(i.n), texto: `contratos · ${fmtMoedaCurta(i.valor)}/mês em aluguel reajustável` })),
                  { titulo: 'Reajuste com a data vencida', valor: fmtNum(h.reajustes.vencidos.length), texto: `${fmtMoedaCurta(h.reajustes.vencidosValor)}/mês em aluguel · conferir se foi aplicado`, alerta: h.reajustes.vencidos.length > 0 },
                ]}
              />
            </div>
            <Lista
              titulo="Reajuste com a data vencida"
              vazio="Nenhum reajuste vencido neste recorte."
              linhas={h.reajustes.vencidos}
              colunas={[contrato, locatario, { rotulo: 'Índice', valor: (c) => c.indice_reajuste ?? '—' }, { rotulo: 'Data do reajuste', valor: (c) => data(c.data_proximo_reajuste) }, aluguel]}
            />
          </Capitulo>

          <Capitulo
            numero="6"
            pergunta="Quanto está em atraso?"
            conclusao={`${fmtNum(h.inad.inadimplentes.length)} contratos ativos estão em cobrança (${fmtPct(h.inad.taxa)} da carteira): ${fmtMoeda(h.inad.valor)} vencidos.`}
            rodape="Inadimplência pela regra do Imoview: o contrato ativo marcado como Atrasado (cobrança amigável). O valor soma as cobranças de locação vencidas e não pagas desses contratos (aluguel e encargos cobrados juntos). Atenção = cobranças que o Imoview mantém em aberto mas que já têm pagamento informado: falta a baixa (conciliação) ou o pagamento foi parcial."
          >
            <Recorte oque="Contratos ativos e cobranças vencidas" recorte={h.recorte} />
            <div className="pg-duas">
              <Barras titulo="Valor vencido por tempo de atraso" linhas={h.inad.faixas.filter((f) => f.valor > 0)} valor={(l) => l.valor} rotuloValor={(l) => fmtMoedaCurta(l.valor)} />
              <Barras
                titulo="Inadimplência por garantia"
                linhas={h.inad.porGarantia}
                destaque={h.inad.garantiaPior ?? ''}
                valor={(l) => l.taxa ?? 0}
                rotuloValor={(l) => `${fmtPct(l.taxa, 0)} · ${l.atrasados}/${l.ativos}`}
              />
            </div>
            <Lista
              titulo="Contratos em cobrança"
              vazio="Nenhum contrato em cobrança neste recorte."
              linhas={h.inad.inadimplentes}
              colunas={[
                contrato,
                locatario,
                { rotulo: 'Garantia', valor: (c) => c.garantia ?? '—' },
                { rotulo: 'Mais antiga', num: true, valor: (c) => (c.cobranca_vencida_desde ? `${fmtNum(h.inad.diasAtraso(c))} dias` : '—') },
                { rotulo: 'Vencido', num: true, valor: (c) => fmtMoeda(Number(c.cobranca_vencida_valor)) },
              ]}
            />
            <div className="pg-espaco">
              <Cartoes
                itens={[
                  { titulo: 'Pagamento informado, sem baixa', valor: fmtNum(h.inad.semBaixa.length), texto: `contratos · ${fmtNum(h.inad.semBaixaCobrancas)} cobranças · ${fmtMoedaCurta(h.inad.semBaixaValor)} · conferir no Imoview`, alerta: h.inad.semBaixa.length > 0 },
                  { titulo: 'Débito de contratos encerrados', valor: fmtNum(h.inad.encerrados.length), texto: `${fmtMoedaCurta(h.inad.encerradosValor)} vencidos de ex-locatários · fora da taxa` },
                  h.inad.foraDaRegua.length > 0 && { titulo: 'Vencida sem marcação de atraso', valor: fmtNum(h.inad.foraDaRegua.length), texto: 'cobrança vencida em contrato que o Imoview mostra como saudável', alerta: true },
                ].filter(Boolean)}
              />
            </div>
            <Lista
              titulo="Atenção: pagamento informado e conta ainda em aberto"
              vazio="Nenhuma cobrança paga esperando baixa."
              linhas={h.inad.semBaixa}
              colunas={[
                { rotulo: 'Contrato', valor: (b) => b.codigo },
                { rotulo: 'Locatário', valor: (b) => b.contrato?.locatario_nome ?? '—' },
                { rotulo: 'Situação', valor: (b) => b.contrato?.situacao ?? '—' },
                { rotulo: 'Vencimento mais antigo', valor: (b) => data(b.vencimento) },
                { rotulo: 'Pagamento informado', valor: (b) => data(b.pagamento) },
                { rotulo: 'Cobranças', num: true, valor: (b) => fmtNum(b.cobrancas) },
                { rotulo: 'Valor', num: true, valor: (b) => fmtMoeda(b.valor) },
              ]}
            />
          </Capitulo>

          <Capitulo
            numero="7"
            pergunta="A carteira está protegida?"
            conclusao={`${fmtNum(h.protecao.seguroVencido + h.protecao.seguroVence30)} seguros incêndio vencidos ou vencendo em 30 dias e ${fmtNum(h.protecao.seguroSemRegistro)} contratos sem seguro registrado.`}
            rodape={`Datas do seguro incêndio e da garantia locatícia como estão no contrato do Imoview. Garantia com validade (seguro fiança, título de capitalização) cadastrada em ${fmtNum(h.protecao.comValidade)} contratos ativos; fiador e caução não têm data de fim.`}
          >
            <Recorte oque="Contratos ativos" recorte={h.recorte} />
            <Cartoes
              itens={[
                { titulo: 'Seguro incêndio vencido', valor: fmtNum(h.protecao.seguroVencido), texto: 'imóvel descoberto até renovar', alerta: h.protecao.seguroVencido > 0 },
                { titulo: 'Seguro vence em 30 dias', valor: fmtNum(h.protecao.seguroVence30), texto: 'renovar antes do vencimento' },
                { titulo: 'Sem seguro registrado', valor: fmtNum(h.protecao.seguroSemRegistro), texto: `de ${fmtNum(r.ativos)} ativos · ${fmtNum(h.protecao.seguroVigente)} vigentes` },
                { titulo: 'Garantia vencida ou vencendo', valor: fmtNum(h.protecao.garantiaVencida + h.protecao.garantiaVence60), texto: `${fmtNum(h.protecao.garantiaVencida)} vencidas · ${fmtNum(h.protecao.garantiaVence60)} vencem em 60 dias` },
              ]}
            />
            <Lista
              titulo="Para regularizar"
              vazio="Seguros e garantias em dia neste recorte."
              linhas={h.protecao.lista}
              colunas={[
                contrato,
                locatario,
                { rotulo: 'Seguro incêndio', valor: (c) => ({ vencido: `vencido em ${data(c.seguro_incendio_fim)}`, vence_30: `vence ${data(c.seguro_incendio_fim)}`, sem_registro: 'sem registro', vigente: 'vigente' })[c.seguro_incendio_situacao] ?? '—' },
                { rotulo: 'Garantia', valor: (c) => (c.garantia_situacao === 'vencida' ? `${c.garantia} vencida em ${data(c.garantia_fim)}` : c.garantia_situacao === 'vence_60' ? `${c.garantia} vence ${data(c.garantia_fim)}` : c.garantia ?? '—') },
              ]}
            />
          </Capitulo>

          <Capitulo
            numero="8"
            pergunta="Quem são os nossos proprietários?"
            conclusao={`${fmtNum(h.proprietarios.total)} proprietários; os 10 maiores respondem por ${fmtPct(h.proprietarios.concentracaoTop10, 0)} da administração.`}
            rodape="Participação de cada proprietário pelo percentual dele no imóvel. Administração = aluguel × taxa do contrato. Não segue os filtros."
          >
            <Recorte oque="Proprietários dos contratos ativos" recorte="toda a carteira" />
            <Lista
              titulo="Maiores proprietários pela administração"
              vazio="Nenhum proprietário na carteira ativa."
              limite={10}
              linhas={h.proprietarios.top10}
              colunas={[
                { rotulo: 'Proprietário', valor: (p) => p.nome ?? `Código ${p.codigo_proprietario}` },
                { rotulo: 'Contratos', num: true, valor: (p) => fmtNum(p.contratos) },
                { rotulo: 'Aluguel administrado', num: true, valor: (p) => fmtMoeda(Number(p.aluguel_administrado)) },
                { rotulo: 'Administração/mês', num: true, valor: (p) => fmtMoeda(Number(p.receita_adm)) },
                { rotulo: '% da adm.', num: true, valor: (p) => fmtPct((Number(p.receita_adm) / (h.proprietarios.receitaTotal || 1)) * 100) },
              ]}
            />
          </Capitulo>

          <section className="pg-rodape" aria-label="Saúde dos dados">
            <div className="pg-capitulo-pergunta">Dá para confiar nestes números?</div>
            <SaudeDados fontes={h.saude} />
            <p className="pg-nota">
              O Hub lê o Imoview ao abrir esta página quando a última leitura passou de 12 horas, e pelo botão “Atualizar agora”. CPF e CNPJ não são guardados.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
