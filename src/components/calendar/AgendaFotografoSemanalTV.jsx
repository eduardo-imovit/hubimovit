import { useAgendamentosFotografo } from '../../hooks/useAgendamentosFotografo'

// dia_semana segue Date.getDay(): 0=Domingo...6=Sabado. So os dias com agenda do fotografo.
const DIAS_UTEIS = [
  { dia: 2, nome: 'Terça' },
  { dia: 3, nome: 'Quarta' },
  { dia: 5, nome: 'Sexta' },
]

export default function AgendaFotografoSemanalTV() {
  const { blocos, carregando } = useAgendamentosFotografo()

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">📷 Agenda do Fotógrafo — Semana</div>

      {!carregando && (
        <div className="agenda-fotografo-tv-grid">
          {DIAS_UTEIS.map(({ dia, nome }) => {
            const blocosDoDia = blocos
              .filter((b) => b.dia_semana === dia)
              .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

            return (
              <div className="agenda-fotografo-tv-dia" key={dia}>
                <div className="agenda-fotografo-tv-dia-nome">{nome}</div>
                {blocosDoDia.length === 0 && <div className="agenda-fotografo-tv-vazio">—</div>}
                {blocosDoDia.map((b) => (
                  <div className="agenda-fotografo-tv-bloco" key={b.id}>
                    <div className="agenda-fotografo-tv-bloco-corretor">{b.corretor_nome}</div>
                    <div className="agenda-fotografo-tv-bloco-hora">
                      {b.hora_inicio.slice(0, 5)}–{b.hora_fim.slice(0, 5)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
