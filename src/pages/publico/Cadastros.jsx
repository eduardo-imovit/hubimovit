import { Link } from 'react-router-dom'
import { TIPOS_CADASTRO, linkCadastro } from '../../lib/cadastros'
import { Moldura } from '../../components/cadastro/BlocosCadastro'

/**
 * Seletor público de cadastros (RF30, PRD §5.17): quem abre sem saber o
 * perfil escolhe o cartão; quem já tem o link direto cai no form do tipo.
 */
export default function Cadastros() {
  return (
    <Moldura eyebrow="Cadastros">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Cadastros · Imovit</div>
          <div className="page-title">Qual cadastro você quer preencher?</div>
          <div className="page-sub">Escolha o seu perfil abaixo. Uma cópia das respostas chega no seu e-mail.</div>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {Object.entries(TIPOS_CADASTRO).map(([tipo, cfg]) => (
          <div key={tipo} className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{cfg.titulo}</div>
              <div className="page-sub" style={{ margin: 0 }}>{cfg.descricao}</div>
            </div>
            {cfg.habilitado ? (
              <Link className="btn btn-primary btn-sm" to={`/cadastro/${tipo}`}>Preencher</Link>
            ) : (
              <span className="avisos-item-sub">Em breve</span>
            )}
          </div>
        ))}
      </div>

      <p className="avisos-item-sub" style={{ marginTop: 'var(--space-4)' }}>
        Links diretos também valem: {Object.entries(TIPOS_CADASTRO).filter(([, c]) => c.habilitado).map(([t]) => linkCadastro(t)).join(' · ')}
      </p>
    </Moldura>
  )
}
