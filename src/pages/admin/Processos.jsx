import { useState } from 'react'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { useHistoricoProposta } from '../../hooks/useHistoricoProposta'
import { STATUS_LABEL, formatarPrazo } from '../../lib/esteiraLabels'
import { StatusBadge } from '../../components/esteira/StatusBadge'

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_TERMINAIS = ['sincronizada', 'rejeitada', 'expirada']

/** Mesmo cálculo da view propostas_ativas (status_efetivo) -- aqui feito no client porque Processos busca propostas_locacao direto, não a view. */
function statusEfetivo(proposta) {
  if (new Date(proposta.link_expira_em) < new Date() && !STATUS_TERMINAIS.includes(proposta.status)) return 'expirada'
  return proposta.status
}

export default function Processos() {
  const { propostas, carregando, erro } = usePropostasLocacao(false)
  const [propostaSelecionadaId, setPropostaSelecionadaId] = useState(null)

  const propostaSelecionada = propostas.find((p) => p.id === propostaSelecionadaId) ?? null

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Admin</div>
          <div className="page-title">Processos</div>
          <div className="page-sub">Visão consolidada de todos os processos de locação, do início até a conclusão.</div>
        </div>
      </header>

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os processos: {erro}</div>}

      {!carregando && !erro && propostas.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhum processo registrado</div>
          <div className="empty-sub">Todo processo criado em Propostas aparece aqui, do início ao fim.</div>
        </div>
      )}

      {propostas.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 'var(--space-5)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Prazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => {
                const efetivo = statusEfetivo(p)
                const prazo = formatarPrazo(p.link_expira_em, efetivo)
                return (
                  <tr key={p.id}>
                    <td>{p.nome_cliente || p.email}</td>
                    <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                    <td>{p.valor != null ? `R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td><StatusBadge status={efetivo} /></td>
                    <td>{prazo ? <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span> : '—'}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPropostaSelecionadaId(p.id)}>
                        Ver linha do tempo
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {propostaSelecionada && <TimelineProcesso proposta={propostaSelecionada} />}
    </div>
  )
}

function TimelineProcesso({ proposta }) {
  const { historico, carregando } = useHistoricoProposta(proposta.id)

  return (
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">
        {proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`} · {proposta.nome_cliente || proposta.email}
      </div>
      {carregando && <div className="hub-loading">Carregando…</div>}
      {!carregando && (
        <div className="timeline">
          {historico.map((h) => (
            <div className="timeline-item" key={h.id}>
              <span className="timeline-dot" />
              <div className="timeline-time">{formatarData(h.timestamp_registro)} · {h.ator}</div>
              <div className="timeline-title">{STATUS_LABEL[h.status_novo] ?? h.status_novo}</div>
              {h.motivo && <div className="timeline-sub">{h.motivo}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
