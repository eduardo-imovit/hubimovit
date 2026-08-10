import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível redefinir a senha. Peça um novo link de recuperação.')
      return
    }
    setSucesso(true)
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">imovit</div>
        <div className="login-tagline">Redefinir senha</div>

        {sucesso ? (
          <div className="stat-sub is-muted">Senha redefinida. Redirecionando…</div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {erro && <div className="login-error">{erro}</div>}

            <div className="field">
              <label htmlFor="nova-senha">Nova senha</label>
              <input
                id="nova-senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mínimo 6 caracteres"
              />
            </div>

            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
