import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buscar } from '../../lib/homeNiveis'
import { useEventosCalendario } from '../../hooks/useEventosCalendario'
import { usePlantao } from '../../hooks/usePlantao'
import { somarDias } from '../../lib/paineis'

// ---------------------------------------------------------------------------
// Ícones (traço fino, herdam a cor do texto)
// ---------------------------------------------------------------------------

const CAMINHOS = {
  painel: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  grafico: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  kanban: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z',
  documento: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  pessoas: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9',
  mais: 'M12 5v14M5 12h14',
  pasta: 'M3 6h6l2 2h10v12H3z',
  megafone: 'M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 010 6',
  calendario: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  busca: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  seta: 'M5 12h14M13 6l6 6-6 6',
}

export function Icone({ nome, tamanho = 20 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome] ?? CAMINHOS.seta} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Busca "O que você procura?"
// ---------------------------------------------------------------------------

export function BuscaHome({ paginas, links }) {
  const [consulta, setConsulta] = useState('')
  const [selecionado, setSelecionado] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const resultados = useMemo(() => buscar(consulta, paginas, links), [consulta, paginas, links])

  const abrir = (r) => {
    if (!r) return
    if (r.tipo === 'link') window.open(r.url, '_blank', 'noopener')
    else navigate(r.to)
    setConsulta('')
  }

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelecionado((s) => Math.min(s + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelecionado((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); abrir(resultados[selecionado]) }
    if (e.key === 'Escape') setConsulta('')
  }

  return (
    <div className="home-busca">
      <div className="home-busca-campo">
        <Icone nome="busca" tamanho={18} />
        <input
          ref={inputRef}
          type="search"
          placeholder="O que você procura? Ex.: proposta, plantão, manual…"
          value={consulta}
          onChange={(e) => { setConsulta(e.target.value); setSelecionado(0) }}
          onKeyDown={teclas}
          aria-label="Buscar páginas, links e manuais"
          aria-expanded={consulta.length > 0}
          aria-controls="home-busca-resultados"
        />
      </div>
      {consulta && (
        <ul className="home-busca-resultados" id="home-busca-resultados" role="listbox">
          {resultados.length === 0 && <li className="home-busca-vazio">Nada encontrado para "{consulta}".</li>}
          {resultados.map((r, i) => (
            <li key={`${r.tipo}-${r.titulo}`} role="option" aria-selected={i === selecionado}>
              <button type="button" className={i === selecionado ? 'is-ativo' : undefined} onMouseEnter={() => setSelecionado(i)} onClick={() => abrir(r)}>
                <span className="home-busca-tipo">{r.tipo === 'link' ? r.sub || 'Link' : 'Página'}</span>
                <span className="home-busca-titulo">{r.titulo}</span>
                <span aria-hidden="true">{r.tipo === 'link' ? '↗' : '→'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Atalhos
// ---------------------------------------------------------------------------

export function Atalhos({ itens }) {
  return (
    <nav className="home-atalhos" aria-label="Atalhos">
      {itens.map((a) => {
        const conteudo = (
          <>
            <span className="home-atalho-icone"><Icone nome={a.icone} /></span>
            <span className="home-atalho-texto">
              <span className="home-atalho-titulo">{a.titulo}</span>
              <span className="home-atalho-desc">{a.descricao}</span>
            </span>
          </>
        )
        return a.to.startsWith('#') ? (
          <a key={a.to} href={a.to} className="home-atalho">{conteudo}</a>
        ) : (
          <Link key={a.to} to={a.to} className="home-atalho">{conteudo}</Link>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Para você hoje
// ---------------------------------------------------------------------------

export function Pendencias({ itens, erro }) {
  if (itens == null) return <div className="home-pendencias-carregando">Vendo o que precisa da sua atenção…</div>
  // uma consulta que falhou não pode virar "tudo em dia"
  if (itens.length === 0 && erro) {
    return <div className="home-pendencias-erro">Não consegui verificar as suas pendências agora. Recarregue a página em instantes.</div>
  }
  if (itens.length === 0) {
    return (
      <div className="home-tudo-em-dia">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Tudo em dia.</strong>
          <div>Nada esperando por você agora.</div>
        </div>
      </div>
    )
  }
  return (
    <ul className="home-pendencias">
      {itens.map((p) => (
        <li key={p.texto}>
          <Link to={p.to} className={`home-pendencia home-pendencia--${p.tom}`}>
            {p.n != null && <span className="home-pendencia-n">{p.n}</span>}
            <span className="home-pendencia-texto">{p.texto}</span>
            <span className="home-pendencia-acao">{p.acao} <Icone nome="seta" tamanho={14} /></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Hoje no escritório: plantão dos próximos dias e compromissos de hoje/amanhã
// ---------------------------------------------------------------------------

const TURNO = { manha: 'Manhã', tarde: 'Tarde', dia_inteiro: 'Dia inteiro' }
const DIA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const nomeCurto = (nome) => {
  const partes = (nome ?? '').trim().split(/\s+/)
  return partes.length <= 2 ? partes.join(' ') : `${partes[0]} ${partes.at(-1)}`
}

export function HojeNoEscritorio({ hoje }) {
  const { plantoes, carregando } = usePlantao(hoje, somarDias(hoje, 4))
  const dias = Array.from({ length: 5 }, (_, i) => somarDias(hoje, i))
  const ativos = plantoes.filter((p) => p.status !== 'cancelado')
  // enquanto carrega, não afirmar "sem escala"
  if (carregando && plantoes.length === 0) return <p className="is-muted home-vazio">Carregando o plantão…</p>

  return (
    <div className="home-hoje">
      <ul className="home-plantao">
        {dias.map((d) => {
          const doDia = ativos.filter((p) => p.data === d)
          const semana = DIA_SEMANA[new Date(`${d}T12:00:00`).getDay()]
          return (
            <li key={d} className={d === hoje ? 'is-hoje' : undefined}>
              <span className="home-plantao-dia">{d === hoje ? 'Hoje' : semana} <span>{d.slice(8, 10)}/{d.slice(5, 7)}</span></span>
              <span className="home-plantao-nomes">
                {doDia.length === 0
                  ? <span className="is-muted">sem escala</span>
                  : doDia.map((p) => (
                    <span key={p.id}><span className="is-muted">{TURNO[p.turno]}</span> {nomeCurto(p.corretor_nome)}</span>
                  ))}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agenda da semana: eventos e fotógrafo nos próximos 7 dias
// ---------------------------------------------------------------------------

const TIPOS_AGENDA = {
  reuniao: { rotulo: 'Reunião', grupo: 'eventos', classe: 'reuniao' },
  aviso: { rotulo: 'Aviso', grupo: 'eventos', classe: 'aviso' },
  'data-comemorativa': { rotulo: 'Data', grupo: 'eventos', classe: 'data' },
  fotografo: { rotulo: 'Fotógrafo', grupo: 'fotografo', classe: 'fotografo' },
}
const FILTROS_AGENDA = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'eventos', rotulo: 'Eventos' },
  { valor: 'fotografo', rotulo: 'Fotógrafo' },
]
const MAX_POR_DIA = 4

export function AgendaSemana({ hoje }) {
  const fim = somarDias(hoje, 6)
  const { eventosPorDia } = useEventosCalendario(hoje, fim)
  const [filtro, setFiltro] = useState('tudo')
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i))

  const doDia = (d) =>
    (eventosPorDia[d] ?? []).filter((e) => filtro === 'tudo' || TIPOS_AGENDA[e.tipo]?.grupo === filtro)
  const contar = (grupo) => dias.reduce((s, d) => s + (eventosPorDia[d] ?? []).filter((e) => grupo === 'tudo' || TIPOS_AGENDA[e.tipo]?.grupo === grupo).length, 0)

  return (
    <div>
      <div className="home-agenda-topo">
        <div className="home-agenda-filtros" role="radiogroup" aria-label="Filtrar agenda">
          {FILTROS_AGENDA.map((f) => (
            <button key={f.valor} type="button" role="radio" aria-checked={filtro === f.valor} className={filtro === f.valor ? 'is-ativo' : undefined} onClick={() => setFiltro(f.valor)}>
              {f.rotulo} <span>{contar(f.valor)}</span>
            </button>
          ))}
        </div>
        <div className="home-agenda-legenda" aria-hidden="true">
          <span><i className="home-agenda-ponto home-agenda-ponto--reuniao" />Reunião</span>
          <span><i className="home-agenda-ponto home-agenda-ponto--data" />Data / aniversário</span>
          <span><i className="home-agenda-ponto home-agenda-ponto--aviso" />Aviso</span>
          <span><i className="home-agenda-ponto home-agenda-ponto--fotografo" />Fotógrafo</span>
        </div>
      </div>

      <div className="home-agenda-grade">
        {dias.map((d) => {
          const itens = doDia(d)
          const semana = DIA_SEMANA[new Date(`${d}T12:00:00`).getDay()]
          return (
            <div key={d} className={`home-agenda-dia${d === hoje ? ' is-hoje' : ''}`}>
              <div className="home-agenda-dia-nome">{d === hoje ? 'Hoje' : semana} <span>{d.slice(8, 10)}/{d.slice(5, 7)}</span></div>
              {itens.length === 0 && <div className="home-agenda-vazio">—</div>}
              {itens.slice(0, MAX_POR_DIA).map((e) => {
                const tipo = TIPOS_AGENDA[e.tipo] ?? TIPOS_AGENDA.aviso
                const hora = e.tipo === 'reuniao' ? e.hora.slice(11, 16) : e.tipo === 'fotografo' ? e.sub : null
                return (
                  <div key={`${e.tipo}-${e.id}`} className={`home-agenda-item home-agenda-item--${tipo.classe}`} title={`${tipo.rotulo}: ${e.titulo}${hora ? ` · ${hora}` : ''}`}>
                    {hora && <span className="home-agenda-hora">{hora}</span>}
                    <span className="home-agenda-titulo">{e.titulo.replace(/^📷\s*/, '')}</span>
                  </div>
                )
              })}
              {itens.length > MAX_POR_DIA && <Link to="/agenda" className="home-agenda-mais">+{itens.length - MAX_POR_DIA} na agenda</Link>}
            </div>
          )
        })}
      </div>
      <Link to="/agenda" className="home-link-mais">Ver agenda completa <Icone nome="seta" tamanho={14} /></Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avisos (3 mais recentes) e links úteis
// ---------------------------------------------------------------------------

export function AvisosResumo({ avisos }) {
  const [todos, setTodos] = useState(false)
  if (!avisos.length) return <p className="is-muted home-vazio">Nenhum aviso no momento.</p>
  const lista = todos ? avisos : avisos.slice(0, 3)
  return (
    <div>
      <ul className="home-avisos">
        {lista.map((a) => (
          <li key={a.id}>
            <div className="home-aviso-titulo">{a.titulo}</div>
            {a.corpo && <div className="home-aviso-corpo">{a.corpo}</div>}
            {a.link_url && <a href={a.link_url} target="_blank" rel="noreferrer" className="home-link-mais">Abrir ↗</a>}
          </li>
        ))}
      </ul>
      {avisos.length > 3 && (
        <button type="button" className="home-link-mais home-botao-link" onClick={() => setTodos((t) => !t)}>
          {todos ? 'Mostrar menos' : `Ver todos os ${avisos.length} avisos`}
        </button>
      )}
    </div>
  )
}

export function LinksUteis({ links }) {
  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const l of links) {
      const k = l.categoria || 'Geral'
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k).push(l)
    }
    return [...mapa.entries()]
  }, [links])
  if (!grupos.length) return <p className="is-muted home-vazio">Nenhum link cadastrado.</p>
  return (
    <div className="home-links">
      {grupos.map(([cat, itens]) => (
        <div key={cat}>
          <div className="home-subtitulo">{cat}</div>
          <ul>
            {itens.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer" title={l.descricao ?? undefined}>{l.titulo} <span aria-hidden="true">↗</span></a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
