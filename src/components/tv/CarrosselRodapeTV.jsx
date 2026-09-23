import { useEffect, useState } from 'react'

const TEMPO_POR_PAINEL_MS = 15000

/**
 * Carrossel de painéis do rodapé da TV Display: mostra um painel por vez e
 * troca sozinho a cada 15 s, em ciclo. Todos os painéis ficam montados na
 * mesma célula de grid (só a opacidade muda), então a altura do rodapé é a
 * do painel mais alto e não "pula" na troca, e cada painel mantém seus dados
 * carregados entre uma volta e outra.
 *
 * `paineis`: [{ chave, rotulo, conteudo }]
 */
export default function CarrosselRodapeTV({ paineis }) {
  const [indice, setIndice] = useState(0)
  const total = paineis.length

  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(() => setIndice((i) => (i + 1) % total), TEMPO_POR_PAINEL_MS)
    return () => clearInterval(timer)
  }, [total])

  const atual = indice % Math.max(total, 1)

  return (
    <div className="tv-carrossel">
      <div className="tv-carrossel-paineis">
        {paineis.map((p, i) => (
          <div key={p.chave} className={`tv-carrossel-painel${i === atual ? ' is-ativo' : ''}`} aria-hidden={i !== atual}>
            {p.conteudo}
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className="tv-carrossel-indicador" aria-hidden="true">
          {paineis.map((p, i) => (
            <span key={p.chave} className={`tv-carrossel-passo${i === atual ? ' is-ativo' : ''}`}>
              <span className="tv-carrossel-passo-rotulo">{p.rotulo}</span>
              <span className="tv-carrossel-passo-trilho">
                {/* key muda a cada troca: reinicia a animação da barra do painel ativo */}
                {i === atual && <span key={indice} className="tv-carrossel-passo-barra" style={{ animationDuration: `${TEMPO_POR_PAINEL_MS}ms` }} />}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
