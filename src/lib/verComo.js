// "Ver como" (só Gestão): o Hub inteiro passa a aparecer como para outro nível
// ou para um corretor específico (menu, Home, Meus números, Kanban). É uma
// prévia de tela: os dados continuam sendo os que a conta da Gestão pode ler, e
// as páginas filtram para o corretor escolhido. A trava de verdade do corretor
// é a RLS (testada no banco). Fica na aba (sessionStorage) até sair da prévia.

const CHAVE = 'hub:ver-como'
export const EVENTO_VER_COMO = 'hub:ver-como'

/** { role, nome?, email? } ou null. */
export function lerVerComo() {
  try {
    const valor = sessionStorage.getItem(CHAVE)
    return valor ? JSON.parse(valor) : null
  } catch {
    return null
  }
}

export function definirVerComo(previa) {
  try {
    if (previa) sessionStorage.setItem(CHAVE, JSON.stringify(previa))
    else sessionStorage.removeItem(CHAVE)
  } catch {
    // sem sessionStorage (aba privada restrita): a prévia simplesmente não persiste
  }
  window.dispatchEvent(new Event(EVENTO_VER_COMO))
}

/**
 * Nome do corretor como aparece no atendimento do CRM, com o mesmo ajuste da
 * vw_atendimentos_base e da função nome_corretor_crm() do banco.
 */
export const nomeCorretorCrm = (bruto) => {
  const nome = (bruto ?? '').trim()
  return nome === 'Gabriel Simon C' ? 'Gabriel Simon' : nome
}
