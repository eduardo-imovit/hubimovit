import { useCallback, useEffect, useMemo, useState } from 'react'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import ModalPortal from '../../components/esteira/ModalPortal'
import { supabase } from '../../lib/supabaseClient'
import {
  ALUGARIA, AREAS, COM_QUEM, FATORES, buscarContratos, calcularNps, cancelarDistrato, criarDistrato,
  enviarLinkPorEmail, fmtData, fmtDataHora, linkDistrato, linkWhatsApp, mensagemWhatsApp, rotulo, situacao,
} from '../../lib/distrato'

const brl = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }))

function copiar(texto, avisar) {
  navigator.clipboard.writeText(texto).then(() => avisar?.())
}

/** Ações do link (copiar, WhatsApp, e-mail) — usado no "Novo distrato" e no detalhe. */
function AcoesLink({ d, onMudou }) {
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const link = linkDistrato(d.token)
  async function porEmail() {
    setEnviando(true)
    setMsg('')
    try {
      await enviarLinkPorEmail(d.id)
      setMsg(`Link enviado para ${d.locatario_email}.`)
      onMudou?.()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <input readOnly value={link} onFocus={(ev) => ev.target.select()} aria-label="Link do distrato" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(link, () => setMsg('Link copiado.'))}>Copiar link</button>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer"
          href={linkWhatsApp(d.locatario_telefone, mensagemWhatsApp(d.locatario_nome, link))}>Abrir no WhatsApp</a>
        <button type="button" className="btn btn-ghost btn-sm" disabled={enviando || !d.locatario_email} onClick={porEmail}
          title={d.locatario_email ? `Enviar para ${d.locatario_email}` : 'Contrato sem e-mail do locatário'}>
          {enviando ? 'Enviando…' : 'Enviar por e-mail'}
        </button>
      </div>
      {msg && <span className="field-hint">{msg}</span>}
      <span className="field-hint">O link vale até {fmtDataHora(d.expira_em)}.</span>
    </div>
  )
}

function NovoDistrato({ onClose, onCriado }) {
  const [busca, setBusca] = useState('')
  const [contratos, setContratos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState(null)
  const [criando, setCriando] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setCarregando(true)
      buscarContratos(busca)
        .then((r) => { setContratos(r); setErro('') })
        .catch((e) => setErro(e.message))
        .finally(() => setCarregando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  async function criar(c) {
    setCriando(c.codigo)
    setErro('')
    try {
      const { distrato } = await criarDistrato(c.codigo)
      setCriado({ ...distrato, locatario_nome: c.locatario_nome, locatario_email: c.locatario_email, locatario_telefone: c.locatario_telefone })
      onCriado()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCriando(null)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{criado ? 'Link criado' : 'Novo distrato'}</div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {criado ? (
              <>
                <p style={{ margin: 0 }}>Envie o link para <strong>{criado.locatario_nome}</strong>. Quando o locatário enviar, o administrativo recebe o aviso por e-mail.</p>
                <AcoesLink d={criado} />
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="nd-busca">Contrato ativo</label>
                  <input id="nd-busca" autoFocus placeholder="Código do contrato ou do imóvel, nome do locatário ou endereço"
                    value={busca} onChange={(ev) => setBusca(ev.target.value)} />
                </div>
                {erro && <div className="hub-error">{erro}</div>}
                {carregando && <div className="hub-loading">Buscando…</div>}
                {!carregando && contratos.length === 0 && <div className="muted">Nenhum contrato ativo encontrado.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 360, overflowY: 'auto' }}>
                  {contratos.map((c) => (
                    <div key={c.codigo} className="card card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div><strong>{c.locatario_nome}</strong> <span className="muted">· contrato {c.codigo}</span></div>
                        <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                          {c.imovel_endereco} · {brl(c.valor_aluguel)} · fim {fmtData(c.data_fim)}
                        </div>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" disabled={criando != null} onClick={() => criar(c)}>
                        {criando === c.codigo ? 'Gerando…' : 'Gerar link'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function motivoCompleto(d) {
  if (!d.motivo) return '—'
  return [d.motivo, d.motivo_com_quem ? rotulo(COM_QUEM, d.motivo_com_quem).toLowerCase() : null,
    d.motivo_fator ? `pesou: ${rotulo(FATORES, d.motivo_fator).toLowerCase()}` : null].filter(Boolean).join(' · ')
}

function Detalhe({ d, onClose, onMudou }) {
  const [msg, setMsg] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const s = situacao(d)

  async function cancelar() {
    setCancelando(true)
    try {
      await cancelarDistrato(d.id)
      onMudou()
      onClose()
    } catch (e) {
      setMsg(e.message)
      setCancelando(false)
    }
  }

  const linha = (r, v) => (
    <>
      <dt className="muted">{r}</dt>
      <dd style={{ margin: 0 }}>{v ?? '—'}</dd>
    </>
  )

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{d.locatario_nome ?? 'Distrato'}</div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span className={`badge ${s.badge}`}>{s.label}</span>
              {d.origem === 'planilha' && <span className="badge badge-gray">Importado da planilha</span>}
              {d.motivo_com_quem === 'imovit' && <span className="badge badge-coral">Retido: ficou com a Imovit</span>}
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
              {linha('Imóvel', [d.imovel_resumo, d.imovel_endereco].filter(Boolean).join(' · '))}
              {linha('Contrato', d.contrato_codigo ? `${d.contrato_codigo} · ${fmtData(d.contrato_inicio)} a ${fmtData(d.contrato_fim)} · ${brl(d.aluguel)}` : null)}
              {linha('Aviso em', d.aviso_em ? fmtDataHora(d.aviso_em) : null)}
              {linha('Entrega prevista', d.data_prevista_saida ? `${fmtData(d.data_prevista_saida)}${d.dentro_prazo === false ? ' (antes dos 30 dias)' : ''}` : null)}
              {linha('Fim do aviso prévio', d.fim_aviso_previo ? fmtData(d.fim_aviso_previo) : null)}
              {linha('Motivo', motivoCompleto(d))}
              {linha('Detalhe', d.motivo_detalhe)}
              {linha('Contato', [d.contato_telefone ?? d.locatario_telefone, d.contato_email ?? d.locatario_email].filter(Boolean).join(' · '))}
            </dl>

            {d.status === 'aviso_recebido' && d.motivo && (
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(d.motivo, () => setMsg('Motivo copiado: cole no motivo de rescisão do Imoview.'))}>
                  Copiar motivo para o Imoview
                </button>
              </div>
            )}

            {(d.nps != null || d.notas || d.alugaria_de_novo || d.comentario) && (
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Pesquisa de satisfação</div>
                <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
                  {linha('Recomendaria (0–10)', d.nps)}
                  {AREAS.map((a) => d.notas?.[a.chave] != null && linha(a.label, `${d.notas[a.chave]}/5`))}
                  {linha('Alugaria de novo', d.alugaria_de_novo ? rotulo(ALUGARIA, d.alugaria_de_novo) : null)}
                  {linha('Comentário', d.comentario)}
                </dl>
              </div>
            )}

            {d.origem === 'planilha' && d.respostas_originais && (
              <details>
                <summary className="muted" style={{ cursor: 'pointer' }}>Respostas como vieram da planilha</summary>
                <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: 'var(--space-2) var(--space-4)', margin: 'var(--space-2) 0 0' }}>
                  {Object.entries(d.respostas_originais).map(([k, v]) => linha(k, String(v ?? '')))}
                </dl>
              </details>
            )}

            {s.chave === 'aguardando' && <AcoesLink d={d} onMudou={onMudou} />}
            {msg && <span className="field-hint">{msg}</span>}
            {confirmar && (
              <div className="login-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span>Cancelar este distrato? O link deixa de funcionar.</span>
                <button type="button" className="btn btn-primary btn-sm" disabled={cancelando} onClick={cancelar}>
                  {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer">
            {d.origem === 'hub' && d.status !== 'cancelado' && !confirmar && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmar(true)}>Cancelar distrato</button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function Resumo({ itens }) {
  const r = useMemo(() => {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const doze = new Date(agora)
    doze.setFullYear(doze.getFullYear() - 1)
    const recebidos = itens.filter((d) => d.status === 'aviso_recebido' && d.aviso_em)
    const ano = recebidos.filter((d) => new Date(d.aviso_em) >= doze)
    const motivos = Object.entries(ano.reduce((acc, d) => {
      if (d.motivo) acc[d.motivo] = (acc[d.motivo] ?? 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1])
    const medias = AREAS.map((a) => {
      const v = ano.map((d) => d.notas?.[a.chave]).filter((n) => n != null)
      return { ...a, media: v.length ? v.reduce((s, n) => s + n, 0) / v.length : null, n: v.length }
    })
    const novoImovel = ano.filter((d) => d.motivo_com_quem)
    return {
      mes: recebidos.filter((d) => new Date(d.aviso_em) >= inicioMes).length,
      aguardando: itens.filter((d) => situacao(d).chave === 'aguardando').length,
      ano: ano.length,
      nps: calcularNps(ano.map((d) => d.nps)),
      npsN: ano.filter((d) => d.nps != null).length,
      retidos: novoImovel.filter((d) => d.motivo_com_quem === 'imovit').length,
      novoImovel: novoImovel.length,
      motivos,
      medias,
    }
  }, [itens])

  return (
    <>
      <div className="kpi-grid">
        <div className="stat-card">
          <div className="stat-label">Avisos no mês</div>
          <div className="stat-value">{r.mes}</div>
          <div className="stat-sub">{r.aguardando} link(s) aguardando o locatário</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">NPS de saída · 12 meses</div>
          <div className="stat-value">{r.nps ?? '—'}</div>
          <div className="stat-sub">{r.npsN} resposta(s) de {r.ano} aviso(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ficaram com a Imovit</div>
          <div className="stat-value">{r.retidos}</div>
          <div className="stat-sub">de {r.novoImovel} que alugaram ou compraram outro imóvel</div>
        </div>
      </div>
      {(r.motivos.length > 0 || r.medias.some((m) => m.media != null)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card card-body">
            <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Motivos · 12 meses</div>
            {r.motivos.length === 0 && <div className="muted">Sem avisos no período.</div>}
            {r.motivos.map(([m, n]) => (
              <div key={m} style={{ marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}><span>{m}</span><span>{n}</span></div>
                <div className="mini-bar-track" style={{ background: 'var(--champagne)' }}>
                  <div className="mini-bar-fill" style={{ width: `${(n / r.motivos[0][1]) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="card card-body">
            <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Notas por área · 12 meses (1 a 5)</div>
            {r.medias.map((a) => (
              <div key={a.chave} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                <span>{a.label}</span>
                <span className={a.media != null && a.media < 3 ? 'text-coral' : ''}>{a.media != null ? `${a.media.toFixed(1)} (${a.n})` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

const FILTROS = [
  { chave: 'todos', label: 'Todos' },
  { chave: 'aguardando', label: 'Aguardando' },
  { chave: 'recebido', label: 'Avisos recebidos' },
  { chave: 'expirado', label: 'Expirados' },
  { chave: 'cancelado', label: 'Cancelados' },
]

/**
 * Distratos (RF29, PRD §5.16): o ADM gera o link por contrato e acompanha
 * os avisos, motivos e a pesquisa de satisfação. Só gestão/adm (rota + RLS).
 */
export default function Distratos() {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  const carregar = useCallback(() => {
    supabase.from('distratos').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErro(error.message)
        else setItens(data ?? [])
        setCarregando(false)
      })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = itens.filter((d) => filtro === 'todos' || situacao(d).chave === filtro)
  const ordem = (d) => d.aviso_em ?? d.created_at

  return (
    <div>
      <SubnavPropostas area="locacao" />
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Propostas · Locação</div>
          <div className="page-title">Distratos</div>
          <div className="page-sub">Avisos de desocupação, motivos de saída e a satisfação de quem sai.</div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setNovo(true)}>Novo distrato</button>
      </header>

      {erro && <div className="hub-error">Não foi possível carregar: {erro}</div>}
      {carregando && <div className="hub-loading">Carregando…</div>}
      {!carregando && !erro && <Resumo itens={itens} />}

      {!carregando && !erro && (
        <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
          {FILTROS.map((f) => (
            <button key={f.chave} type="button" className={`tab${filtro === f.chave ? ' is-active' : ''}`} style={{ background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => setFiltro(f.chave)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!carregando && !erro && visiveis.length === 0 && (
        <div className="card card-body">{itens.length === 0 ? 'Nenhum distrato ainda. Clique em "Novo distrato" quando um locatário avisar que vai sair.' : 'Nada neste filtro.'}</div>
      )}

      {visiveis.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Aviso</th>
                <th>Entrega prevista</th>
                <th>Motivo</th>
                <th className="num">NPS</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {[...visiveis].sort((a, b) => ordem(b).localeCompare(ordem(a))).map((d) => {
                const s = situacao(d)
                return (
                  <tr key={d.id} onClick={() => setAberto(d)} style={{ cursor: 'pointer' }}>
                    <td style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 500 }}>{d.locatario_nome ?? '—'}</div>
                      {d.contrato_codigo && <div className="is-muted" style={{ fontSize: 'var(--text-xs)' }}>Contrato {d.contrato_codigo}</div>}
                    </td>
                    <td style={{ minWidth: 200, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.imovel_endereco ?? ''}>{d.imovel_endereco ?? '—'}</div>
                      {d.imovel_resumo && <div className="is-muted" style={{ fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.imovel_resumo}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {d.aviso_em ? new Date(d.aviso_em).toLocaleDateString('pt-BR') : '—'}
                      {d.fim_aviso_previo && <div className="is-muted" style={{ fontSize: 'var(--text-xs)' }}>30 dias: {fmtData(d.fim_aviso_previo)}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {fmtData(d.data_prevista_saida)}
                      {d.dentro_prazo === false && <div className="text-coral" style={{ fontSize: 'var(--text-xs)' }}>antes dos 30 dias</div>}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      {d.motivo ?? '—'}
                      {d.motivo_com_quem === 'imovit' && <div style={{ marginTop: 4 }}><span className="badge badge-coral">Ficou com a Imovit</span></div>}
                    </td>
                    <td className="num">{d.nps ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`badge ${s.badge}`}>{s.label}</span>
                      {d.origem === 'planilha' && <div className="is-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>da planilha</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {novo && <NovoDistrato onClose={() => setNovo(false)} onCriado={carregar} />}
      {aberto && <Detalhe d={aberto} onClose={() => setAberto(null)} onMudou={carregar} />}
    </div>
  )
}
