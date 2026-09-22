import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const CHAVE_DISPENSADO = 'portal_senha_prompt_dispensado'

/**
 * Convite pra locatário criar senha depois do primeiro acesso (que hoje é só
 * link mágico por e-mail). Não bloqueia nada -- só oferece uma entrada mais
 * rápida nas próximas visitas. Guardamos em user_metadata.senha_definida pra
 * não ficar pedindo de novo depois que a pessoa já criou.
 */
export default function DefinirSenha({ session, onDefinida }) {
  const [aberto, setAberto] = useState(false)
  const [dispensado, setDispensado] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE_DISPENSADO) === '1'
    } catch {
      return false
    }
  })
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (session.user.user_metadata?.senha_definida || dispensado) return null

  function dispensar() {
    setDispensado(true)
    try {
      sessionStorage.setItem(CHAVE_DISPENSADO, '1')
    } catch {
      // sessionStorage indisponível (modo privado etc.) -- só não persiste entre abas, sem problema
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { senha_definida: true },
    })
    setSalvando(false)
    if (error) {
      setErro('Não foi possível salvar a senha. Tente novamente.')
      return
    }
    onDefinida?.()
  }

  if (!aberto) {
    return (
      <div className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <div className="page-eyebrow" style={{ marginBottom: 2 }}>Entrar mais rápido da próxima vez</div>
          <div className="stat-sub is-muted" style={{ marginTop: 0 }}>Crie uma senha pra não precisar esperar o link por e-mail toda vez.</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={dispensar}>Agora não</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAberto(true)}>Criar senha</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Criar senha de acesso</div>
      {erro && <div className="login-error">{erro}</div>}
      <div className="field">
        <label htmlFor="ds-senha">Nova senha</label>
        <input id="ds-senha" type="password" autoComplete="new-password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div className="field-hint">Mínimo 8 caracteres.</div>
      </div>
      <div className="field">
        <label htmlFor="ds-confirmacao">Confirme a senha</label>
        <input id="ds-confirmacao" type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={salvando} onClick={dispensar}>Cancelar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar senha'}</button>
      </div>
    </form>
  )
}
