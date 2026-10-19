import {
  KM_FIM, FINALIDADES_KM32, moeda, km, pct, pctTexto, paradasDa, leituraFinalidade,
} from '../../lib/campanhaKm32'

/**
 * Km 32 no rodapé da TV Display (PRD §5.9, 16/10): Venda e Locação lado a lado,
 * porque a TV não tem aba para clicar. Mesma régua da Home, sem as explicações:
 * na TV é bater o olho. Os dados vêm do TVDisplayFooter (useCampanha), que só
 * põe o painel na rotação com a campanha no ar.
 */
export function Km32TV({ dados }) {
  const paradas = paradasDa(dados.inicio, dados.fim)
  const primeira = leituraFinalidade(dados, Object.values(dados.finalidades)[0] ?? { valor: 0, meta_valor: 1 })

  return (
    <section className="agenda-fotografo-tv">
      <div className="agenda-fotografo-tv-titulo">
        🏁 {dados.nome} — dia {primeira.diasPassados} de {primeira.diasCampanha}
      </div>
      <div className="km32-tv-grid">
        {FINALIDADES_KM32.map(({ chave, rotulo }) => {
          const f = dados.finalidades?.[chave]
          if (!f) return null
          const l = leituraFinalidade(dados, f)
          const acima = l.diferenca > 0
          return (
            <div className="kpi-tv-card km32-tv-card" key={chave}>
              <div className="kpi-tv-rotulo">{rotulo} · Km {km(l.progresso)} de {KM_FIM}</div>

              <div className="km32-tv-track" aria-hidden="true">
                <div className="km32-tv-fill" style={{ width: pct(l.progresso) }} />
                {paradas.map((p) => (
                  <span key={p.mes} className="km32-tv-parada" style={{ left: pct(p.fracao) }} />
                ))}
                <span className="km32-tv-hoje" style={{ left: pct(l.tempo) }} />
              </div>

              <div className="km32-tv-numeros">
                <div>
                  <div className="kpi-tv-valor km32-tv-valor">{moeda(chave, l.valorMes)}</div>
                  <div className="kpi-tv-sub">
                    de {moeda(chave, l.metaMes.valor)} · meta de {l.metaMes.mes} · {pctTexto(Math.min(1, l.valorMes / l.metaMes.valor))}
                  </div>
                  {chave === 'Aluguel' && (
                    <div className="kpi-tv-sub">
                      {f.negocios} {f.negocios === 1 ? 'contrato iniciado' : 'contratos iniciados'} · {f.ativos} {f.ativos === 1 ? 'ativo' : 'ativos'}
                      {f.em_ativacao > 0 && ` · ${f.em_ativacao} em ativação`}
                    </div>
                  )}
                </div>
                <div className="km32-tv-lado">
                  {l.batida ? (
                    <div className="km32-tv-ritmo is-acima">Meta batida</div>
                  ) : l.noRitmo ? (
                    <div className="km32-tv-ritmo">no ritmo esperado</div>
                  ) : (
                    <div className={`km32-tv-ritmo ${acima ? 'is-acima' : 'is-abaixo'}`}>
                      {acima ? '▲' : '▼'} {moeda(chave, Math.abs(l.diferenca))} {acima ? 'acima' : 'abaixo'}
                    </div>
                  )}
                  <div className="kpi-tv-sub">do esperado até hoje ({moeda(chave, l.esperado)})</div>
                  <div className="kpi-tv-sub">{moeda(chave, f.em_proposta)} em proposta ({f.propostas})</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
