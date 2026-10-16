import { useEffect, useState } from 'react'

const TEMPO_POR_PAINEL_MS = 15000

/**
 * Carrossel de painéis do rodapé da TV Display: mostra um painel por vez e
 * troca sozinho a cada 15 s, em ciclo. Clicar numa barrinha do indicador vai
 * direto para aquele painel e recomeça a contagem dele (16/10). Todos os painéis ficam montados na
 * mesma célula de grid (só a opacidade muda), então a altura do rodapé é a
 * do painel mais alto e não "pula" na troca, e cada painel mantém seus dados
 * carregados entre uma volta e outra.
 *
 * `paineis`: [{ chave, rotulo, conteudo }]
 */
export default function CarrosselRodapeTV({ paineis }) {
  const [indice, setIndice] = useState(0)
  const total = paineis.length

  // `volta` muda a cada troca (automática ou por clique): reinicia o tempo e a barra
  const [volta, setVolta] = useState(0)
  useEffect(() => {
    if (total <= 1) return undefined
    const timer = setTimeout(() => {
      setIndice((i) => (i + 1) % total)
      setVolta((v) => v + 1)
    }, TEMPO_POR_PAINEL_MS)
    return () => clearTimeout(timer)
  }, [total, volta])

  const irPara = (i) => {
    setIndice(i)
    setVolta((v) => v + 1)
  }

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
        <div className="tv-carrossel-indicador" role="tablist" aria-label="Painéis do rodapé">
          {paineis.map((p, i) => (
            <button key={p.chave} type="button" role="tab" aria-selected={i === atual}
              className={`tv-carrossel-passo${i === atual ? ' is-ativo' : ''}`} onClick={() => irPara(i)}>
              <span className="tv-carrossel-passo-rotulo">{p.rotulo}</span>
              <span className="tv-carrossel-passo-trilho">
                {/* key muda a cada troca: reinicia a animação da barra do painel ativo */}
                {i === atual && <span key={volta} className="tv-carrossel-passo-barra" style={{ animationDuration: `${TEMPO_POR_PAINEL_MS}ms` }} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
