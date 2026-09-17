import { useState } from 'react'
import { dataComemorativaOcorreEm } from '../../lib/calendario'

function diasNoIntervalo(inicioISO, fimISO) {
  const dias = []
  let atual = new Date(`${inicioISO}T12:00:00`)
  const fim = new Date(`${fimISO}T12:00:00`)
  while (atual <= fim) {
    dias.push(atual.toLocaleDateString('en-CA'))
    atual.setDate(atual.getDate() + 1)
  }
  return dias
}

/** Dropdown do calendário: alterna entre datas comemorativas e a agenda do fotógrafo do período visível. */
export default function AgendaDropdown({ datasComemorativas, blocosFotografo, inicioISO, fimISO }) {
  const [aba, setAba] = useState('datas')

  const dias = diasNoIntervalo(inicioISO, fimISO)
  const ocorrenciasDatas = []
  for (const dia of dias) {
    for (const dc of datasComemorativas) {
      if (dataComemorativaOcorreEm(dc, dia)) ocorrenciasDatas.push({ ...dc, ocorrenciaISO: dia })
    }
  }
  ocorrenciasDatas.sort((a, b) => a.ocorrenciaISO.localeCompare(b.ocorrenciaISO))

  const ocorrenciasFotografo = [...blocosFotografo].sort(
    (a, b) => a.ocorrenciaISO.localeCompare(b.ocorrenciaISO) || a.hora_inicio.localeCompare(b.hora_inicio),
  )

  const contagem = aba === 'datas' ? ocorrenciasDatas.length : ocorrenciasFotografo.length

  return (
    <details className="dc-dropdown">
      <summary>📅 Agenda do período{contagem > 0 ? ` (${contagem})` : ''}</summary>
      <div className="dc-dropdown-panel">
        <div className="segmented" style={{ marginBottom: 'var(--space-2)' }}>
          <button type="button" className={aba === 'datas' ? 'is-active' : ''} onClick={() => setAba('datas')}>
            Datas comemorativas
          </button>
          <button type="button" className={aba === 'fotografo' ? 'is-active' : ''} onClick={() => setAba('fotografo')}>
            Calendário do fotógrafo
          </button>
        </div>

        {aba === 'datas' && (
          <>
            {ocorrenciasDatas.length === 0 && (
              <div className="dc-dropdown-item" style={{ color: 'var(--grafite-soft)' }}>Nenhuma data neste período.</div>
            )}
            {ocorrenciasDatas.map((o) => (
              <div className="dc-dropdown-item" key={`${o.id}-${o.ocorrenciaISO}`}>
                <span>{o.emoji ?? '🎉'} {o.nome}</span>
                <span className="dc-dropdown-date">{o.ocorrenciaISO.slice(8, 10)}/{o.ocorrenciaISO.slice(5, 7)}</span>
              </div>
            ))}
          </>
        )}

        {aba === 'fotografo' && (
          <>
            {ocorrenciasFotografo.length === 0 && (
              <div className="dc-dropdown-item" style={{ color: 'var(--grafite-soft)' }}>Nenhum bloco neste período.</div>
            )}
            {ocorrenciasFotografo.map((o) => (
              <div className="dc-dropdown-item" key={`${o.id}-${o.ocorrenciaISO}`}>
                <span>📷 {o.corretor_nome}</span>
                <span className="dc-dropdown-date">
                  {o.ocorrenciaISO.slice(8, 10)}/{o.ocorrenciaISO.slice(5, 7)} · {o.hora_inicio.slice(0, 5)}–{o.hora_fim.slice(0, 5)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </details>
  )
}
