import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  BANCARIO_VAZIO, BANCOS, EQUIPES, TIPOS_CONTA, TIPOS_PIX, UFS, abrirOnboarding, buscarCep, cpfValido,
  enviarBancarios, enviarOnboarding, prepararBancario, soDigitos,
} from '../../lib/onboarding'

/** Botões de escolha única (mesmo padrão da equipe). */
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

/**
 * Dados bancários (PRD §5.18b): opcionais, conta e/ou PIX, sempre no nome
 * do próprio colaborador. Só o Financeiro (ADM) e a Gestão veem.
 */
function SecaoBancaria({ b, setB, depois = false }) {
  const set = (patch) => setB((atual) => ({ ...atual, ...patch }))
  return (
    <>
      <div>
        <div className="page-eyebrow" style={{ marginBottom: 0 }}>Dados bancários (opcional)</div>
        <span className="field-hint">Para o Financeiro pagar suas comissões. <strong>A conta precisa estar no seu nome.</strong>{!depois && ' Se preferir, envie depois por este mesmo link.'}</span>
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

/** Depois do envio, sem bancário: o link aceita só esta parte (uma vez). */
function SoBancario({ token }) {
  const [b, setB] = useState(BANCARIO_VAZIO)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(ev) {
    ev.preventDefault()
    // O CPF não volta para a página: a função confere a chave CPF.
    const { erro: msg, dados } = prepararBancario(b, null)
    if (msg) return setErro(msg)
    if (!dados) return setErro('Preencha a conta, o PIX ou os dois.')
    setErro('')
    setEnviando(true)
    try {
      await enviarBancarios(token, dados)
      setEnviado(true)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) return <p className="page-sub" style={{ margin: 0 }}>Dados bancários recebidos. Obrigado!</p>
  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <SecaoBancaria b={b} setB={setB} depois />
      {erro && <div className="login-error">{erro}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar dados bancários'}</button>
      </div>
    </form>
  )
}

function Moldura({ children }) {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">Boas-vindas</span>
        </div>
      </nav>
      <main className="app-main" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>{children}</main>
    </div>
  )
}

function Mensagem({ titulo, texto, children }) {
  return (
    <Moldura>
      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>{titulo}</div>
        <p className="page-sub" style={{ margin: 0 }}>{texto}</p>
        {children}
      </div>
    </Moldura>
  )
}

const VAZIO = {
  nome: '', telefone: '', cpf: '', creciNumero: '', creciUf: 'SP', equipe: null,
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP', aceite: false,
}

/**
 * Link público do onboarding (RF32.2, PRD §5.18): o colaborador novo passa
 * os dados para a Gestão criar o e-mail @imovit e o usuário no Imoview.
 * Sem login: o token do link é a chave; tudo passa pela Edge Function.
 */
export default function OnboardingPublico() {
  const { token } = useParams()
  const [situacao, setSituacao] = useState(null)
  const [faltaBancario, setFaltaBancario] = useState(false)
  const [erroCarga, setErroCarga] = useState('')
  const [form, setForm] = useState(VAZIO)
  const [bancario, setBancario] = useState(BANCARIO_VAZIO)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    abrirOnboarding(token)
      .then(({ onboarding }) => {
        setSituacao(onboarding.situacao)
        setFaltaBancario(!!onboarding.falta_bancario)
      })
      .catch((e) => setErroCarga(e.message))
  }, [token])

  async function aoSairDoCep() {
    if (soDigitos(form.cep).length !== 8) return
    setBuscandoCep(true)
    const e = await buscarCep(form.cep)
    setBuscandoCep(false)
    if (e) set({ logradouro: e.logradouro || form.logradouro, bairro: e.bairro || form.bairro, cidade: e.cidade, uf: e.uf })
  }

  function validar() {
    if (form.nome.trim().split(/\s+/).length < 2) return 'Informe o nome completo.'
    if (![10, 11].includes(soDigitos(form.telefone).length)) return 'Confira o WhatsApp, com DDD.'
    if (!cpfValido(form.cpf)) return 'Confira o CPF.'
    if (!form.creciNumero.trim()) return 'Informe o número do CRECI.'
    if (!form.equipe) return 'Escolha a equipe: locação ou venda.'
    if (soDigitos(form.cep).length !== 8) return 'Confira o CEP.'
    if (!form.logradouro.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim()) return 'Complete o endereço.'
    if (!form.aceite) return 'Confirme o uso dos dados para continuar.'
    return ''
  }

  async function enviar(ev) {
    ev.preventDefault()
    const msg = validar()
    const banc = prepararBancario(bancario, form.cpf)
    setErro(msg || banc.erro || '')
    if (msg || banc.erro) return
    setEnviando(true)
    try {
      await enviarOnboarding(token, {
        nome_completo: form.nome.trim().replace(/\s+/g, ' '),
        telefone: form.telefone,
        cpf: form.cpf,
        creci_numero: form.creciNumero.trim(),
        creci_uf: form.creciUf,
        equipe: form.equipe,
        endereco: {
          cep: form.cep, logradouro: form.logradouro.trim(), numero: form.numero.trim(),
          complemento: form.complemento.trim() || null, bairro: form.bairro.trim(), cidade: form.cidade.trim(), uf: form.uf,
        },
        aceite: true,
        dados_bancarios: banc.dados,
      })
      setFaltaBancario(!banc.dados)
      setEnviado(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (erroCarga) return <Mensagem titulo="Link não encontrado" texto={erroCarga} />
  if (!situacao) return <Moldura><div className="hub-loading">Carregando…</div></Moldura>
  if (situacao === 'expirado' || situacao === 'cancelado') {
    return <Mensagem titulo="Este link não está mais ativo" texto="Fale com a Gestão da Imovit para receber um novo link." />
  }
  if (enviado || situacao === 'enviado') {
    return (
      <Mensagem titulo="Recebemos seus dados" texto="A Gestão vai criar o seu e-mail da Imovit e os seus acessos, e te chama no WhatsApp. Bem-vindo(a)!">
        {faltaBancario && <SoBancario token={token} />}
      </Mensagem>
    )
  }

  return (
    <Moldura>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Imovit</div>
          <div className="page-title">Seja bem-vindo(a)</div>
          <div className="page-sub">Preencha seus dados para criarmos o seu e-mail, o acesso ao CRM e ao Hub.</div>
        </div>
      </header>

      <form className="card card-body" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="field">
          <label htmlFor="ob-nome">Nome completo</label>
          <input id="ob-nome" autoComplete="name" value={form.nome} onChange={(ev) => set({ nome: ev.target.value })} maxLength={160} required />
          <span className="field-hint">Escreva como no seu documento: é o nome que vai aparecer no CRM e nos relatórios.</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label htmlFor="ob-tel">WhatsApp</label>
            <input id="ob-tel" type="tel" autoComplete="tel" placeholder="(19) 99999-9999" value={form.telefone} onChange={(ev) => set({ telefone: ev.target.value })} required />
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label htmlFor="ob-cpf">CPF</label>
            <input id="ob-cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(ev) => set({ cpf: ev.target.value })} maxLength={14} required />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label htmlFor="ob-creci">CRECI</label>
            <input id="ob-creci" value={form.creciNumero} onChange={(ev) => set({ creciNumero: ev.target.value })} maxLength={20} required />
          </div>
          <div className="field" style={{ flex: '1 1 100px' }}>
            <label htmlFor="ob-creci-uf">UF do CRECI</label>
            <select id="ob-creci-uf" value={form.creciUf} onChange={(ev) => set({ creciUf: ev.target.value })}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Equipe</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="radiogroup" aria-label="Equipe">
            {EQUIPES.map((e) => (
              <button key={e.valor} type="button" role="radio" aria-checked={form.equipe === e.valor}
                className={`btn btn-sm ${form.equipe === e.valor ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set({ equipe: e.valor })}>
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-eyebrow" style={{ marginBottom: 0 }}>Endereço</div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label htmlFor="ob-cep">CEP</label>
            <input id="ob-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={form.cep}
              onChange={(ev) => set({ cep: ev.target.value })} onBlur={aoSairDoCep} maxLength={9} required />
            {buscandoCep && <span className="field-hint">Buscando endereço…</span>}
          </div>
          <div className="field" style={{ flex: '3 1 260px' }}>
            <label htmlFor="ob-rua">Rua</label>
            <input id="ob-rua" autoComplete="address-line1" value={form.logradouro} onChange={(ev) => set({ logradouro: ev.target.value })} required />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 100px' }}>
            <label htmlFor="ob-num">Número</label>
            <input id="ob-num" value={form.numero} onChange={(ev) => set({ numero: ev.target.value })} required />
          </div>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label htmlFor="ob-comp">Complemento (opcional)</label>
            <input id="ob-comp" autoComplete="address-line2" value={form.complemento} onChange={(ev) => set({ complemento: ev.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label htmlFor="ob-bairro">Bairro</label>
            <input id="ob-bairro" value={form.bairro} onChange={(ev) => set({ bairro: ev.target.value })} required />
          </div>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label htmlFor="ob-cidade">Cidade</label>
            <input id="ob-cidade" value={form.cidade} onChange={(ev) => set({ cidade: ev.target.value })} required />
          </div>
          <div className="field" style={{ flex: '1 1 80px' }}>
            <label htmlFor="ob-uf">UF</label>
            <select id="ob-uf" value={form.uf} onChange={(ev) => set({ uf: ev.target.value })}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <SecaoBancaria b={bancario} setB={setBancario} />

        <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.aceite} onChange={(ev) => set({ aceite: ev.target.checked })} style={{ marginTop: 4 }} />
          <span>Autorizo a Imovit a usar estes dados para o meu cadastro como colaborador(a). O CPF e o endereço ficam visíveis só para a Gestão; os dados bancários, para a Gestão e o Financeiro.</span>
        </label>

        {erro && <div className="login-error">{erro}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        </div>
      </form>
    </Moldura>
  )
}
