import { createPortal } from 'react-dom'

/**
 * Renderiza direto em document.body, fora da árvore do componente que chamou.
 * Necessário porque .card:hover aplica `transform`, e um ancestral com transform
 * vira containing block de descendentes `position: fixed` -- um modal renderizado
 * dentro de um card prende o overlay dentro dos limites do card em vez da tela
 * inteira. Portal resolve isso pra qualquer ancestral, não só .card.
 */
export default function ModalPortal({ children }) {
  return createPortal(children, document.body)
}
