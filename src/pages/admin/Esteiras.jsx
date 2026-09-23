import { useState } from 'react'
import JSZip from 'jszip'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { useDocumentosEsteira } from '../../hooks/useDocumentosEsteira'
import { supabase } from '../../lib/supabaseClient'
import { decidirDocumento, marcarSincronizada, solicitarAjustes } from '../../lib/esteira'
import { formatarPrazo } from '../../lib/esteiraLabels'
import { StatusBadge, DocStatusBadge } from '../../components/esteira/StatusBadge'
import ReasonModal from '../../components/esteira/ReasonModal'
import ModalPortal from '../../components/esteira/ModalPortal'

function sanitizarNomeArquivo(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')
}

const STATUS_RELEVANTES = ['aguardando_docs', 'docs_em_analise', 'docs_aprovados']

async function abrirArquivo(path) {
  const { data, error } = await supabase.storage.from('esteira-documentos').createSignedUrl(path, 300)
  if (error || !data) return
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export default function Esteiras() {
  const { propostas, carregando, erro, recarregar } = usePropostasLocacao()
  const [propostaSelecionadaId, setPropostaSelecionadaId] = useState(null)

  const propostasEsteira = propostas.filter((p) => STATUS_RELEVANTES.includes(p.status_efetivo))
  const propostaSelecionada = propostasEsteira.find((p) => p.id === propostaSelecionadaId) ?? null

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Admin</div>
          <div className="page-title">Esteiras</div>
          <div className="page-sub">Revise os documentos enviados por cada locatário e aprove ou rejeite.</div>
        </div>
      </header>

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as esteiras: {erro}</div>}

      {!carregando && !erro && propostasEsteira.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhuma esteira em andamento</div>
          <div className="empty-sub">Propostas aparecem aqui depois que o proprietário aprova, até a documentação ser sincronizada.</div>
        </div>
      )}

      {propostasEsteira.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 'var(--space-5)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Locatário</th>
                <th>Imóvel</th>
                <th>Status</th>
                <th>Prazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostasEsteira.map((p) => {
                const prazo = formatarPrazo(p.link_expira_em, p.status_efetivo)
                return (
                  <tr key={p.id}>
                    <td>{p.nome_cliente || p.email}</td>
                    <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                    <td><StatusBadge status={p.status_efetivo} /></td>
                    <td>{prazo ? <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span> : '—'}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPropostaSelecionadaId(p.id)}>
                        Ver documentos
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {propostaSelecionada && <ChecklistEsteira proposta={propostaSelecionada} onAtualizar={recarregar} />}
    </div>
  )
}

function ChecklistEsteira({ proposta, onAtualizar }) {
  const { checklist, carregando, recarregar } = useDocumentosEsteira(proposta)
  const [processandoId, setProcessandoId] = useState(null)
  const [finalizando, setFinalizando] = useState(false)
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)
  const [rejeitandoId, setRejeitandoId] = useState(null)
  const [mostrarAjustes, setMostrarAjustes] = useState(false)
  const [enviandoAjustes, setEnviandoAjustes] = useState(false)
  const [avisoAjustes, setAvisoAjustes] = useState('')
  const [erro, setErro] = useState('')

  async function handleDecisao(documentoId, decisao, feedback) {
    setErro('')
    setProcessandoId(documentoId)
    try {
      await decidirDocumento({ documento_id: documentoId, decisao, feedback })
      await Promise.all([recarregar(), onAtualizar()])
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  async function handleConfirmarRejeicao(motivo) {
    await handleDecisao(rejeitandoId, 'rejeitado', motivo)
    setRejeitandoId(null)
  }

  const documentosEnviados = checklist.filter((doc) => doc.envio?.arquivo_path)
  const aprovados = checklist.filter((doc) => doc.envio?.status === 'aprovado').length
  const reprovados = checklist.filter((doc) => doc.envio?.status === 'rejeitado')
  // Mesmas regras que a Edge Function confere antes de mandar o e-mail:
  // locatário mandou tudo e o ADM já decidiu cada documento.
  const tudoEnviado = checklist.length > 0 && checklist.every((doc) => doc.envio?.arquivo_path)
  const semDecisaoPendente = !checklist.some((doc) => doc.envio?.status === 'enviado')
  const podeSolicitarAjustes = tudoEnviado && semDecisaoPendente && reprovados.length > 0

  async function handleSolicitarAjustes() {
    setErro('')
    setEnviandoAjustes(true)
    try {
      await solicitarAjustes(proposta.id)
      setMostrarAjustes(false)
      setAvisoAjustes(`E-mail enviado ao locatário com ${reprovados.length} documento(s) para reenviar.`)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviandoAjustes(false)
    }
  }
  const prazo = formatarPrazo(proposta.link_expira_em, proposta.status_efetivo)

  async function handleFinalizar() {
    setErro('')
    setFinalizando(true)
    try {
      if (documentosEnviados.length > 0) {
        const zip = new JSZip()
        for (const doc of documentosEnviados) {
          const { data, error: erroUrl } = await supabase.storage
            .from('esteira-documentos')
            .createSignedUrl(doc.envio.arquivo_path, 300)
          if (erroUrl || !data) continue
          const resposta = await fetch(data.signedUrl)
          const blob = await resposta.blob()
          const extensao = doc.envio.arquivo_path.split('.').pop()
          zip.file(`${sanitizarNomeArquivo(doc.nome)}.${extensao}`, blob)
        }
        const conteudo = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(conteudo)
        const link = document.createElement('a')
        link.href = url
        link.download = `documentos-${sanitizarNomeArquivo(proposta.nome_cliente || proposta.email)}.zip`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }
      await marcarSincronizada(proposta.id)
      setMostrarConfirmacao(false)
      await onAtualizar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div className="esteira-layout">
      <aside className="esteira-sidebar">
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <div className="page-eyebrow" style={{ marginBottom: 2 }}>Locatário</div>
            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', color: 'var(--grafite)' }}>
              {proposta.nome_cliente || proposta.email}
            </div>
          </div>
          <div>
            <div className="page-eyebrow" style={{ marginBottom: 2 }}>Imóvel</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--grafite-mid)' }}>
              {proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`}
            </div>
          </div>
          <StatusBadge status={proposta.status_efetivo} />
          {prazo && <span className={`esteira-prazo ${prazo.urgente ? 'is-urgente' : 'is-ok'}`}>{prazo.texto}</span>}
        </div>

        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <div className="page-eyebrow" style={{ marginBottom: 0 }}>Documentos</div>
            <span className="stat-sub is-muted" style={{ marginTop: 0 }}>{aprovados}/{checklist.length}</span>
          </div>
          <div className="mini-bar-track" style={{ background: 'var(--champagne)' }}>
            <div className="mini-bar-fill" style={{ width: `${checklist.length ? (aprovados / checklist.length) * 100 : 0}%` }} />
          </div>

          {proposta.status_efetivo === 'docs_aprovados' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
              onClick={() => setMostrarConfirmacao(true)}
            >
              Baixar documentos e finalizar
            </button>
          )}

          {podeSolicitarAjustes && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
              onClick={() => { setAvisoAjustes(''); setMostrarAjustes(true) }}
            >
              Solicitar ajustes ({reprovados.length})
            </button>
          )}
          {avisoAjustes && (
            <div className="stat-sub is-muted" style={{ marginTop: 'var(--space-2)' }}>{avisoAjustes}</div>
          )}
        </div>
      </aside>

      <main style={{ minWidth: 0 }}>
        {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}

        {carregando && <div className="hub-loading">Carregando checklist…</div>}

        {!carregando && (
          <div className="upload-list" style={{ marginTop: 0 }}>
            {checklist.map((doc) => (
              <div className="upload-item" key={doc.codigo}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="upload-item-name">{doc.nome}</div>
                  {doc.envio?.status === 'rejeitado' && doc.envio?.feedback_adm && (
                    <div className="timeline-sub" style={{ marginTop: 2 }}>{doc.envio.feedback_adm}</div>
                  )}
                </div>
                <DocStatusBadge status={doc.envio?.status} />
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                  {doc.envio?.arquivo_path && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirArquivo(doc.envio.arquivo_path)}>
                      Ver arquivo
                    </button>
                  )}
                  {doc.envio?.status === 'enviado' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={processandoId === doc.envio.id}
                        onClick={() => handleDecisao(doc.envio.id, 'aprovado')}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={processandoId === doc.envio.id}
                        onClick={() => setRejeitandoId(doc.envio.id)}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {rejeitandoId && (
        <ReasonModal
          title="Rejeitar documento"
          description="O locatário vê esse motivo ao lado do documento no portal. O e-mail só sai quando você clicar em “Solicitar ajustes”, com todos os reprovados juntos."
          confirmLabel="Rejeitar"
          obrigatorio={false}
          processando={processandoId === rejeitandoId}
          onConfirm={handleConfirmarRejeicao}
          onCancel={() => setRejeitandoId(null)}
        />
      )}

      {mostrarAjustes && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !enviandoAjustes && setMostrarAjustes(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Solicitar ajustes?</div>
              <button type="button" className="modal-close" disabled={enviandoAjustes} onClick={() => setMostrarAjustes(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>O locatário vai receber um e-mail só, pedindo para reenviar:</p>
              <ul style={{ paddingLeft: 'var(--space-5)', margin: 'var(--space-2) 0' }}>
                {reprovados.map((doc) => (
                  <li key={doc.codigo}>
                    <strong>{doc.nome}</strong>{doc.envio?.feedback_adm ? `: ${doc.envio.feedback_adm}` : ''}
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost btn-sm" disabled={enviandoAjustes} onClick={() => setMostrarAjustes(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={enviandoAjustes} onClick={handleSolicitarAjustes}>
                {enviandoAjustes ? 'Enviando…' : 'Enviar e-mail'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {mostrarConfirmacao && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !finalizando && setMostrarConfirmacao(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Finalizar processo?</div>
              <button type="button" className="modal-close" disabled={finalizando} onClick={() => setMostrarConfirmacao(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Isso vai, nessa ordem:</p>
              <ol style={{ paddingLeft: 'var(--space-5)', margin: 'var(--space-2) 0' }}>
                <li>Baixar um .zip com os {documentosEnviados.length} documento(s) enviados pra este computador</li>
                <li>Marcar o processo como sincronizado (confirme antes que já lançou no Imoview)</li>
                <li>Apagar os documentos do Storage do Supabase pra liberar espaço</li>
              </ol>
              <p><strong>Não tem como desfazer</strong> — garanta que o .zip baixou certo antes de fechar esta tela.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost btn-sm" disabled={finalizando} onClick={() => setMostrarConfirmacao(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={finalizando} onClick={handleFinalizar}>
                {finalizando ? 'Finalizando…' : 'Baixar tudo e finalizar'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
