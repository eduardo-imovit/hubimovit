import { useState } from 'react'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { criarProposta, decidirAprovacaoInterna, descartarProposta } from '../../lib/esteira'
import { formatarPrazo } from '../../lib/esteiraLabels'
import { StatusBadge } from '../../components/esteira/StatusBadge'
import ReasonModal from '../../components/esteira/ReasonModal'
import ModalPortal from '../../components/esteira/ModalPortal'

const vazio = { nome_cliente: '', email: '', codigo_imovel: '', valor: '', imovel_titulo: '', imovel_endereco: '' }

export default function Propostas() {
  const { propostas, carregando, erro, recarregar } = usePropostasLocacao()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [descartandoId, setDescartandoId] = useState(null)
  const [propostaDescartando, setPropostaDescartando] = useState(null)
  const [erroDescarte, setErroDescarte] = useState('')

  async function handleDescartar(motivo) {
    setDescartandoId(propostaDescartando.id)
    setErroDescarte('')
    try {
      await descartarProposta({ proposta_id: propostaDescartando.id, motivo })
      setPropostaDescartando(null)
      await recarregar()
    } catch (err) {
      setErroDescarte(err.message)
    } finally {
      setDescartandoId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErroForm('')
    setSalvando(true)
    try {
      await criarProposta({
        nome_cliente: form.nome_cliente,
        email: form.email,
        codigo_imovel: Number(form.codigo_imovel),
        valor: Number(form.valor),
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
            <label htmlFor="pp-nome">Nome do locatário</label>
            <input id="pp-nome" required value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pp-email">E-mail do locatário</label>
            <input id="pp-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pp-imovel">Código do imóvel</label>
              <input id="pp-imovel" type="number" required value={form.codigo_imovel} onChange={(e) => setForm({ ...form, codigo_imovel: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pp-valor">Valor (R$)</label>
              <input id="pp-valor" type="number" step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
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
                <th>Valor</th>
                <th>Status</th>
                <th>Prazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => {
                const prazo = formatarPrazo(p.link_expira_em, p.status_efetivo)
                return (
                  <tr key={p.id}>
                    <td>{p.nome_cliente || p.email}</td>
                    <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                    <td>{ValorBR(p.valor)}</td>
                    <td><StatusBadge status={p.status_efetivo} /></td>
                    <td>{prazo ? <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span> : '—'}</td>
                    <td>
                      {!['rejeitada', 'expirada'].includes(p.status_efetivo) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={descartandoId === p.id}
                          onClick={() => setPropostaDescartando(p)}
                        >
                          {descartandoId === p.id ? 'Descartando…' : 'Descartar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {propostaDescartando && (
        <ReasonModal
          title="Descartar proposta?"
          description={`${propostaDescartando.nome_cliente || propostaDescartando.email} — essa ação é definitiva e não notifica o locatário.`}
          confirmLabel="Descartar"
          processando={descartandoId === propostaDescartando.id}
          erro={erroDescarte}
          onConfirm={handleDescartar}
          onCancel={() => { setPropostaDescartando(null); setErroDescarte('') }}
        />
      )}
    </div>
  )
}

function ValorBR(v) {
  return v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
}

function RevisaoInterna({ propostas, onAtualizar }) {
  const pendentes = propostas.filter((p) => p.status_efetivo === 'aguardando_aprovacao_interna')
  const [processandoId, setProcessandoId] = useState(null)
  const [rejeitando, setRejeitando] = useState(null)
  const [detalhando, setDetalhando] = useState(null)
  const [erro, setErro] = useState('')

  if (pendentes.length === 0) return null

  async function handleDecisao(proposta, decisao, motivo) {
    setErro('')
    setProcessandoId(proposta.id)
    try {
      await decidirAprovacaoInterna({ proposta_id: proposta.id, decisao, motivo })
      setRejeitando(null)
      setDetalhando(null)
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
      {erro && !rejeitando && !detalhando && <div className="login-error">{erro}</div>}
      <div className="avisos-list">
        {pendentes.map((p) => (
          <div className="avisos-item" key={p.id}>
            <div className="avisos-item-body">
              <button type="button" className="btn-link" style={{ font: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }} onClick={() => setDetalhando(p)}>
                {p.nome_cliente || p.email}
              </button>
              <div className="avisos-item-sub">
                {p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}
                {p.valor_oferta != null ? ` · oferta: ${ValorBR(p.valor_oferta)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalhando(p)}>
                Ver detalhes
              </button>
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
                onClick={() => setRejeitando(p)}
              >
                Pedir correção
              </button>
            </div>
          </div>
        ))}
      </div>

      {detalhando && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => setDetalhando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detalhando.nome_cliente || detalhando.email}</div>
              <button type="button" className="modal-close" onClick={() => setDetalhando(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {erro && <div className="login-error">{erro}</div>}
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Locatário</div>
                <div>{detalhando.nome_cliente || '—'}</div>
                <div style={{ color: 'var(--grafite-soft)' }}>{detalhando.email}{detalhando.tel ? ` · ${detalhando.tel}` : ''}</div>
              </div>
              <div>
                <div className="page-eyebrow" style={{ marginBottom: 2 }}>Imóvel</div>
                <div>{detalhando.imovel_titulo || `Imóvel ${detalhando.codigo_imovel}`}</div>
                {detalhando.imovel_endereco && <div style={{ color: 'var(--grafite-soft)' }}>{detalhando.imovel_endereco}</div>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
                <div>
                  <div className="page-eyebrow" style={{ marginBottom: 2 }}>Valor pedido</div>
                  <div>{ValorBR(detalhando.valor)}</div>
                </div>
                <div>
                  <div className="page-eyebrow" style={{ marginBottom: 2 }}>Oferta do locatário</div>
                  <div>{ValorBR(detalhando.valor_oferta)}</div>
                </div>
              </div>
              {detalhando.observacoes && (
                <div>
                  <div className="page-eyebrow" style={{ marginBottom: 2 }}>Observações do locatário</div>
                  <div>{detalhando.observacoes}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={processandoId === detalhando.id}
                onClick={() => { setRejeitando(detalhando); setDetalhando(null) }}
              >
                Pedir correção
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={processandoId === detalhando.id}
                onClick={() => handleDecisao(detalhando, 'aprovado')}
              >
                {processandoId === detalhando.id ? 'Aprovando…' : 'Aprovar'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {rejeitando && (
        <ReasonModal
          title="Pedir correção"
          description="O locatário vai ver esse motivo pra corrigir e reenviar."
          confirmLabel="Pedir correção"
          processando={processandoId === rejeitando.id}
          erro={erro}
          onConfirm={(motivo) => handleDecisao(rejeitando, 'rejeitado', motivo)}
          onCancel={() => { setRejeitando(null); setErro('') }}
        />
      )}
    </div>
  )
}
