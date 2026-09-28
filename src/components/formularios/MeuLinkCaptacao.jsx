import { useState } from 'react'
import { usePerfil } from '../../hooks/usePerfil'
import { useCorretores } from '../../hooks/useCorretores'
import { linkCaptacao } from '../../lib/captacao'

/**
 * Link de captação de quem está logado: o e-mail do login identifica o
 * corretor no CRM (colaboradores_raw.email_oficial). Cada um vê só o seu
 * (pedido do Eduardo, 28/09: não expor o link do time inteiro).
 */
export default function MeuLinkCaptacao({ compacto = false }) {
  const { perfil } = usePerfil()
  const corretores = useCorretores()
  const [copiado, setCopiado] = useState(false)

  if (!perfil || !corretores.length) return null
  const eu = corretores.find((c) => c.email_oficial?.toLowerCase() === perfil.email?.toLowerCase())

  if (!eu) {
    return (
      <div className="avisos-item-sub">
        Seu e-mail ({perfil.email}) não está no cadastro de corretores do CRM, então não há link de captação para você.
      </div>
    )
  }

  const url = linkCaptacao(eu.id_corretor_crm)

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
      {!compacto && <div className="avisos-item-sub" style={{ wordBreak: 'break-all', flex: '1 1 240px' }}>{url}</div>}
      <button type="button" className="btn btn-primary btn-sm" onClick={copiar}>
        {copiado ? 'Link copiado!' : 'Copiar meu link de captação'}
      </button>
    </div>
  )
}
