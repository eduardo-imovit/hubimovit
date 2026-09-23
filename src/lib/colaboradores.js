import { chamarFuncao } from './funcoes'

/** Ações da Gestão sobre colaboradores (Edge Function gestao-colaboradores). */
export const suspenderColaborador = (perfil_id) => chamarFuncao('gestao-colaboradores', { acao: 'suspender', perfil_id })
export const reativarColaborador = (perfil_id) => chamarFuncao('gestao-colaboradores', { acao: 'reativar', perfil_id })
export const excluirColaborador = (perfil_id) => chamarFuncao('gestao-colaboradores', { acao: 'excluir', perfil_id })
