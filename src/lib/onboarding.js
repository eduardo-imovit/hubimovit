import { chamarFuncao } from './funcoes'
import { supabase } from './supabaseClient'
import { linkWhatsApp } from './distrato'

/**
 * Onboarding de colaboradores (RF32, PRD §5.18): a Gestão gera um link, o
 * colaborador passa os dados, o Eduardo cria o e-mail e o usuário no Imoview,
 * a Gestão aprova e o colaborador entra em colaboradores_raw. Tudo passa pela
 * Edge Function `onboarding`; a leitura direta é só da Gestão (RLS).
 */
const FUNCAO = import.meta.env.VITE_FUNCAO_ONBOARDING || 'onboarding'

export const criarOnboarding = (nome) => chamarFuncao(FUNCAO, { evento: 'criar', nome: nome || null })
export const aprovarOnboarding = (id, dados) => chamarFuncao(FUNCAO, { evento: 'aprovar', id, ...dados })
export const marcarEtapa = (id, etapa, feito) => chamarFuncao(FUNCAO, { evento: 'marcar', id, etapa, feito })
export const cancelarOnboarding = (id) => chamarFuncao(FUNCAO, { evento: 'cancelar', id })
export const abrirOnboarding = (token) => chamarFuncao(FUNCAO, { evento: 'abrir', token })
export const enviarOnboarding = (token, dados) => chamarFuncao(FUNCAO, { evento: 'enviar', token, ...dados })
export const enviarBancarios = (token, dados_bancarios) => chamarFuncao(FUNCAO, { evento: 'enviar_bancarios', token, dados_bancarios })
export const editarBancarios = (id, dados_bancarios) => chamarFuncao(FUNCAO, { evento: 'editar_bancarios', id, dados_bancarios })
export const excluirBancarios = (id) => chamarFuncao(FUNCAO, { evento: 'excluir_bancarios', id })

/** Linha do banco → estado do formulário (separa a conta do dígito). */
export function bancarioParaForm(d) {
  const [conta, digito] = (d.conta ?? '').split('-')
  return {
    banco: d.banco ?? '', agencia: d.agencia ?? '', conta: conta ?? '', digito: digito ?? '',
    tipoConta: d.tipo_conta ?? null, pixTipo: d.pix_tipo ?? null, pixChave: d.pix_chave ?? '',
  }
}

/**
 * Dados bancários (PRD §5.18b): Gestão e ADM leem. A RPC devolve só nome,
 * equipe e o bancário, sem CPF e sem endereço.
 */
export async function listarDadosBancarios() {
  const { data, error } = await supabase.rpc('dados_bancarios_colaboradores')
  if (error) throw error
  return data ?? []
}

/** Bancário de um onboarding (ficha da Gestão). */
export async function dadosBancariosDe(onboardingId) {
  const { data, error } = await supabase.from('onboarding_dados_bancarios').select('*').eq('onboarding_id', onboardingId).maybeSingle()
  if (error) throw error
  return data
}

export const TIPOS_CONTA = [
  { valor: 'corrente', label: 'Corrente' },
  { valor: 'poupanca', label: 'Poupança' },
]
export const TIPOS_PIX = [
  { valor: 'cpf', label: 'CPF' },
  { valor: 'celular', label: 'Celular' },
  { valor: 'email', label: 'E-mail' },
  { valor: 'aleatoria', label: 'Chave aleatória' },
]
export const tipoContaLabel = (v) => TIPOS_CONTA.find((t) => t.valor === v)?.label ?? '—'
export const tipoPixLabel = (v) => TIPOS_PIX.find((t) => t.valor === v)?.label ?? '—'

// Os mais usados; o campo aceita qualquer outro digitado.
export const BANCOS = [
  '001 · Banco do Brasil', '033 · Santander', '104 · Caixa', '237 · Bradesco', '341 · Itaú',
  '077 · Inter', '260 · Nubank', '336 · C6 Bank', '290 · PagBank', '323 · Mercado Pago',
  '756 · Sicoob', '748 · Sicredi', '212 · Banco Original', '208 · BTG Pactual', '655 · Neon',
]

export const BANCARIO_VAZIO = { banco: '', agencia: '', conta: '', digito: '', tipoConta: null, pixTipo: null, pixChave: '' }

/**
 * Confere o bancário no navegador (a função confere de novo). Devolve
 * { erro } ou { dados } (dados = null se tudo vazio).
 */
export function prepararBancario(b, cpf) {
  const temConta = [b.banco, b.agencia, b.conta, b.digito].some((v) => v.trim()) || !!b.tipoConta
  const temPix = !!b.pixTipo || !!b.pixChave.trim()
  if (!temConta && !temPix) return { dados: null }
  if (temConta) {
    if (!b.banco.trim() || !b.agencia.trim() || !b.conta.trim() || !b.digito.trim() || !b.tipoConta) {
      return { erro: 'Complete os dados da conta: banco, agência, conta, dígito e tipo. Ou deixe a conta em branco.' }
    }
    if (!/^\d{1,5}(-[0-9Xx])?$/.test(b.agencia.replace(/\s/g, ''))) return { erro: 'Confira a agência (só números).' }
    if (!/^\d{1,13}$/.test(soDigitos(b.conta)) || !/^[0-9Xx]$/.test(b.digito.trim())) return { erro: 'Confira a conta e o dígito.' }
  }
  if (temPix) {
    if (!b.pixTipo || !b.pixChave.trim()) return { erro: 'Escolha o tipo da chave PIX e preencha a chave. Ou deixe o PIX em branco.' }
    if (b.pixTipo === 'cpf' && cpf != null && soDigitos(b.pixChave) !== soDigitos(cpf)) {
      return { erro: 'A chave PIX do tipo CPF precisa ser o seu CPF: a conta tem de estar no seu nome.' }
    }
  }
  return {
    dados: {
      banco: temConta ? b.banco.trim() : null,
      agencia: temConta ? b.agencia.replace(/\s/g, '') : null,
      conta: temConta ? `${soDigitos(b.conta)}-${b.digito.trim()}` : null,
      tipo_conta: temConta ? b.tipoConta : null,
      pix_tipo: temPix ? b.pixTipo : null,
      pix_chave: temPix ? b.pixChave.trim() : null,
    },
  }
}

export { linkWhatsApp }

export const linkOnboarding = (token) => `${window.location.origin}/onboarding/${token}`

export const EQUIPES = [
  { valor: 'locacao', label: 'Locação' },
  { valor: 'venda', label: 'Venda' },
]
export const equipeLabel = (v) => EQUIPES.find((e) => e.valor === v)?.label ?? '—'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

// Onde fica a fila de repique hoje (listas fixas no n8n, PRD §5.18 P2).
export const INSTRUCAO_REPIQUE = (equipe, codigo) =>
  `No n8n, nos fluxos "teste repique" e "Repique 3.0", nó "Calcular fila": acrescente ${codigo ?? 'o código'} em ${equipe === 'venda' ? 'filaVendas' : 'filaLocacao'} e publique. Edite pelo editor, nunca pelo conector.`

export function mensagemLink(nome, link) {
  const primeiro = (nome ?? '').split(' ')[0]
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Seja bem-vindo(a) à Imovit. Para criarmos seus acessos (e-mail, CRM e Hub), preencha seus dados neste link: ${link}`
}

export function mensagemAcesso(nome, email) {
  const primeiro = (nome ?? '').split(' ')[0]
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Seus acessos da Imovit estão prontos.\n\nSeu e-mail: ${email}\n\nCrie sua conta no Hub com este e-mail: https://hub.imovit.com.br\n\nDepois de criar, avise a Gestão para liberar o seu nível.`
}

export const soDigitos = (t) => (t ?? '').replace(/\D/g, '')

export function cpfValido(valor) {
  const cpf = soDigitos(valor)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (n) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}

export const mascararCpf = (cpf) => (cpf ? `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}` : '—')
export const formatarCpf = (cpf) => (cpf ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : '—')

export function enderecoTexto(e) {
  if (!e) return '—'
  return `${e.logradouro}, ${e.numero}${e.complemento ? ` ${e.complemento}` : ''} · ${e.bairro} · ${e.cidade}/${e.uf} · CEP ${e.cep}`
}

/** Busca o endereço pelo CEP (ViaCEP, público). Devolve null se não achar. */
export async function buscarCep(cep) {
  const d = soDigitos(cep)
  if (d.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    const j = await r.json()
    if (j.erro) return null
    return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' }
  } catch {
    return null
  }
}

/**
 * Lista do onboarding + o que dá para conferir sozinho: cadastro em
 * colaboradores_raw (pelo código) e login/nível no Hub (pelo e-mail).
 * Nada disso é gravado (RF32.6).
 */
export async function listarOnboardings() {
  const { data, error } = await supabase
    .from('onboarding_colaboradores')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  const lista = data ?? []
  const codigos = lista.map((o) => o.id_corretor_crm).filter(Boolean)
  const emails = lista.map((o) => o.email_imovit).filter(Boolean)
  const [colabs, perfis] = await Promise.all([
    codigos.length
      ? supabase.from('colaboradores_raw').select('id_corretor_crm, ativo').in('id_corretor_crm', codigos)
      : { data: [] },
    emails.length
      ? supabase.from('perfis').select('id, email, role, nome').in('email', emails)
      : { data: [] },
  ])
  const colabPorCodigo = new Map((colabs.data ?? []).map((c) => [Number(c.id_corretor_crm), c]))
  const perfilPorEmail = new Map((perfis.data ?? []).map((p) => [p.email.toLowerCase(), p]))
  return lista.map((o) => ({
    ...o,
    colaborador: o.id_corretor_crm ? colabPorCodigo.get(Number(o.id_corretor_crm)) ?? null : null,
    perfil: o.email_imovit ? perfilPorEmail.get(o.email_imovit.toLowerCase()) ?? null : null,
  }))
}

/** As 10 etapas do checklist (PRD §5.18). `auto` = o Hub confere sozinho. */
export function checklist(o) {
  const m = o.marcacoes ?? {}
  const aprovado = ['aprovado', 'concluido'].includes(o.status)
  return [
    { chave: 'dados', label: 'Dados recebidos', auto: true, feito: !!o.enviado_em },
    { chave: 'email', label: 'E-mail @imovit criado', auto: true, feito: aprovado && !!o.email_imovit },
    { chave: 'imoview', label: 'Usuário no Imoview', auto: true, feito: aprovado && !!o.id_corretor_crm },
    { chave: 'colaboradores', label: 'Cadastro no Hub (colaboradores)', auto: true, feito: !!o.colaborador?.ativo },
    { chave: 'crm', label: 'CRM: equipe e distribuição no Imoview', auto: false, feito: !!m.crm },
    { chave: 'repique', label: 'Fila de repique', auto: false, feito: !!m.repique },
    { chave: 'acesso_enviado', label: 'Acesso enviado', auto: false, feito: !!m.acesso_enviado },
    { chave: 'login', label: 'Login no Hub', auto: true, feito: !!o.perfil },
    { chave: 'nivel', label: 'Nível Corretor', auto: true, feito: o.perfil?.role === 'corretor' },
    { chave: 'plantao', label: 'Plantão', auto: false, feito: !!m.plantao },
  ]
}

/** Situação para a lista: "expirado" e "concluído" são calculados. */
export function situacao(o) {
  if (o.status === 'cancelado') return { chave: 'cancelado', label: 'Cancelado', badge: 'badge-gray' }
  if (o.status === 'link_enviado') {
    if (new Date(o.expira_em) < new Date()) return { chave: 'expirado', label: 'Link expirado', badge: 'badge-danger' }
    return { chave: 'aguardando', label: 'Link enviado', badge: 'badge-gray' }
  }
  if (o.status === 'dados_recebidos') return { chave: 'recebido', label: 'Dados recebidos', badge: 'badge-warning' }
  const etapas = checklist(o)
  if (etapas.every((e) => e.feito)) return { chave: 'concluido', label: 'Concluído', badge: 'badge-success' }
  return { chave: 'andamento', label: 'Em andamento', badge: 'badge-coral' }
}
