import { TIPOS_PLANTAO } from '../../lib/tiposPlantao'

/** Etiqueta do tipo de plantão: cor + ícone + rótulo. `compacta` mostra só o ícone e a cor (o rótulo fica no title). */
export default function TagPlantao({ tipo, compacta = false }) {
  const t = TIPOS_PLANTAO[tipo] ?? TIPOS_PLANTAO.venda
  return (
    <span className={`plantao-tag plantao-tag--${tipo}${compacta ? ' is-compacta' : ''}`} title={`Plantão de ${t.rotulo.toLowerCase()}`}>
      <span aria-hidden="true">{t.icone}</span>
      {compacta ? <span className="sr-only">{t.rotulo}</span> : <span>{t.rotulo}</span>}
    </span>
  )
}
