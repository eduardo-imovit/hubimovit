import { useEffect, useMemo } from 'react'
import { usePlantao } from '../../hooks/usePlantao'

const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TURNOS = [
  { chave: 'manha', rotulo: 'Manhã' },
  { chave: 'tarde', rotulo: 'Tarde' },
  { chave: 'dia_inteiro', rotulo: 'Dia inteiro' },
]
const ATUALIZAR_MS = 10 * 60 * 1000

/** "Rachel Bittencourt" → "Rachel Bittencourt"; "Ana Celia de Sousa Andrade" → "Ana Andrade". */
function nomeCurto(nome) {
  const partes = (nome ?? '').trim().split(/\s+/)
  return partes.length <= 2 ? partes.join(' ') : `${partes[0]} ${partes.at(-1)}`
}

/** Os próximos `n` dias corridos a partir de `inicioISO` (inclusive), fim de semana incluído. */
function proximosDias(inicioISO, n = 5) {
  const d = new Date(`${inicioISO}T12:00:00`)
  return Array.from({ length: n }, (_, i) => {
    const dia = new Date(d)
    dia.setDate(d.getDate() + i)
    return dia.toLocaleDateString('en-CA')
  })
}

/**
 * Plantão dos próximos 5 dias (fim de semana incluído) para a TV Display, em 5
 * colunas (docs/01-prd.md §5.3). Começa sempre em hoje, que fica em destaque;
 * os outros dias ficam esmaecidos. Fim de semana é plantão do dia inteiro.
 * Relê a cada 10 minutos, para uma escala importada aparecer sem reiniciar a TV.
 */
export default function PlantaoSemanalTV({ hojeISO }) {
  const dias = useMemo(() => proximosDias(hojeISO), [hojeISO])
  const { plantoes, recarregar } = usePlantao(dias[0], dias[4])

  useEffect(() => {
    const timer = setInterval(recarregar, ATUALIZAR_MS)
    return () => clearInterval(timer)
  }, [recarregar])

  const ativos = plantoes.filter((p) => p.status !== 'cancelado')
  const destaque = dias[0]
  const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">
        🏠 Plantão — próximos dias · {ddmm(dias[0])} a {ddmm(dias[4])}
      </div>

      <div className="plantao-tv-grid">
        {dias.map((diaISO) => {
          const doDia = ativos.filter((p) => p.data === diaISO)
          const ehHoje = diaISO === hojeISO
          return (
            <div className={`plantao-tv-dia${diaISO === destaque ? ' is-destaque' : ''}${ehHoje ? ' is-hoje' : ''}`} key={diaISO}>
              <div className="plantao-tv-dia-nome">
                {ehHoje ? 'Hoje' : NOMES_DIA[new Date(`${diaISO}T12:00:00`).getDay()]} <span>{ddmm(diaISO)}</span>
              </div>
              {doDia.length === 0 && <div className="plantao-tv-vazio">sem escala</div>}
              {TURNOS.map((t) =>
                doDia
                  .filter((p) => p.turno === t.chave)
                  .map((p) => (
                    <div className="plantao-tv-item" key={p.id}>
                      <span className="plantao-tv-turno">{t.rotulo}</span>
                      <span className="plantao-tv-nome">{nomeCurto(p.corretor_nome)}</span>
                    </div>
                  ))
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
