import { useState } from 'react'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { criarProposta, descartarProposta, editarProposta } from '../../lib/esteira'
import { GARANTIAS, formatarPrazo, valorBR } from '../../lib/esteiraLabels'
import { StatusBadge } from '../../components/esteira/StatusBadge'
import ReasonModal from '../../components/esteira/ReasonModal'
import PropostaDetalheModal from '../../components/esteira/PropostaDetalheModal'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import { usePerfil } from '../../hooks/usePerfil'
import { useCorretores } from '../../hooks/useCorretores'
import { pode } from '../../lib/acessos'

const vazio = {
  nome_cliente: '', email: '', tel: '', codigo_imovel: '', imovel_titulo: '', imovel_endereco: '',
  corretor_responsavel: '', valor: '', valor_oferta: '', garantia: '', data_posse: '', prazo_meses: '30',
  dia_vencimento: '', clausula_rescisao: '', negociacao_especifica: '', observacoes: '', taxa_administracao: '',
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
  const corretores = useCorretores()
  // Só gestão/adm aqui (RF28); o corretor volta depois. Descartar é da Admin/Gestão.
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
    // Sugere como responsável o corretor do CRM com o mesmo e-mail de quem está criando.
    const eu = corretores.find((c) => c.email_oficial?.toLowerCase() === perfil?.email?.toLowerCase())
    setEditando(null)
    setForm({ ...vazio, corretor_responsavel: eu?.nome_completo ?? '' })
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
      corretor_responsavel: p.corretor_responsavel ?? '',
      garantia: p.garantia ?? '',
      data_posse: p.data_posse ?? '',
      prazo_meses: p.prazo_meses != null ? String(p.prazo_meses) : '30',
      dia_vencimento: p.dia_vencimento != null ? String(p.dia_vencimento) : '',
      clausula_rescisao: p.clausula_rescisao ?? '',
      negociacao_especifica: p.negociacao_especifica ?? '',
      taxa_administracao: p.taxa_administracao != null ? String(p.taxa_administracao) : '',
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
    const texto = (v) => v.trim() || undefined
    const termos = {
      nome_cliente: form.nome_cliente,
      tel: form.tel,
      imovel_titulo: form.imovel_titulo || undefined,
      imovel_endereco: form.imovel_endereco || undefined,
      corretor_responsavel: form.corretor_responsavel.trim(),
      valor: Number(form.valor),
      valor_oferta: Number(form.valor_oferta),
      garantia: form.garantia,
      data_posse: form.data_posse,
      prazo_meses: Number(form.prazo_meses),
      dia_vencimento: Number(form.dia_vencimento),
      clausula_rescisao: texto(form.clausula_rescisao),
      negociacao_especifica: texto(form.negociacao_especifica),
      observacoes: texto(form.observacoes),
      taxa_administracao: form.taxa_administracao === '' ? undefined : Number(String(form.taxa_administracao).replace(',', '.')),
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
            <div className="field" style={{ flex: '2 1 220px' }}>
              <label htmlFor="pp-titulo">Título do imóvel (opcional)</label>
              <input id="pp-titulo" value={form.imovel_titulo} onChange={(e) => setForm({ ...form, imovel_titulo: e.target.value })} placeholder="Apto 2 quartos, Jardim das Palmeiras" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pp-endereco">Endereço (opcional)</label>
            <input id="pp-endereco" value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} />
          </div>

          <div className="page-eyebrow" style={{ marginTop: 'var(--space-3)' }}>Condições negociadas</div>
          <div className="field">
            <label htmlFor="pp-corretor">Corretor responsável pela negociação</label>
            <input id="pp-corretor" required list="pp-corretores" value={form.corretor_responsavel} onChange={(e) => setForm({ ...form, corretor_responsavel: e.target.value })} placeholder="Escolha ou digite o nome" />
            <datalist id="pp-corretores">
              {corretores.map((c) => <option key={c.nome_completo} value={c.nome_completo} />)}
            </datalist>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="pp-oferta">Valor da locação (negociado, R$)</label>
              <CurrencyInput id="pp-oferta" required value={form.valor_oferta} onChange={(valor_oferta) => setForm({ ...form, valor_oferta })} />
            </div>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="pp-valor">Valor do anúncio (R$)</label>
              <CurrencyInput id="pp-valor" required value={form.valor} onChange={(valor) => setForm({ ...form, valor })} />
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="pp-garantia">Tipo de garantia</label>
              <select id="pp-garantia" required value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })}>
                <option value="" disabled>Escolha…</option>
                {GARANTIAS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="pp-posse">Data da posse</label>
              <input id="pp-posse" type="date" required value={form.data_posse} onChange={(e) => setForm({ ...form, data_posse: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="pp-prazo">Prazo contratual (meses)</label>
              <input id="pp-prazo" type="number" min="1" max="360" required value={form.prazo_meses} onChange={(e) => setForm({ ...form, prazo_meses: e.target.value })} />
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="pp-vencimento">Vencimento do aluguel (dia)</label>
              <input id="pp-vencimento" type="number" min="1" max="31" required value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} placeholder="10" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pp-rescisao">Cláusula de rescisão (opcional)</label>
            <textarea id="pp-rescisao" rows={2} value={form.clausula_rescisao} onChange={(e) => setForm({ ...form, clausula_rescisao: e.target.value })} placeholder="Ex.: multa de 3 aluguéis, proporcional ao tempo restante; isenta após 12 meses." />
          </div>
          <div className="field">
            <label htmlFor="pp-negociacao">Negociação específica (opcional)</label>
            <textarea id="pp-negociacao" rows={2} value={form.negociacao_especifica} onChange={(e) => setForm({ ...form, negociacao_especifica: e.target.value })} placeholder="Ex.: carência de 1 mês, desconto no primeiro aluguel." />
          </div>
          <div className="field">
            <label htmlFor="pp-obs">Outros combinados e benfeitorias (opcional)</label>
            <textarea id="pp-obs" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Ex.: pintura por conta do locador, troca do box antes da posse." />
            <span className="field-hint">O locatário vê exatamente estas condições para validar.</span>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="pp-taxa">Taxa de administração (%, opcional)</label>
            <input id="pp-taxa" inputMode="decimal" value={form.taxa_administracao} onChange={(e) => setForm({ ...form, taxa_administracao: e.target.value })} placeholder="8" />
            <span className="field-hint">Responsabilidade do proprietário. Não aparece para o locatário.</span>
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
