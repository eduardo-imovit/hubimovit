import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import ModalPortal from '../../components/esteira/ModalPortal'
import { useProcessoLocacao } from '../../hooks/useProcessoLocacao'
import { usePerfil } from '../../hooks/usePerfil'
import { pode } from '../../lib/acessos'
import {
  ABAS, PROCESSOS, CANAIS, COR_SEM_PAPEL, etapasDe, fasesDe, papeisUsados, ordenarPapeis,
  itensChecklist, ordemNova, trocaDeOrdem, etapaDoFormulario, formularioDaEtapa,
} from '../../lib/processoLocacao'

/**
 * Propostas › Locação › Processo (RF33, PRD §5.20).
 * Todo o time lê; gestão/adm editam (S3). A permissão de verdade está no banco (RLS):
 * aqui os botões só aparecem para quem pode usá-los.
 */
export default function ProcessoLocacao() {
  const dados = useProcessoLocacao()
  const { papeis, etapas, carregando, erro } = dados
  const { perfil } = usePerfil()
  const podeEditar = pode(perfil, 'processoLocacaoEditar')
  const [params, setParams] = useSearchParams()
  const aba = ABAS.some((a) => a.chave === params.get('aba')) ? params.get('aba') : 'contrato'

  // editor aberto: { tipo: 'etapa', etapa, processo, grupo } | { tipo: 'papel', papel } | null
  const [editor, setEditor] = useState(null)
  const [aviso, setAviso] = useState(null)
  const timerAviso = useRef(null)

  function avisar(texto, tipo = 'success') {
    clearTimeout(timerAviso.current)
    setAviso({ texto, tipo })
    timerAviso.current = setTimeout(() => setAviso(null), tipo === 'danger' ? 7000 : 3000)
  }
  useEffect(() => () => clearTimeout(timerAviso.current), [])

  /** Roda uma escrita do hook e avisa o resultado. Devolve true se deu certo. */
  async function escrever(acao, ok) {
    try {
      await acao()
      if (ok) avisar(ok)
      return true
    } catch (e) {
      avisar(`Não foi possível salvar: ${e.message}`, 'danger')
      return false
    }
  }

  async function mover(etapa, dir) {
    const trocas = trocaDeOrdem(etapasDe(etapas, etapa.processo), etapa, dir)
    if (trocas) await escrever(() => dados.moverEtapa(trocas))
  }

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
          ? (
            <Equipe
              papeis={papeis}
              etapas={etapas}
              podeEditar={podeEditar}
              onNovo={() => setEditor({ tipo: 'papel', papel: null })}
              onEditar={(p) => setEditor({ tipo: 'papel', papel: p })}
            />
          )
          : (
            <Processo
              key={aba} // ao trocar de aba, o filtro de papel volta a zero
              processo={aba}
              papeis={papeis}
              etapas={etapas}
              podeEditar={podeEditar}
              onNova={(grupo) => setEditor({ tipo: 'etapa', etapa: null, processo: aba, grupo })}
              onEditar={(e) => setEditor({ tipo: 'etapa', etapa: e, processo: e.processo, grupo: e.grupo })}
              onMover={mover}
            />
          )
      )}

      {editor?.tipo === 'etapa' && (
        <EditorEtapa
          {...editor}
          papeis={papeis}
          todas={etapasDe(etapas, editor.processo)}
          dados={dados}
          escrever={escrever}
          onFechar={() => setEditor(null)}
        />
      )}
      {editor?.tipo === 'papel' && (
        <EditorPapel
          papel={editor.papel}
          papeis={papeis}
          etapas={etapas}
          dados={dados}
          escrever={escrever}
          onFechar={() => setEditor(null)}
        />
      )}

      {aviso && (
        <div className="pl-avisos" role="status" aria-live="polite">
          <div className={`toast toast-${aviso.tipo}`}>
            <span className="toast-icon">{aviso.tipo === 'danger' ? '!' : '✓'}</span>
            <div className="toast-body">{aviso.texto}</div>
            <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={() => setAviso(null)}>×</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================== processo ============================== */

function Processo({ processo, papeis, etapas, podeEditar, onNova, onEditar, onMover }) {
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
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`pl-etapa-${id}`)?.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'center' })
  }

  return (
    <div>
      <div className="pl-intro">
        <div>
          <h2 className="pl-titulo">{info.nome}</h2>
          <p className="page-sub">
            {info.desc} {todas.length} etapas{melhorias > 0 && `, ${melhorias} com melhoria pendente`}.
            {podeEditar ? ' Use Editar e as setas para mudar o desenho.' : ' Só ADM e Gestão editam o desenho do processo.'}
          </p>
        </div>
        {podeEditar && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNova(fases[fases.length - 1]?.nome ?? '')}>
            Nova etapa
          </button>
        )}
      </div>

      {info.nota && <div className="pl-nota">{info.nota}</div>}

      {todas.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nenhuma etapa ainda</div>
          <div className="empty-sub">
            {podeEditar ? 'Comece pela primeira etapa deste processo em "Nova etapa".' : 'Quando a ADM ou a Gestão desenhar este processo, as etapas aparecem aqui.'}
          </div>
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
                {podeEditar && (
                  <button type="button" className="btn btn-ghost btn-sm pl-fase-add" onClick={() => onNova(f.nome)}>
                    + Etapa nesta fase
                  </button>
                )}
              </div>
              <ol className="pl-etapas">
                {f.etapas.map((e) => (
                  <CartaoEtapa
                    key={e.id}
                    etapa={e}
                    numero={numero(e)}
                    papel={papelPorId[e.papel]}
                    apagada={filtro !== null && e.papel !== filtro}
                    podeEditar={podeEditar}
                    primeira={numero(e) === 1}
                    ultima={numero(e) === todas.length}
                    onEditar={() => onEditar(e)}
                    onMover={(dir) => onMover(e, dir)}
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

function CartaoEtapa({ etapa: e, numero, papel, apagada, podeEditar, primeira, ultima, onEditar, onMover }) {
  const checklist = itensChecklist(e)

  return (
    <li
      id={`pl-etapa-${e.id}`}
      className={`card pl-etapa${apagada ? ' is-apagada' : ''}${podeEditar ? ' pl-etapa--editavel' : ''}`}
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
      {podeEditar && (
        <div className="pl-etapa-acoes">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEditar}>Editar</button>
          <div className="pl-etapa-setas">
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Subir etapa ${numero}`} title="Subir" disabled={primeira} onClick={() => onMover(-1)}>↑</button>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Descer etapa ${numero}`} title="Descer" disabled={ultima} onClick={() => onMover(1)}>↓</button>
          </div>
        </div>
      )}
    </li>
  )
}

/* ============================== equipe ============================== */

function Equipe({ papeis, etapas, podeEditar, onNovo, onEditar }) {
  const lista = ordenarPapeis(papeis)
  const conta = (id, processo) => etapas.filter((e) => e.papel === id && e.processo === processo).length
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

  return (
    <div>
      <div className="pl-intro">
        <div>
          <h2 className="pl-titulo">Equipe e papéis</h2>
          <p className="page-sub">
            Os processos apontam para papéis, não para pessoas. Quando muda quem responde por um papel,
            o processo inteiro passa a mostrar o novo nome.
          </p>
        </div>
        {podeEditar && <button type="button" className="btn btn-primary btn-sm" onClick={onNovo}>Novo papel</button>}
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
              {podeEditar && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditar(p)}>Editar</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================== editores ============================== */

/** Moldura dos modais desta página (mesmo padrão de OnboardingAdmin). Esc fecha. */
function Modal({ titulo, onFechar, rodape, children }) {
  useEffect(() => {
    const tecla = (ev) => { if (ev.key === 'Escape') onFechar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar])

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onFechar}>
        <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{titulo}</div>
            <button type="button" className="modal-close" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body pl-modal-corpo">{children}</div>
          <div className="modal-footer pl-modal-rodape">{rodape}</div>
        </div>
      </div>
    </ModalPortal>
  )
}

function EditorEtapa({ etapa, processo, grupo, papeis, todas, dados, escrever, onFechar }) {
  const [form, setForm] = useState(() => ({ ...formularioDaEtapa(etapa), grupo: etapa?.grupo ?? grupo ?? '' }))
  const [salvando, setSalvando] = useState(false)
  const [falta, setFalta] = useState('')
  const [confirmar, setConfirmar] = useState(null) // null | { casos: n }
  const fases = [...new Set(todas.map((e) => e.grupo))]
  const campo = (nome) => ({ id: `pl-f-${nome}`, value: form[nome], onChange: (ev) => setForm({ ...form, [nome]: ev.target.value }) })

  async function salvar(ev) {
    ev.preventDefault()
    if (!form.titulo.trim()) return setFalta('Diga o que acontece nesta etapa.')
    setFalta('')
    setSalvando(true)
    const campos = etapaDoFormulario(form)
    const ok = etapa
      ? await escrever(() => dados.salvarEtapa(etapa.id, campos), 'Etapa salva.')
      : await escrever(() => dados.salvarEtapa(null, { ...campos, processo, ordem: ordemNova(todas, campos.grupo) }), 'Etapa criada.')
    setSalvando(false)
    if (ok) onFechar()
  }

  async function pedirExclusao() {
    setConfirmar({ casos: await dados.casosNaEtapa(etapa.id) })
  }

  async function excluir() {
    setSalvando(true)
    const ok = await escrever(() => dados.excluirEtapa(etapa.id), 'Etapa excluída.')
    setSalvando(false)
    if (ok) onFechar()
  }

  return (
    <Modal
      titulo={etapa ? 'Editar etapa' : 'Nova etapa'}
      onFechar={onFechar}
      rodape={(
        <>
          {etapa && !confirmar && (
            <button type="button" className="btn btn-danger btn-sm" onClick={pedirExclusao} disabled={salvando}>Excluir etapa</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>Cancelar</button>
          <button type="submit" form="pl-form-etapa" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id="pl-form-etapa" onSubmit={salvar} noValidate className="pl-form">
        <div className={`field${falta ? ' field-error' : ''}`}>
          <label htmlFor="pl-f-titulo">O que acontece</label>
          <input {...campo('titulo')} placeholder="Ex.: Validar minuta com as partes" autoFocus />
          {falta && <span className="field-hint">{falta}</span>}
        </div>

        <div className="pl-form-grade">
          <div className="field">
            <label htmlFor="pl-f-papel">Quem faz</label>
            <select {...campo('papel')}>
              <option value="">Sem papel definido</option>
              {ordenarPapeis(papeis).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pl-f-grupo">{processo === 'adm' ? 'Fase / fluxo' : 'Fase'}</label>
            <input {...campo('grupo')} list="pl-fases" placeholder="Sem fase" />
            <datalist id="pl-fases">{fases.map((g) => <option key={g} value={g} />)}</datalist>
            <span className="field-hint">Escolha uma fase existente ou digite um nome novo.</span>
          </div>
          <div className="field">
            <label htmlFor="pl-f-canal">Canal</label>
            <input {...campo('canal')} list="pl-canais" />
            <datalist id="pl-canais">{CANAIS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor="pl-f-prazo">Prazo (dias úteis)</label>
            <input {...campo('prazo')} type="number" min="0" step="1" inputMode="numeric" placeholder="Sem prazo" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pl-f-detalhes">Detalhes</label>
          <textarea {...campo('detalhes')} rows={3} />
        </div>
        <div className="field">
          <label htmlFor="pl-f-checklist">Checklist</label>
          <textarea {...campo('checklist')} rows={4} placeholder="Um item por linha" />
          <span className="field-hint">Um item por linha.</span>
        </div>
        <div className="field">
          <label htmlFor="pl-f-decisao">Decisão / desvio</label>
          <textarea {...campo('decisao')} rows={2} placeholder="Ex.: Se não estiver ok → pedir mais documentos" />
        </div>
        <div className="field">
          <label htmlFor="pl-f-melhoria">Melhoria pendente</label>
          <textarea {...campo('melhoria')} rows={2} placeholder="O que ainda precisa mudar nesta etapa" />
        </div>

        {confirmar && (
          <div className="pl-confirmar" role="alert">
            <p>
              Excluir “{etapa.titulo}”? Não tem volta.
              {confirmar.casos > 0 && ` ${confirmar.casos} processo(s) em andamento estão nesta etapa e ficarão sem etapa atual.`}
              {' '}Se a etapa só mudou, prefira editar.
            </p>
            <div className="pl-confirmar-botoes">
              <button type="button" className="btn btn-danger btn-sm" onClick={excluir} disabled={salvando}>Excluir de vez</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmar(null)}>Manter</button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}

function EditorPapel({ papel, papeis, etapas, dados, escrever, onFechar }) {
  const [form, setForm] = useState({
    nome: papel?.nome ?? '',
    cor: papel?.cor ?? COR_SEM_PAPEL,
    responsaveis: papel?.responsaveis ?? '',
    externo: papel?.externo ?? false,
  })
  const [salvando, setSalvando] = useState(false)
  const [falta, setFalta] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const emUso = papel ? etapas.filter((e) => e.papel === papel.id).length : 0

  async function salvar(ev) {
    ev.preventDefault()
    if (!form.nome.trim()) return setFalta('Dê um nome ao papel, como "Corretor".')
    setFalta('')
    setSalvando(true)
    const campos = { nome: form.nome.trim(), cor: form.cor, responsaveis: form.responsaveis.trim(), externo: form.externo }
    const ordem = Math.max(0, ...papeis.map((p) => Number(p.ordem) || 0)) + 10
    const ok = papel
      ? await escrever(() => dados.salvarPapel(papel.id, campos), 'Papel salvo.')
      : await escrever(() => dados.salvarPapel(null, { ...campos, ordem }), 'Papel criado.')
    setSalvando(false)
    if (ok) onFechar()
  }

  async function excluir() {
    setSalvando(true)
    const ok = await escrever(() => dados.excluirPapel(papel.id), 'Papel excluído.')
    setSalvando(false)
    if (ok) onFechar()
  }

  return (
    <Modal
      titulo={papel ? 'Editar papel' : 'Novo papel'}
      onFechar={onFechar}
      rodape={(
        <>
          {papel && !confirmar && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmar(true)} disabled={salvando}>Excluir papel</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFechar}>Cancelar</button>
          <button type="submit" form="pl-form-papel" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id="pl-form-papel" onSubmit={salvar} noValidate className="pl-form">
        <div className="pl-form-grade pl-form-grade--cor">
          <div className={`field${falta ? ' field-error' : ''}`}>
            <label htmlFor="pl-p-nome">Nome do papel</label>
            <input id="pl-p-nome" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} placeholder="Ex.: Coordenação Administrativa" autoFocus />
            {falta && <span className="field-hint">{falta}</span>}
          </div>
          <div className="field">
            <label htmlFor="pl-p-cor">Cor</label>
            <input id="pl-p-cor" type="color" className="pl-cor" value={form.cor} onChange={(ev) => setForm({ ...form, cor: ev.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pl-p-resp">Responsáveis</label>
          <input id="pl-p-resp" value={form.responsaveis} onChange={(ev) => setForm({ ...form, responsaveis: ev.target.value })} placeholder="Nomes, separados por vírgula" />
          <span className="field-hint">Aparece em todas as etapas deste papel.</span>
        </div>
        <label className="pl-check">
          <input type="checkbox" checked={form.externo} onChange={(ev) => setForm({ ...form, externo: ev.target.checked })} />
          Fora da Imovit (ex.: seguradora, cartório)
        </label>

        {confirmar && (
          <div className="pl-confirmar" role="alert">
            {emUso > 0 ? (
              <>
                <p>Este papel está em {emUso} etapa{emUso > 1 ? 's' : ''}. Troque o “Quem faz” dessas etapas antes de excluir.</p>
                <div className="pl-confirmar-botoes">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmar(false)}>Entendi</button>
                </div>
              </>
            ) : (
              <>
                <p>Excluir o papel “{papel.nome}”? Não tem volta.</p>
                <div className="pl-confirmar-botoes">
                  <button type="button" className="btn btn-danger btn-sm" onClick={excluir} disabled={salvando}>Excluir de vez</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmar(false)}>Manter</button>
                </div>
              </>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
