import { useMemo } from 'react'
import { useAvisos } from './useAvisos'
import { useDatasComemorativas } from './useDatasComemorativas'
import { useColaboradores } from './useColaboradores'
import { useAgendamentosFotografo } from './useAgendamentosFotografo'
import { blocosFotografoNoIntervalo, dataComemorativaOcorreEm, reunioesRecorrentesNoIntervalo } from '../lib/calendario'

/**
 * Eventos do calendário da Home num intervalo de datas (inclusive): reuniões
 * recorrentes, avisos com data, agenda do fotógrafo, datas comemorativas e
 * datas da equipe (aniversário e tempo de casa). Fonte única pro calendário
 * da Home e pra agenda de eventos da TV Display.
 *
 * `eventosPorDia`: { 'AAAA-MM-DD': [{ id, hora, titulo, sub, cor, tipo }] }, ordenado por hora.
 */
export function useEventosCalendario(inicioISO, fimISO) {
  const { avisos } = useAvisos()
  const { datas: datasComemorativas } = useDatasComemorativas()
  const { colaboradores } = useColaboradores()
  const { blocos: blocosFotografo } = useAgendamentosFotografo()

  const datasEquipe = useMemo(() => {
    const datas = []
    for (const c of colaboradores) {
      if (c.data_nascimento) {
        datas.push({ id: `aniv-${c.id_corretor_crm}`, nome: `Aniversário — ${c.nome_completo}`, data: c.data_nascimento, recorrente_anual: true, emoji: '🎂', removivel: false })
      }
      if (c.data_admissao) {
        datas.push({ id: `admissao-${c.id_corretor_crm}`, nome: `Empresa — ${c.nome_completo}`, data: c.data_admissao, recorrente_anual: true, emoji: '🏢', removivel: false })
      }
    }
    return datas
  }, [colaboradores])

  const datasFaixa = useMemo(() => [...datasComemorativas, ...datasEquipe], [datasComemorativas, datasEquipe])

  const reunioesRecorrentes = useMemo(
    () => reunioesRecorrentesNoIntervalo(inicioISO, fimISO),
    [inicioISO, fimISO],
  )

  const ocorrenciasFotografo = useMemo(
    () => blocosFotografoNoIntervalo(blocosFotografo, inicioISO, fimISO),
    [blocosFotografo, inicioISO, fimISO],
  )

  const eventosPorDia = useMemo(() => {
    const mapa = {}
    for (const r of reunioesRecorrentes) {
      const item = { id: r.id, hora: r.hora, titulo: r.titulo, sub: null, cor: 'var(--info)', tipo: 'reuniao' }
      mapa[r.dataISO] = mapa[r.dataISO] ? [...mapa[r.dataISO], item] : [item]
    }
    for (const a of avisos) {
      if (!a.data_referencia) continue
      const item = { id: a.id, hora: `${a.data_referencia}T08:00:00`, titulo: a.titulo, sub: null, cor: 'var(--champagne)', tipo: 'aviso' }
      mapa[a.data_referencia] = mapa[a.data_referencia] ? [...mapa[a.data_referencia], item] : [item]
    }
    for (const f of ocorrenciasFotografo) {
      const item = {
        id: f.id,
        hora: `${f.ocorrenciaISO}T${f.hora_inicio}`,
        titulo: `📷 ${f.corretor_nome}`,
        sub: `${f.hora_inicio.slice(0, 5)}–${f.hora_fim.slice(0, 5)}`,
        cor: 'var(--ninho-cheio)',
        tipo: 'fotografo',
      }
      mapa[f.ocorrenciaISO] = mapa[f.ocorrenciaISO] ? [...mapa[f.ocorrenciaISO], item] : [item]
    }
    let dia = new Date(`${inicioISO}T12:00:00`)
    const fim = new Date(`${fimISO}T12:00:00`)
    while (dia <= fim) {
      const diaISO = dia.toLocaleDateString('en-CA')
      for (const dc of datasFaixa) {
        if (dataComemorativaOcorreEm(dc, diaISO)) {
          const item = { id: dc.id, hora: `${diaISO}T00:00:00`, titulo: `${dc.emoji ?? '🎉'} ${dc.nome}`, sub: null, cor: 'var(--coral)', tipo: 'data-comemorativa' }
          mapa[diaISO] = mapa[diaISO] ? [...mapa[diaISO], item] : [item]
        }
      }
      dia.setDate(dia.getDate() + 1)
    }
    for (const chave of Object.keys(mapa)) {
      mapa[chave].sort((a, b) => a.hora.localeCompare(b.hora))
    }
    return mapa
  }, [reunioesRecorrentes, avisos, ocorrenciasFotografo, datasFaixa, inicioISO, fimISO])

  return { eventosPorDia, datasFaixa, ocorrenciasFotografo }
}
