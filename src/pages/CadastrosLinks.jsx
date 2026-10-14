import { useState } from 'react'
import { TIPOS_CADASTRO, linkCadastro } from '../lib/cadastros'

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
 * Ferramentas ▸ Cadastros (RF30.5, PRD §5.17): os links de cada tipo para o
 * corretor mandar ao cliente. Abrem no celular, sem login. A lista de
 * respostas continua só com gestão/adm.
 */
export default function CadastrosLinks() {
  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Ferramentas</div>
          <div className="page-title">Cadastros para clientes</div>
          <div className="page-sub">Links dos formulários públicos. Mande o do perfil certo; sem o perfil, mande o seletor.</div>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {Object.entries(TIPOS_CADASTRO).filter(([, c]) => c.habilitado).map(([tipo, cfg]) => (
          <div key={tipo} className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{cfg.titulo}</div>
            <div className="page-sub" style={{ margin: 0 }}>{cfg.descricao}</div>
            <LinkCopiavel url={linkCadastro(tipo)} />
          </div>
        ))}
      </div>
    </div>
  )
}
