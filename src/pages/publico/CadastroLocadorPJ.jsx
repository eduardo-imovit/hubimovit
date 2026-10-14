import { useState } from 'react'
import { ESTADOS_CIVIS, TIPOS_CONTA, enviarCadastro } from '../../lib/cadastros'
import { BlocoEndereco, Campo, Linha, Moldura, Opcoes, cnpjOk, cpfCnpjOk, cpfOk, emailOk, limpa } from '../../components/cadastro/BlocosCadastro'

const inicial = {
  email: '', site: '',
  e_razao: '', e_cnpj: '', e_insc_mun: '', e_insc_est: '', e_tel: '',
  'e-end': '', 'e-comp': '', 'e-bairro': '', 'e-cidade': '', 'e-estado': '', 'e-cep': '',
  s_nome: '', s_cpf: '', s_rg: '', s_prof: '', s_civil: '', s_nac: '', s_tel: '',
  's-end': '', 's-comp': '', 's-bairro': '', 's-cidade': '', 's-estado': '', 's-cep': '',
  b_favorecido: '', b_doc: '', b_banco: '', b_agencia: '', b_tipo: '', b_numero: '',
  'i-end': '', 'i-comp': '', 'i-bairro': '', 'i-cidade': '', 'i-estado': '', 'i-cep': '',
  i_iptu: '', i_cpfl: '', i_sanasa: '', i_gas: '', i_adm: '', i_tel_adm: '',
}

/**
 * Cadastro público da locadora PJ (RF30, PRD §5.17): os mesmos blocos do
 * Google Form "Cadastro Locadora - Pessoa Jurídica". Grava pela Edge
 * Function `cadastro-locador` com tipo `locador-pj`.
 */
export default function CadastroLocadorPJ() {
  const [form, setForm] = useState(inicial)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const endOk = (p) => form[`${p}-end`].trim() && form[`${p}-bairro`].trim() && form[`${p}-cidade`].trim() && form[`${p}-estado`].trim() && form[`${p}-cep`].trim()

  function validar() {
    const f = form
    if (!emailOk(f.email)) return 'Informe um e-mail válido.'
    if (f.e_razao.trim().length < 3) return 'Informe a razão social.'
    if (!cnpjOk(f.e_cnpj)) return 'Informe o CNPJ com 14 dígitos.'
    if (f.e_tel.replace(/\D/g, '').length < 10) return 'Informe o telefone da empresa com DDD.'
    if (!endOk('e')) return 'Preencha o endereço completo da empresa.'
    if (f.s_nome.trim().length < 3) return 'Informe o nome do sócio administrador.'
    if (!cpfOk(f.s_cpf)) return 'Informe o CPF do sócio com 11 dígitos.'
    if (!f.s_rg.trim() || !f.s_prof.trim() || !f.s_nac.trim() || !f.s_civil) return 'Preencha RG, profissão, nacionalidade e estado civil do sócio.'
    if (f.s_tel.replace(/\D/g, '').length < 10) return 'Informe o telefone do sócio com DDD.'
    if (!endOk('s')) return 'Preencha o endereço completo do sócio.'
    if (!f.b_favorecido.trim() || !cpfCnpjOk(f.b_doc)) return 'Informe favorecido e CPF/CNPJ da conta.'
    if (!f.b_banco.trim() || !f.b_agencia.trim() || !f.b_tipo || !f.b_numero.trim()) return 'Preencha banco, agência, tipo e número da conta.'
    if (!endOk('i')) return 'Preencha o endereço completo do imóvel.'
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
      const end = (p) => ({
        endereco: f[`${p}-end`].trim(), complemento: limpa(f[`${p}-comp`]), bairro: f[`${p}-bairro`].trim(),
        cidade: f[`${p}-cidade`].trim(), estado: f[`${p}-estado`].trim(), cep: f[`${p}-cep`].trim(),
      })
      await enviarCadastro('locador-pj', {
        site: f.site || undefined,
        email: f.email.trim(),
        empresa: {
          razao_social: f.e_razao.trim(), cnpj: f.e_cnpj.trim(),
          inscricao_municipal: limpa(f.e_insc_mun), inscricao_estadual: limpa(f.e_insc_est),
          telefone: f.e_tel.trim(), ...end('e'),
        },
        socio: {
          nome: f.s_nome.trim(), cpf: f.s_cpf.trim(), rg: f.s_rg.trim(), profissao: f.s_prof.trim(),
          estado_civil: f.s_civil, nacionalidade: f.s_nac.trim(), telefone: f.s_tel.trim(), ...end('s'),
        },
        banco: {
          favorecido: f.b_favorecido.trim(), cpf: f.b_doc.trim(), banco: f.b_banco.trim(),
          agencia: f.b_agencia.trim(), tipo_conta: f.b_tipo, numero_conta: f.b_numero.trim(),
        },
        imovel: {
          ...end('i'), iptu: limpa(f.i_iptu), cpfl: limpa(f.i_cpfl), sanasa: limpa(f.i_sanasa),
          gas: limpa(f.i_gas), administradora: limpa(f.i_adm), telefone_administradora: limpa(f.i_tel_adm),
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
      <Moldura eyebrow="Cadastro da locadora">
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">Cadastro recebido</div>
          <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>Obrigado!</div>
          <p className="page-sub" style={{ margin: 0 }}>
            Recebemos o cadastro. Uma cópia foi enviada para {form.email}. Nossa equipe entra em contato com os próximos passos.
          </p>
        </div>
      </Moldura>
    )
  }

  return (
    <Moldura eyebrow="Cadastro da locadora">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Cadastro da locadora · pessoa jurídica</div>
          <div className="page-title">Cadastro Locadora</div>
          <div className="page-sub">Preencha os dados abaixo. Uma cópia das respostas chega no seu e-mail.</div>
        </div>
      </header>

      <form className="card card-body" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <input type="text" name="site" tabIndex={-1} autoComplete="off" value={form.site} onChange={(ev) => set({ site: ev.target.value })}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

        <Campo id="pj-email" rotulo="E-mail" valor={form.email} onChange={(v) => set({ email: v })} req tipo="email" auto="email" />

        <div className="page-eyebrow">Dados da empresa locadora</div>
        <Campo id="pj-razao" rotulo="Razão social" valor={form.e_razao} onChange={(v) => set({ e_razao: v })} req />
        <Linha>
          <Campo id="pj-cnpj" rotulo="CNPJ" valor={form.e_cnpj} onChange={(v) => set({ e_cnpj: v })} req placeholder="00.000.000/0001-00" flex="1 1 200px" />
          <Campo id="pj-tel" rotulo="Telefone" valor={form.e_tel} onChange={(v) => set({ e_tel: v })} req tipo="tel" flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="pj-im" rotulo="Inscrição municipal" valor={form.e_insc_mun} onChange={(v) => set({ e_insc_mun: v })} flex="1 1 200px" />
          <Campo id="pj-ie" rotulo="Inscrição estadual" valor={form.e_insc_est} onChange={(v) => set({ e_insc_est: v })} flex="1 1 200px" />
        </Linha>
        <BlocoEndereco prefixo="e" form={form} set={set} />

        <div className="page-eyebrow">Neste ato representado por: sócio administrador</div>
        <Campo id="pj-s-nome" rotulo="Nome" valor={form.s_nome} onChange={(v) => set({ s_nome: v })} req auto="name" />
        <Linha>
          <Campo id="pj-s-cpf" rotulo="CPF" valor={form.s_cpf} onChange={(v) => set({ s_cpf: v })} req flex="1 1 200px" />
          <Campo id="pj-s-rg" rotulo="RG" valor={form.s_rg} onChange={(v) => set({ s_rg: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="pj-s-prof" rotulo="Profissão" valor={form.s_prof} onChange={(v) => set({ s_prof: v })} req flex="1 1 200px" />
          <Campo id="pj-s-nac" rotulo="Nacionalidade" valor={form.s_nac} onChange={(v) => set({ s_nac: v })} req flex="1 1 200px" />
        </Linha>
        <div className="field"><label>Estado civil</label><Opcoes opcoes={ESTADOS_CIVIS} valor={form.s_civil} onChange={(v) => set({ s_civil: v })} /></div>
        <Campo id="pj-s-tel" rotulo="Telefone" valor={form.s_tel} onChange={(v) => set({ s_tel: v })} req tipo="tel" />
        <BlocoEndereco prefixo="s" form={form} set={set} />

        <div className="page-eyebrow">Dados para depósito</div>
        <Campo id="pj-b-fav" rotulo="Favorecido" valor={form.b_favorecido} onChange={(v) => set({ b_favorecido: v })} req />
        <Linha>
          <Campo id="pj-b-doc" rotulo="CPF ou CNPJ" valor={form.b_doc} onChange={(v) => set({ b_doc: v })} req flex="1 1 200px" />
          <Campo id="pj-b-banco" rotulo="Banco" valor={form.b_banco} onChange={(v) => set({ b_banco: v })} req flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="pj-b-ag" rotulo="Agência" valor={form.b_agencia} onChange={(v) => set({ b_agencia: v })} req flex="1 1 160px" />
          <Campo id="pj-b-num" rotulo="Número da conta" valor={form.b_numero} onChange={(v) => set({ b_numero: v })} req flex="1 1 160px" />
        </Linha>
        <div className="field"><label>Tipo de conta</label><Opcoes opcoes={TIPOS_CONTA} valor={form.b_tipo} onChange={(v) => set({ b_tipo: v })} /></div>

        <div className="page-eyebrow">Dados do imóvel</div>
        <BlocoEndereco prefixo="i" form={form} set={set} />
        <Linha>
          <Campo id="pj-i-iptu" rotulo="IPTU (códigos cartográficos)" valor={form.i_iptu} onChange={(v) => set({ i_iptu: v })} flex="2 1 220px" />
          <Campo id="pj-i-cpfl" rotulo="Código CPFL" valor={form.i_cpfl} onChange={(v) => set({ i_cpfl: v })} flex="1 1 160px" />
        </Linha>
        <Linha>
          <Campo id="pj-i-sanasa" rotulo="Código Sanasa" valor={form.i_sanasa} onChange={(v) => set({ i_sanasa: v })} flex="1 1 200px" />
          <Campo id="pj-i-gas" rotulo="Código do gás" valor={form.i_gas} onChange={(v) => set({ i_gas: v })} flex="1 1 200px" />
        </Linha>
        <Linha>
          <Campo id="pj-i-adm" rotulo="Administradora do condomínio" valor={form.i_adm} onChange={(v) => set({ i_adm: v })} flex="2 1 220px" />
          <Campo id="pj-i-tel" rotulo="Telefone" valor={form.i_tel_adm} onChange={(v) => set({ i_tel_adm: v })} tipo="tel" flex="1 1 160px" />
        </Linha>

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
