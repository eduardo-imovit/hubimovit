import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SITE_CASADEZOITO, linkApresentacao } from '../lib/captacao'

function LinkCopiavel({ url }) {
  const [copiado, setCopiado] = useState(false)
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <div className="avisos-item-sub" style={{ wordBreak: 'break-all', flex: '1 1 240px' }}>{url}</div>
      <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">Abrir</a>
      <button type="button" className="btn btn-primary btn-sm" onClick={copiar}>{copiado ? 'Link copiado!' : 'Copiar link'}</button>
    </div>
  )
}

/**
 * Materiais para mandar a clientes (RF23, PRD §5.7): Apresentação Imovit
 * personalizada (código do corretor, o mesmo da captação, identificado pelo
 * login) e o site da CasaDezoito.
 */
export default function MateriaisClientes() {
  const [token, setToken] = useState(undefined)

  useEffect(() => {
    supabase.rpc('meu_link_captacao').then(({ data }) => setToken(data ?? null))
  }, [])

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Ferramentas</div>
          <div className="page-title">Materiais para clientes</div>
          <div className="page-sub">Links para mandar a leads e clientes. Abrem no celular, sem login.</div>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>Apresentação Imovit</div>
          <div className="page-sub" style={{ margin: 0 }}>
            Quem somos, como trabalhamos e a CasaDezoito, terminando com o seu contato (nome e WhatsApp). Para leads do topo.
          </div>
          {token === undefined && <div className="avisos-item-sub">Carregando seu link…</div>}
          {token === null && (
            <div className="avisos-item-sub">
              Seu e-mail não está no cadastro de corretores do CRM, então a apresentação sai sem o cartão do consultor.
            </div>
          )}
          {token !== undefined && <LinkCopiavel url={token ? linkApresentacao(token) : `${window.location.origin}/apresentacao`} />}
        </div>

        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>Sobre a CasaDezoito</div>
          <div className="page-sub" style={{ margin: 0 }}>O site da CasaDezoito: conceito, espaços, empresas e como chegar.</div>
          <LinkCopiavel url={SITE_CASADEZOITO} />
        </div>
      </div>
    </div>
  )
}
