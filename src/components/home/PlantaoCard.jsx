import { usePlantao } from '../../hooks/usePlantao'
import { diasDaSemana, formatarDiaCurto, hojeISO, inicioDaSemanaISO } from '../../lib/dateUtils'

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', dia_inteiro: 'Dia inteiro' }

export default function PlantaoCard() {
  const inicioSemana = inicioDaSemanaISO()
  const dias = diasDaSemana(inicioSemana)
  const fimSemana = dias[6]
  const hoje = hojeISO()

  const { plantoes, carregando, erro } = usePlantao(inicioSemana, fimSemana)

  return (
    <div>
      {erro && <div className="hub-error">Não foi possível carregar o plantão: {erro}</div>}

      <div className="plantao-week">
        {dias.map((dia) => {
          const doDia = plantoes.filter((p) => p.data === dia && p.status !== 'cancelado')
          return (
            <div className={`plantao-day${dia === hoje ? ' is-today' : ''}`} key={dia}>
              <div className="plantao-day-label">{formatarDiaCurto(dia)}</div>
              {carregando && <div className="plantao-empty">…</div>}
              {!carregando && doDia.length === 0 && <div className="plantao-empty">Sem plantão</div>}
              {doDia.map((p) => (
                <span key={p.id} className={`plantao-slot is-${p.status}`}>
                  {p.corretor_nome.split(' ')[0]} · {TURNO_LABEL[p.turno]}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
