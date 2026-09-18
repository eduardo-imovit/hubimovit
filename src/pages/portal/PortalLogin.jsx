import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'

export default function PortalLogin() {
  const { session, carregando } = useSession()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  if (!carregando && session) {
    return <Navigate to="/portal" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/portal` },
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar o link. Tente novamente.')
      return
    }
    setEnviado(true)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">imovit</div>
        <div className="login-tagline">Acompanhe sua locação</div>

        {enviado ? (
          <div className="stat-sub is-muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>
            Enviamos um link de acesso pra <strong>{email}</strong>. Confira sua caixa de entrada
            (e o spam) e clique nele pra entrar.
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {erro && <div className="login-error">{erro}</div>}
            <div className="field">
              <label htmlFor="portal-email">E-mail</label>
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link de acesso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
