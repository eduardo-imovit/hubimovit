// Labels e variantes de badge (badge-{variant} em components.css) pro status da
// proposta e dos documentos da esteira. Fonte única -- antes cada tela (portal,
// Propostas, Esteiras, Processos) tinha seu próprio STATUS_LABEL, divergentes
// entre si, e nenhuma usava cor semântica (tudo badge-gray ou texto puro).

export function valorBR(v) {
  return v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
}

export const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando validação',
  correcao_solicitada: 'Correção pedida',
  aguardando_aprovacao_interna: 'Em revisão interna', // fluxo antigo: só aparece no histórico
  criada: 'Aguardando liberação da esteira',
  aguardando_docs: 'Aguardando documentos',
  docs_em_analise: 'Documentos em análise',
  docs_aprovados: 'Documentos aprovados',
  sincronizada: 'Processo concluído',
  rejeitada: 'Proposta rejeitada',
  expirada: 'Prazo expirado',
}

export const STATUS_VARIANT = {
  aguardando_locatario: 'warning',
  correcao_solicitada: 'danger',
  aguardando_aprovacao_interna: 'info',
  criada: 'info',
  aguardando_docs: 'warning',
  docs_em_analise: 'info',
  docs_aprovados: 'success',
  sincronizada: 'success',
  rejeitada: 'danger',
  expirada: 'danger',
}

export const DOC_STATUS_LABEL = {
  pendente: 'Pendente',
  enviado: 'Em análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado — reenvie',
}

export const DOC_STATUS_VARIANT = {
  pendente: 'gray',
  enviado: 'info',
  aprovado: 'success',
  rejeitado: 'danger',
}

/**
 * Jornada do locatário no portal -- etapas que "destravam" conforme o
 * processo anda. Cadastro e Documentos são etapas separadas, porque pro
 * locatário são duas tarefas distintas, mesmo com o mesmo status (aguardando_docs).
 * `acao`: a etapa pede algo do locatário (merece o aviso de "liberada");
 * sem `acao`, é espera pela equipe.
 */
export const ETAPAS_JORNADA = [
  { chave: 'proposta', label: 'Validação', acao: true, aguardando: 'Confira os termos da proposta e valide.' },
  { chave: 'cadastro', label: 'Cadastro', acao: true, aguardando: 'Complete seu cadastro para liberar os documentos.' },
  { chave: 'documentos', label: 'Documentos', acao: true, aguardando: 'Envie os documentos da lista.' },
  { chave: 'conclusao', label: 'Conclusão', acao: false, aguardando: 'Documentação aprovada. Estamos finalizando seu processo.' },
]

/**
 * Índice da etapa atual da jornada, ou null quando a proposta saiu do fluxo
 * (rejeitada/expirada). Proposta concluída (sincronizada) devolve o total de
 * etapas: tudo feito.
 */
export function etapaJornada(proposta) {
  switch (proposta.status) {
    case 'aguardando_locatario':
    case 'correcao_solicitada': return 0
    case 'criada':
    case 'aguardando_docs': return proposta.tipo_pessoa ? 2 : 1
    case 'docs_em_analise': return 2
    case 'docs_aprovados': return 3
    case 'sincronizada': return ETAPAS_JORNADA.length
    default: return null
  }
}

// aguardando_cliente = proposta de venda esperando a assinatura do proponente
const STATUS_COM_PRAZO = ['aguardando_locatario', 'criada', 'aguardando_docs', 'docs_em_analise', 'docs_aprovados', 'aguardando_cliente']

/** Texto de prazo restante do link da proposta, só pros status onde o prazo ainda importa. */
export function formatarPrazo(linkExpiraEm, status) {
  if (!linkExpiraEm || !STATUS_COM_PRAZO.includes(status)) return null
  const diffMs = new Date(linkExpiraEm).getTime() - Date.now()
  const dias = Math.ceil(diffMs / 86400000)
  if (dias <= 0) return { texto: 'Prazo vence hoje', urgente: true }
  if (dias === 1) return { texto: 'Prazo vence amanhã', urgente: true }
  if (dias <= 2) return { texto: `Prazo vence em ${dias} dias`, urgente: true }
  return { texto: `Prazo: ${dias} dias restantes`, urgente: false }
}
