import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Campanha Km 32 na Home (RF25, PRD §5.9). Os números vêm de campanha_resumo(),
// que soma os negócios realizados no CRM (jornada do atendimento) dentro do
// período da campanha. Nada é digitado nem fica no código.
const SLUG = 'km32-4tri-2026'
const KM_INICIO = 32
const KM_FIM = 42
const ABAS = [
  { chave: 'Venda', rotulo: 'Venda' },
  { chave: 'Aluguel', rotulo: 'Locação' },
]
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const DIA_MS = 24 * 60 * 60 * 1000
const dataLocal = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmtUm = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Venda em milhões (abaixo de R$ 1 MM, em mil); locação em mil (é aluguel mensal). */
const moeda = (finalidade, v) => (v == null ? '—' : finalidade === 'Venda' && Math.abs(v) >= 1_000_000 ? `R$ ${fmtUm(v / 1_000_000)} MM` : `R$ ${fmtUm(v / 1_000)} mil`)
const km = (fracao) => Math.round(KM_INICIO + (KM_FIM - KM_INICIO) * fracao)
// `pct` é só para posições no CSS; `pctTexto` é para ler (vírgula decimal)
const pct = (f) => `${(f * 100).toFixed(2)}%`
const pctTexto = (f) => `${(f * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/** Quanto do período já passou (0–1) até a data, contando o próprio dia. */
function fracaoAte(inicio, fim, data) {
  const total = (dataLocal(fim) - dataLocal(inicio)) / DIA_MS + 1
  const passados = (data - dataLocal(inicio)) / DIA_MS + 1
  return Math.min(1, Math.max(0, passados / total))
}

/** Dias de calendário entre duas datas, contando as duas pontas. */
const diasEntre = (a, b) => Math.round((b - a) / DIA_MS) + 1

/**
 * Meta do mês corrente pela mesma régua diária (16/10): meta da campanha ÷ dias
 * da campanha × dias do mês dentro dela. Dá a sensação de possível sem trocar
 * a conta: a soma das metas dos meses é a meta da campanha.
 */
function metaDoMes(inicio, fim, hoje, meta) {
  const a = dataLocal(inicio)
  const b = dataLocal(fim)
  const h = dataLocal(hoje)
  const de = new Date(Math.max(a, new Date(h.getFullYear(), h.getMonth(), 1)))
  const ate = new Date(Math.min(b, new Date(h.getFullYear(), h.getMonth() + 1, 0)))
  return { valor: (meta / diasEntre(a, b)) * diasEntre(de, ate), mes: MESES_LONGOS[h.getMonth()] }
}

/**
 * Paradas no último dia de cada mês, na mesma régua do tempo: a tracejada
 * "hoje" encosta na parada no fim do mês. A meta acumulada da parada é a mesma
 * fração (ex.: 31/10 = 29,9% do período = 29,9% da meta).
 */
function paradasDa(inicio, fim) {
  const a = dataLocal(inicio)
  const b = dataLocal(fim)
  const paradas = []
  for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const fimDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const data = fimDoMes < b ? fimDoMes : b
    paradas.push({ mes: MESES[d.getMonth()], data, fracao: fracaoAte(inicio, fim, data) })
  }
  return paradas
}

function useCampanha(slug) {
  const [estado, setEstado] = useState({ dados: null, erro: false, carregando: true })
  useEffect(() => {
    let ativo = true
    supabase.rpc('campanha_resumo', { p_slug: slug }).then(({ data, error }) => {
      if (ativo) setEstado({ dados: data ?? null, erro: !!error, carregando: false })
    })
    return () => { ativo = false }
  }, [slug])
  return estado
}

export function TrilhaKm32() {
  const { dados, erro, carregando } = useCampanha(SLUG)
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
  if (!carregando && (!dados || dados.hoje < dados.inicio || dados.hoje > dados.fim)) return null

  const f = dados?.finalidades?.[aba]
  const progresso = f ? Math.min(1, f.valor / f.meta_valor) : 0
  const tempo = dados ? fracaoAte(dados.inicio, dados.fim, dataLocal(dados.hoje)) : 0
  const paradas = dados ? paradasDa(dados.inicio, dados.fim) : []
  const abaAtual = ABAS.find((a) => a.chave === aba)
  // Esperado até hoje: meta total ÷ dias da campanha × dias já passados (= meta × fração do calendário)
  const esperado = f ? f.meta_valor * tempo : 0
  const diferenca = f ? f.valor - esperado : 0
  const noRitmo = f ? Math.abs(diferenca) < f.meta_valor * 0.01 : true
  const diasCampanha = dados ? diasEntre(dataLocal(dados.inicio), dataLocal(dados.fim)) : 0
  const diasPassados = dados ? diasEntre(dataLocal(dados.inicio), dataLocal(dados.hoje)) : 0
  const porDia = f ? f.meta_valor / diasCampanha : 0
  const metaMes = f ? metaDoMes(dados.inicio, dados.fim, dados.hoje, f.meta_valor) : null
  const valorMes = f ? (f.valor_mes ?? f.valor) : 0
  const batida = f ? f.valor >= f.meta_valor : false

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
