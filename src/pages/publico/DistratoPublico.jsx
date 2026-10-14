import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ALUGARIA, AREAS, AVISO_MULTA, COM_QUEM, DOCUMENTOS_SAIDA, FATORES, MOTIVOS, PEDE_COM_QUEM, PEDE_FATOR,
  PROCEDIMENTO, abrirDistrato, enviarAviso, fmtData, fmtDataHora, somaDias,
} from '../../lib/distrato'

function Moldura({ children }) {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">Aviso de desocupação</span>
        </div>
      </nav>
      <main className="app-main" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>{children}</main>
    </div>
  )
}

function Opcoes({ opcoes, valor, onChange, rotulo }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => {
        const v = typeof o === 'string' ? o : o.valor
        const l = typeof o === 'string' ? o : o.label
        return (
          <button key={v} type="button" role="radio" aria-checked={valor === v}
            className={`btn btn-sm ${valor === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(valor === v ? null : v)}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

const PASSOS = ['Procedimento', 'Aviso', 'Pesquisa']

function Passos({ atual }) {
  return (
    <ol style={{ display: 'flex', gap: 'var(--space-2)', listStyle: 'none', margin: '0 0 var(--space-4)', padding: 0 }} aria-label="Etapas">
      {PASSOS.map((p, i) => (
        <li key={p} aria-current={i === atual ? 'step' : undefined}
          style={{
            flex: 1, padding: 'var(--space-2) 0', borderTop: `3px solid ${i <= atual ? 'var(--coral)' : 'var(--champagne)'}`,
            fontSize: 'var(--text-sm)', color: i === atual ? 'var(--grafite)' : 'var(--grafite-soft)', fontWeight: i === atual ? 500 : 400,
          }}>
          {i + 1}. {p}
        </li>
      ))}
    </ol>
  )
}

function Mensagem({ titulo, texto }) {
  return (
    <Moldura>
      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>{titulo}</div>
        <p className="page-sub" style={{ margin: 0 }}>{texto}</p>
        <p className="page-sub" style={{ margin: 0 }}>administrativo@imovit.com.br · (19) 2512-7700</p>
      </div>
    </Moldura>
  )
}

function Comprovante({ d, avisoEm, fimAviso, dataPrevista, dentroPrazo }) {
  return (
    <Moldura>
      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <div className="page-eyebrow">Aviso recebido</div>
          <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>Recebemos o seu aviso de desocupação</div>
          <p className="page-sub" style={{ margin: 0 }}>Uma cópia deste comprovante foi enviada para o seu e-mail.</p>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
          <dt className="muted">Imóvel</dt><dd style={{ margin: 0 }}>{d.imovel_endereco ?? '—'}</dd>
          <dt className="muted">Aviso registrado em</dt><dd style={{ margin: 0 }}>{fmtDataHora(avisoEm)}</dd>
          <dt className="muted">Entrega prevista</dt><dd style={{ margin: 0 }}>{fmtData(dataPrevista)}</dd>
          <dt className="muted">Fim do aviso prévio</dt><dd style={{ margin: 0 }}>{fmtData(fimAviso)}</dd>
        </dl>
        {dentroPrazo === false && <div className="login-error">{AVISO_MULTA}</div>}
        <div>
          <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Próximos passos</div>
          <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>
            <li>Deixe o imóvel livre, limpo e com os equipamentos funcionando. Se precisar pintar, pinte antes da entrega das chaves.</li>
            <li>Com o imóvel desocupado, agende a vistoria final com o administrativo (segunda a sexta).</li>
            <li>Com a vistoria aprovada pelo proprietário, traga as chaves e os documentos:
              <ul style={{ paddingLeft: 18 }}>{DOCUMENTOS_SAIDA.map((t) => <li key={t}>{t}</li>)}</ul>
            </li>
          </ol>
        </div>
        <p className="page-sub" style={{ margin: 0 }}>Dúvidas: administrativo@imovit.com.br · (19) 2512-7700</p>
      </div>
    </Moldura>
  )
}

/**
 * Link público do distrato (RF29.2, PRD §5.16): procedimento + ciência,
 * aviso + motivo, pesquisa opcional e comprovante. Sem login: o token do
 * link é a chave; tudo passa pela Edge Function `distrato`.
 */
export default function DistratoPublico() {
  const { token } = useParams()
  const [d, setD] = useState(null)
  const [erroCarga, setErroCarga] = useState('')
  const [passo, setPasso] = useState(0)
  const [ciente, setCiente] = useState(false)
  const [form, setForm] = useState({
    data: '', motivo: null, detalhe: '', comQuem: null, fator: null, telefone: '', email: '', multa: false,
    nps: null, notas: {}, alugaria: null, comentario: '',
  })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    abrirDistrato(token)
      .then(({ distrato }) => {
        setD(distrato)
        setForm((f) => ({ ...f, telefone: distrato.locatario_telefone ?? '', email: distrato.locatario_email ?? '' }))
      })
      .catch((e) => setErroCarga(e.message))
  }, [token])

  useEffect(() => { window.scrollTo({ top: 0 }) }, [passo])

  if (erroCarga) return <Mensagem titulo="Link não encontrado" texto={erroCarga} />
  if (!d) return <Moldura><div className="hub-loading">Carregando…</div></Moldura>
  if (d.situacao === 'expirado' || d.situacao === 'cancelado') {
    return <Mensagem titulo="Este link não está mais ativo" texto="Fale com o administrativo da Imovit para receber um novo link." />
  }
  if (enviado) return <Comprovante d={d} {...enviado} />
  if (d.situacao === 'enviado') {
    return <Comprovante d={d} avisoEm={d.aviso_em} fimAviso={d.fim_aviso_previo} dataPrevista={d.data_prevista_saida} dentroPrazo={d.dentro_prazo} />
  }

  const fimAviso = somaDias(d.hoje, d.aviso_previo_dias)
  const antesDoPrazo = form.data && form.data < fimAviso

  function validarAviso() {
    if (!form.data) return 'Informe a data prevista de entrega das chaves.'
    if (form.data < d.hoje) return 'A data prevista não pode ser no passado.'
    if (!form.motivo) return 'Escolha o motivo da saída.'
    if (form.motivo === 'Outro' && !form.detalhe.trim()) return 'Conte o motivo em poucas palavras.'
    if (PEDE_COM_QUEM.includes(form.motivo) && !form.comQuem) return 'Conte com quem você fechou o novo imóvel.'
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Confira o e-mail de contato.'
    if (!form.telefone.trim() && !form.email.trim()) return 'Deixe um telefone ou e-mail para contato.'
    if (antesDoPrazo && !form.multa) return 'Confirme que está ciente da cobrança do aviso prévio.'
    return ''
  }

  function avancarAviso(ev) {
    ev.preventDefault()
    const msg = validarAviso()
    setErro(msg)
    if (!msg) setPasso(2)
  }

  async function enviar(comPesquisa) {
    setErro('')
    setEnviando(true)
    try {
      const notas = Object.fromEntries(Object.entries(form.notas).filter(([, v]) => v != null))
      const r = await enviarAviso(token, {
        ciente: true,
        data_prevista_saida: form.data,
        confirma_multa: antesDoPrazo ? form.multa : undefined,
        contato_telefone: form.telefone.trim() || null,
        contato_email: form.email.trim() || null,
        motivo: form.motivo,
        motivo_detalhe: form.detalhe.trim() || null,
        motivo_com_quem: PEDE_COM_QUEM.includes(form.motivo) ? form.comQuem : null,
        motivo_fator: PEDE_FATOR.includes(form.motivo) ? form.fator : null,
        ...(comPesquisa ? {
          nps: form.nps,
          notas: Object.keys(notas).length ? notas : null,
          alugaria_de_novo: form.alugaria,
          comentario: form.comentario.trim() || null,
        } : {}),
      })
      setEnviado({ avisoEm: r.aviso_em, fimAviso: r.fim_aviso_previo, dataPrevista: form.data, dentroPrazo: r.dentro_prazo })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const primeiro = (d.locatario_nome ?? '').split(' ')[0]

  return (
    <Moldura>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">{d.imovel_endereco}</div>
          <div className="page-title">Aviso de desocupação</div>
          <div className="page-sub">{primeiro ? `Olá, ${primeiro}. ` : ''}São três passos rápidos.</div>
        </div>
      </header>
      <Passos atual={passo} />

      {passo === 0 && (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="page-eyebrow">Procedimento de desocupação</div>
          <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', lineHeight: 1.6 }}>
            {PROCEDIMENTO.map((t) => <li key={t}>{t}</li>)}
          </ol>
          <div>
            <div className="field-hint" style={{ marginBottom: 'var(--space-2)' }}>Documentos para a entrega das chaves:</div>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>{DOCUMENTOS_SAIDA.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="login-error"><strong>Atenção:</strong> {AVISO_MULTA}</div>
          <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={ciente} onChange={(ev) => setCiente(ev.target.checked)} style={{ marginTop: 4 }} />
            <span>Li o procedimento e estou ciente.</span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!ciente} onClick={() => setPasso(1)}>Continuar</button>
          </div>
        </div>
      )}

      {passo === 1 && (
        <form className="card card-body" onSubmit={avancarAviso} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <div className="page-eyebrow" style={{ marginBottom: 2 }}>Locatário e imóvel</div>
            <div>{d.locatario_nome}</div>
            <div className="muted">{d.imovel_resumo ? `${d.imovel_resumo} · ` : ''}{d.imovel_endereco}</div>
          </div>

          <div className="field">
            <label htmlFor="dt-data">Data prevista de entrega das chaves</label>
            <input id="dt-data" type="date" min={d.hoje} value={form.data} onChange={(ev) => set({ data: ev.target.value, multa: false })} required />
            <span className="field-hint">O aviso prévio de 30 dias termina em {fmtData(fimAviso)}.</span>
          </div>
          {antesDoPrazo && (
            <div className="login-error" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span>A data é anterior ao fim do aviso prévio. {AVISO_MULTA}</span>
              <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.multa} onChange={(ev) => set({ multa: ev.target.checked })} style={{ marginTop: 4 }} />
                <span>Estou ciente da cobrança.</span>
              </label>
            </div>
          )}

          <div className="field">
            <label>Por que você está saindo?</label>
            <Opcoes rotulo="Motivo" opcoes={MOTIVOS} valor={form.motivo} onChange={(v) => set({ motivo: v, comQuem: null, fator: null })} />
          </div>
          {PEDE_COM_QUEM.includes(form.motivo) && (
            <div className="field">
              <label>Com quem?</label>
              <Opcoes rotulo="Com quem" opcoes={COM_QUEM} valor={form.comQuem} onChange={(v) => set({ comQuem: v })} />
            </div>
          )}
          {PEDE_FATOR.includes(form.motivo) && (
            <div className="field">
              <label>O que pesou mais? (opcional)</label>
              <Opcoes rotulo="O que pesou mais" opcoes={FATORES} valor={form.fator} onChange={(v) => set({ fator: v })} />
            </div>
          )}
          <div className="field">
            <label htmlFor="dt-det">{form.motivo === 'Outro' ? 'Conte o motivo' : 'Quer contar mais? (opcional)'}</label>
            <textarea id="dt-det" rows={3} value={form.detalhe} onChange={(ev) => set({ detalhe: ev.target.value })} maxLength={1000} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="dt-tel">Telefone para contato</label>
              <input id="dt-tel" type="tel" autoComplete="tel" value={form.telefone} onChange={(ev) => set({ telefone: ev.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="dt-email">E-mail para o comprovante</label>
              <input id="dt-email" type="email" autoComplete="email" value={form.email} onChange={(ev) => set({ email: ev.target.value })} />
            </div>
          </div>

          {erro && <div className="login-error">{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setErro(''); setPasso(0) }}>Voltar</button>
            <button type="submit" className="btn btn-primary btn-sm">Continuar</button>
          </div>
        </form>
      )}

      {passo === 2 && (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div>
            <div className="page-eyebrow">Pesquisa de satisfação (opcional)</div>
            <p className="page-sub" style={{ margin: 0 }}>Leva um minuto e nos ajuda a melhorar. Se preferir, pule e envie o aviso.</p>
          </div>

          <div className="field">
            <label>De 0 a 10, quanto você recomendaria a Imovit a um amigo?</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: 4 }} role="radiogroup" aria-label="Nota de 0 a 10">
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} type="button" role="radio" aria-checked={form.nps === n}
                  className={`btn btn-sm ${form.nps === n ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '6px 0', minWidth: 0 }} onClick={() => set({ nps: form.nps === n ? null : n })}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="field-hint"><span>Nada provável</span><span>Muito provável</span></div>
          </div>

          <div className="field">
            <label>Como você avalia cada área? (1 = ruim, 5 = ótimo)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {AREAS.map((a) => (
                <div key={a.chave} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <span style={{ flex: '1 1 200px' }}>{a.label}</span>
                  <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label={a.label}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const ativo = form.notas[a.chave] === n
                      return (
                        <button key={n} type="button" role="radio" aria-checked={ativo}
                          className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-ghost'}`} style={{ minWidth: 40 }}
                          onClick={() => set({ notas: { ...form.notas, [a.chave]: ativo ? null : n } })}>
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Você alugaria com a Imovit de novo?</label>
            <Opcoes rotulo="Alugaria de novo" opcoes={ALUGARIA} valor={form.alugaria} onChange={(v) => set({ alugaria: v })} />
          </div>

          <div className="field">
            <label htmlFor="dt-com">Algo que você queira nos dizer? (opcional)</label>
            <textarea id="dt-com" rows={3} value={form.comentario} onChange={(ev) => set({ comentario: ev.target.value })} maxLength={2000} />
          </div>

          {erro && <div className="login-error">{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => { setErro(''); setPasso(1) }}>Voltar</button>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => enviar(false)}>Pular e enviar o aviso</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => enviar(true)}>
                {enviando ? 'Enviando…' : 'Enviar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Moldura>
  )
}
