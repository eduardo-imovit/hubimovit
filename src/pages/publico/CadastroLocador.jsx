import { useState } from 'react'
import { ESTADOS_CIVIS, TIPOS_CONTA, enviarCadastroLocador } from '../../lib/cadastroLocador'

const inicial = {
  email: '', nome: '', cpf: '', rg: '', nascimento: '', estado_civil: '', nacionalidade: '', profissao: '',
  celular: '', telefone: '', endereco: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
  c_nome: '', c_cpf: '', c_rg: '', c_profissao: '', c_nacionalidade: '', c_email: '', c_celular: '', c_telefone: '',
  b_favorecido: '', b_cpf: '', b_banco: '', b_agencia: '', b_tipo: '', b_numero: '',
  i_endereco: '', i_complemento: '', i_bairro: '', i_cidade: '', i_estado: '', i_cep: '',
  i_administradora: '', i_tel_adm: '', site: '',
}

const limpa = (v) => (v.trim() ? v.trim() : undefined)
const cpfOk = (v) => /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(v.trim())

function Moldura({ children }) {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">Cadastro do locador</span>
        </div>
      </nav>
      <main className="app-main" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>{children}</main>
    </div>
  )
}

function Opcoes({ opcoes, valor, onChange }) {
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

// Campo texto com o padrão do Hub (mesmo da captação pública).
function Campo({ id, rotulo, valor, onChange, req, tipo, auto, placeholder, flex }) {
  return (
    <div className="field" style={flex ? { flex } : undefined}>
      <label htmlFor={id}>{rotulo}{req ? '' : ' (opcional)'}</label>
      <input id={id} type={tipo ?? 'text'} required={!!req} autoComplete={auto}
        value={valor} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} />
    </div>
  )
}

// Linha flexível de campos (mesmo arranjo da captação pública).
function Linha({ children }) {
  return <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>{children}</div>
}

/**
 * Cadastro público do locador PF (RF28, PRD §5.15): página única com os 5
 * blocos do Google Form. Grava pela Edge Function `cadastro-locador`.
 */
export default function CadastroLocador() {
  const [form, setForm] = useState(inicial)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  function validar() {
    const f = form
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Informe um e-mail válido.'
    if (f.nome.trim().length < 3) return 'Informe o nome completo do locador.'
    if (!cpfOk(f.cpf)) return 'Informe o CPF do locador com 11 dígitos.'
    if (!f.rg.trim() || !f.nascimento || !f.estado_civil) return 'Preencha RG, nascimento e estado civil.'
    if (!f.nacionalidade.trim() || !f.profissao.trim()) return 'Preencha nacionalidade e profissão.'
    if (f.celular.replace(/\D/g, '').length < 10) return 'Informe um celular com DDD.'
    if (!f.endereco.trim() || !f.bairro.trim() || !f.cidade.trim() || !f.estado.trim() || !f.cep.trim()) {
      return 'Preencha o endereço completo do locador.'
    }
    if ((f.c_cpf.trim() || f.c_rg.trim()) && !cpfOk(f.c_cpf)) return 'O CPF do cônjuge precisa de 11 dígitos.'
    if (!f.b_favorecido.trim() || !cpfOk(f.b_cpf)) return 'Informe favorecido e CPF da conta.'
    if (!f.b_banco.trim() || !f.b_agencia.trim() || !f.b_tipo || !f.b_numero.trim()) return 'Preencha banco, agência, tipo e número da conta.'
    if (!f.i_endereco.trim() || !f.i_bairro.trim() || !f.i_cidade.trim() || !f.i_estado.trim() || !f.i_cep.trim()) {
      return 'Preencha o endereço completo do imóvel.'
    }
    return ''
  }

  async function enviar(ev) {
    ev.preventDefault()
    const msg = validar()
    setErro(msg)
    if (msg) return
    setEnviando(true)
    try {
      const f = form
      await enviarCadastroLocador({
        site: f.site || undefined,
        email: f.email.trim(),
        locador: {
          nome: f.nome.trim(), cpf: f.cpf.trim(), rg: f.rg.trim(), nascimento: f.nascimento,
          estado_civil: f.estado_civil, nacionalidade: f.nacionalidade.trim(), profissao: f.profissao.trim(),
          celular: f.celular.trim(), telefone: limpa(f.telefone), endereco: f.endereco.trim(),
          complemento: limpa(f.complemento), bairro: f.bairro.trim(), cidade: f.cidade.trim(),
          estado: f.estado.trim(), cep: f.cep.trim(),
        },
        conjuge: (f.c_nome.trim() || f.c_cpf.trim()) ? {
          nome: limpa(f.c_nome), cpf: limpa(f.c_cpf), rg: limpa(f.c_rg), profissao: limpa(f.c_profissao),
          nacionalidade: limpa(f.c_nacionalidade), email: limpa(f.c_email), celular: limpa(f.c_celular),
          telefone: limpa(f.c_telefone),
        } : null,
        banco: {
          favorecido: f.b_favorecido.trim(), cpf: f.b_cpf.trim(), banco: f.b_banco.trim(),
          agencia: f.b_agencia.trim(), tipo_conta: f.b_tipo, numero_conta: f.b_numero.trim(),
        },
        imovel: {
          endereco: f.i_endereco.trim(), complemento: limpa(f.i_complemento), bairro: f.i_bairro.trim(),
          cidade: f.i_cidade.trim(), estado: f.i_estado.trim(), cep: f.i_cep.trim(),
          administradora: limpa(f.i_administradora), telefone_administradora: limpa(f.i_tel_adm),
        },
      })
      setEnviado(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <Moldura>
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">Cadastro recebido</div>
          <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>Obrigado, {form.nome.split(' ')[0]}!</div>
          <p className="page-sub" style={{ margin: 0 }}>
            Recebemos seu cadastro. Uma cópia foi enviada para {form.email}. Nossa equipe entra em contato com os próximos passos.
          </p>
        </div>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Cadastro do locador · pessoa física</div>
          <div className="page-title">Cadastro Locador(a)</div>
          <div className="page-sub">Preencha os dados abaixo. Uma cópia das respostas chega no seu e-mail.</div>
        </div>
      </header>

      <form className="card card-body" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <input type="text" name="site" tabIndex={-1} autoComplete="off" value={form.site} onChange={(ev) => set({ site: ev.target.value })}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

        <Campo id="cl-email" rotulo="E-mail" valor={form.email} onChange={(v) => set({ email: v })} req tipo="email" auto="email" />

        <div className="page-eyebrow">Dados do locador(a)</div>
        <Campo id="cl-nome" rotulo="Nome completo" valor={form.nome} onChange={(v) => set({ nome: v })} req auto="name" />
        <Linha>
          <Campo id="cl-cpf" rotulo="CPF" valor={form.cpf} onChange={(v) => set({ cpf: v })} req placeholder="000.000.000-00" flex="1 1 200px" />
          <Campo id="cl-rg" rotulo="RG" valor={form.rg} onChange={(v) => set({ rg: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-nasc" rotulo="Data de nascimento" valor={form.nascimento} onChange={(v) => set({ nascimento: v })} req tipo="date" auto="bday" flex="1 1 200px" />
          <div className="field" style={{ flex: '1 1 200px' }}><label>Estado civil</label><Opcoes opcoes={ESTADOS_CIVIS} valor={form.estado_civil} onChange={(v) => set({ estado_civil: v })} /></div>
        </Linha>
        <Linha>
          <Campo id="cl-nac" rotulo="Nacionalidade" valor={form.nacionalidade} onChange={(v) => set({ nacionalidade: v })} req flex="1 1 200px" />
          <Campo id="cl-prof" rotulo="Profissão" valor={form.profissao} onChange={(v) => set({ profissao: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-cel" rotulo="Celular" valor={form.celular} onChange={(v) => set({ celular: v })} req tipo="tel" auto="tel" placeholder="(19) 99999-9999" flex="1 1 200px" />
          <Campo id="cl-tel" rotulo="Telefone" valor={form.telefone} onChange={(v) => set({ telefone: v })} flex="1 1 200px" />
        </Linha>
        <Campo id="cl-end" rotulo="Endereço" valor={form.endereco} onChange={(v) => set({ endereco: v })} req auto="address-line1" />
        <Campo id="cl-comp" rotulo="Complemento" valor={form.complemento} onChange={(v) => set({ complemento: v })} />
        <Linha>
          <Campo id="cl-bairro" rotulo="Bairro" valor={form.bairro} onChange={(v) => set({ bairro: v })} req flex="2 1 220px" />
          <Campo id="cl-cidade" rotulo="Cidade" valor={form.cidade} onChange={(v) => set({ cidade: v })} req auto="address-level2" flex="2 1 220px" />
        </Linha>
        <Linha>
          <Campo id="cl-estado" rotulo="Estado" valor={form.estado} onChange={(v) => set({ estado: v })} req flex="1 1 200px" />
          <Campo id="cl-cep" rotulo="CEP" valor={form.cep} onChange={(v) => set({ cep: v })} req auto="postal-code" flex="1 1 200px" />
        </Linha>

        <div className="page-eyebrow">Dados da(o) cônjuge (caso queira incluir no IR)</div>
        <Campo id="cl-c-nome" rotulo="Nome" valor={form.c_nome} onChange={(v) => set({ c_nome: v })} />
        <Linha>
          <Campo id="cl-c-cpf" rotulo="CPF" valor={form.c_cpf} onChange={(v) => set({ c_cpf: v })} flex="1 1 200px" />
          <Campo id="cl-c-rg" rotulo="RG" valor={form.c_rg} onChange={(v) => set({ c_rg: v })} flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-c-prof" rotulo="Profissão" valor={form.c_profissao} onChange={(v) => set({ c_profissao: v })} flex="1 1 200px" />
          <Campo id="cl-c-nac" rotulo="Nacionalidade" valor={form.c_nacionalidade} onChange={(v) => set({ c_nacionalidade: v })} flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-c-email" rotulo="E-mail" valor={form.c_email} onChange={(v) => set({ c_email: v })} tipo="email" flex="1 1 200px" />
          <Campo id="cl-c-cel" rotulo="Celular" valor={form.c_celular} onChange={(v) => set({ c_celular: v })} tipo="tel" flex="1 1 200px" />
        </Linha>
        <Campo id="cl-c-tel" rotulo="Telefone" valor={form.c_telefone} onChange={(v) => set({ c_telefone: v })} tipo="tel" />

        <div className="page-eyebrow">Dados para depósito</div>
        <Campo id="cl-b-fav" rotulo="Favorecido" valor={form.b_favorecido} onChange={(v) => set({ b_favorecido: v })} req />
        <Linha>
          <Campo id="cl-b-cpf" rotulo="CPF" valor={form.b_cpf} onChange={(v) => set({ b_cpf: v })} req flex="1 1 200px" />
          <Campo id="cl-b-banco" rotulo="Banco" valor={form.b_banco} onChange={(v) => set({ b_banco: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-b-ag" rotulo="Agência" valor={form.b_agencia} onChange={(v) => set({ b_agencia: v })} req flex="1 1 160px" />
          <Campo id="cl-b-num" rotulo="Número da conta" valor={form.b_numero} onChange={(v) => set({ b_numero: v })} req flex="1 1 160px" />
        </Linha>
        <div className="field"><label>Tipo de conta</label><Opcoes opcoes={TIPOS_CONTA} valor={form.b_tipo} onChange={(v) => set({ b_tipo: v })} /></div>

        <div className="page-eyebrow">Dados do imóvel</div>
        <Campo id="cl-i-end" rotulo="Endereço" valor={form.i_endereco} onChange={(v) => set({ i_endereco: v })} req />
        <Campo id="cl-i-comp" rotulo="Complemento" valor={form.i_complemento} onChange={(v) => set({ i_complemento: v })} />
        <Linha>
          <Campo id="cl-i-bairro" rotulo="Bairro" valor={form.i_bairro} onChange={(v) => set({ i_bairro: v })} req flex="2 1 220px" />
          <Campo id="cl-i-cidade" rotulo="Cidade" valor={form.i_cidade} onChange={(v) => set({ i_cidade: v })} req flex="2 1 220px" />
        </Linha>
        <Linha>
          <Campo id="cl-i-estado" rotulo="Estado" valor={form.i_estado} onChange={(v) => set({ i_estado: v })} req flex="1 1 200px" />
          <Campo id="cl-i-cep" rotulo="CEP" valor={form.i_cep} onChange={(v) => set({ i_cep: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="cl-i-adm" rotulo="Administradora do condomínio" valor={form.i_administradora} onChange={(v) => set({ i_administradora: v })} flex="2 1 220px" />
          <Campo id="cl-i-tel" rotulo="Telefone" valor={form.i_tel_adm} onChange={(v) => set({ i_tel_adm: v })} tipo="tel" flex="1 1 160px" />
        </Linha>

        <div className="field">
          <label>Documentos necessários para a locação</label>
          <span className="field-hint">Envie para administrativo3@imovit.com.br: RG/CPF ou CNH, matrícula do imóvel, IPTU (códigos cartográficos, incluindo box), conta CPFL, código Sanasa (ou conta) e código do gás (ou conta).</span>
        </div>

        {erro && <div className="login-error">{erro}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar cadastro'}
          </button>
        </div>
      </form>
    </Moldura>
  )
}
