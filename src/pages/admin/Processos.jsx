import { useState } from 'react'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { useHistoricoProposta } from '../../hooks/useHistoricoProposta'

const STATUS_LABEL = {
  aguardando_locatario: 'Aguardando locatário',
  aguardando_aprovacao_interna: 'Em revisão interna',
  criada: 'Aguardando proprietário',
  aguardando_docs: 'Aguardando documentos',
  docs_em_analise: 'Docs em análise',
  docs_aprovados: 'Docs aprovados',
  sincronizada: 'Sincronizada',
  rejeitada: 'Rejeitada',
  expirada: 'Expirada',
}

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
                <th>Proprietário</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome_cliente || p.email}</td>
                  <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                  <td>{p.proprietario_nome || '—'}</td>
                  <td>{STATUS_LABEL[statusEfetivo(p)] ?? statusEfetivo(p)}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPropostaSelecionadaId(p.id)}>
                      Ver linha do tempo
                    </button>
                  </td>
                </tr>
              ))}
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
        <div className="avisos-list">
          {historico.map((h) => (
            <div className="avisos-item" key={h.id}>
              <div className="avisos-item-body">
                <span className="avisos-item-title">{STATUS_LABEL[h.status_novo] ?? h.status_novo}</span>
                <div className="avisos-item-sub">
                  {formatarData(h.timestamp_registro)} · {h.ator}
                  {h.motivo ? ` · ${h.motivo}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
