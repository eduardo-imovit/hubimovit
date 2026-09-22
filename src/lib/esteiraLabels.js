// Labels e variantes de badge (badge-{variant} em components.css) pro status da
// proposta e dos documentos da esteira. Fonte única -- antes cada tela (portal,
// Propostas, Esteiras, Processos) tinha seu próprio STATUS_LABEL, divergentes
// entre si, e nenhuma usava cor semântica (tudo badge-gray ou texto puro).

export const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando seus dados',
  aguardando_aprovacao_interna: 'Em revisão interna',
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

/** Ordem "feliz" do fluxo, pra indicador de progresso -- estados terminais (rejeitada/expirada) não entram aqui. */
export const PASSOS_FLUXO = [
  { status: 'aguardando_locatario', label: 'Proposta' },
  { status: 'aguardando_aprovacao_interna', label: 'Aprovação' },
  { status: 'aguardando_docs', label: 'Documentos' },
  { status: 'docs_em_analise', label: 'Análise' },
  { status: 'sincronizada', label: 'Concluído' },
]

/** Mapeia um status_efetivo pro índice do passo correspondente em PASSOS_FLUXO (docs_aprovados/criada contam como o passo seguinte mais próximo). */
export function passoAtual(status) {
  const equivalencias = { criada: 'aguardando_docs', docs_aprovados: 'docs_em_analise' }
  const alvo = equivalencias[status] ?? status
  const idx = PASSOS_FLUXO.findIndex((p) => p.status === alvo)
  return idx === -1 ? null : idx
}

const STATUS_COM_PRAZO = ['aguardando_locatario', 'aguardando_aprovacao_interna', 'criada', 'aguardando_docs', 'docs_em_analise', 'docs_aprovados']

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
