import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../hooks/useSession'

const DOMINIO_PERMITIDO = /@imovit\.com\.br$/i

export default function Login() {
  const { session, carregando } = useSession()
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!carregando && session) {
    return <Navigate to="/" replace />
  }

  function trocarModo(novoModo) {
    setModo(novoModo)
    setErro('')
    setAviso('')
  }

  async function handleEntrar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) {
      // Suspenso pela Gestão: o Auth bloqueia o login (ver gestao-colaboradores).
      const suspenso = error.code === 'user_banned' || /banned/i.test(error.message)
      setErro(suspenso ? 'Seu acesso ao Hub está suspenso. Fale com a Gestão.' : 'E-mail ou senha inválidos.')
    }
  }

  async function handleCriarConta(e) {
    e.preventDefault()
    setErro('')
    setAviso('')
    if (!DOMINIO_PERMITIDO.test(email)) {
      setErro('Cadastro permitido apenas para e-mails @imovit.com.br.')
      return
    }
    setEnviando(true)
    const { error } = await supabase.auth.signUp({ email, password: senha })
    setEnviando(false)
    if (error) {
      setErro(error.message.includes('already registered') ? 'Esse e-mail já tem conta.' : 'Não foi possível criar a conta.')
      return
    }
    setAviso('Conta criada! Confirme seu e-mail (se pedido) e faça login.')
    trocarModo('entrar')
  }

  async function handleEsqueciSenha(e) {
    e.preventDefault()
    setErro('')
    setAviso('')
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar o e-mail de recuperação.')
      return
    }
    setAviso('Se esse e-mail tiver conta, enviamos um link de recuperação.')
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">imovit</div>
        <div className="login-tagline">Hub Operacional</div>

        {modo === 'entrar' && (
          <form className="login-form" onSubmit={handleEntrar}>
            {erro && <div className="login-error">{erro}</div>}
            {aviso && <div className="stat-sub is-muted">{aviso}</div>}

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@imovit.com.br"
              />
            </div>

            <div className="field">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <button type="button" className="btn-link" onClick={() => trocarModo('criar-conta')}>Criar conta</button>
              <button type="button" className="btn-link" onClick={() => trocarModo('esqueci-senha')}>Esqueci a senha</button>
            </div>
          </form>
        )}

        {modo === 'criar-conta' && (
          <form className="login-form" onSubmit={handleCriarConta}>
            {erro && <div className="login-error">{erro}</div>}

            <div className="field">
              <label htmlFor="email-criar">E-mail @imovit.com.br</label>
              <input
                id="email-criar"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@imovit.com.br"
              />
            </div>

            <div className="field">
              <label htmlFor="senha-criar">Senha</label>
              <input
                id="senha-criar"
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
              {enviando ? 'Criando…' : 'Criar conta'}
            </button>

            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)' }} onClick={() => trocarModo('entrar')}>
              ← Voltar para login
            </button>
          </form>
        )}

        {modo === 'esqueci-senha' && (
          <form className="login-form" onSubmit={handleEsqueciSenha}>
            {erro && <div className="login-error">{erro}</div>}
            {aviso && <div className="stat-sub is-muted">{aviso}</div>}

            <div className="field">
              <label htmlFor="email-recuperar">E-mail</label>
              <input
                id="email-recuperar"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@imovit.com.br"
              />
            </div>

            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>

            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)' }} onClick={() => trocarModo('entrar')}>
              ← Voltar para login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
