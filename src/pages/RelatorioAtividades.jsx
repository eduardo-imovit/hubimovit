import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAtividadesPeriodo } from '../hooks/useAtividadesPeriodo'
import { useColaboradores } from '../hooks/useColaboradores'
import { hojeISO } from '../lib/dateUtils'
import {
  agruparPorEquipeETipo,
  distribuicaoDiaria,
  resumoPorEquipe,
  semanasComparacao,
  variacaoPercentual,
} from '../lib/relatorioAtividades'

const DIAS_SEMANA_LABEL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function formatarPeriodo(inicioISO, fimISO) {
  const opts = { day: '2-digit', month: '2-digit' }
  const i = new Date(`${inicioISO}T12:00:00`).toLocaleDateString('pt-BR', opts)
  const f = new Date(`${fimISO}T12:00:00`).toLocaleDateString('pt-BR', opts)
  return `${i} a ${f}`
}

function CardEquipe({ titulo, dados }) {
  const delta = variacaoPercentual(dados.atualRealizadas, dados.anteriorRealizadas)
  const subiu = delta >= 0
  return (
    <div className="stat-card">
      <div className="stat-label">{titulo}</div>
      <div className="stat-value">
        {dados.atualRealizadas} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--grafite-soft)' }}>/ {dados.atualAgendadas}</span>
      </div>
      <div className="stat-sub is-muted">realizadas / agendadas</div>
      <span className={`badge ${subiu ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 'var(--space-2)', display: 'inline-block' }}>
        {subiu ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% vs semana anterior ({dados.anteriorRealizadas})
      </span>
    </div>
  )
}

function TabelaEquipe({ titulo, linhas }) {
  return (
    <div>
      <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>{titulo}</div>
      {linhas.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Sem atividades no período</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo de atividade</th>
                <th className="num">Atual realizadas</th>
                <th className="num">Atual agendadas</th>
                <th className="num">Anterior realizadas</th>
                <th className="num">Anterior agendadas</th>
                <th className="mini-bar-cell">Comparação (realizadas)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const max = Math.max(l.atualRealizadas, l.anteriorRealizadas) || 1
                return (
                  <tr key={l.tipo}>
                    <td>{l.tipo}</td>
                    <td className="num">{l.atualRealizadas}</td>
                    <td className="num">{l.atualAgendadas}</td>
                    <td className="num">{l.anteriorRealizadas}</td>
                    <td className="num">{l.anteriorAgendadas}</td>
                    <td className="mini-bar-cell">
                      <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: `${(l.atualRealizadas / max) * 100}%` }} /></div>
                      <div className="mini-bar-track"><div className="mini-bar-fill is-muted" style={{ width: `${(l.anteriorRealizadas / max) * 100}%` }} /></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RelatorioAtividades() {
  const [dataFoco, setDataFoco] = useState(hojeISO())
  const periodo = useMemo(() => semanasComparacao(dataFoco), [dataFoco])

  const { atividades, carregando: carregandoAtividades, erro: erroAtividades } = useAtividadesPeriodo(periodo.anterior.inicio, periodo.atual.fim)
  const { colaboradores, carregando: carregandoColaboradores, erro: erroColaboradores } = useColaboradores()

  const carregando = carregandoAtividades || carregandoColaboradores
  const erro = erroAtividades || erroColaboradores

  const resumo = useMemo(() => resumoPorEquipe(atividades, colaboradores, periodo), [atividades, colaboradores, periodo])
  const porTipo = useMemo(() => agruparPorEquipeETipo(atividades, colaboradores, periodo), [atividades, colaboradores, periodo])
  const diario = useMemo(() => distribuicaoDiaria(atividades, colaboradores, periodo), [atividades, colaboradores, periodo])

  function navegarSemana(direcao) {
    const base = new Date(`${dataFoco}T12:00:00`)
    base.setDate(base.getDate() + direcao * 7)
    setDataFoco(base.toLocaleDateString('en-CA'))
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/kanban" style={{ fontSize: 'var(--text-xs)', color: 'var(--grafite-soft)' }}>← Kanban</Link>
          <div className="page-eyebrow" style={{ marginTop: 'var(--space-2)' }}>Locação & Vendas</div>
          <div className="page-title">Relatório de atividades</div>
          <div className="page-sub">
            Semana de {formatarPeriodo(periodo.atual.inicio, periodo.atual.fim)} (comparado com {formatarPeriodo(periodo.anterior.inicio, periodo.anterior.fim)})
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button type="button" className="btn-icon btn-icon-sm" onClick={() => navegarSemana(-1)}>‹</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDataFoco(hojeISO())}>Semana atual</button>
          <button type="button" className="btn-icon btn-icon-sm" onClick={() => navegarSemana(1)}>›</button>
        </div>
      </header>

      {carregando && <div className="hub-loading">Carregando relatório de atividades…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o relatório: {erro}</div>}

      {!carregando && !erro && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <CardEquipe titulo="Locação" dados={resumo.Locação} />
            <CardEquipe titulo="Vendas" dados={resumo.Vendas} />
            <CardEquipe titulo="Geral (Locação + Vendas + Analista)" dados={resumo.Geral} />
          </div>

          <div style={{ marginTop: 'var(--space-7)' }}>
            <TabelaEquipe titulo="Equipe Locação" linhas={porTipo.Locação} />
          </div>
          <div style={{ marginTop: 'var(--space-7)' }}>
            <TabelaEquipe titulo="Equipe Vendas" linhas={porTipo.Vendas} />
          </div>

          <div style={{ marginTop: 'var(--space-7)' }}>
            <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
              Distribuição diária — {formatarPeriodo(periodo.atual.inicio, periodo.atual.fim)}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th className="num">Locação realizadas</th>
                    <th className="num">Locação agendadas</th>
                    <th className="num">Vendas realizadas</th>
                    <th className="num">Vendas agendadas</th>
                  </tr>
                </thead>
                <tbody>
                  {diario.map((linha, i) => (
                    <tr key={linha.dia}>
                      <td>{DIAS_SEMANA_LABEL[i]} · {linha.dia.slice(8, 10)}/{linha.dia.slice(5, 7)}</td>
                      <td className="num">{linha.locacaoRealizadas}</td>
                      <td className="num">{linha.locacaoAgendadas}</td>
                      <td className="num">{linha.vendasRealizadas}</td>
                      <td className="num">{linha.vendasAgendadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-5)' }}>
            Equipe definida pelo cargo em colaboradores_raw (locação / vendas / analista). "Realizadas" conta atividades marcadas como concluídas no CRM; "agendadas" conta todas, concluídas ou não.
          </div>
        </>
      )}
    </div>
  )
}
