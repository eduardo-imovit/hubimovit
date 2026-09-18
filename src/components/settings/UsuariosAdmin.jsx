import { useState } from 'react'
import { usePerfis } from '../../hooks/usePerfis'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabaseClient'

const ROLE_LABEL = { gestao: 'Gestão', adm: 'Adm', user: 'Usuário', tvaccess: 'Acesso TV' }

export default function UsuariosAdmin() {
  const { perfis, carregando, erro, atualizarRole } = usePerfis()
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

      {!carregando && !erro && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td>
                    <select
                      value={p.role}
                      onChange={(e) => atualizarRole(p.id, e.target.value)}
                      disabled={p.id === session?.user?.id}
                      title={p.id === session?.user?.id ? 'Você não pode alterar seu próprio acesso' : undefined}
                    >
                      {Object.entries(ROLE_LABEL).map(([valor, label]) => (
                        <option key={valor} value={valor}>{label}</option>
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
