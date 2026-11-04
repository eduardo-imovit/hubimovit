import { useCallback, useEffect, useState } from 'react'
import ModalPortal from '../esteira/ModalPortal'
import SecaoBancaria from '../onboarding/SecaoBancaria'
import { fmtDataHora } from '../../lib/distrato'
import {
  bancarioParaForm, editarBancarios, equipeLabel, excluirBancarios, listarDadosBancarios, prepararBancario,
  tipoContaLabel, tipoPixLabel,
} from '../../lib/onboarding'

function copiar(texto, avisar) {
  navigator.clipboard.writeText(texto).then(() => avisar?.())
}

function Modal({ titulo, onClose, travado, children, rodape }) {
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !travado && onClose()}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{titulo}</div>
            <button type="button" className="modal-close" disabled={travado} onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>{children}</div>
          <div className="modal-footer">{rodape}</div>
        </div>
      </div>
    </ModalPortal>
  )
}

/** Editar conta/PIX (Gestão/ADM). A função confere as regras e grava quem editou. */
function Editar({ d, onClose, onSalvo }) {
  const [b, setB] = useState(() => bancarioParaForm(d))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const { erro: msg, dados } = prepararBancario(b, null)
    if (msg) return setErro(msg)
    if (!dados) return setErro('Deixe pelo menos a conta ou o PIX. Para tirar tudo, use Excluir.')
    setErro('')
    setSalvando(true)
    try {
      await editarBancarios(d.onboarding_id, dados)
      onSalvo(`Dados bancários de ${d.nome_completo} atualizados.`)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Editar · ${d.nome_completo}`} onClose={onClose} travado={salvando}
      rodape={<>
        <button type="button" className="btn btn-ghost btn-sm" disabled={salvando} onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <SecaoBancaria b={b} setB={setB} modo="interno" />
      {erro && <div className="login-error">{erro}</div>}
    </Modal>
  )
}

function Excluir({ d, onClose, onExcluido }) {
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  async function excluir() {
    setExcluindo(true)
    try {
      await excluirBancarios(d.onboarding_id)
      onExcluido(`Dados bancários de ${d.nome_completo} excluídos.`)
    } catch (e) {
      setErro(e.message)
      setExcluindo(false)
    }
  }

  return (
    <Modal titulo={`Excluir os dados bancários de ${d.nome_completo}?`} onClose={onClose} travado={excluindo}
      rodape={<>
        <button type="button" className="btn btn-ghost btn-sm" disabled={excluindo} onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={excluindo} onClick={excluir}>{excluindo ? 'Excluindo…' : 'Excluir definitivamente'}</button>
      </>}>
      <p style={{ margin: 0 }}>Apaga a conta e o PIX. O cadastro do colaborador (onboarding e checklist) continua.</p>
      <p style={{ margin: 0 }}><strong>Não tem como desfazer.</strong> Para corrigir um dado, prefira <strong>Editar</strong>.</p>
      {erro && <div className="login-error">{erro}</div>}
    </Modal>
  )
}

/**
 * Configurações ▸ Usuários ▸ Dados bancários (PRD §5.18b): Gestão e ADM
 * (Financeiro) veem, editam e excluem. Lê pela RPC dados_bancarios_colaboradores,
 * que confere o papel e devolve só nome, equipe e o bancário (sem CPF e sem
 * endereço). A escrita passa pela função `onboarding`.
 */
export default function DadosBancariosLista() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const recarregar = useCallback(() => {
    listarDadosBancarios().then(setLista).catch((e) => setErro(e.message))
  }, [])
  useEffect(() => { recarregar() }, [recarregar])

  const concluir = (texto) => {
    setEditando(null)
    setExcluindo(null)
    setMsg(texto)
    recarregar()
  }
  const copiado = (o) => setMsg(`${o} copiado.`)

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <div className="page-eyebrow">Dados bancários</div>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Enviados pelo colaborador no link de onboarding. A conta é sempre no nome dele. Quem entrou antes de 04/11 não aparece aqui.
      </p>
      {erro && <div className="hub-error">Não foi possível carregar os dados bancários: {erro}</div>}
      {!lista && !erro && <div className="hub-loading">Carregando…</div>}
      {lista && lista.length === 0 && <div className="stat-sub is-muted">Nenhum colaborador enviou dados bancários ainda.</div>}
      {msg && <div className="field-hint" style={{ marginBottom: 'var(--space-2)' }}>{msg}</div>}
      {lista && lista.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Conta</th>
                <th>PIX</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const conta = d.banco ? `${d.banco} · ag. ${d.agencia} · conta ${d.conta}` : null
                return (
                  <tr key={d.onboarding_id}>
                    <td>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{d.nome_completo || '—'}</div>
                      <div className="timeline-sub" style={{ marginTop: 0 }}>{[equipeLabel(d.equipe), d.email_imovit].filter(Boolean).join(' · ')}</div>
                      {d.atualizado_em && (
                        <div className="timeline-sub" style={{ marginTop: 0 }}>Editado por {d.atualizado_por_nome ?? '—'} em {fmtDataHora(d.atualizado_em)}</div>
                      )}
                    </td>
                    <td>
                      {conta ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span>{conta} <span className="muted">({tipoContaLabel(d.tipo_conta)})</span></span>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => copiar(conta, () => copiado('Conta'))}>Copiar</button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {d.pix_tipo ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span><span className="muted">{tipoPixLabel(d.pix_tipo)}:</span> {d.pix_chave}</span>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => copiar(d.pix_chave, () => copiado('PIX'))}>Copiar</button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMsg(''); setEditando(d) }}>Editar</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => { setMsg(''); setExcluindo(d) }}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editando && <Editar d={editando} onClose={() => setEditando(null)} onSalvo={concluir} />}
      {excluindo && <Excluir d={excluindo} onClose={() => setExcluindo(null)} onExcluido={concluir} />}
    </section>
  )
}
