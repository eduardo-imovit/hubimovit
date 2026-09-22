import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'

export default function PortalLogin() {
  const { session, carregando } = useSession()
  const [modo, setModo] = useState('link') // 'link' | 'senha'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  if (!carregando && session) {
    return <Navigate to="/portal" replace />
  }

  async function handleSubmitLink(e) {
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

  async function handleSubmitSenha(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) {
      setErro('E-mail ou senha incorretos.')
    }
  }

  function trocarModo(novoModo) {
    setModo(novoModo)
    setErro('')
    setEnviado(false)
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
        ) : modo === 'link' ? (
          <form className="login-form" onSubmit={handleSubmitLink}>
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
            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)', alignSelf: 'center' }} onClick={() => trocarModo('senha')}>
              Já tenho senha — entrar direto
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleSubmitSenha}>
            {erro && <div className="login-error">{erro}</div>}
            <div className="field">
              <label htmlFor="portal-email-senha">E-mail</label>
              <input
                id="portal-email-senha"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="field">
              <label htmlFor="portal-senha">Senha</label>
              <input
                id="portal-senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)', alignSelf: 'center' }} onClick={() => trocarModo('link')}>
              Prefiro usar o link por e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
