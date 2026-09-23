import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePortalAcesso } from '../../hooks/usePortalAcesso'
import { useHistoricoProposta } from '../../hooks/useHistoricoProposta'
import { useDocumentosEsteira } from '../../hooks/useDocumentosEsteira'
import { supabase } from '../../lib/supabaseClient'
import { confirmarDadosLocatario, completarCadastro, registrarDocumentosEnviados } from '../../lib/esteira'
import { ETAPAS_JORNADA, STATUS_LABEL, STATUS_VARIANT, etapaJornada, formatarPrazo } from '../../lib/esteiraLabels'
import { StatusBadge, DocStatusBadge } from '../../components/esteira/StatusBadge'
import JornadaLocatario from '../../components/esteira/JornadaLocatario'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import PortalShell from '../../components/portal/PortalShell'
import DefinirSenha from '../../components/portal/DefinirSenha'

function formatarDataCurta(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function PortalStatus() {
  const { session, propostas, carregando, carregandoSessao, erro, recarregar } = usePortalAcesso()
  const [propostaId, setPropostaId] = useState(null)

  if (carregandoSessao) {
    return <div className="hub-loading">Carregando…</div>
  }

  if (!session) {
    return <Navigate to="/portal/entrar" replace />
  }

  if (carregando) {
    return <PortalShell><div className="hub-loading">Carregando…</div></PortalShell>
  }

  if (erro) {
    return <PortalShell><div className="hub-error">Não foi possível carregar seus processos: {erro}</div></PortalShell>
  }

  if (propostas.length === 0) {
    return (
      <PortalShell>
        <div className="empty">
          <div className="empty-title">Nenhum processo encontrado</div>
          <div className="empty-sub">Não achamos nenhuma proposta de locação associada a este e-mail.</div>
        </div>
      </PortalShell>
    )
  }

  const proposta = propostas.find((p) => p.id === propostaId) ?? propostas[0]

  return (
    <PortalShell>
      <DefinirSenha session={session} />
      {propostas.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          {propostas.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn-sm ${p.id === proposta.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPropostaId(p.id)}
            >
              {p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}
            </button>
          ))}
        </div>
      )}
      <PropostaDetalhe proposta={proposta} onAtualizar={recarregar} />
    </PortalShell>
  )
}

// Última etapa que o locatário já viu neste navegador, pra saber quando uma
// etapa nova destravou. Sem storage (aba anônima, bloqueio), só não anima.
function lerEtapaVista(propostaId) {
  try {
    const v = localStorage.getItem(`jornada:${propostaId}`)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

function salvarEtapaVista(propostaId, etapa) {
  try {
    localStorage.setItem(`jornada:${propostaId}`, String(etapa))
  } catch {
    // sem storage: segue sem lembrar
  }
}

/** Detecta a etapa que acabou de destravar desde a última vez que o locatário viu a proposta. */
function useEtapaLiberada(propostaId, etapa) {
  const [liberada, setLiberada] = useState(null)

  useEffect(() => {
    if (etapa === null) return
    const vista = lerEtapaVista(propostaId)
    if (vista !== null && etapa > vista) setLiberada(etapa)
    salvarEtapaVista(propostaId, etapa)
  }, [propostaId, etapa])

  return [liberada, () => setLiberada(null)]
}

function AvisoEtapaLiberada({ etapa, onFechar }) {
  if (etapa >= ETAPAS_JORNADA.length) {
    return (
      <div className="jornada-aviso" role="status">
        <div>
          <strong>Processo concluído!</strong> Todas as etapas da sua locação foram cumpridas.
        </div>
        <button type="button" className="modal-close" aria-label="Fechar aviso" onClick={onFechar}>×</button>
      </div>
    )
  }
  const e = ETAPAS_JORNADA[etapa]
  return (
    <div className="jornada-aviso" role="status">
      <div>
        <strong>{e.acao ? 'Nova etapa liberada:' : 'Etapa concluída!'}</strong>{' '}
        {e.acao ? `${e.label}. ${e.aguardando}` : e.aguardando}
      </div>
      <button type="button" className="modal-close" aria-label="Fechar aviso" onClick={onFechar}>×</button>
    </div>
  )
}

function PropostaDetalhe({ proposta, onAtualizar }) {
  const { historico } = useHistoricoProposta(proposta.id)
  const prazo = formatarPrazo(proposta.link_expira_em, proposta.status)
  const etapa = proposta.meuPapel === 'locatario' ? etapaJornada(proposta) : null
  const [etapaLiberada, fecharAviso] = useEtapaLiberada(proposta.id, etapa)

  const atividade = [...historico].reverse()

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">{proposta.meuPapel === 'locatario' ? 'Locatário' : 'Proprietário'}</div>
          <div className="page-title">{proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}</div>
          {proposta.imovel_endereco && <div className="page-sub">{proposta.imovel_endereco}</div>}
        </div>
      </header>

      <div className="esteira-layout">
        <aside className="esteira-sidebar">
          <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <StatusBadge status={proposta.status} />
            {prazo && <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span>}
          </div>
          {etapa !== null && (
            <div className="card card-body">
              <JornadaLocatario etapa={etapa} recemLiberada={etapaLiberada} />
            </div>
          )}
        </aside>

        <main style={{ minWidth: 0 }}>
          {etapaLiberada !== null && <AvisoEtapaLiberada etapa={etapaLiberada} onFechar={fecharAviso} />}
          <AcaoDaVez proposta={proposta} onAtualizar={onAtualizar} />

          {atividade.length > 0 && (
            <section style={{ marginTop: 'var(--space-6)' }}>
              <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Atividade recente</div>
              <div className="esteira-atividade">
                {atividade.map((h) => (
                  <div className="esteira-atividade-item" key={h.id}>
                    <span className={`esteira-atividade-dot is-${STATUS_VARIANT[h.status_novo] ?? 'info'}`} />
                    <div className="esteira-atividade-body">
                      <div className="esteira-atividade-title">{STATUS_LABEL[h.status_novo] ?? h.status_novo}</div>
                      <div className="esteira-atividade-meta">{formatarDataCurta(h.timestamp_registro)}</div>
                      {h.motivo && <div className="esteira-atividade-motivo">{h.motivo}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function AcaoDaVez({ proposta, onAtualizar }) {
  if (proposta.meuPapel === 'locatario' && proposta.status === 'aguardando_locatario') {
    return <FormConfirmarDados proposta={proposta} onAtualizar={onAtualizar} />
  }
  if (proposta.meuPapel === 'locatario' && ['aguardando_docs', 'docs_em_analise'].includes(proposta.status)) {
    if (!proposta.tipo_pessoa) {
      return <FormCadastro proposta={proposta} onAtualizar={onAtualizar} />
    }
    return <ChecklistDocumentos proposta={proposta} onAtualizar={onAtualizar} />
  }
  const etapa = etapaJornada(proposta)
  const aguardando = etapa !== null && etapa < ETAPAS_JORNADA.length ? ETAPAS_JORNADA[etapa].aguardando : null
  return (
    <div className="card card-body">
      <div className="stat-sub is-muted" style={{ marginTop: 0 }}>
        {proposta.status === 'sincronizada'
          ? 'Tudo certo por aqui: o processo foi concluído.'
          : `${aguardando ?? 'Nada para fazer da sua parte agora.'} Esta página se atualiza sozinha quando a próxima etapa for liberada.`}
      </div>
    </div>
  )
}

function FormConfirmarDados({ proposta, onAtualizar }) {
  const [form, setForm] = useState({
    nome: proposta.nome_cliente || '',
    tel: '',
    valor_oferta: proposta.valor != null ? String(proposta.valor) : '',
    observacoes: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await confirmarDadosLocatario({
        proposta_id: proposta.id,
        nome: form.nome,
        tel: form.tel,
        valor_oferta: form.valor_oferta ? Number(form.valor_oferta) : undefined,
        observacoes: form.observacoes || undefined,
      })
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Confirme seus dados pra seguir com a proposta</div>
      {erro && <div className="login-error">{erro}</div>}
      <div className="field">
        <label htmlFor="pf-nome">Nome completo</label>
        <input id="pf-nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="pf-email">E-mail</label>
        <input id="pf-email" value={proposta.email} disabled />
      </div>
      <div className="field">
        <label htmlFor="pf-tel">Telefone</label>
        <input id="pf-tel" required value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} placeholder="(19) 99999-9999" />
      </div>
      <div className="field">
        <label htmlFor="pf-valor-oferta">Valor da oferta (R$)</label>
        <CurrencyInput id="pf-valor-oferta" value={form.valor_oferta} onChange={(valor_oferta) => setForm({ ...form, valor_oferta })} />
      </div>
      <div className="field">
        <label htmlFor="pf-observacoes">Observações (opcional)</label>
        <textarea id="pf-observacoes" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
        {salvando ? 'Enviando…' : 'Confirmar e continuar'}
      </button>
    </form>
  )
}

const TIPO_RENDA_OPCOES = ['CLT', 'Autônomo(a)', 'Empresário(a)', 'Aposentado(a)/Pensionista', 'Outro']

function FormCadastro({ proposta, onAtualizar }) {
  const [form, setForm] = useState({
    tipo_pessoa: 'Física',
    tem_conjuge: false,
    profissao: '',
    cargo: '',
    tipo_renda: TIPO_RENDA_OPCOES[0],
    renda_pessoal: '',
    renda_familiar: '',
    nome_empresa: '',
    conjuge_nome: '',
    conjuge_email: '',
    conjuge_profissao: '',
    conjuge_renda: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const ehFisica = form.tipo_pessoa === 'Física'
  const precisaConjuge = ehFisica && form.tem_conjuge

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await completarCadastro({
        proposta_id: proposta.id,
        tipo_pessoa: form.tipo_pessoa,
        tem_conjuge: form.tem_conjuge,
        profissao: ehFisica ? form.profissao || undefined : undefined,
        cargo: ehFisica ? form.cargo || undefined : undefined,
        tipo_renda: ehFisica ? form.tipo_renda || undefined : undefined,
        renda_pessoal: ehFisica && form.renda_pessoal ? Number(form.renda_pessoal) : undefined,
        renda_familiar: ehFisica && form.renda_familiar ? Number(form.renda_familiar) : undefined,
        nome_empresa: ehFisica ? form.nome_empresa || undefined : undefined,
        conjuge_nome: precisaConjuge ? form.conjuge_nome || undefined : undefined,
        conjuge_email: precisaConjuge ? form.conjuge_email || undefined : undefined,
        conjuge_profissao: precisaConjuge ? form.conjuge_profissao || undefined : undefined,
        conjuge_renda: precisaConjuge && form.conjuge_renda ? Number(form.conjuge_renda) : undefined,
      })
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Proposta aprovada — complete seu cadastro pra liberar os documentos</div>
      {erro && <div className="login-error">{erro}</div>}
      <div className="field">
        <label htmlFor="fc-tipo">Tipo de pessoa</label>
        <select id="fc-tipo" value={form.tipo_pessoa} onChange={(e) => setForm({ ...form, tipo_pessoa: e.target.value })}>
          <option value="Física">Física</option>
          <option value="Jurídica">Jurídica</option>
        </select>
      </div>
      {ehFisica && (
        <>
          <p className="page-sub" style={{ margin: 0 }}>
            Esses dados de profissão e renda são usados só pra avaliar sua proposta — ficam restritos à nossa
            equipe de locação e não são compartilhados fora disso.
          </p>
          <div className="field">
            <label htmlFor="fc-profissao">Profissão</label>
            <input id="fc-profissao" required value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-cargo">Cargo</label>
              <input id="fc-cargo" required value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-tipo-renda">Tipo de renda</label>
              <select id="fc-tipo-renda" value={form.tipo_renda} onChange={(e) => setForm({ ...form, tipo_renda: e.target.value })}>
                {TIPO_RENDA_OPCOES.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>
          {form.tipo_renda !== 'Aposentado(a)/Pensionista' && (
            <div className="field">
              <label htmlFor="fc-empresa">Empresa onde trabalha</label>
              <input id="fc-empresa" value={form.nome_empresa} onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-renda-pessoal">Renda pessoal (R$)</label>
              <CurrencyInput id="fc-renda-pessoal" required value={form.renda_pessoal} onChange={(renda_pessoal) => setForm({ ...form, renda_pessoal })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-renda-familiar">Renda familiar (R$)</label>
              <CurrencyInput id="fc-renda-familiar" value={form.renda_familiar} onChange={(renda_familiar) => setForm({ ...form, renda_familiar })} />
            </div>
          </div>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              id="fc-conjuge"
              type="checkbox"
              checked={form.tem_conjuge}
              onChange={(e) => setForm({ ...form, tem_conjuge: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <label htmlFor="fc-conjuge" style={{ textTransform: 'none', letterSpacing: 0 }}>Tenho cônjuge (vai precisar dos documentos dele também)</label>
          </div>
        </>
      )}
      {precisaConjuge && (
        <div className="card card-body" style={{ background: 'var(--gray-50)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">Dados do cônjuge</div>
          <div className="field">
            <label htmlFor="fc-conjuge-nome">Nome completo</label>
            <input id="fc-conjuge-nome" required value={form.conjuge_nome} onChange={(e) => setForm({ ...form, conjuge_nome: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-conjuge-email">E-mail</label>
              <input id="fc-conjuge-email" type="email" required value={form.conjuge_email} onChange={(e) => setForm({ ...form, conjuge_email: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="fc-conjuge-profissao">Profissão</label>
              <input id="fc-conjuge-profissao" required value={form.conjuge_profissao} onChange={(e) => setForm({ ...form, conjuge_profissao: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="fc-conjuge-renda">Renda do cônjuge (R$)</label>
            <CurrencyInput id="fc-conjuge-renda" required value={form.conjuge_renda} onChange={(conjuge_renda) => setForm({ ...form, conjuge_renda })} />
          </div>
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
        {salvando ? 'Enviando…' : 'Salvar cadastro e continuar'}
      </button>
    </form>
  )
}

function ChecklistDocumentos({ proposta, onAtualizar }) {
  const { checklist, carregando, recarregar } = useDocumentosEsteira(proposta)

  // A atualização automática do portal traz a proposta nova; se ela mudou
  // (ex.: ADM reprovou um documento), a lista de documentos acompanha.
  useEffect(() => {
    recarregar()
  }, [proposta.updated_at, recarregar])
  const [enviandoCodigo, setEnviandoCodigo] = useState(null)
  const [erro, setErro] = useState('')

  async function handleArquivo(documentoCodigo, arquivo) {
    if (!arquivo) return
    setErro('')
    setEnviandoCodigo(documentoCodigo)
    try {
      const extensao = arquivo.name.split('.').pop()
      const path = `${proposta.id}/${documentoCodigo}.${extensao}`
      const { error: erroUpload } = await supabase.storage.from('esteira-documentos').upload(path, arquivo, { upsert: true })
      if (erroUpload) throw erroUpload
      await registrarDocumentosEnviados(proposta.id, [{ documento_codigo: documentoCodigo, arquivo_path: path }])
      await Promise.all([recarregar(), onAtualizar()])
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviandoCodigo(null)
    }
  }

  if (carregando) return <div className="hub-loading">Carregando checklist…</div>

  const aprovados = checklist.filter((doc) => doc.envio?.status === 'aprovado').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <div className="page-eyebrow" style={{ marginBottom: 0 }}>Documentos necessários</div>
        <span className="stat-sub is-muted" style={{ marginTop: 0 }}>{aprovados} de {checklist.length} aprovados</span>
      </div>
      <div className="mini-bar-track" style={{ background: 'var(--champagne)', marginBottom: 'var(--space-4)' }}>
        <div className="mini-bar-fill" style={{ width: `${checklist.length ? (aprovados / checklist.length) * 100 : 0}%` }} />
      </div>
      {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}
      <div className="upload-list" style={{ marginTop: 0 }}>
        {checklist.map((doc) => (
          <div className="upload-item" key={doc.codigo}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="upload-item-name">{doc.nome}</div>
              {doc.envio?.status === 'rejeitado' && doc.envio?.feedback_adm && (
                <div className="timeline-sub" style={{ marginTop: 2 }}>{doc.envio.feedback_adm}</div>
              )}
            </div>
            <DocStatusBadge status={doc.envio?.status} />
            {doc.envio?.status !== 'aprovado' && (
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', flexShrink: 0 }}>
                {enviandoCodigo === doc.codigo ? 'Enviando…' : doc.envio ? 'Reenviar' : 'Enviar'}
                <input
                  type="file"
                  style={{ display: 'none' }}
                  disabled={enviandoCodigo !== null}
                  onChange={(e) => handleArquivo(doc.codigo, e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
