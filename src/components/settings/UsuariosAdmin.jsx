import { useCallback, useEffect, useState } from 'react'
import { usePerfis } from '../../hooks/usePerfis'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabaseClient'
import { PAPEL_LABEL, PAPEIS_ATRIBUIVEIS } from '../../lib/acessos'
import ReasonModal from '../esteira/ReasonModal'

/** Pedidos de troca de nível feitos na página de Perfil, esperando a Gestão. */
function SolicitacoesPendentes({ perfis, onDecidido }) {
  const [pendentes, setPendentes] = useState([])
  const [processandoId, setProcessandoId] = useState(null)
  const [recusando, setRecusando] = useState(null)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('solicitacoes_acesso')
      .select('*')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
    if (!error) setPendentes(data ?? [])
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  async function decidir(solicitacao, aprovar, resposta) {
    setErro('')
    setProcessandoId(solicitacao.id)
    const { error } = await supabase.rpc('decidir_solicitacao_acesso', {
      p_solicitacao_id: solicitacao.id,
      p_aprovar: aprovar,
      p_resposta: resposta || null,
    })
    setProcessandoId(null)
    if (error) {
      setErro(`Não foi possível registrar a decisão: ${error.message}`)
      return
    }
    setRecusando(null)
    await Promise.all([recarregar(), onDecidido()])
  }

  if (pendentes.length === 0) return null

  const perfilPorId = Object.fromEntries(perfis.map((p) => [p.id, p]))

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <div className="page-eyebrow">Pedidos de nível pendentes ({pendentes.length})</div>
      {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}
      <div className="upload-list">
        {pendentes.map((s) => {
          const quem = perfilPorId[s.perfil_id]
          return (
            <div className="upload-item" key={s.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="upload-item-name">{quem?.nome || quem?.email || 'Usuário'}</div>
                <div className="timeline-sub">
                  {PAPEL_LABEL[s.role_atual] ?? s.role_atual} → <strong>{PAPEL_LABEL[s.role_solicitado]}</strong>
                  {s.motivo ? ` · “${s.motivo}”` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={processandoId === s.id} onClick={() => decidir(s, true)}>
                  {processandoId === s.id ? 'Salvando…' : 'Aprovar'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={processandoId === s.id} onClick={() => setRecusando(s)}>
                  Recusar
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {recusando && (
        <ReasonModal
          title="Recusar pedido de nível"
          description="A pessoa vê essa resposta na página de Perfil."
          confirmLabel="Recusar"
          obrigatorio={false}
          processando={processandoId === recusando.id}
          onConfirm={(motivo) => decidir(recusando, false, motivo)}
          onCancel={() => setRecusando(null)}
        />
      )}
    </section>
  )
}

export default function UsuariosAdmin() {
  const { perfis, carregando, erro, atualizarRole, recarregar } = usePerfis()
  const { session } = useSession()
  const [enviandoResetPara, setEnviandoResetPara] = useState(null)
  const [mensagem, setMensagem] = useState('')

  async function handleResetarSenha(email) {
    setMensagem('')
    setEnviandoResetPara(email)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      setMensagem(error ? `Não foi possível enviar o link para ${email}.` : `Link de redefinição enviado para ${email}.`)
    } finally {
      setEnviandoResetPara(null)
    }
  }

  return (
    <div>
      {mensagem && <div className="stat-sub is-muted" style={{ marginBottom: 'var(--space-3)' }}>{mensagem}</div>}
      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os usuários: {erro}</div>}

      {!carregando && !erro && <SolicitacoesPendentes perfis={perfis} onDecidido={recarregar} />}

      {!carregando && !erro && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 'var(--weight-medium)' }}>{p.nome || p.email}</div>
                    {(p.nome || p.cargo) && (
                      <div className="timeline-sub" style={{ marginTop: 0 }}>{[p.cargo, p.nome ? p.email : null].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td>
                    <select
                      value={p.role}
                      onChange={(e) => atualizarRole(p.id, e.target.value)}
                      disabled={p.id === session?.user?.id}
                      title={p.id === session?.user?.id ? 'Você não pode alterar seu próprio acesso' : undefined}
                    >
                      {PAPEIS_ATRIBUIVEIS.map((valor) => (
                        <option key={valor} value={valor}>{PAPEL_LABEL[valor]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={enviandoResetPara === p.email}
                      onClick={() => handleResetarSenha(p.email)}
                    >
                      {enviandoResetPara === p.email ? 'Enviando…' : 'Resetar senha'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
