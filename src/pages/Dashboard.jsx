import { useMemo, useState } from 'react'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { useCampanhas } from '../hooks/useCampanhas'
import { useMetas } from '../hooks/useMetas'
import KpiCard from '../components/dashboard/KpiCard'
import FunilChart from '../components/dashboard/FunilChart'
import CampanhasChart from '../components/dashboard/CampanhasChart'
import MetaVsRealizado from '../components/dashboard/MetaVsRealizado'

const ABAS = ['Visão Geral', 'Funil', 'Campanhas']

function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function Dashboard() {
  const [aba, setAba] = useState('Visão Geral')
  const { atendimentos, carregando: carregandoAtendimentos, erro: erroAtendimentos } = useAtendimentos()
  const { meta, google, carregando: carregandoCampanhas, erro: erroCampanhas } = useCampanhas()
  const { metasCampanhas, carregando: carregandoMetas } = useMetas()

  const resumo = useMemo(() => {
    const total = atendimentos.length
    const negocios = atendimentos.filter((a) => a.situacao === 'Negócio realizado').length
    const conversao = total > 0 ? (negocios / total) * 100 : 0
    const vendas = atendimentos.filter((a) => a.finalidade === 'Venda').length
    const aluguel = atendimentos.filter((a) => a.finalidade === 'Aluguel').length
    const investimentoTotal = [...meta, ...google].reduce((acc, l) => acc + (l.investimento ?? 0), 0)
    return { total, negocios, conversao, vendas, aluguel, investimentoTotal }
  }, [atendimentos, meta, google])

  const carregando = carregandoAtendimentos || carregandoCampanhas
  const erro = erroAtendimentos || erroCampanhas

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Comercial · CRM · Performance</div>
          <div className="page-title">Dashboard</div>
        </div>
      </header>

      <div className="tabs">
        {ABAS.map((nome) => (
          <button key={nome} type="button" className={`tab${aba === nome ? ' is-active' : ''}`} onClick={() => setAba(nome)}>
            {nome}
          </button>
        ))}
      </div>

      {carregando && <div className="hub-loading">Carregando dados…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o dashboard: {erro}</div>}

      {!carregando && !erro && (
        <div className="tabs-panel">
          {aba === 'Visão Geral' && (
            <>
              <div className="kpi-grid">
                <KpiCard label="Total de atendimentos" valor={resumo.total} />
                <KpiCard label="Taxa de conversão" valor={`${resumo.conversao.toFixed(1)}%`} corDestaque="var(--coral)" />
                <KpiCard label="Venda × Aluguel" valor={`${resumo.vendas} / ${resumo.aluguel}`} sub="atendimentos" />
                <KpiCard label="Investimento em mídia" valor={moeda(resumo.investimentoTotal)} sub="Meta Ads + Google Ads" />
              </div>
            </>
          )}

          {aba === 'Funil' && <FunilChart atendimentos={atendimentos} />}

          {aba === 'Campanhas' && (
            <>
              <CampanhasChart meta={meta} google={google} />
              <div style={{ marginTop: 'var(--space-7)' }}>
                <div className="page-eyebrow">Meta × Realizado</div>
                {!carregandoMetas && <MetaVsRealizado metasCampanhas={metasCampanhas} meta={meta} google={google} />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
