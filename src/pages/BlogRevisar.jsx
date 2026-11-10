import { useEffect, useState } from 'react'
import { listarRascunhos, lerPost, decidir, htmlSeguro } from '../lib/blog'

const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const MENSAGEM = {
  aprovado: (t) => `"${t}" foi publicado no site.`,
  rejeitado: (t) => `"${t}" voltou para a fila. O robô reescreve em até 15 minutos e você recebe o aviso.`,
  ja_decidido: (t) => `"${t}" já tinha sido decidido por outra pessoa.`,
  nao_encontrado: () => 'Esse post não existe mais.',
}

/**
 * Revisar blog (RF35, PRD §5.22): rascunhos gerados pelo motor de pauta. Gestão e
 * marketing leem o artigo como vai ficar no site e aprovam ou devolvem com "o que mudar".
 */
export default function BlogRevisar() {
  const [itens, setItens] = useState(null)
  const [selId, setSelId] = useState(null)
  const [post, setPost] = useState(null)
  const [modo, setModo] = useState('ler') // ler | aprovar | rejeitar
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    listarRascunhos()
      .then((lista) => {
        setItens(lista)
        if (lista.length) setSelId(lista[0].id)
      })
      .catch((e) => setErro(e.message))
  }, [])

  useEffect(() => {
    if (!selId) { setPost(null); return }
    setPost(null)
    setModo('ler')
    setObservacao('')
    lerPost(selId).then(setPost).catch((e) => setErro(e.message))
  }, [selId])

  async function confirmar() {
    setEnviando(true)
    setErro('')
    try {
      const r = await decidir(post.id, modo === 'aprovar' ? 'approve' : 'reject', observacao)
      setAviso((MENSAGEM[r?.resultado] ?? (() => 'Decisão registrada.'))(r?.titulo ?? post.titulo))
      const resto = itens.filter((p) => p.id !== post.id)
      setItens(resto)
      setSelId(resto[0]?.id ?? null)
    } catch (e) {
      setErro(e.code === '42501' ? 'Você não tem permissão para revisar o blog.' : `Não foi possível registrar: ${e.message}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Blog</div>
          <div className="page-title">Revisar posts</div>
          <div className="page-sub">Leia como vai ficar no site. Aprovar publica na hora; devolver manda o robô reescrever.</div>
        </div>
      </header>

      {aviso && <div className="card card-body blog-aviso" role="status">{aviso}</div>}
      {erro && <div className="hub-error">{erro}</div>}
      {itens === null && !erro && <div className="hub-loading">Carregando os rascunhos…</div>}
      {itens?.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nada para revisar</div>
          <div className="empty-sub">Quando o robô escrever um post novo, ele aparece aqui e você recebe um aviso por e-mail.</div>
        </div>
      )}

      {itens?.length > 0 && (
        <div className="blog-revisar">
          <nav className="blog-lista" aria-label="Rascunhos">
            {itens.map((p) => (
              <button key={p.id} type="button" className={`blog-lista-item${p.id === selId ? ' is-ativo' : ''}`}
                aria-current={p.id === selId} onClick={() => { setSelId(p.id); setAviso('') }}>
                <span className="blog-lista-titulo">{p.titulo}</span>
                <span className="blog-lista-meta">{fmtData(p.data_geracao)}</span>
              </button>
            ))}
          </nav>

          <section className="card card-body blog-leitura" aria-busy={!post}>
            {!post && <div className="hub-loading">Abrindo o artigo…</div>}
            {post && (
              <>
                <div className="blog-pauta">
                  <div><strong>Pauta:</strong> {post.tema}</div>
                  {post.publico && <div><strong>Para quem:</strong> {post.publico}</div>}
                </div>

                <div className="blog-acoes">
                  {modo === 'ler' && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setModo('aprovar')}>Aprovar</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModo('rejeitar')}>Devolver para correção</button>
                    </>
                  )}
                  {modo === 'aprovar' && (
                    <div className="blog-confirma">
                      <p>Publicar <strong>{post.titulo}</strong> no site agora?</p>
                      <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={confirmar}>
                        {enviando ? 'Publicando…' : 'Sim, publicar'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => setModo('ler')}>Cancelar</button>
                    </div>
                  )}
                  {modo === 'rejeitar' && (
                    <div className="blog-confirma">
                      <div className="field">
                        <label htmlFor="blog-obs">O que mudar (opcional)</label>
                        <textarea id="blog-obs" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)}
                          placeholder="Ex.: menos genérico, cite as escolas do bairro, corte a parte de investimento" />
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={confirmar}>
                        {enviando ? 'Devolvendo…' : 'Devolver para o robô'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => setModo('ler')}>Cancelar</button>
                    </div>
                  )}
                </div>

                <article className="blog-artigo">
                  {/* o HTML do robô costuma trazer o próprio <h1>; só põe o título quando não traz */}
                  {!/<h1[\s>]/i.test(post.conteudo_html ?? '') && <h1>{post.titulo}</h1>}
                  {/* conteúdo passa pelo DOMPurify em htmlSeguro (lib/blog.js) */}
                  <div dangerouslySetInnerHTML={{ __html: htmlSeguro(post.conteudo_html) }} />
                </article>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
