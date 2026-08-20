import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAtendimentos } from '../hooks/useAtendimentos'
import { useAtividadesResumo } from '../hooks/useAtividadesResumo'
import { FILTROS_VAZIOS, filtrarAtendimentos } from '../lib/atendimentos'
import {
  agruparAtualizacoes,
  agruparBairrosVisitados,
  agruparEntradasPorFinalidade,
  agruparFunilEtapas,
  agruparOrigem,
  agruparPorCorretor,
  agruparPrimeiroContato,
  agruparTaxaAtualizacao,
  agruparTempoFunil,
  agruparTiposAtividade,
  agruparUltimoContato,
  tempoMedioDescarteDias,
  tempoMedioFunilDias,
} from '../lib/analiseAtendimentos'
import KanbanFiltros from '../components/kanban/KanbanFiltros'
import KpiCard from '../components/dashboard/KpiCard'
import OrigemChart from '../components/dashboard/OrigemChart'
import BairrosHeatmap from '../components/dashboard/BairrosHeatmap'
import FunilEtapasChart from '../components/dashboard/FunilEtapasChart'
import CorretorChart from '../components/dashboard/CorretorChart'
import EntradasFinalidadeChart from '../components/dashboard/EntradasFinalidadeChart'
import TempoFunilChart from '../components/dashboard/TempoFunilChart'
import UltimoContatoChart from '../components/dashboard/UltimoContatoChart'
import TaxaAtualizacaoChart from '../components/dashboard/TaxaAtualizacaoChart'
import PrimeiroContatoChart from '../components/dashboard/PrimeiroContatoChart'
import AtualizacoesChart from '../components/dashboard/AtualizacoesChart'
import TiposAtividadeChart from '../components/dashboard/TiposAtividadeChart'

function Secao({ titulo, children }) {
  return (
    <div style={{ marginTop: 'var(--space-7)' }}>
      <div className="page-eyebrow">{titulo}</div>
      {children}
    </div>
  )
}

export default function DadosAtendimento() {
  const { atendimentos, carregando: carregandoAtendimentos, erro: erroAtendimentos } = useAtendimentos()
  const { atividades, resumoPorAtendimento, carregando: carregandoAtividades, erro: erroAtividades } = useAtividadesResumo()
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)

  const carregando = carregandoAtendimentos || carregandoAtividades
  const erro = erroAtendimentos || erroAtividades

  const atendimentosFiltrados = useMemo(() => filtrarAtendimentos(atendimentos, filtros), [atendimentos, filtros])
  const codigosFiltrados = useMemo(() => new Set(atendimentosFiltrados.map((a) => a.codigo)), [atendimentosFiltrados])
  const atividadesFiltradas = useMemo(() => atividades.filter((a) => codigosFiltrados.has(a.codigoatendimento)), [atividades, codigosFiltrados])

  const funilEtapas = useMemo(() => agruparFunilEtapas(atendimentosFiltrados), [atendimentosFiltrados])
  const origem = useMemo(() => agruparOrigem(atendimentosFiltrados), [atendimentosFiltrados])
  const bairros = useMemo(() => agruparBairrosVisitados(atividadesFiltradas, 16), [atividadesFiltradas])
  const entradasPorFinalidade = useMemo(() => agruparEntradasPorFinalidade(atendimentosFiltrados), [atendimentosFiltrados])
  const tempoFunil = useMemo(() => agruparTempoFunil(atendimentosFiltrados), [atendimentosFiltrados])
  const tempoMedio = useMemo(() => tempoMedioFunilDias(atendimentosFiltrados), [atendimentosFiltrados])
  const corretoresVenda = useMemo(() => agruparPorCorretor(atendimentosFiltrados.filter((a) => a.finalidade === 'Venda')), [atendimentosFiltrados])
  const corretoresAluguel = useMemo(() => agruparPorCorretor(atendimentosFiltrados.filter((a) => a.finalidade === 'Aluguel')), [atendimentosFiltrados])
  const ultimoContato = useMemo(() => agruparUltimoContato(atendimentosFiltrados, resumoPorAtendimento), [atendimentosFiltrados, resumoPorAtendimento])
  const primeiroContato = useMemo(() => agruparPrimeiroContato(atendimentosFiltrados, resumoPorAtendimento), [atendimentosFiltrados, resumoPorAtendimento])
  const taxaAtualizacao = useMemo(() => agruparTaxaAtualizacao(atendimentosFiltrados, resumoPorAtendimento), [atendimentosFiltrados, resumoPorAtendimento])
  const tempoMedioDescarte = useMemo(() => tempoMedioDescarteDias(atendimentosFiltrados), [atendimentosFiltrados])
  const atualizacoes = useMemo(() => agruparAtualizacoes(atendimentosFiltrados, resumoPorAtendimento), [atendimentosFiltrados, resumoPorAtendimento])
  const tiposAtividade = useMemo(() => agruparTiposAtividade(atividadesFiltradas), [atividadesFiltradas])

  const semFechamentoRegistrado = useMemo(
    () => tempoFunil.find((linha) => linha.bucket === 'Sem data de fechamento')?.Descartado ?? 0,
    [tempoFunil]
  )

  const resumo = useMemo(() => {
    const abertos = atendimentosFiltrados.filter((a) => a.situacao === 'Em atendimento')
    const contatadosRecente = ultimoContato
      .filter((b) => ['Hoje', '1–3 dias', '4–7 dias'].includes(b.bucket))
      .reduce((acc, b) => acc + b.total, 0)
    const semAtividade = atendimentosFiltrados.filter((a) => !resumoPorAtendimento[a.codigo]).length
    return {
      total: atendimentosFiltrados.length,
      pctContatoRecente: abertos.length > 0 ? (contatadosRecente / abertos.length) * 100 : 0,
      pctSemAtividade: atendimentosFiltrados.length > 0 ? (semAtividade / atendimentosFiltrados.length) * 100 : 0,
    }
  }, [atendimentosFiltrados, ultimoContato, resumoPorAtendimento])

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/kanban" style={{ fontSize: 'var(--text-xs)', color: 'var(--grafite-soft)' }}>← Kanban</Link>
          <div className="page-eyebrow" style={{ marginTop: 'var(--space-2)' }}>Vendas & Locação</div>
          <div className="page-title">Dados de atendimento</div>
          <div className="page-sub">Origem, funil, resposta e engajamento — espelho do CRM.</div>
        </div>
      </header>

      {carregando && <div className="hub-loading">Carregando dados de atendimento…</div>}
      {erro && <div className="hub-error">Não foi possível carregar os dados: {erro}</div>}

      {!carregando && !erro && (
        <>
          <KanbanFiltros atendimentos={atendimentos} filtros={filtros} setFiltros={setFiltros} />

          <div className="kpi-grid">
            <KpiCard label="Atendimentos analisados" valor={resumo.total} />
            <KpiCard label="Tempo médio no funil" valor={`${tempoMedio.toFixed(0)} dias`} corDestaque="var(--coral)" />
            <KpiCard label="Tempo médio de descarte" valor={`${tempoMedioDescarte.toFixed(0)} dias`} sub="entrada até fechamento, só descartados com data registrada" />
            <KpiCard label="Sem nenhuma atividade" valor={`${resumo.pctSemAtividade.toFixed(0)}%`} sub="do total de atendimentos" />
          </div>

          <Secao titulo="Funil por etapa (volume atual)">
            <FunilEtapasChart dados={funilEtapas} />
          </Secao>

          <Secao titulo="Entradas de leads por finalidade">
            <EntradasFinalidadeChart dados={entradasPorFinalidade} />
          </Secao>

          <Secao titulo="Origem dos leads">
            <OrigemChart dados={origem} />
          </Secao>

          <Secao titulo="Bairros mais visitados">
            <BairrosHeatmap dados={bairros} />
            <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-2)' }}>Aproximado a partir do endereço das visitas registradas — quanto mais forte a cor, mais visitas.</div>
          </Secao>

          <Secao titulo="Tempo no funil">
            <TempoFunilChart dados={tempoFunil} />
            {semFechamentoRegistrado > 0 && (
              <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-2)' }}>
                {semFechamentoRegistrado} descartados sem data de fechamento registrada no CRM — não sabemos quanto tempo ficaram ativos, por isso aparecem separados em vez de contados até hoje.
              </div>
            )}
          </Secao>

          <Secao titulo="Volume e conversão por corretor">
            <div className="stat-sub is-muted" style={{ marginBottom: 'var(--space-3)' }}>
              Vendas e locação são times diferentes — rankings separados. Ordenado por taxa de conversão entre corretores com 15+ atendimentos; abaixo disso a amostra é pequena demais pra comparar, então ficam listados por volume ao final.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-7)' }}>
              <div>
                <div className="page-eyebrow">Vendas</div>
                <CorretorChart dados={corretoresVenda} />
              </div>
              <div>
                <div className="page-eyebrow">Locação</div>
                <CorretorChart dados={corretoresAluguel} />
              </div>
            </div>
          </Secao>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-7)', marginTop: 'var(--space-7)' }}>
            <div>
              <div className="page-eyebrow">Primeiro contato</div>
              <PrimeiroContatoChart dados={primeiroContato} />
              <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-2)' }}>
                A sincronização de atividades só começou em mai/2026 — atendimentos antigos com contato antes disso aparecem aqui com atraso inflado, mesmo que o corretor tenha respondido rápido.
              </div>
            </div>
            <div>
              <div className="page-eyebrow">Último contato (abertos)</div>
              <UltimoContatoChart dados={ultimoContato} />
            </div>
          </div>

          <Secao titulo="Taxa de atualização (atendimentos em aberto)">
            <TaxaAtualizacaoChart dados={taxaAtualizacao} />
            <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-2)' }}>
              Dias desde o último contato registrado. Até 15 dias é saudável, 16–30 precisa de atenção, 31+ (incluindo quem nunca teve contato registrado) é passível de descarte.
            </div>
          </Secao>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-7)', marginTop: 'var(--space-7)' }}>
            <div>
              <div className="page-eyebrow">Atualizações por atendimento</div>
              <AtualizacoesChart dados={atualizacoes} />
            </div>
            <div>
              <div className="page-eyebrow">Tipos de atividade</div>
              <TiposAtividadeChart dados={tiposAtividade} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
