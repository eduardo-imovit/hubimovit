import { chamarFuncao } from './funcoes'
import { supabase } from './supabaseClient'

/**
 * Distratos (RF29, PRD §5.16): o ADM gera um link por contrato e o locatário
 * envia o aviso de desocupação, o motivo e a pesquisa de satisfação. Tudo
 * passa pela Edge Function `distrato`.
 */
const FUNCAO = import.meta.env.VITE_FUNCAO_DISTRATO || 'distrato'

export const criarDistrato = (contratoCodigo) => chamarFuncao(FUNCAO, { evento: 'criar', contrato_codigo: contratoCodigo })
export const enviarLinkPorEmail = (id) => chamarFuncao(FUNCAO, { evento: 'enviar_link', id })
export const cancelarDistrato = (id) => chamarFuncao(FUNCAO, { evento: 'cancelar', id })
export const abrirDistrato = (token) => chamarFuncao(FUNCAO, { evento: 'abrir', token })
export const enviarAviso = (token, dados) => chamarFuncao(FUNCAO, { evento: 'enviar', token, ...dados })

export async function buscarContratos(busca) {
  const { data, error } = await supabase.rpc('contratos_para_distrato', { busca: busca ?? '' })
  if (error) throw error
  return data ?? []
}

export const linkDistrato = (token) => `${window.location.origin}/distrato/${token}`

export function mensagemWhatsApp(nome, link) {
  const primeiro = (nome ?? '').split(' ')[0]
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da Imovit. Segue o link para o aviso de desocupação do imóvel. Nele estão o procedimento de entrega, o formulário do aviso e uma pesquisa rápida sobre a sua experiência com a gente: ${link}`
}

export function linkWhatsApp(telefone, texto) {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  const numero = digitos && !digitos.startsWith('55') ? `55${digitos}` : digitos
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

// Mesmos nomes do motivo de rescisão do Imoview (para o ADM lançar igual).
export const MOTIVOS = [
  'Mudou de cidade', 'Foi transferido', 'Comprou outro imóvel', 'Alugou outro imóvel',
  'Valor do aluguel', 'Dificuldade financeira', 'Fechou empresa',
  'O proprietário solicitou o imóvel de volta', 'Vencimento do contrato', 'Outro',
]
export const PEDE_COM_QUEM = ['Alugou outro imóvel', 'Comprou outro imóvel']
export const PEDE_FATOR = ['Alugou outro imóvel', 'Valor do aluguel']

export const COM_QUEM = [
  { valor: 'imovit', label: 'Com a Imovit' },
  { valor: 'outra_imobiliaria', label: 'Com outra imobiliária' },
  { valor: 'proprietario_direto', label: 'Direto com o proprietário' },
]
export const FATORES = [
  { valor: 'preco', label: 'Preço' },
  { valor: 'tamanho', label: 'Tamanho' },
  { valor: 'localizacao', label: 'Localização' },
  { valor: 'estado_imovel', label: 'Estado do imóvel' },
  { valor: 'outro', label: 'Outro' },
]
export const AREAS = [
  { chave: 'atendimento', label: 'Atendimento da equipe' },
  { chave: 'manutencao', label: 'Manutenção e reparos' },
  { chave: 'financeiro', label: 'Financeiro (boletos, repasses, reajustes)' },
  { chave: 'comunicacao', label: 'Comunicação e prazo de resposta' },
  { chave: 'estado_entrada', label: 'Estado do imóvel na entrada' },
]
export const ALUGARIA = [
  { valor: 'sim', label: 'Sim' },
  { valor: 'talvez', label: 'Talvez' },
  { valor: 'nao', label: 'Não' },
]

export const rotulo = (lista, valor) => lista.find((i) => i.valor === valor)?.label ?? valor ?? '—'

// Procedimento de desocupação (PDF "PROCEDIMENTO DESOCUPAÇÃO"), adaptado ao link (D6, 14/10).
export const PROCEDIMENTO = [
  'O aviso de desocupação deve ser enviado com no mínimo 30 dias de antecedência. Enviar este formulário vale como o aviso oficial: a data e a hora do envio ficam registradas.',
  'O imóvel deverá ser entregue livre de objetos e coisas, em boas condições de higiene e limpeza, e com todos os seus utensílios e equipamentos funcionando (no caso de mobiliado).',
  'As chaves internas deverão ser deixadas nas respectivas portas. Caso seja necessária a pintura do imóvel, ela já deverá ser feita antes da entrega das chaves, evitando a cobrança de dias adicionais de aluguel e encargos.',
  'A vistoria final deverá ser agendada após os procedimentos acima, com o imóvel totalmente desocupado, acompanhada pelo locatário e pelo locador (caso queira). O vistoriador informará às partes qualquer reparo necessário. A vistoria de saída só é realizada de segunda a sexta-feira, com agendamento prévio.',
  'Havendo pendência na vistoria, com reparos a fazer no imóvel, o locatário deverá solicitar uma nova vistoria após finalizar a manutenção. Será cobrada uma taxa de R$ 150,00 (cento e cinquenta reais).',
  'Após a vistoria final, o laudo será encaminhado ao proprietário do imóvel, para que ele aprove e libere o imóvel para darmos início ao processo de rescisão. A reprovação pelo proprietário obriga o locatário a sanar as pendências para então seguirmos com a rescisão.',
  'Com a vistoria aprovada pelo proprietário, o locatário deverá dirigir-se à Imovit para entregar as chaves e os documentos abaixo, para dar início ao processo de rescisão.',
]
export const DOCUMENTOS_SAIDA = [
  'Três últimas contas e comprovantes de pagamento da CPFL, Sanasa e gás (caso não seja incluso no condomínio).',
  'Três últimos boletos e recibos de pagamento do condomínio e a carta de quitação expedida pela administradora (CND).',
  'Controle remoto da(s) garagem(ns), tags de acesso, chave/cartão do carrinho ou identificação do condomínio, quando for o caso.',
]
export const AVISO_MULTA = 'Caso o período do aviso prévio não seja cumprido, será cobrado o valor de 1 (um) mês de aluguel e demais encargos da locação, de forma integral.'

export const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
export const fmtDataHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—')

export function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Situação para a tela do ADM: o "expirado" é calculado. */
export function situacao(d) {
  if (d.status === 'aviso_recebido') return { chave: 'recebido', label: 'Aviso recebido', badge: 'badge-success' }
  if (d.status === 'cancelado') return { chave: 'cancelado', label: 'Cancelado', badge: 'badge-gray' }
  if (d.expira_em && new Date(d.expira_em) < new Date()) return { chave: 'expirado', label: 'Link expirado', badge: 'badge-danger' }
  return { chave: 'aguardando', label: 'Link enviado', badge: 'badge-warning' }
}

/** NPS = % promotores (9–10) − % detratores (0–6). */
export function calcularNps(notas) {
  const v = notas.filter((n) => n != null)
  if (!v.length) return null
  const prom = v.filter((n) => n >= 9).length
  const det = v.filter((n) => n <= 6).length
  return Math.round(((prom - det) / v.length) * 100)
}
