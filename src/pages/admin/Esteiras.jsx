import { useState } from 'react'
import JSZip from 'jszip'
import { usePropostasLocacao } from '../../hooks/usePropostasLocacao'
import { useDocumentosEsteira } from '../../hooks/useDocumentosEsteira'
import { supabase } from '../../lib/supabaseClient'
import { decidirDocumento, marcarSincronizada } from '../../lib/esteira'

function sanitizarNomeArquivo(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')
}

const STATUS_LABEL = {
  aguardando_docs: 'Aguardando documentos',
  docs_em_analise: 'Docs em análise',
  docs_aprovados: 'Docs aprovados',
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostasEsteira.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome_cliente || p.email}</td>
                  <td>{p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}</td>
                  <td>{STATUS_LABEL[p.status_efetivo] ?? p.status_efetivo}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPropostaSelecionadaId(p.id)}>
                      Ver documentos
                    </button>
                  </td>
                </tr>
              ))}
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
  const [erro, setErro] = useState('')

  async function handleDecisao(documentoId, decisao) {
    setErro('')
    setProcessandoId(documentoId)
    try {
      const feedback = decisao === 'rejeitado' ? window.prompt('Motivo da rejeição (opcional):') ?? undefined : undefined
      await decidirDocumento({ documento_id: documentoId, decisao, feedback })
      await Promise.all([recarregar(), onAtualizar()])
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  const documentosEnviados = checklist.filter((doc) => doc.envio?.arquivo_path)

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
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="page-eyebrow">
        {proposta.imovel_titulo || `Imóvel ${proposta.codigo_imovel}`} · {proposta.nome_cliente || proposta.email}
      </div>

      {erro && <div className="login-error">{erro}</div>}

      {carregando && <div className="hub-loading">Carregando checklist…</div>}

      {!carregando && (
        <div className="avisos-list">
          {checklist.map((doc) => (
            <div className="avisos-item" key={doc.codigo}>
              <div className="avisos-item-body">
                <span className="avisos-item-title">{doc.nome}</span>
                <div className="avisos-item-sub">
                  {doc.envio?.status ?? 'pendente'}
                  {doc.envio?.status === 'rejeitado' && doc.envio?.feedback_adm ? ` · ${doc.envio.feedback_adm}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
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
                      onClick={() => handleDecisao(doc.envio.id, 'rejeitado')}
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

      {proposta.status_efetivo === 'docs_aprovados' && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setMostrarConfirmacao(true)}>
          Finalizar processo
        </button>
      )}

      {mostrarConfirmacao && (
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
      )}
    </div>
  )
}
