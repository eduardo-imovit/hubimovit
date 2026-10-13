import { chamarFuncao } from './funcoes'

/**
 * Cadastro Locador PF (RF28, PRD §5.15): mesmos campos do Google Form
 * "Cadastro Locador(a) - Pessoa Física". Envio pela Edge Function
 * `cadastro-locador`, que grava e avisa administrativo3@.
 */
export const ESTADOS_CIVIS = ['Solteiro (a)', 'Casado (a)', 'Divorciado (a)', 'Viúvo (a)', 'União Estável', 'Separado (a)']
export const TIPOS_CONTA = ['Corrente', 'Poupança']

const FUNCAO = import.meta.env.VITE_FUNCAO_CADASTRO_LOCADOR || 'cadastro-locador'

export const enviarCadastroLocador = (dados) => chamarFuncao(FUNCAO, { evento: 'enviar', ...dados })

/** Link fixo do cadastro (rota pública, sem token). */
export const linkCadastroLocador = () => `${window.location.origin}/cadastro-locador`
