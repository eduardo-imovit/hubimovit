import { useState } from 'react'
import { usePropostasLocacao } from '../hooks/usePropostasLocacao'
import { useHistoricoProposta } from '../hooks/useHistoricoProposta'
import { useDocumentosEsteira } from '../hooks/useDocumentosEsteira'
import { supabase } from '../lib/supabaseClient'
import { criarProposta, decidirDocumento, marcarSincronizada } from '../lib/esteira'

const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando locatário',
  criada: 'Aguardando proprietário',
  aguardando_docs: 'Aguardando documentos',
  docs_em_analise: 'Docs em análise',
  docs_aprovados: 'Docs aprovados',
  sincronizada: 'Sincronizada',
  rejeitada: 'Rejeitada',
  expirada: 'Expirada',
}

const vazio = { email: '', codigo_imovel: '', proprietario_nome: '', proprietario_email: '', imovel_titulo: '', imovel_endereco: '' }

export default function Esteira() {
  const { propostas, carregando, erro, recarregar } = usePropostasLocacao()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [propostaSelecionadaId, setPropostaSelecionadaId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setErroForm('')
    setSalvando(true)
    try {
      await criarProposta({
        email: form.email,
        codigo_imovel: Number(form.codigo_imovel),
        proprietario_nome: form.proprietario_nome,
        proprietario_email: form.proprietario_email,
        imovel_titulo: form.imovel_titulo || undefined,
        imovel_endereco: form.imovel_endereco || undefined,
      })
      setForm(vazio)
      setMostrarForm(false)
      await recarregar()
    } catch (err) {
      setErroForm(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const propostaSelecionada = propostas.find((p) => p.id === propostaSelecionadaId) ?? null

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Comercial</div>
          <div className="page-title">Esteira de Locação</div>
          <div className="page-sub">Acompanhe propostas em andamento, do primeiro contato até a sincronização com o CRM.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nova proposta'}
        </button>
      </header>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="ep-email">E-mail do locatário</label>
            <input id="ep-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ep-imovel">Código do imóvel</label>
            <input id="ep-imovel" type="number" required value={form.codigo_imovel} onChange={(e) => setForm({ ...form, codigo_imovel: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="ep-prop-nome">Nome do proprietário</label>
              <input id="ep-prop-nome" required value={form.proprietario_nome} onChange={(e) => setForm({ ...form, proprietario_nome: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="ep-prop-email">E-mail do proprietário</label>
              <input id="ep-prop-email" type="email" required value={form.proprietario_email} onChange={(e) => setForm({ ...form, proprietario_email: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ep-titulo">Título do imóvel (opcional)</label>
            <input id="ep-titulo" value={form.imovel_titulo} onChange={(e) => setForm({ ...form, imovel_titulo: e.target.value })} placeholder="Apto 2 quartos, Jardim das Palmeiras" />
          </div>
          <div className="field">
            <label htmlFor="ep-endereco">Endereço (opcional)</label>
            <input id="ep-endereco" value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar proposta'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as propostas: {erro}</div>}

      {!carregando && !erro && propostas.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhuma proposta ativa</div>
          <div className="empty-sub">Propostas criadas aparecem aqui até serem sincronizadas.</div>
        </div>
      )}

      {propostas.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 'var(--space-5)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Proprietário</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className={p.id === propostaSelecionadaId ? 'is-active' : ''}>
                  <td>{p.email}</td>
                  <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                  <td>{p.proprietario_nome || '—'}</td>
                  <td>{STATUS_LABEL[p.status_efetivo] ?? p.status_efetivo}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPropostaSelecionadaId(p.id)}>
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {propostaSelecionada && <DetalheProposta proposta={propostaSelecionada} onAtualizar={recarregar} />}
    </div>
  )
}

async function abrirArquivo(path) {
  const { data, error } = await supabase.storage.from('esteira-documentos').createSignedUrl(path, 300)
  if (error || !data) return
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

function DetalheProposta({ proposta, onAtualizar }) {
  const { checklist, carregando, recarregar } = useDocumentosEsteira(proposta)
  const { historico } = useHistoricoProposta(proposta.id)
  const [processandoId, setProcessandoId] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleDecisao(documentoId, decisao) {
    setErro('')
    setProcessandoId(documentoId)
    try {
      const feedback = decisao === 'rejeitado' ? window.prompt('Motivo da rejeição (opcional):') ?? undefined : undefined
      await decidirDocumento({ documento_id: documentoId, decisao, feedback })
      await Promise.all([recarregar(), onAtualizar()])
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  async function handleSincronizar() {
    setErro('')
    setSincronizando(true)
    try {
      await marcarSincronizada(proposta.id)
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <div className="page-eyebrow">{proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}</div>
        <div className="avisos-item-sub">
          Locatário: {proposta.nome_cliente || proposta.email} · Proprietário: {proposta.proprietario_nome} ({proposta.proprietario_email})
        </div>
      </div>

      {erro && <div className="login-error">{erro}</div>}

      {!carregando && checklist.length > 0 && (
        <div>
          <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Documentos</div>
          <div className="avisos-list">
            {checklist.map((doc) => (
              <div className="avisos-item" key={doc.codigo}>
                <div className="avisos-item-body">
                  <span className="avisos-item-title">{doc.nome}</span>
                  <div className="avisos-item-sub">
                    {doc.envio?.status ?? 'pendente'}
                    {doc.envio?.status === 'rejeitado' && doc.envio?.feedback_adm ? ` · ${doc.envio.feedback_adm}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  {doc.envio?.arquivo_path && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirArquivo(doc.envio.arquivo_path)}>
                      Ver arquivo
                    </button>
                  )}
                  {doc.envio?.status === 'enviado' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={processandoId === doc.envio.id}
                        onClick={() => handleDecisao(doc.envio.id, 'aprovado')}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={processandoId === doc.envio.id}
                        onClick={() => handleDecisao(doc.envio.id, 'rejeitado')}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposta.status === 'docs_aprovados' && (
        <button type="button" className="btn btn-primary btn-sm" disabled={sincronizando} onClick={handleSincronizar}>
          {sincronizando ? 'Marcando…' : 'Marcar como sincronizada (depois de lançar no Imoview)'}
        </button>
      )}

      {historico.length > 0 && (
        <div>
          <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Linha do tempo</div>
          <div className="avisos-list">
            {historico.map((h) => (
              <div className="avisos-item" key={h.id}>
                <div className="avisos-item-body">
                  <span className="avisos-item-title">{STATUS_LABEL[h.status_novo] ?? h.status_novo}</span>
                  <div className="avisos-item-sub">
                    {new Date(h.timestamp_registro).toLocaleString('pt-BR')} · {h.ator}
                    {h.motivo ? ` · ${h.motivo}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
