import { chamarFuncao } from './funcoes'

/**
 * Central de Cadastros (RF30, PRD §5.17): os 6 cadastros do Google
 * (Locador/Locatário/Fiador × PF/PJ) num motor único — 1 tabela, 1 função,
 * 1 lista. Só os tipos `habilitado` aparecem com link; os demais mostram
 * "Em breve" no seletor e entram sem migração nova.
 */
export const ESTADOS_CIVIS = ['Solteiro (a)', 'Casado (a)', 'Divorciado (a)', 'Viúvo (a)', 'União Estável', 'Separado (a)']
export const TIPOS_CONTA = ['Corrente', 'Poupança']

export const TIPOS_CADASTRO = {
  'locador-pf': {
    titulo: 'Locador(a) · Pessoa Física',
    descricao: 'Dados pessoais, cônjuge, conta para depósito e imóvel.',
    destino: 'administrativo3@imovit.com.br',
    habilitado: true,
  },
  'locador-pj': {
    titulo: 'Locadora · Pessoa Jurídica',
    descricao: 'Dados da empresa, sócio administrador, conta e imóvel.',
    destino: 'administrativo3@imovit.com.br',
    habilitado: true,
  },
  'locatario-pf': {
    titulo: 'Locatário(a) · Pessoa Física',
    descricao: 'Em breve: os mesmos campos do Google Form.',
    destino: '',
    habilitado: false,
  },
  'locatario-pj': {
    titulo: 'Locatária · Pessoa Jurídica',
    descricao: 'Em breve: os mesmos campos do Google Form.',
    destino: '',
    habilitado: false,
  },
  'fiador-pf': {
    titulo: 'Fiador(a) · Pessoa Física',
    descricao: 'Em breve: dados pessoais, profissionais e referências.',
    destino: 'administrativo@imovit.com.br',
    habilitado: false,
  },
  'fiadora-pj': {
    titulo: 'Fiadora · Pessoa Jurídica',
    descricao: 'Em breve: dados da empresa e do representante.',
    destino: 'pamela@imovit.com.br',
    habilitado: false,
  },
}

const FUNCAO = import.meta.env.VITE_FUNCAO_CADASTRO_LOCADOR || 'cadastro-locador'

/** Envia um cadastro do tipo (o `tipo` diz à função como validar e avisar). */
export const enviarCadastro = (tipo, dados) => chamarFuncao(FUNCAO, { evento: 'enviar', tipo, ...dados })

/** Link direto do formulário de um tipo (para o corretor mandar ao cliente). */
export const linkCadastro = (tipo) => `${window.location.origin}/cadastro/${tipo}`

/** Link do seletor público (quando não se sabe o perfil de quem preenche). */
export const linkCadastros = () => `${window.location.origin}/cadastros`
