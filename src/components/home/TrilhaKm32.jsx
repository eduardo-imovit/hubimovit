import { useEffect, useState } from 'react'
import { useCampanha } from '../../hooks/useCampanha'
import {
  SLUG_KM32, KM_INICIO, KM_FIM, FINALIDADES_KM32 as ABAS, DIA_MS, dataLocal, moeda, km, pct, pctTexto,
  paradasDa, campanhaNoAr, leituraFinalidade,
} from '../../lib/campanhaKm32'

// Campanha Km 32 na Home (RF25, PRD §5.9). Os números vêm de campanha_resumo(),
// que soma os negócios realizados no CRM (jornada do atendimento) dentro do
// período da campanha. Nada é digitado nem fica no código. A régua (meta do
// mês, esperado até hoje) fica em lib/campanhaKm32, a mesma da TV Display.

export function TrilhaKm32() {
  const { dados, erro, carregando } = useCampanha(SLUG_KM32)
  const [aba, setAba] = useState('Venda')
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    if (!dados) return undefined
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [dados])

  if (erro) {
    return (
      <section className="km32 km32--aviso" aria-label="Campanha">
        <p className="km32-l">Não foi possível carregar a campanha agora.</p>
      </section>
    )
  }
  // campanha inexistente, inativa ou fora do período: o bloco não aparece
  if (!carregando && !campanhaNoAr(dados)) return null

  const f = dados?.finalidades?.[aba]
  const l = f ? leituraFinalidade(dados, f) : null
  const progresso = l?.progresso ?? 0
  const paradas = dados ? paradasDa(dados.inicio, dados.fim) : []
  const abaAtual = ABAS.find((a) => a.chave === aba)
  const { tempo = 0, esperado, diferenca, noRitmo, diasCampanha, diasPassados, porDia, metaMes, valorMes, batida } = l ?? {}

  const leitura = dados?.ultima_leitura ? new Date(dados.ultima_leitura) : null
  const atrasado = leitura && (dataLocal(dados.hoje) - new Date(leitura.getFullYear(), leitura.getMonth(), leitura.getDate())) / DIA_MS > 1
  const inicioTexto = dados ? dataLocal(dados.inicio).toLocaleDateString('pt-BR') : ''

  return (
    <section className="km32" aria-labelledby="km32-titulo" aria-busy={carregando}>
      <div className="km32-topo">
        <div>
          <div className="km32-label">{dados?.nome ?? 'Campanha'}</div>
          <h2 id="km32-titulo" className="km32-titulo">Km {km(progresso)} <span>de {KM_FIM}</span></h2>
        </div>
        <div className="km32-abas" role="tablist" aria-label="Meta">
          {ABAS.map((a) => (
            <button key={a.chave} type="button" role="tab" aria-selected={aba === a.chave}
              className={aba === a.chave ? 'is-ativa' : ''} onClick={() => setAba(a.chave)}>
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="km32-trilha" role="img"
        aria-label={f ? `${pctTexto(progresso)} da meta de ${abaAtual.rotulo.toLowerCase()}; ${pctTexto(tempo)} da campanha já passou` : 'Carregando a campanha'}>
        <div className="km32-track">
          <div className="km32-fill" style={{ width: montado ? pct(progresso) : 0 }} />
          {paradas.map((p) => (
            <span key={p.mes} className={`km32-parada${p.fracao === 1 ? ' is-chegada' : ''}`} style={{ left: pct(p.fracao) }}
              title={f ? `${p.mes}: meta acumulada de ${moeda(aba, f.meta_valor * p.fracao)}` : p.mes} />
          ))}
          {dados && <span className="km32-hoje" style={{ left: pct(tempo) }} title="Onde o calendário está hoje" />}
          <span className="km32-corredor" style={{ left: montado ? pct(progresso) : 0 }} />
        </div>
        <div className="km32-escala">
          <span style={{ left: 0 }}>Km {KM_INICIO}<small>largada</small></span>
          {paradas.map((p) => (
            <span key={p.mes} style={{ left: pct(p.fracao) }}>Km {km(p.fracao)}<small>{p.mes}{p.fracao === 1 ? ' · chegada' : ''}</small></span>
          ))}
        </div>
      </div>

      {f && (
        <div className="km32-numeros">
          <div title={`Na campanha: ${moeda(aba, f.valor)} de ${moeda(aba, f.meta_valor)} (${pctTexto(progresso)})`}>
            <span className="km32-n">{moeda(aba, valorMes)}</span>
            <span className="km32-l">
              de {moeda(aba, metaMes.valor)} · meta de {metaMes.mes} · {pctTexto(Math.min(1, valorMes / metaMes.valor))}
            </span>
          </div>
          <div title={`Meta da campanha ÷ ${diasCampanha} dias = ${moeda(aba, porDia)} por dia, somados até hoje`}>
            {batida ? (
              <>
                <span className="km32-n">Meta batida</span>
                <span className="km32-l">{moeda(aba, f.valor)} de {moeda(aba, f.meta_valor)}</span>
              </>
            ) : (
              <>
                <span className={`km32-n${!noRitmo && diferenca < 0 ? ' is-falta' : ''}`}>{moeda(aba, esperado)}</span>
                <span className="km32-l">
                  esperado até hoje · {diasPassados} de {diasCampanha} dias × {moeda(aba, porDia)}
                </span>
                <span className="km32-l">
                  {noRitmo ? (
                    <strong>no ritmo esperado</strong>
                  ) : diferenca > 0 ? (
                    <strong>{moeda(aba, diferenca)} acima do esperado</strong>
                  ) : (
                    <strong className="is-atras">{moeda(aba, -diferenca)} abaixo do esperado</strong>
                  )}
                </span>
              </>
            )}
          </div>
          {f.em_proposta != null && (
            <div>
              <span className="km32-n">{moeda(aba, f.em_proposta)}</span>
              <span className="km32-l" title="Propostas em análise no CRM, com interação nos últimos 30 dias">
                em proposta · {f.propostas} {f.propostas === 1 ? 'ativa' : 'ativas'} (30 dias)
              </span>
            </div>
          )}
        </div>
      )}

      {dados && (
        <p className="km32-rodape">
          {f && f.negocios === 0 && `A largada foi dada em ${inicioTexto}. Nenhum negócio realizado ainda. `}
          {f && f.sem_valor > 0 && `${f.sem_valor} ${f.sem_valor === 1 ? 'negócio' : 'negócios'} sem valor no CRM (fora do valor). `}
          Negócios realizados no CRM desde {inicioTexto}
          {leitura && ` · atualizado em ${leitura.toLocaleDateString('pt-BR')} às ${leitura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          {atrasado && <strong className="km32-atraso"> · dados do CRM atrasados</strong>}
        </p>
      )}
    </section>
  )
}
