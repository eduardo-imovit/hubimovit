import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../hooks/useSession'

const DOMINIO_PERMITIDO = /@imovit\.com\.br$/i

// Só no `npm run dev`: /login?previa=confirmar mostra a tela de confirmação sem cadastrar ninguém.
const PREVIA_CONFIRMAR = import.meta.env.DEV && new URLSearchParams(window.location.search).get('previa') === 'confirmar'

export default function Login() {
  const { session, carregando } = useSession()
  const [modo, setModo] = useState(PREVIA_CONFIRMAR ? 'confirmar-email' : 'entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  // E-mail que acabou de se cadastrar (ou tentou entrar sem confirmar): mostra a tela de confirmação.
  const [aConfirmar, setAConfirmar] = useState(PREVIA_CONFIRMAR ? 'fulano@imovit.com.br' : '')
  const [reenvio, setReenvio] = useState('')

  if (!carregando && session && !PREVIA_CONFIRMAR) {
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
      if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
        setAConfirmar(email)
        setReenvio('')
        setModo('confirmar-email')
        return
      }
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin },
    })
    setEnviando(false)
    // Com confirmação ligada, o Supabase não dá erro para e-mail já cadastrado:
    // devolve o usuário sem identidades.
    const jaExiste = error?.message.includes('already registered') || (data?.user && data.user.identities?.length === 0)
    if (jaExiste) {
      setErro('Esse e-mail já tem conta. Volte e entre com a sua senha, ou use "Esqueci a senha".')
      return
    }
    if (error) {
      setErro('Não foi possível criar a conta.')
      return
    }
    // Sem confirmação exigida, o signUp já devolve a sessão e o <Navigate> leva para a Home.
    if (data?.session) return
    setAConfirmar(email)
    setReenvio('')
    setSenha('')
    setModo('confirmar-email')
  }

  async function reenviarConfirmacao() {
    setReenvio('enviando')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: aConfirmar,
      options: { emailRedirectTo: window.location.origin },
    })
    setReenvio(error ? 'erro' : 'enviado')
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

            <p className="login-confirmar-dica">Depois de criar, vamos mandar um link para este e-mail. A conta só funciona depois que você confirmar.</p>

            <button type="submit" className="btn btn-primary login-submit" disabled={enviando}>
              {enviando ? 'Criando…' : 'Criar conta'}
            </button>

            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)' }} onClick={() => trocarModo('entrar')}>
              ← Voltar para login
            </button>
          </form>
        )}

        {modo === 'confirmar-email' && (
          <div className="login-form login-confirmar" role="status" aria-live="polite">
            <div className="login-confirmar-icone" aria-hidden="true">✉</div>
            <h1 className="login-confirmar-titulo">Confirme seu e-mail</h1>
            <p>
              Enviamos um link de confirmação para <strong>{aConfirmar}</strong>.
            </p>
            <ol className="login-confirmar-passos">
              <li>Abra o e-mail que chegou na sua caixa de entrada.</li>
              <li>Clique no link para ativar a conta.</li>
              <li>Volte aqui e entre com o seu e-mail e senha.</li>
            </ol>
            <p className="login-confirmar-dica">
              Sem confirmar, o Hub não deixa entrar. Não achou? Olhe no spam ou em “Outros”; pode levar alguns minutos.
            </p>

            {reenvio === 'enviado' && <div className="login-ok">Enviamos outro link. Confira a caixa de entrada.</div>}
            {reenvio === 'erro' && <div className="login-error">Não deu para reenviar agora. Espere um minuto e tente de novo.</div>}

            <button type="button" className="btn btn-primary login-submit" onClick={() => trocarModo('entrar')}>
              Já confirmei, quero entrar
            </button>
            <button type="button" className="btn-link" style={{ fontSize: 'var(--text-xs)' }} onClick={reenviarConfirmacao} disabled={reenvio === 'enviando'}>
              {reenvio === 'enviando' ? 'Reenviando…' : 'Não recebi, reenviar o e-mail'}
            </button>
          </div>
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
