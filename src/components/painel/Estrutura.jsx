import { useState } from 'react'
import { OPCOES_PERIODO } from '../../lib/painelGestao'

/** Barra única de filtros, acima de tudo que ela recorta. O estado vive na URL. */
export function BarraFiltros({ filtros, setFiltro, limpar, canais, corretores, alterados }) {
  const [copiado, setCopiado] = useState(false)
  const copiarLink = async () => {
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
      <div className="pg-segmentado" role="radiogroup" aria-label="Finalidade">
        {[
          { valor: 'todas', label: 'Tudo' },
          { valor: 'Venda', label: 'Venda' },
          { valor: 'Aluguel', label: 'Locação' },
        ].map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={filtros.finalidade === o.valor}
            className={filtros.finalidade === o.valor ? 'is-ativo' : undefined}
            onClick={() => setFiltro('finalidade', o.valor)}
          >
            {o.valor !== 'todas' && <span className={`pg-ponto pg-ponto--${o.valor}`} aria-hidden="true" />}
            {o.label}
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
        <span>Canal</span>
        <select value={filtros.canal} onChange={(e) => setFiltro('canal', e.target.value)}>
          <option value="todos">Todos</option>
          {canais.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="pg-campo">
        <span>Corretor</span>
        <select value={filtros.corretor} onChange={(e) => setFiltro('corretor', e.target.value)}>
          <option value="todos">Todos</option>
          {corretores.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="pg-filtros-acoes">
        {alterados && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>
            Limpar filtros
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiarLink}>
          {copiado ? 'Link copiado' : 'Copiar link desta visão'}
        </button>
      </div>
    </div>
  )
}

/** Capítulo da história: a pergunta pequena em cima, a conclusão como título. */
export function Capitulo({ numero, pergunta, conclusao, children, rodape }) {
  return (
    <section className="pg-capitulo" aria-labelledby={`pg-cap-${numero}`}>
      <div className="pg-capitulo-cabeca">
        <div className="pg-capitulo-pergunta">
          <span className="pg-capitulo-numero">{numero}</span>
          {pergunta}
        </div>
        <h2 id={`pg-cap-${numero}`} className="pg-capitulo-conclusao">{conclusao}</h2>
      </div>
      {children}
      {rodape && <p className="pg-nota">{rodape}</p>}
    </section>
  )
}

const SETA = { sobe: '↑', desce: '↓', igual: '→' }

/**
 * Índice da manchete: valor, variação com seta e texto (nunca só cor) e um
 * minigráfico dos últimos 12 meses.
 */
export function Indice({ rotulo, valor, variacao, sentido = 'maior-melhor', contexto, serie, formula }) {
  let direcao = 'igual'
  if (variacao != null && Math.abs(variacao) >= 5) direcao = variacao > 0 ? 'sobe' : 'desce'
  const bom = direcao === 'igual' || sentido === 'neutro' ? null : (direcao === 'sobe') === (sentido === 'maior-melhor')
  const classe = bom == null ? 'neutro' : bom ? 'bom' : 'ruim'
  return (
    <div className="pg-indice" title={formula}>
      <div className="pg-indice-rotulo">{rotulo}</div>
      <div className="pg-indice-valor">{valor}</div>
      {variacao != null && (
        <div className={`pg-indice-var pg-indice-var--${classe}`}>
          <span aria-hidden="true">{SETA[direcao]}</span> {variacao > 0 ? '+' : ''}
          {Math.round(variacao)}% <span className="pg-indice-contexto">{contexto}</span>
        </div>
      )}
      {variacao == null && contexto && <div className="pg-indice-contexto">{contexto}</div>}
      {serie && serie.length > 1 && <Sparkline valores={serie} />}
    </div>
  )
}

function Sparkline({ valores }) {
  const w = 120
  const h = 28
  const max = Math.max(...valores, 1)
  const passo = w / (valores.length - 1)
  const pts = valores.map((v, i) => `${(i * passo).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ')
  const ultimo = pts.split(' ').at(-1).split(',')
  return (
    <svg className="pg-sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`Últimos 12 meses: ${valores.join(', ')}`}>
      <polyline points={pts} fill="none" stroke="var(--grafite-fade)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r="3" fill="var(--coral)" />
    </svg>
  )
}
