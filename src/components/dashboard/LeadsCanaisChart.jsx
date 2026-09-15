import { useMemo, useState } from 'react'
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

// Reclassifica a midia bruta em grupos mais legiveis que o "canal" padrao:
// - campanha-meta* e campanha_* (varios IDs de campanha do Meta Ads,
//   registrados com prefixos diferentes) viram um unico grupo "Campanha Meta"
// - whatsapp-site* continua dentro de "Site" (mesma regra que o canal ja usa)
// Qualquer outra midia cai no "canal" que a view ja calcula (Portais,
// Indicacao, Site, WhatsApp, Instagram, Outbound, Outros...), exceto
// "Campanhas pagas" que aqui vira "Trafego pago" (rotulo mais claro).
function grupoMidia(linha) {
  const chave = (linha.midia_raw ?? '').trim().toLowerCase()
  if (chave.startsWith('campanha-meta') || chave.startsWith('campanha_')) return 'Campanha Meta'
  if (chave.startsWith('whatsapp-site')) return 'Site'
  if (linha.canal === 'Campanhas pagas') return 'Tráfego pago'
  return linha.canal
}

// Agrega atendimentos brutos por grupo de midia: conta leads/visitas/negocios
// a partir das linhas individuais e calcula as taxas a partir das somas —
// nunca faz media de taxas ja prontas.
function agregarPorGrupo(linhas) {
  const porGrupo = new Map()
  for (const linha of linhas) {
    const grupo = grupoMidia(linha)
    const acc = porGrupo.get(grupo) ?? { canal: grupo, leads: 0, visitas: 0, negocios: 0 }
    acc.leads += 1
    if (linha.fase_ordem >= 5) acc.visitas += 1
    if (linha.fase_ordem >= 7) acc.negocios += 1
    porGrupo.set(grupo, acc)
  }
  return [...porGrupo.values()].map((c) => ({
    ...c,
    taxa_lead_visita: c.leads > 0 ? Math.round((c.visitas / c.leads) * 1000) / 10 : null,
    taxa_lead_negocio: c.leads > 0 ? Math.round((c.negocios / c.leads) * 1000) / 10 : null,
  }))
}

function media(valores) {
  if (valores.length === 0) return null
  return valores.reduce((acc, v) => acc + v, 0) / valores.length
}

function TooltipCanal({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="card card-body" style={{ fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.canal}</div>
      <div>Leads: {d.leads}</div>
      <div>Visitas: {d.visitas}</div>
      <div>Negócios: {d.negocios}</div>
      <div>Taxa lead→visita: {d.taxa_lead_visita}%</div>
      <div>Taxa lead→negócio: {d.taxa_lead_negocio}%</div>
    </div>
  )
}

// Label customizado do canal: alterna acima/abaixo do ponto conforme a
// posicao do canal na ordem por volume, pra pontos vizinhos (mesmo leads e
// taxa, ex.: Instagram e Outros) nao ficarem com o texto sobreposto.
function LabelCanal({ x, y, width, height, index, pontos }) {
  const item = pontos[index]
  if (!item) return null
  const cx = x + width / 2
  const ty = item.labelAcima ? y - 6 : y + height + 14
  return (
    <text x={cx} y={ty} textAnchor="middle" fontSize={11} fill="var(--grafite)">
      {item.canal}
    </text>
  )
}

export default function LeadsCanaisChart({ dados }) {
  const [finalidade, setFinalidade] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const filtrados = useMemo(
    () => dados.filter((d) =>
      (!finalidade || d.finalidade === finalidade) &&
      (!dataInicio || d.data_entrada >= dataInicio) &&
      (!dataFim || d.data_entrada <= dataFim)
    ),
    [dados, finalidade, dataInicio, dataFim]
  )

  const porCanal = useMemo(() => agregarPorGrupo(filtrados), [filtrados])

  // Referencia para "volume alto, conversao baixa": media simples de leads
  // (soma por canal, nao taxa) e a taxa geral ponderada (soma negocios /
  // soma leads), nunca a media das taxas por canal.
  const mediaLeads = useMemo(() => media(porCanal.map((c) => c.leads)), [porCanal])
  const taxaGeral = useMemo(() => {
    const totalLeads = porCanal.reduce((acc, c) => acc + c.leads, 0)
    const totalNegocios = porCanal.reduce((acc, c) => acc + c.negocios, 0)
    return totalLeads > 0 ? Math.round((totalNegocios / totalLeads) * 1000) / 10 : null
  }, [porCanal])

  const pontos = useMemo(() => {
    const comDestaque = porCanal.map((c) => ({
      ...c,
      destaque: mediaLeads != null && taxaGeral != null && c.leads > mediaLeads && c.taxa_lead_negocio < taxaGeral,
    }))
    // Ordem por leads (e taxa como desempate) define a alternancia do label:
    // pontos vizinhos nessa ordem tendem a ficar proximos no grafico.
    const ordemProximidade = [...comDestaque].sort((a, b) => a.leads - b.leads || a.taxa_lead_negocio - b.taxa_lead_negocio)
    const acimaPorCanal = new Map(ordemProximidade.map((c, i) => [c.canal, i % 2 === 0]))
    return comDestaque.map((c) => ({ ...c, labelAcima: acimaPorCanal.get(c.canal) }))
  }, [porCanal, mediaLeads, taxaGeral])

  return (
    <div>
      <div className="filters-bar">
        <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
          <option value="">Finalidade: todas</option>
          <option value="Venda">Venda</option>
          <option value="Aluguel">Aluguel</option>
        </select>
        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} title="Entrada a partir de" />
        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Entrada até" />
        {(finalidade || dataInicio || dataFim) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFinalidade(''); setDataInicio(''); setDataFim('') }}>
            Limpar filtros
          </button>
        )}
      </div>

      {pontos.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Sem dados para o filtro selecionado</div>
        </div>
      ) : (
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 24, right: 72, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--champagne)" />
              <XAxis type="number" dataKey="leads" name="Leads" fontSize={11} stroke="var(--grafite-soft)" label={{ value: 'Leads', position: 'insideBottom', offset: -4, fontSize: 11, fill: 'var(--grafite-soft)' }} />
              <YAxis type="number" dataKey="taxa_lead_negocio" name="Taxa lead→negócio" unit="%" fontSize={11} stroke="var(--grafite-soft)" />
              <ZAxis type="number" dataKey="negocios" range={[100, 900]} name="Negócios" />
              {taxaGeral != null && (
                <ReferenceLine
                  y={taxaGeral}
                  stroke="var(--grafite-fade)"
                  strokeDasharray="4 3"
                  label={{ value: `Média geral: ${taxaGeral}%`, position: 'insideTopLeft', fontSize: 11, fill: 'var(--grafite-soft)' }}
                />
              )}
              <Tooltip content={<TooltipCanal />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                data={pontos}
                fillOpacity={0.8}
                isAnimationActive={false}
                label={(props) => <LabelCanal {...props} pontos={pontos} />}
              >
                {pontos.map((c) => (
                  <Cell key={c.canal} fill={c.destaque ? 'var(--danger)' : 'var(--coral)'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
