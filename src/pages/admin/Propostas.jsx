import { useState } from 'react'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { criarProposta, descartarProposta, editarProposta } from '../../lib/esteira'
import { formatarPrazo, valorBR } from '../../lib/esteiraLabels'
import { StatusBadge } from '../../components/esteira/StatusBadge'
import ReasonModal from '../../components/esteira/ReasonModal'
import PropostaDetalheModal from '../../components/esteira/PropostaDetalheModal'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import { usePerfil } from '../../hooks/usePerfil'
import { pode } from '../../lib/acessos'

const vazio = {
  nome_cliente: '', email: '', tel: '', codigo_imovel: '', valor: '', valor_oferta: '',
  observacoes: '', imovel_titulo: '', imovel_endereco: '',
}

// Antes da validação do locatário a proposta ainda pode ser corrigida e reenviada.
const EDITAVEIS = ['aguardando_locatario', 'correcao_solicitada']

/**
 * Propostas de locação (esteira v4, PRD §5.6): o locatário negocia antes; aqui o
 * gestor registra a proposta com os termos e o sistema envia para o locatário
 * validar. Se ele pedir correção, a proposta volta para cá com o motivo.
 */
export default function Propostas() {
  const { propostas, carregando, erro, recarregar } = usePropostasLocacao()
  const { perfil } = usePerfil()
  // Corretor cria e acompanha as dele (o banco já filtra); descartar é da Admin/Gestão.
  const podeDescartar = pode(perfil, 'esteiraDecidir')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [descartandoId, setDescartandoId] = useState(null)
  const [propostaDescartando, setPropostaDescartando] = useState(null)
  const [erroDescarte, setErroDescarte] = useState('')
  const [detalhando, setDetalhando] = useState(null)

  const correcoes = propostas.filter((p) => p.status_efetivo === 'correcao_solicitada')

  function abrirNova() {
    setEditando(null)
    setForm(vazio)
    setErroForm('')
    setMostrarForm(true)
  }

  function abrirEdicao(p) {
    setEditando(p)
    setForm({
      nome_cliente: p.nome_cliente ?? '',
      email: p.email,
      tel: p.tel ?? '',
      codigo_imovel: String(p.codigo_imovel),
      valor: p.valor != null ? String(p.valor) : '',
      valor_oferta: p.valor_oferta != null ? String(p.valor_oferta) : '',
      observacoes: p.observacoes ?? '',
      imovel_titulo: p.imovel_titulo ?? '',
      imovel_endereco: p.imovel_endereco ?? '',
    })
    setErroForm('')
    setDetalhando(null)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function fecharForm() {
    setMostrarForm(false)
    setEditando(null)
    setForm(vazio)
  }

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
    const termos = {
      nome_cliente: form.nome_cliente,
      tel: form.tel,
      valor: Number(form.valor),
      valor_oferta: Number(form.valor_oferta),
      observacoes: form.observacoes.trim() || undefined,
      imovel_titulo: form.imovel_titulo || undefined,
      imovel_endereco: form.imovel_endereco || undefined,
    }
    try {
      if (editando) {
        await editarProposta({ proposta_id: editando.id, ...termos })
      } else {
        await criarProposta({ ...termos, email: form.email, codigo_imovel: Number(form.codigo_imovel) })
      }
      fecharForm()
      await recarregar()
    } catch (err) {
      setErroForm(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <SubnavPropostas area="locacao" />
      <header className="page-header">
        <div>
          <div className="page-title">Propostas de locação</div>
          <div className="page-sub">
            Registre a proposta já negociada entre as partes. O locatário recebe por e-mail, valida e entra na esteira de documentos.
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={mostrarForm ? fecharForm : abrirNova}>
          {mostrarForm ? 'Cancelar' : '+ Nova proposta'}
        </button>
      </header>

      {correcoes.length > 0 && !mostrarForm && (
        <div className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">Correções pedidas pelo locatário ({correcoes.length})</div>
          <div className="avisos-list">
            {correcoes.map((p) => (
              <div className="avisos-item" key={p.id}>
                <div className="avisos-item-body">
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{p.nome_cliente || p.email}</div>
                  <div className="avisos-item-sub">{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</div>
                  {p.motivo_correcao && <div className="esteira-atividade-motivo" style={{ whiteSpace: 'pre-line' }}>“{p.motivo_correcao}”</div>}
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirEdicao(p)}>
                  Corrigir e reenviar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">
            {editando ? `Corrigir proposta — ${editando.nome_cliente || editando.email}` : 'Nova proposta (termos já negociados)'}
          </div>
          {editando?.motivo_correcao && (
            <div className="login-error" style={{ whiteSpace: 'pre-line' }}>
              <strong>O locatário pediu:</strong> {editando.motivo_correcao}
            </div>
          )}
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="pp-nome">Nome do locatário</label>
            <input id="pp-nome" required value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="pp-email">E-mail do locatário</label>
              <input id="pp-email" type="email" required disabled={!!editando} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="pp-tel">Telefone do locatário</label>
              <input id="pp-tel" required value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} placeholder="(19) 99999-9999" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="pp-imovel">Código do imóvel</label>
              <input id="pp-imovel" type="number" required disabled={!!editando} value={form.codigo_imovel} onChange={(e) => setForm({ ...form, codigo_imovel: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="pp-valor">Valor do anúncio (R$)</label>
              <CurrencyInput id="pp-valor" required value={form.valor} onChange={(valor) => setForm({ ...form, valor })} />
            </div>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="pp-oferta">Valor negociado (R$)</label>
              <CurrencyInput id="pp-oferta" required value={form.valor_oferta} onChange={(valor_oferta) => setForm({ ...form, valor_oferta })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pp-obs">Observações da proposta</label>
            <textarea
              id="pp-obs"
              rows={4}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Ex.: contrato de 30 meses, condomínio incluso, garantia por seguro-fiança, entrada no dia 10/11, pintura por conta do locador."
            />
            <span className="field-hint">Os termos que as partes combinaram. O locatário vê exatamente este texto para validar.</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="pp-titulo">Título do imóvel (opcional)</label>
              <input id="pp-titulo" value={form.imovel_titulo} onChange={(e) => setForm({ ...form, imovel_titulo: e.target.value })} placeholder="Apto 2 quartos, Jardim das Palmeiras" />
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="pp-endereco">Endereço (opcional)</label>
              <input id="pp-endereco" value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Enviando…' : editando ? 'Salvar e reenviar ao locatário' : 'Criar e enviar ao locatário'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as propostas: {erro}</div>}

      {!carregando && !erro && propostas.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhuma proposta ativa</div>
          <div className="empty-sub">Propostas criadas aparecem aqui até o processo ser concluído.</div>
        </div>
      )}

      {propostas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Valor negociado</th>
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
                    <td>{valorBR(p.valor_oferta ?? p.valor)}</td>
                    <td><StatusBadge status={p.status_efetivo} /></td>
                    <td>{prazo ? <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span> : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalhando(p)}>
                          Visualizar
                        </button>
                        {EDITAVEIS.includes(p.status_efetivo) && (
                          <button type="button" className={`btn btn-sm ${p.status_efetivo === 'correcao_solicitada' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => abrirEdicao(p)}>
                            {p.status_efetivo === 'correcao_solicitada' ? 'Corrigir' : 'Editar'}
                          </button>
                        )}
                        {podeDescartar && !['rejeitada', 'expirada'].includes(p.status_efetivo) && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={descartandoId === p.id}
                            onClick={() => setPropostaDescartando(p)}
                          >
                            {descartandoId === p.id ? 'Descartando…' : 'Descartar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {detalhando && (
        <PropostaDetalheModal
          proposta={detalhando}
          onClose={() => setDetalhando(null)}
          onEditar={EDITAVEIS.includes(detalhando.status_efetivo) ? () => abrirEdicao(detalhando) : undefined}
        />
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
