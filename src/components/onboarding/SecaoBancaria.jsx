import { BANCOS, TIPOS_CONTA, TIPOS_PIX } from '../../lib/onboarding'

/** Botões de escolha única (mesmo padrão da equipe). Clicar de novo desmarca. */
function Escolha({ rotulo, opcoes, valor, onChange }) {
  return (
    <div className="field">
      <label>{rotulo}</label>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }} role="radiogroup" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
            className={`btn btn-sm ${valor === o.valor ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onChange(valor === o.valor ? null : o.valor)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const PLACEHOLDER_PIX = { cpf: 'Só números', celular: '(19) 99999-9999', email: 'voce@email.com', aleatoria: '0000aaaa-00aa-00aa-00aa-000000aaaaaa' }

const DICA = {
  // link público, no formulário completo
  form: <>Para o Financeiro pagar suas comissões. <strong>A conta precisa estar no seu nome.</strong> Se preferir, envie depois por este mesmo link.</>,
  // link público, depois do envio
  depois: <>Para o Financeiro pagar suas comissões. <strong>A conta precisa estar no seu nome.</strong></>,
  // edição pela Gestão/ADM
  interno: <>A conta tem de estar no nome do colaborador. Para tirar a conta ou o PIX, deixe o bloco em branco.</>,
}

/**
 * Campos de dados bancários (PRD §5.18b): conta e/ou PIX, sempre no nome do
 * próprio colaborador. Usado no link público e na edição da Gestão/ADM.
 * `modo`: 'form' | 'depois' | 'interno'.
 */
export default function SecaoBancaria({ b, setB, modo = 'form' }) {
  const set = (patch) => setB((atual) => ({ ...atual, ...patch }))
  return (
    <>
      <div>
        <div className="page-eyebrow" style={{ marginBottom: 0 }}>{modo === 'interno' ? 'Dados bancários' : 'Dados bancários (opcional)'}</div>
        <span className="field-hint">{DICA[modo]}</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="ob-banco">Banco</label>
          <input id="ob-banco" list="ob-bancos" placeholder="Ex.: 341 · Itaú" value={b.banco} onChange={(ev) => set({ banco: ev.target.value })} maxLength={80} />
          <datalist id="ob-bancos">{BANCOS.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
        <div className="field" style={{ flex: '1 1 110px' }}>
          <label htmlFor="ob-agencia">Agência</label>
          <input id="ob-agencia" inputMode="numeric" placeholder="0000" value={b.agencia} onChange={(ev) => set({ agencia: ev.target.value })} maxLength={7} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="ob-conta">Conta</label>
          <input id="ob-conta" inputMode="numeric" placeholder="Sem o dígito" value={b.conta} onChange={(ev) => set({ conta: ev.target.value })} maxLength={15} />
        </div>
        <div className="field" style={{ flex: '0 1 90px' }}>
          <label htmlFor="ob-digito">Dígito</label>
          <input id="ob-digito" value={b.digito} onChange={(ev) => set({ digito: ev.target.value })} maxLength={1} />
        </div>
      </div>
      <Escolha rotulo="Tipo de conta" opcoes={TIPOS_CONTA} valor={b.tipoConta} onChange={(v) => set({ tipoConta: v })} />
      <Escolha rotulo="Chave PIX" opcoes={TIPOS_PIX} valor={b.pixTipo} onChange={(v) => set({ pixTipo: v })} />
      {b.pixTipo && (
        <div className="field">
          <label htmlFor="ob-pix">Chave ({TIPOS_PIX.find((t) => t.valor === b.pixTipo)?.label})</label>
          <input id="ob-pix" placeholder={PLACEHOLDER_PIX[b.pixTipo]} value={b.pixChave} onChange={(ev) => set({ pixChave: ev.target.value })} maxLength={120} />
        </div>
      )}
    </>
  )
}
