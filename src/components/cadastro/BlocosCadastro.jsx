/**
 * Blocos compartilhados dos cadastros públicos (RF30, PRD §5.17): o mesmo
 * visual do Hub em todos os tipos (mesmo padrão da captação pública).
 * Cada formulário monta seus blocos com estes componentes.
 */

export const limpa = (v) => (v.trim() ? v.trim() : undefined)
export const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v.trim())
export const cpfOk = (v) => /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(v.trim())
export const cnpjOk = (v) => /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(v.trim())
export const cpfCnpjOk = (v) => cpfOk(v) || cnpjOk(v)

export function Moldura({ eyebrow, children }) {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">{eyebrow}</span>
        </div>
      </nav>
      <main className="app-main" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>{children}</main>
    </div>
  )
}

export function Opcoes({ opcoes, valor, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} role="radiogroup">
      {opcoes.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={valor === o}
          className={`btn btn-sm ${valor === o ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Campo({ id, rotulo, valor, onChange, req, tipo, auto, placeholder, flex }) {
  return (
    <div className="field" style={flex ? { flex } : undefined}>
      <label htmlFor={id}>{rotulo}{req ? '' : ' (opcional)'}</label>
      <input id={id} type={tipo ?? 'text'} required={!!req} autoComplete={auto}
        value={valor} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function Linha({ children }) {
  return <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>{children}</div>
}

/** Bloco de endereço completo (pessoa, empresa, sócio ou imóvel). */
export function BlocoEndereco({ prefixo, form, set, req = true }) {
  const g = (c) => `${prefixo}-${c}`
  return (
    <>
      <Campo id={g('end')} rotulo="Endereço" valor={form[g('end')]} onChange={(v) => set({ [g('end')]: v })} req={req} auto="address-line1" />
      <Campo id={g('comp')} rotulo="Complemento" valor={form[g('comp')]} onChange={(v) => set({ [g('comp')]: v })} />
      <Linha>
        <Campo id={g('bairro')} rotulo="Bairro" valor={form[g('bairro')]} onChange={(v) => set({ [g('bairro')]: v })} req={req} flex="2 1 220px" />
        <Campo id={g('cidade')} rotulo="Cidade" valor={form[g('cidade')]} onChange={(v) => set({ [g('cidade')]: v })} req={req} auto="address-level2" flex="2 1 220px" />
      </Linha>
      <Linha>
        <Campo id={g('estado')} rotulo="Estado" valor={form[g('estado')]} onChange={(v) => set({ [g('estado')]: v })} req={req} flex="1 1 200px" />
        <Campo id={g('cep')} rotulo="CEP" valor={form[g('cep')]} onChange={(v) => set({ [g('cep')]: v })} req={req} auto="postal-code" flex="1 1 200px" />
      </Linha>
    </>
  )
}
