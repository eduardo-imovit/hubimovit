import { chamarFuncao } from './funcoes'

/**
 * Captação de imóvel (RF23, PRD §5.7): opções do formulário, iguais às do Tally
 * "Acompanhamento personalizado". O texto da declaração vem da Edge Function
 * `captacao` (é o que fica gravado junto da assinatura).
 */
export const TIPOS_IMOVEL = ['Apartamento', 'Apartamento duplex', 'Apartamento Garden', 'Casa de rua', 'Casa de condomínio', 'Cobertura', 'Comercial', 'Loft', 'Sítio', 'Terreno']
export const FINALIDADES = ['Venda', 'Locação', 'Ambos']
export const PERIODOS_EXCLUSIVIDADE = ['30 dias', '90 dias', '180 dias', '1 ano']
export const QUARTOS = ['1', '2', '3', '4', '5 ou mais']
export const SUITES = ['0', '1', '2', '3', '4', '5 ou mais']
export const BANHEIROS = ['1', '2', '3', '4', '5 ou mais']
export const SALAS = ['1', '2', '3', '4 ou mais']
export const VAGAS = ['0', '1', '2', '3', '4 ou mais']
export const TIPOS_VAGA = ['Coberta', 'Livre', 'Ambas']
export const LAZER = ['Academia', 'Churrasqueira', 'Hidromassagem', 'Home cinema', 'Piscina', 'Playground', 'Quadra poliesportiva', 'Quadra de tênis', 'Sala de massagem', 'Salão de festas', 'Salão de jogos', 'Sauna', 'Espaço gourmet', 'Garage band', 'Quadra de squash', 'Quadra de beach tênis']

export const carregarFormularioCaptacao = (token) => chamarFuncao('captacao', { evento: 'formulario', token })
export const enviarCaptacao = (dados) => chamarFuncao('captacao', { evento: 'enviar', ...dados })

/** Link fixo de captação de um corretor (código aleatório de captacao_links). */
export const linkCaptacao = (token) => `${window.location.origin}/captacao/${token}`

/** Nome e WhatsApp do consultor dono do código (cartão da Apresentação Imovit). */
export const carregarConsultor = (token) => chamarFuncao('captacao', { evento: 'consultor', token })

/** Apresentação Imovit personalizada do corretor (mesmo código da captação). */
export const linkApresentacao = (token) => `${window.location.origin}/apresentacao/${token}`

export const SITE_CASADEZOITO = 'https://www.casadezoito.com.br/'
