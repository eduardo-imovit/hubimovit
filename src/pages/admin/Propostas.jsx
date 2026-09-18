import { useState } from 'react'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { criarProposta, decidirAprovacaoInterna } from '../../lib/esteira'

const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando locatário',
  aguardando_aprovacao_interna: 'Em revisão interna',
  criada: 'Aguardando proprietário',
  aguardando_docs: 'Aprovada — aguardando docs',
  docs_em_analise: 'Aprovada — docs em análise',
  docs_aprovados: 'Aprovada — docs aprovados',
  sincronizada: 'Sincronizada',
  rejeitada: 'Rejeitada',
  expirada: 'Expirada',
}

const vazio = { email: '', codigo_imovel: '', proprietario_nome: '', proprietario_email: '', imovel_titulo: '', imovel_endereco: '' }

export default function Propostas() {
  const { propostas, carregando, erro, recarregar } = usePropostasLocacao()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

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

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Admin</div>
          <div className="page-title">Propostas</div>
          <div className="page-sub">Crie novas propostas de locação e acompanhe a aprovação do proprietário.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nova proposta'}
        </button>
      </header>

      <RevisaoInterna propostas={propostas} onAtualizar={recarregar} />

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="pp-email">E-mail do locatário</label>
            <input id="pp-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pp-imovel">Código do imóvel</label>
            <input id="pp-imovel" type="number" required value={form.codigo_imovel} onChange={(e) => setForm({ ...form, codigo_imovel: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pp-prop-nome">Nome do proprietário</label>
              <input id="pp-prop-nome" required value={form.proprietario_nome} onChange={(e) => setForm({ ...form, proprietario_nome: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pp-prop-email">E-mail do proprietário</label>
              <input id="pp-prop-email" type="email" required value={form.proprietario_email} onChange={(e) => setForm({ ...form, proprietario_email: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pp-titulo">Título do imóvel (opcional)</label>
            <input id="pp-titulo" value={form.imovel_titulo} onChange={(e) => setForm({ ...form, imovel_titulo: e.target.value })} placeholder="Apto 2 quartos, Jardim das Palmeiras" />
          </div>
          <div className="field">
            <label htmlFor="pp-endereco">Endereço (opcional)</label>
            <input id="pp-endereco" value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} />
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
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Proprietário</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                  <td>{p.proprietario_nome || '—'}</td>
                  <td>{STATUS_LABEL[p.status_efetivo] ?? p.status_efetivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RevisaoInterna({ propostas, onAtualizar }) {
  const pendentes = propostas.filter((p) => p.status_efetivo === 'aguardando_aprovacao_interna')
  const [processandoId, setProcessandoId] = useState(null)
  const [erro, setErro] = useState('')

  if (pendentes.length === 0) return null

  async function handleDecisao(proposta, decisao) {
    setErro('')
    let motivo
    if (decisao === 'rejeitado') {
      motivo = window.prompt('Motivo (o locatário vai ver esse texto pra corrigir e reenviar):')
      if (!motivo) return
    }
    setProcessandoId(proposta.id)
    try {
      await decidirAprovacaoInterna({ proposta_id: proposta.id, decisao, motivo })
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  return (
    <div className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Aguardando revisão interna ({pendentes.length})</div>
      {erro && <div className="login-error">{erro}</div>}
      <div className="avisos-list">
        {pendentes.map((p) => (
          <div className="avisos-item" key={p.id}>
            <div className="avisos-item-body">
              <span className="avisos-item-title">{p.nome_cliente || p.email}</span>
              <div className="avisos-item-sub">
                {p.imovel_titulo || `Imóvel ${p.codigo_imovel}`} · proprietário: {p.proprietario_nome || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={processandoId === p.id}
                onClick={() => handleDecisao(p, 'aprovado')}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={processandoId === p.id}
                onClick={() => handleDecisao(p, 'rejeitado')}
              >
                Pedir correção
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
