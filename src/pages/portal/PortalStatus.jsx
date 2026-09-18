import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePortalAcesso } from '../../hooks/usePortalAcesso'
import { useHistoricoProposta } from '../../hooks/useHistoricoProposta'
import { useDocumentosEsteira } from '../../hooks/useDocumentosEsteira'
import { supabase } from '../../lib/supabaseClient'
import { confirmarDadosLocatario, proprietarioAceitou, registrarDocumentosEnviados } from '../../lib/esteira'
import PortalShell from '../../components/portal/PortalShell'

const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando seus dados',
  criada: 'Aguardando aprovação do proprietário',
  aguardando_docs: 'Aguardando envio de documentos',
  docs_em_analise: 'Documentos em análise',
  docs_aprovados: 'Documentos aprovados — finalizando',
  sincronizada: 'Processo concluído',
  rejeitada: 'Proposta rejeitada',
  expirada: 'Prazo expirado',
}

const DOC_STATUS_LABEL = { pendente: 'Pendente', enviado: 'Em análise', aprovado: 'Aprovado', rejeitado: 'Rejeitado — reenvie' }

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function PropostaDetalhe({ proposta, onAtualizar }) {
  const { historico } = useHistoricoProposta(proposta.id)

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">{proposta.meuPapel === 'locatario' ? 'Locatário' : 'Proprietário'}</div>
          <div className="page-title">{proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}</div>
          {proposta.imovel_endereco && <div className="page-sub">{proposta.imovel_endereco}</div>}
        </div>
      </header>

      <div className="card card-body" style={{ marginBottom: 'var(--space-5)' }}>
        <span className="badge badge-gray">{STATUS_LABEL[proposta.status] ?? proposta.status}</span>
      </div>

      <AcaoDaVez proposta={proposta} onAtualizar={onAtualizar} />

      {historico.length > 0 && (
        <section style={{ marginTop: 'var(--space-6)' }}>
          <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Linha do tempo</div>
          <div className="avisos-list">
            {historico.map((h) => (
              <div className="avisos-item" key={h.id}>
                <div className="avisos-item-body">
                  <span className="avisos-item-title">{STATUS_LABEL[h.status_novo] ?? h.status_novo}</span>
                  <div className="avisos-item-sub">{formatarData(h.timestamp_registro)}{h.motivo ? ` · ${h.motivo}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AcaoDaVez({ proposta, onAtualizar }) {
  if (proposta.meuPapel === 'locatario' && proposta.status === 'aguardando_locatario') {
    return <FormConfirmarDados proposta={proposta} onAtualizar={onAtualizar} />
  }
  if (proposta.meuPapel === 'locatario' && ['aguardando_docs', 'docs_em_analise'].includes(proposta.status)) {
    return <ChecklistDocumentos proposta={proposta} onAtualizar={onAtualizar} />
  }
  if (proposta.meuPapel === 'proprietario' && proposta.status === 'criada') {
    return <AprovarProprietario proposta={proposta} onAtualizar={onAtualizar} />
  }
  return (
    <div className="stat-sub is-muted">
      {proposta.status === 'sincronizada'
        ? 'Tudo certo por aqui — o processo foi concluído.'
        : 'Nada pra fazer da sua parte agora. Assim que houver uma próxima etapa, ela aparece aqui.'}
    </div>
  )
}

function FormConfirmarDados({ proposta, onAtualizar }) {
  const [form, setForm] = useState({ nome: '', tel: '', tipo_pessoa: 'Física', tem_conjuge: false })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await confirmarDadosLocatario({ proposta_id: proposta.id, ...form })
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Complete seus dados pra seguir com a proposta</div>
      {erro && <div className="login-error">{erro}</div>}
      <div className="field">
        <label htmlFor="pf-nome">Nome completo</label>
        <input id="pf-nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="pf-tel">Telefone</label>
        <input id="pf-tel" required value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} placeholder="(19) 99999-9999" />
      </div>
      <div className="field">
        <label htmlFor="pf-tipo">Tipo de pessoa</label>
        <select id="pf-tipo" value={form.tipo_pessoa} onChange={(e) => setForm({ ...form, tipo_pessoa: e.target.value })}>
          <option value="Física">Física</option>
          <option value="Jurídica">Jurídica</option>
        </select>
      </div>
      {form.tipo_pessoa === 'Física' && (
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            id="pf-conjuge"
            type="checkbox"
            checked={form.tem_conjuge}
            onChange={(e) => setForm({ ...form, tem_conjuge: e.target.checked })}
            style={{ width: 'auto' }}
          />
          <label htmlFor="pf-conjuge" style={{ textTransform: 'none', letterSpacing: 0 }}>Tenho cônjuge (vai precisar dos documentos dele também)</label>
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
        {salvando ? 'Enviando…' : 'Confirmar e continuar'}
      </button>
    </form>
  )
}

function AprovarProprietario({ proposta, onAtualizar }) {
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleAprovar() {
    setErro('')
    setProcessando(true)
    try {
      await proprietarioAceitou(proposta.id)
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Aprovação da proposta</div>
      <div>Um novo locatário fez uma proposta pro seu imóvel. Aprovando, o processo segue pra etapa de documentação.</div>
      {erro && <div className="login-error">{erro}</div>}
      <button type="button" className="btn btn-primary btn-sm" disabled={processando} onClick={handleAprovar}>
        {processando ? 'Aprovando…' : 'Aprovar proposta'}
      </button>
    </div>
  )
}

function ChecklistDocumentos({ proposta, onAtualizar }) {
  const { checklist, carregando, recarregar } = useDocumentosEsteira(proposta)
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

  return (
    <div>
      <div className="page-eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Documentos necessários</div>
      {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}
      <div className="avisos-list">
        {checklist.map((doc) => (
          <div className="avisos-item" key={doc.codigo}>
            <div className="avisos-item-body">
              <span className="avisos-item-title">{doc.nome}</span>
              <div className="avisos-item-sub">
                {DOC_STATUS_LABEL[doc.envio?.status ?? 'pendente']}
                {doc.envio?.status === 'rejeitado' && doc.envio?.feedback_adm ? ` · ${doc.envio.feedback_adm}` : ''}
              </div>
            </div>
            {doc.envio?.status !== 'aprovado' && (
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
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
