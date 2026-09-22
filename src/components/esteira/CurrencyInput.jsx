import { useEffect, useState } from 'react'

function centavosParaValor(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Input de valor em reais que formata "R$ 1.234,56" enquanto digita (mesmo
 * padrão de apps bancários: cada dígito novo entra pela direita, empurrando
 * os centavos). Value/onChange trabalham com número puro (ex: 1234.56) --
 * o componente só cuida da máscara visual.
 */
export default function CurrencyInput({ id, value, onChange, required, placeholder = 'R$ 0,00' }) {
  const [centavos, setCentavos] = useState(() => Math.round((Number(value) || 0) * 100))

  useEffect(() => {
    const novo = Math.round((Number(value) || 0) * 100)
    setCentavos((atual) => (novo === atual ? atual : novo))
  }, [value])

  function handleChange(e) {
    const digitos = e.target.value.replace(/\D/g, '')
    const novosCentavos = digitos ? Math.min(parseInt(digitos, 10), Number.MAX_SAFE_INTEGER) : 0
    setCentavos(novosCentavos)
    onChange(novosCentavos / 100)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      required={required}
      placeholder={placeholder}
      value={centavos ? centavosParaValor(centavos) : ''}
      onChange={handleChange}
    />
  )
}
