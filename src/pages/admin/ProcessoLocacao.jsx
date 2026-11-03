import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import { useProcessoLocacao } from '../../hooks/useProcessoLocacao'
import {
  ABAS, PROCESSOS, COR_SEM_PAPEL, etapasDe, fasesDe, papeisUsados, ordenarPapeis,
} from '../../lib/processoLocacao'

/**
 * Propostas › Locação › Processo (RF33, PRD §5.20). v1 = guia de leitura.
 * Mesmas tabelas da página HTML da Direção; tempo real nas duas direções.
 * Edição (gestão/adm) entra no S3 da Fase 25.
 */
export default function ProcessoLocacao() {
  const { papeis, etapas, carregando, erro } = useProcessoLocacao()
  const [params, setParams] = useSearchParams()
  const aba = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'contrato'

  return (
    <div>
      <SubnavPropostas area="locacao" />
      <header className="page-header">
        <div>
          <div className="page-title">Processo de locação</div>
          <div className="page-sub">O passo a passo da locação: quem faz o quê, em que ordem e com qual prazo.</div>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Partes do processo" style={{ marginBottom: 'var(--space-5)' }}>
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={aba === a.chave}
            className={aba === a.chave ? 'is-active' : ''}
            onClick={() => setParams({ aba: a.chave }, { replace: true })}
          >
            {a.label}
          </button>
        ))}
      </div>

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar o processo: {erro}. Atualize a página; se continuar, avise a Gestão.</div>}

      {!carregando && !erro && (
        aba === 'equipe'
          ? <Equipe papeis={papeis} etapas={etapas} />
          // key: ao trocar de aba, o filtro de papel volta a zero
          : <Processo key={aba} processo={aba} papeis={papeis} etapas={etapas} />
      )}
    </div>
  )
}

function Processo({ processo, papeis, etapas }) {
  const [filtro, setFiltro] = useState(null)
  const info = PROCESSOS[processo]
  const todas = etapasDe(etapas, processo)
  const fases = fasesDe(todas)
  const colunas = fases.flatMap((f) => f.etapas) // ordem das colunas do mapa = ordem das fases
  const usados = papeisUsados(papeis, todas)
  const papelPorId = Object.fromEntries(papeis.map((p) => [p.id, p]))
  const numero = (e) => todas.indexOf(e) + 1
  const melhorias = todas.filter((e) => e.melhoria).length

  function irPara(id) {
    document.getElementById(`pl-etapa-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      <div className="pl-intro">
        <h2 className="pl-titulo">{info.nome}</h2>
        <p className="page-sub">
          {info.desc} {todas.length} etapas{melhorias > 0 && `, ${melhorias} com melhoria pendente`}.
          Só ADM e Gestão editam o desenho do processo.
        </p>
      </div>

      {info.nota && <div className="pl-nota">{info.nota}</div>}

      {todas.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nenhuma etapa ainda</div>
          <div className="empty-sub">Quando a ADM ou a Gestão desenhar este processo, as etapas aparecem aqui.</div>
        </div>
      ) : (
        <>
          {/* Mapa de raias: cada linha é um papel; cada coluna, uma etapa */}
          <div className="card pl-raias-card">
            <div className="pl-raias" role="region" aria-label="Mapa de raias: papéis por etapa" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th className="pl-raias-papel">Papel</th>
                    {fases.map((f) => <th key={f.nome} colSpan={f.etapas.length}>{f.nome}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {usados.map((p) => (
                    <tr key={p.id} style={{ '--c': p.cor }}>
                      <th className="pl-raias-papel"><span className="pl-dot" />{p.nome}</th>
                      {colunas.map((e, i) => {
                        const inicioFase = i > 0 && e.grupo !== colunas[i - 1].grupo
                        return (
                          <td key={e.id} className={inicioFase ? 'is-inicio-fase' : undefined}>
                            {e.papel === p.id && (
                              <button
                                type="button"
                                className={`pl-no${e.melhoria ? ' is-melhoria' : ''}`}
                                title={e.titulo}
                                aria-label={`Etapa ${numero(e)}: ${e.titulo}`}
                                onClick={() => irPara(e.id)}
                              >
                                {numero(e)}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pl-legenda">
              <span>Cada linha é um papel; os números seguem a ordem das etapas. Clique para ir até a etapa.</span>
              <span><span className="pl-legenda-melhoria" /> Melhoria pendente</span>
            </div>
          </div>

          {/* Filtro: destaca as etapas de um papel */}
          <div className="filters-bar" role="group" aria-label="Destacar etapas de um papel">
            <span className="pl-filtro-rotulo">Destacar</span>
            {usados.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pl-chip${filtro === p.id ? ' is-active' : ''}`}
                style={{ '--c': p.cor }}
                aria-pressed={filtro === p.id}
                onClick={() => setFiltro(filtro === p.id ? null : p.id)}
              >
                <span className="pl-dot" />{p.nome}
              </button>
            ))}
          </div>

          {fases.map((f) => (
            <section key={f.nome} className="pl-fase">
              <div className="pl-fase-topo">
                <h3>{f.nome}</h3>
                <span className="pl-fase-conta">{f.etapas.length} etapa{f.etapas.length > 1 ? 's' : ''}</span>
              </div>
              <ol className="pl-etapas">
                {f.etapas.map((e) => (
                  <CartaoEtapa
                    key={e.id}
                    etapa={e}
                    numero={numero(e)}
                    papel={papelPorId[e.papel]}
                    apagada={filtro !== null && e.papel !== filtro}
                  />
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function CartaoEtapa({ etapa: e, numero, papel, apagada }) {
  const checklist = (Array.isArray(e.checklist) ? e.checklist : [])
    .map((c) => (typeof c === 'string' ? c : c?.texto))
    .filter(Boolean)

  return (
    <li
      id={`pl-etapa-${e.id}`}
      className={`card pl-etapa${apagada ? ' is-apagada' : ''}`}
      style={{ '--c': papel?.cor ?? COR_SEM_PAPEL }}
    >
      <div className="pl-etapa-n">{String(numero).padStart(2, '0')}</div>
      <div className="pl-etapa-corpo">
        <h4>{e.titulo}</h4>
        <div className="pl-etapa-meta">
          <span className="badge pl-badge-papel"><span className="pl-dot" />{papel?.nome ?? 'Sem papel'}</span>
          {e.canal && <span className="badge badge-gray">{e.canal}</span>}
          {e.prazo != null && <span className="badge badge-gray">prazo: {e.prazo} {e.prazo === 1 ? 'dia útil' : 'dias úteis'}</span>}
          {papel?.responsaveis && <span className="pl-quem">{papel.responsaveis}</span>}
        </div>
        {e.detalhes && <p className="pl-detalhes">{e.detalhes}</p>}
        {checklist.length > 0 && (
          <ul className="pl-checklist">
            {checklist.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
        {e.decisao && <div className="pl-callout is-decisao"><b>Decisão</b>{e.decisao}</div>}
        {e.melhoria && <div className="pl-callout is-melhoria"><b>Melhoria pendente</b>{e.melhoria}</div>}
      </div>
    </li>
  )
}

function Equipe({ papeis, etapas }) {
  const lista = ordenarPapeis(papeis)
  const conta = (id, processo) => etapas.filter((e) => e.papel === id && e.processo === processo).length
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

  return (
    <div>
      <div className="pl-intro">
        <h2 className="pl-titulo">Equipe e papéis</h2>
        <p className="page-sub">
          Os processos apontam para papéis, não para pessoas. Quando muda quem responde por um papel,
          o processo inteiro passa a mostrar o novo nome.
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nenhum papel cadastrado</div>
          <div className="empty-sub">A ADM ou a Gestão cria os papéis, como Corretor ou Coordenação Administrativa.</div>
        </div>
      ) : (
        <div className="pl-papeis">
          {lista.map((p) => (
            <div key={p.id} className="card card-body pl-papel" style={{ '--c': p.cor }}>
              <div className="pl-papel-nome"><span className="pl-dot" />{p.nome}</div>
              {p.externo && <span className="badge badge-info">Fora da Imovit</span>}
              <div className="pl-papel-quem">{p.responsaveis || 'Sem responsável definido'}</div>
              <div className="pl-papel-conta">
                {plural(conta(p.id, 'contrato'), 'etapa', 'etapas')} no contrato · {conta(p.id, 'adm')} na administração
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
