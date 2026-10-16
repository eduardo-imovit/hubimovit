import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePainelEstoque } from '../hooks/usePaineis'
import ModalPortal from '../components/esteira/ModalPortal'
import { fmtNum } from '../lib/paineis'
import { fmtMoedaCurta } from '../lib/admLocacao'
import {
  buscar,
  CARACTERISTICAS,
  FILTROS_VAZIOS,
  filtrosDaUrl,
  filtrosParaUrl,
  interpretarFrase,
  ORDENACOES,
  semCriterio,
} from '../lib/buscaImoveis'

const EXEMPLOS = [
  'apartamento 3 quartos com piscina no Cambuí até 1,5 mi',
  'casa em condomínio para alugar até 15 mil aceita pet',
  'terreno perto do Alphaville Dom Pedro a partir de 500 m²',
]
const MINIMOS = [null, 1, 2, 3, 4, 5]
const POR_PAGINA = 24

const valorTexto = (i) => (Number(i.valor) > 0 ? `${fmtMoedaCurta(Number(i.valor))}${i.finalidade === 'Aluguel' ? '/mês' : ''}` : 'Sob consulta')
const atributos = (i) =>
  [
    i.quartos ? `${i.quartos} qto${i.quartos > 1 ? 's' : ''}` : null,
    i.suites ? `${i.suites} suíte${i.suites > 1 ? 's' : ''}` : null,
    i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : null,
    Number(i.area_principal) > 0 ? `${fmtNum(Number(i.area_principal))} m²` : Number(i.area_lote) > 0 ? `lote ${fmtNum(Number(i.area_lote))} m²` : null,
  ].filter(Boolean)

function CartaoImovel({ imovel: i, motivo, onAbrir }) {
  return (
    <button type="button" className="imovel-card" onClick={() => onAbrir(i)}>
      <div className="imovel-card-foto">
        {i.foto ? <img src={i.foto} alt="" loading="lazy" /> : <span>sem foto</span>}
      </div>
      <div className="imovel-card-corpo">
        <div className="imovel-card-titulo">
          {i.tipo} · {i.bairro}
        </div>
        <div className="imovel-card-valor">{valorTexto(i)}</div>
        {atributos(i).length > 0 && <div className="imovel-card-atributos">{atributos(i).join(' · ')}</div>}
        {motivo && <span className="badge badge-warning">{motivo}</span>}
        <div className="imovel-card-rodape">
          <span>cód. {i.codigo} · {i.finalidade === 'Aluguel' ? 'locação' : 'venda'}</span>
          {i.desatualizado ? (
            <span className="badge badge-gray">sem atualização há {fmtNum(i.dias_sem_atualizar)} dias</span>
          ) : (
            <span>atualizado há {fmtNum(i.dias_sem_atualizar)} d</span>
          )}
        </div>
      </div>
    </button>
  )
}

function Linha({ rotulo, valor }) {
  if (valor == null || valor === '') return null
  return (
    <div className="imovel-ficha-linha">
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  )
}

function FichaImovel({ imovel: i, onFechar }) {
  const [copiado, setCopiado] = useState(false)
  if (!i) return null
  const moeda = (v) => (Number(v) > 0 ? fmtMoedaCurta(Number(v)) : null)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(i.codigo))
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onFechar}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Imóvel ${i.codigo}`}>
          <div className="modal-header">
            <div className="modal-title">{i.titulo || `${i.tipo} · ${i.bairro}`}</div>
            <button type="button" className="modal-close" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body imovel-ficha">
            {i.foto && <img className="imovel-ficha-foto" src={i.foto} alt="" />}
            <div className="imovel-ficha-valor">{valorTexto(i)}</div>
            <dl>
              <Linha rotulo="Código" valor={String(i.codigo)} />
              <Linha rotulo="Finalidade" valor={i.finalidade === 'Aluguel' ? 'Locação' : 'Venda'} />
              <Linha rotulo="Situação" valor={i.situacao} />
              <Linha rotulo="Tipo" valor={i.tipo} />
              <Linha rotulo="Endereço" valor={[i.logradouro, i.bairro, i.cidade].filter(Boolean).join(' · ')} />
              <Linha rotulo="Condomínio" valor={[i.condominio, moeda(i.valor_condominio) && `${moeda(i.valor_condominio)}/mês`].filter(Boolean).join(' · ')} />
              <Linha rotulo="IPTU" valor={moeda(i.valor_iptu)} />
              <Linha rotulo="Área" valor={[Number(i.area_principal) > 0 && `${fmtNum(Number(i.area_principal))} m²`, Number(i.area_lote) > 0 && Number(i.area_lote) !== Number(i.area_principal) && `lote ${fmtNum(Number(i.area_lote))} m²`].filter(Boolean).join(' · ')} />
              <Linha rotulo="Cômodos" valor={[...atributos(i).slice(0, 3), i.banheiros ? `${i.banheiros} banheiro${i.banheiros > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')} />
              <Linha rotulo="Captador" valor={(i.captadores ?? []).join(', ')} />
              <Linha rotulo="Atualização" valor={`há ${fmtNum(i.dias_sem_atualizar)} dias${i.desatualizado ? ' (desatualizado)' : ''}`} />
              <Linha rotulo="No site" valor={i.no_site ? 'Sim' : 'Não'} />
            </dl>
            {(i.caracteristicas ?? []).length > 0 && (
              <div className="imovel-ficha-car">
                {i.caracteristicas.map((c) => (
                  <span key={c} className="badge badge-gray">{CARACTERISTICAS[c]?.label ?? c.replace(/^extra:/, '')}</span>
                ))}
              </div>
            )}
            <div className="imovel-ficha-acoes">
              <button type="button" className="btn btn-secondary btn-sm" onClick={copiar}>
                {copiado ? 'Código copiado' : 'Copiar código'}
              </button>
              <span className="field-hint">Abra o imóvel no Imoview pelo código.</span>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function Bloco({ titulo, itens, onAbrir, vazio }) {
  const [mostrar, setMostrar] = useState(POR_PAGINA)
  if (!itens.length) return vazio ?? null
  return (
    <section className="imovel-bloco">
      <div className="pg-subtitulo">{titulo}</div>
      <div className="imovel-grade">
        {itens.slice(0, mostrar).map((x) => (
          <CartaoImovel key={`${x.imovel.codigo}-${x.imovel.finalidade}`} imovel={x.imovel} motivo={x.motivo} onAbrir={onAbrir} />
        ))}
      </div>
      {itens.length > mostrar && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
          Ver mais {fmtNum(Math.min(POR_PAGINA, itens.length - mostrar))} (faltam {fmtNum(itens.length - mostrar)})
        </button>
      )}
    </section>
  )
}

/** Dash ▸ Estoque (PRD §5.14, revisão de 16/10): busca por frase + filtros, para corretor e Gestão. */
export default function EstoqueBusca() {
  const { dados, carregando, erro } = usePainelEstoque()
  const [params, setParams] = useSearchParams()
  const { filtros, frase: fraseUrl } = useMemo(() => filtrosDaUrl(params), [params])
  const [frase, setFrase] = useState(fraseUrl)
  const [aberto, setAberto] = useState(null)

  const nomesBairros = useMemo(() => (dados?.bairros ?? []).map((b) => b.bairro), [dados])
  const tipos = useMemo(() => [...new Set((dados?.imoveis ?? []).map((i) => i.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [dados])
  const caracteristicasNoEstoque = useMemo(() => {
    const n = new Map()
    for (const i of dados?.imoveis ?? []) for (const c of i.caracteristicas ?? []) n.set(c, (n.get(c) ?? 0) + 1)
    return Object.keys(CARACTERISTICAS).filter((c) => n.get(c)).sort((a, b) => CARACTERISTICAS[a].label.localeCompare(CARACTERISTICAS[b].label, 'pt-BR'))
  }, [dados])

  const resultado = useMemo(() => (dados ? buscar(dados.imoveis, filtros, dados.bairros) : null), [dados, filtros])

  const aplicar = (f, q = fraseUrl) => setParams(filtrosParaUrl(f, q), { replace: true })
  const muda = (campo, valor) => aplicar({ ...filtros, [campo]: valor })
  const adiciona = (campo, valor) => valor && !filtros[campo].includes(valor) && muda(campo, [...filtros[campo], valor])
  const numero = (v) => (v === '' || v == null ? null : Number(v))

  const enviar = (e) => {
    e.preventDefault()
    aplicar({ ...interpretarFrase(frase, nomesBairros), ordem: filtros.ordem }, frase.trim())
  }
  const usarExemplo = (ex) => {
    setFrase(ex)
    aplicar({ ...interpretarFrase(ex, nomesBairros), ordem: filtros.ordem }, ex)
  }
  // a ordem escolhida sobrevive a uma busca nova e ao "Limpar"
  const limpar = () => {
    setFrase('')
    aplicar({ ...FILTROS_VAZIOS, ordem: filtros.ordem }, '')
  }

  const exatos = resultado?.exatos.map((imovel) => ({ imovel })) ?? []
  const comFiltro = resultado && resultado.criterios.some((c) => c.id !== 'situacao')

  return (
    <div className="pg">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <div className="page-title">Estoque</div>
          <div className="page-sub">Escreva o que o cliente procura, como no Google. A busca vira filtros que você pode ajustar.</div>
        </div>
      </header>

      <form className="estoque-busca" onSubmit={enviar} role="search">
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder="ex.: apartamento 3 quartos com piscina no Cambuí até 1,5 mi"
            aria-label="Buscar imóveis"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!dados}>Buscar</button>
      </form>
      <div className="estoque-exemplos">
        <span className="field-hint">Exemplos:</span>
        {EXEMPLOS.map((ex) => (
          <button key={ex} type="button" className="btn btn-link btn-sm" onClick={() => usarExemplo(ex)} disabled={!dados}>
            {ex}
          </button>
        ))}
      </div>

      {carregando && <div className="hub-loading">Carregando o estoque…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o estoque: {erro}</div>}

      {dados && resultado && (
        <>
          <div className="pg-filtros estoque-filtros">
            <div className="pg-segmentado" role="group" aria-label="Finalidade">
              {[
                ['todas', 'Tudo'],
                ['Venda', 'Venda'],
                ['Aluguel', 'Locação'],
              ].map(([v, l]) => (
                <button key={v} type="button" className={filtros.finalidade === v ? 'is-ativo' : ''} onClick={() => muda('finalidade', v)}>
                  {l}
                </button>
              ))}
            </div>
            <label className="pg-campo">
              Tipo
              <select value="" onChange={(e) => adiciona('tipos', e.target.value)}>
                <option value="">Adicionar…</option>
                {tipos.map((t) => (
                  <option key={t} value={t} disabled={filtros.tipos.includes(t)}>{t}</option>
                ))}
              </select>
            </label>
            <label className="pg-campo">
              Bairro
              <select value="" onChange={(e) => adiciona('bairros', e.target.value)}>
                <option value="">Adicionar…</option>
                {[...nomesBairros].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((b) => (
                  <option key={b} value={b} disabled={filtros.bairros.includes(b)}>{b}</option>
                ))}
              </select>
            </label>
            <label className="pg-campo">
              Preço mín.
              <input type="number" min="0" step="1000" value={filtros.precoMin ?? ''} onChange={(e) => muda('precoMin', numero(e.target.value))} placeholder="R$" />
            </label>
            <label className="pg-campo">
              Preço máx.
              <input type="number" min="0" step="1000" value={filtros.precoMax ?? ''} onChange={(e) => muda('precoMax', numero(e.target.value))} placeholder="R$" />
            </label>
            {[
              ['quartos', 'Quartos'],
              ['suites', 'Suítes'],
              ['vagas', 'Vagas'],
            ].map(([campo, rotulo]) => (
              <label key={campo} className="pg-campo">
                {rotulo}
                <select value={filtros[campo] ?? ''} onChange={(e) => muda(campo, numero(e.target.value))}>
                  {MINIMOS.map((n) => (
                    <option key={n ?? 'q'} value={n ?? ''}>{n == null ? 'Qualquer' : `${n}+`}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="pg-campo">
              Área mín.
              <input type="number" min="0" step="10" value={filtros.area ?? ''} onChange={(e) => muda('area', numero(e.target.value))} placeholder="m²" />
            </label>
            <label className="pg-campo">
              Característica
              <select value="" onChange={(e) => adiciona('caracteristicas', e.target.value)}>
                <option value="">Adicionar…</option>
                {caracteristicasNoEstoque.map((c) => (
                  <option key={c} value={c} disabled={filtros.caracteristicas.includes(c)}>{CARACTERISTICAS[c].label}</option>
                ))}
              </select>
            </label>
            <div className="estoque-opcoes">
              <label>
                <input type="checkbox" checked={filtros.vizinhos} onChange={(e) => muda('vizinhos', e.target.checked)} /> Incluir bairros vizinhos (até 2 km)
              </label>
              <label>
                <input type="checkbox" checked={filtros.todoEstoque} onChange={(e) => muda('todoEstoque', e.target.checked)} /> Mostrar também em moderação e em reforma
              </label>
            </div>
            <div className="pg-filtros-acoes">
              <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>Limpar busca</button>
            </div>
          </div>

          {resultado.criterios.length > 0 && (
            <div className="estoque-chips" aria-label="Filtros ativos">
              {resultado.criterios.map((c) => (
                <span key={c.id} className="badge badge-coral">
                  {c.rotulo}
                  <button type="button" className="estoque-chip-x" onClick={() => aplicar(semCriterio(filtros, c.id))} aria-label={`Tirar o filtro ${c.rotulo}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="estoque-resumo-linha">
            <p className="estoque-resumo">
              <strong>{fmtNum(resultado.exatos.length)}</strong> {resultado.exatos.length === 1 ? 'imóvel atende' : 'imóveis atendem'} a tudo
              {resultado.quaseLa.length > 0 && <> · {fmtNum(resultado.quaseLa.length)} quase lá</>}
              {resultado.restricao && (
                <>
                  {' '}
                  · O filtro que mais restringe é <strong>{resultado.restricao.rotulo}</strong>: sem ele, são {fmtNum(resultado.restricao.n)}.{' '}
                  <button type="button" className="btn btn-link btn-sm" onClick={() => aplicar(semCriterio(filtros, resultado.restricao.id))}>
                    Tirar esse filtro
                  </button>
                </>
              )}
            </p>
            <label className="pg-campo estoque-ordem">
              Ordenar por
              <select value={filtros.ordem} onChange={(e) => muda('ordem', e.target.value)}>
                {Object.entries(ORDENACOES).map(([v, o]) => (
                  <option key={v} value={v}>{o.rotulo}</option>
                ))}
              </select>
            </label>
          </div>

          <Bloco
            key={`exatos-${params.toString()}`}
            titulo={comFiltro ? 'Atendem a tudo' : 'Estoque disponível'}
            itens={exatos}
            onAbrir={setAberto}
            vazio={
              <div className="empty">
                <div className="empty-title">Nenhum imóvel atende a tudo</div>
                <div className="empty-sub">Veja os "quase lá" abaixo ou tire um filtro.</div>
              </div>
            }
          />
          <Bloco key={`quase-${params.toString()}`} titulo="Quase lá: falham em um critério, dentro da margem" itens={resultado.quaseLa} onAbrir={setAberto} />
          <p className="pg-nota">
            Estoque do Imoview lido todo dia às 5h30. Por padrão entram os vagos/disponíveis e em desocupação. "Quase lá" aceita: preço até 10% fora da faixa, 1 quarto, suíte ou vaga a menos, área até 10% menor, bairro vizinho a até 2 km ou uma característica a menos.
          </p>
        </>
      )}

      <FichaImovel key={aberto ? `${aberto.codigo}-${aberto.finalidade}` : 'nenhum'} imovel={aberto} onFechar={() => setAberto(null)} />
    </div>
  )
}
