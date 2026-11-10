import { useEffect, useState } from 'react'
import { useCampanha } from '../../hooks/useCampanha'
import {
  SLUG_KM32, KM_INICIO, KM_FIM, FINALIDADES_KM32 as ABAS, DIA_MS, dataLocal, moeda, km, pct, pctTexto,
  paradasDa, campanhaNoAr, leituraFinalidade,
} from '../../lib/campanhaKm32'

// Campanha Km 32 na Home (RF25, PRD §5.9). Os números vêm de campanha_resumo():
// venda = negócios realizados no CRM (jornada do atendimento) no período da
// campanha; locação = contratos iniciados de 1º dia do mês da campanha até
// hoje, sem os cancelados (19/10). Nada é digitado nem fica no código. A régua (meta do
// mês, esperado até hoje) fica em lib/campanhaKm32, a mesma da TV Display.

// Coluna do trimestre: a campanha inteira (out–dez/26)
const PERIODO_TRI = 'out a dez'

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
  const { tempo = 0, metaMes, valorMes, pctMes, faltaMes } = l ?? {}

  const leitura = dados?.ultima_leitura ? new Date(dados.ultima_leitura) : null
  const atrasado = leitura && (dataLocal(dados.hoje) - new Date(leitura.getFullYear(), leitura.getMonth(), leitura.getDate())) / DIA_MS > 1
  const inicioTexto = dados ? dataLocal(dados.inicio).toLocaleDateString('pt-BR') : ''
  const locacao = aba === 'Aluguel'
  const inicioContratos = dados ? dataLocal(`${dados.inicio.slice(0, 8)}01`).toLocaleDateString('pt-BR') : ''

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
          {[
            { titulo: `Mês · ${metaMes.mes}`, realizado: valorMes, meta: metaMes.valor, falta: faltaMes, pctFeito: pctMes },
            { titulo: `Trimestre · ${PERIODO_TRI}`, realizado: f.valor, meta: f.meta_valor, falta: Math.max(0, f.meta_valor - f.valor), pctFeito: progresso },
          ].map((c) => (
            <div key={c.titulo} className="km32-col">
              <div className="km32-col-titulo">{c.titulo} <span>meta {moeda(aba, c.meta)}</span></div>
              <div className="km32-linha km32-linha--destaque">
                <span className="km32-l">Realizado</span>
                <span className="km32-n">{moeda(aba, c.realizado)} <small>{pctTexto(c.pctFeito)}</small></span>
              </div>
              <div className="km32-linha">
                <span className="km32-l">Para bater a meta</span>
                {c.falta > 0
                  ? <span className="km32-n is-falta">{moeda(aba, c.falta)}</span>
                  : <span className="km32-n">Meta batida</span>}
              </div>
              <div className="km32-linha" title="Propostas em análise no CRM, com interação nos últimos 30 dias">
                <span className="km32-l">Em proposta{f.propostas != null && ` · ${f.propostas} ${f.propostas === 1 ? 'ativa' : 'ativas'}`}</span>
                <span className="km32-n">{moeda(aba, f.em_proposta)}</span>
              </div>
            </div>
          ))}
          {locacao && (
            <p className="km32-l km32-contratos">
              {f.negocios} {f.negocios === 1 ? 'contrato iniciado' : 'contratos iniciados'} · {f.ativos} {f.ativos === 1 ? 'ativo' : 'ativos'}
              {f.em_ativacao > 0 && ` · ${f.em_ativacao} em ativação`}
            </p>
          )}
        </div>
      )}

      {dados && (
        <p className="km32-rodape">
          {f && f.negocios === 0 && (locacao ? 'Nenhum contrato iniciado ainda. ' : `A largada foi dada em ${inicioTexto}. Nenhum negócio realizado ainda. `)}
          {f && f.sem_valor > 0 && `${f.sem_valor} ${locacao ? (f.sem_valor === 1 ? 'contrato' : 'contratos') : f.sem_valor === 1 ? 'negócio' : 'negócios'} sem valor (fora do valor). `}
          {locacao ? `Contratos de locação iniciados de ${inicioContratos} até hoje (sem os cancelados)` : `Negócios realizados no CRM desde ${inicioTexto}`}
          {leitura && ` · atualizado em ${leitura.toLocaleDateString('pt-BR')} às ${leitura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          {atrasado && <strong className="km32-atraso"> · dados do CRM atrasados</strong>}
        </p>
      )}
    </section>
  )
}
