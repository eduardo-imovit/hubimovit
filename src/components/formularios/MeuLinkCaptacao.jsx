import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { linkCaptacao } from '../../lib/captacao'

/**
 * Link de captação de quem está logado. O RPC meu_link_captacao acha o
 * corretor pelo e-mail do login (colaboradores_raw.email_oficial) e devolve o
 * código aleatório dele; ninguém vê o link de outro corretor.
 */
export default function MeuLinkCaptacao() {
  const [token, setToken] = useState(undefined)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    supabase.rpc('meu_link_captacao').then(({ data }) => setToken(data ?? null))
  }, [])

  if (token === undefined) return <div className="avisos-item-sub">Carregando seu link…</div>
  if (!token) {
    return <div className="avisos-item-sub">Seu e-mail não está no cadastro de corretores do CRM, então não há link de captação para você.</div>
  }

  const url = linkCaptacao(token)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie o link:', url)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <div className="avisos-item-sub" style={{ wordBreak: 'break-all', flex: '1 1 240px' }}>{url}</div>
      <button type="button" className="btn btn-primary btn-sm" onClick={copiar}>
        {copiado ? 'Link copiado!' : 'Copiar meu link de captação'}
      </button>
    </div>
  )
}
