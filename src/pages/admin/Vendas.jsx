import { useState } from 'react'
import { usePropostasVenda } from '../../hooks/usePropostasVenda'
import { criarPropostaVenda, descartarPropostaVenda } from '../../lib/vendas'
import { formatarPrazo, valorBR } from '../../lib/esteiraLabels'
import ReasonModal from '../../components/esteira/ReasonModal'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import VendaDetalheModal from '../../components/venda/VendaDetalheModal'
import { usePerfil } from '../../hooks/usePerfil'
import { pode } from '../../lib/acessos'
import { supabase } from '../../lib/supabaseClient'
import SubnavPropostas from '../../components/layout/SubnavPropostas'

const vazio = { nome_cliente: '', email: '', codigo_imovel: '', valor: '', imovel_titulo: '', imovel_endereco: '' }

const LABEL = {
  aguardando_cliente: 'Aguardando proponente',
  confirmada: 'Assinada',
  descartada: 'Descartada',
  expirada: 'Prazo expirado',
}

/** Mesmo cálculo da view propostas_venda_ativas (Processos lê a tabela direto). */
function statusEfetivo(p) {
  if (p.status_efetivo) return p.status_efetivo
  if (p.status === 'aguardando_cliente' && new Date(p.link_expira_em) < new Date()) return 'expirada'
  return p.status
}

/**
 * Propostas de VENDA (compra), área separada da locação.
 * modo="propostas": em andamento (aguardando assinatura) + criar nova.
 * modo="processos": histórico completo (assinadas, descartadas, expiradas) com o PDF.
 */
export default function Vendas({ modo = 'propostas' }) {
  const emProcessos = modo === 'processos'
  const { propostas: todas, carregando, erro, recarregar } = usePropostasVenda(!emProcessos)
  const propostas = emProcessos ? todas : todas.filter((p) => p.status === 'aguardando_cliente')
  const { perfil } = usePerfil()
  const podeDescartar = pode(perfil, 'vendasDecidir')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [detalhando, setDetalhando] = useState(null)
  const [descartando, setDescartando] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErroForm('')
    setSalvando(true)
    try {
      await criarPropostaVenda({
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

  function abrirDetalhe(p) {
    setDetalhando(p)
    setErroAcao('')
  }

  // URL assinada gerada na hora do clique (vale 60 s), já como download com nome.
  async function baixarPdf(p) {
    setErroAcao('')
    const { data, error } = await supabase.storage
      .from('propostas-venda')
      .createSignedUrl(p.documento_path, 60, { download: `proposta-compra-${p.codigo_imovel}-${p.id.slice(0, 8)}.pdf` })
    if (error || !data?.signedUrl) return setErroAcao('Não foi possível baixar o PDF. Tente de novo.')
    window.location.assign(data.signedUrl)
  }

  async function handleDescartar(motivo) {
    setErroAcao('')
    setProcessando(true)
    try {
      await descartarPropostaVenda({ proposta_id: descartando.id, motivo })
      setDescartando(null)
      setDetalhando(null)
      await recarregar()
    } catch (err) {
      setErroAcao(err.message)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div>
      <SubnavPropostas area="venda" />
      <header className="page-header">
        <div>
          <div className="page-title">{emProcessos ? 'Processos de venda' : 'Propostas de venda'}</div>
          <div className="page-sub">
            {emProcessos
              ? 'Todas as propostas de compra, do envio à assinatura. Abra uma assinada para baixar o PDF.'
              : 'Crie propostas de compra e acompanhe até o proponente assinar. Assinadas vão para Processos.'}
          </div>
        </div>
        {!emProcessos && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Nova proposta'}
          </button>
        )}
      </header>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {erroForm && <div className="login-error">{erroForm}</div>}
          <div className="field">
            <label htmlFor="pv-nome">Nome do cliente (proponente)</label>
            <input id="pv-nome" required value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pv-email">E-mail do cliente (proponente)</label>
            <input id="pv-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pv-imovel">Código do imóvel</label>
              <input id="pv-imovel" type="number" required value={form.codigo_imovel} onChange={(e) => setForm({ ...form, codigo_imovel: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pv-valor">Valor de referência (R$)</label>
              <CurrencyInput id="pv-valor" required value={form.valor} onChange={(valor) => setForm({ ...form, valor })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pv-titulo">Título do imóvel (opcional)</label>
            <input id="pv-titulo" value={form.imovel_titulo} onChange={(e) => setForm({ ...form, imovel_titulo: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pv-endereco">Endereço (opcional)</label>
            <input id="pv-endereco" value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar proposta'}
          </button>
        </form>
      )}

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as propostas: {erro}</div>}
      {erroAcao && !detalhando && !descartando && <div className="hub-error">{erroAcao}</div>}

      {!carregando && !erro && propostas.length === 0 && (
        <div className="empty">
          <div className="empty-title">{emProcessos ? 'Nenhum processo de venda' : 'Nenhuma proposta aguardando assinatura'}</div>
          <div className="empty-sub">
            {emProcessos ? 'Toda proposta de venda criada aparece aqui, até a assinatura.' : 'Propostas criadas aparecem aqui até serem assinadas.'}
          </div>
        </div>
      )}

      {propostas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Proponente</th>
                <th>Imóvel</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Prazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => {
                const efetivo = statusEfetivo(p)
                const prazo = efetivo === 'aguardando_cliente' ? formatarPrazo(p.link_expira_em, efetivo) : null
                return (
                  <tr key={p.id}>
                    <td>{p.nome_cliente || p.email}</td>
                    <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                    <td>{valorBR(p.valor_proposta ?? p.valor_referencia)}</td>
                    <td>{LABEL[efetivo] ?? efetivo}</td>
                    <td>{prazo ? prazo.texto : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirDetalhe(p)}>
                        Visualizar
                      </button>
                      {p.documento_path && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => baixarPdf(p)}>
                          PDF
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

      {detalhando && (
        <VendaDetalheModal
          proposta={detalhando}
          onBaixarPdf={baixarPdf}
          erro={erroAcao}
          processando={processando}
          podeDescartar={podeDescartar}
          onClose={() => { setDetalhando(null); setErroAcao('') }}
          onDescartar={() => setDescartando(detalhando)}
        />
      )}

      {descartando && (
        <ReasonModal
          title="Descartar proposta de venda?"
          description={`${descartando.nome_cliente || descartando.email} — ação definitiva, sem notificar o proponente.`}
          confirmLabel="Descartar"
          processando={processando}
          erro={erroAcao}
          onConfirm={handleDescartar}
          onCancel={() => { setDescartando(null); setErroAcao('') }}
        />
      )}
    </div>
  )
}
