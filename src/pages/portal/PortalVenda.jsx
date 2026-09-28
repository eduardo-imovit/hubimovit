import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSession } from '../../hooks/useSession'
import { usePerfil } from '../../hooks/usePerfil'
import { pode } from '../../lib/acessos'
import { confirmarPropostaVenda } from '../../lib/vendas'
import { valorBR } from '../../lib/esteiraLabels'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import AssinaturaPad from '../../components/venda/AssinaturaPad'
import DocumentoVenda from '../../components/venda/DocumentoVenda'

/**
 * Portal do proponente (compra): valida a proposta, preenche valor/descrição,
 * assina e recebe o documento de volta. Sem cadastro, sem documentos, sem
 * esteira. A página da locação (PortalStatus) não é tocada.
 */
export default function PortalVenda() {
  const { session, carregando: carregandoSessao } = useSession()
  const email = session?.user?.email ?? ''
  // Equipe testando com o próprio e-mail volta ao painel; o cliente não tem painel no Hub.
  const { perfil } = usePerfil()
  const ehEquipe = pode(perfil, 'vendas')
  const navigate = useNavigate()

  async function concluirESair() {
    await supabase.auth.signOut()
    navigate('/venda/entrar', { replace: true })
  }
  const [propostas, setPropostas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [formPorId, setFormPorId] = useState({})
  const [enviandoId, setEnviandoId] = useState(null)
  const [erroForm, setErroForm] = useState('')
  const [okId, setOkId] = useState(null)
  const [urls, setUrls] = useState({})
  const assinaturaRefs = useRef({})
  const docRefs = useRef({})

  const carregar = useCallback(async () => {
    if (!email) return
    setCarregando(true)
    const { data, error } = await supabase
      .from('propostas_venda')
      .select('*')
      .ilike('email', email)
      .order('timestamp_criacao', { ascending: false })
    if (error) setErro(error.message)
    else {
      setErro(null)
      setPropostas(data ?? [])
    }
    setCarregando(false)
  }, [email])

  useEffect(() => {
    carregar()
  }, [carregar])

  function setForm(id, patch) {
    setFormPorId((f) => ({ ...f, [id]: { ...(f[id] ?? {}), ...patch } }))
  }

  function efetivo(p) {
    if (p.status === 'aguardando_cliente' && p.link_expira_em && new Date(p.link_expira_em) < new Date()) return 'expirada'
    return p.status
  }

  // Assinatura das propostas já assinadas: baixada como blob (URL local), para o
  // html2canvas não esbarrar em imagem de outro domínio ao gerar o PDF.
  useEffect(() => {
    propostas
      .filter((p) => p.status === 'confirmada' && p.assinatura_path)
      .forEach(async (p) => {
        if (urls[p.id]?.assinatura) return
        const { data } = await supabase.storage.from('propostas-venda').download(p.assinatura_path)
        if (data) setUrls((u) => ({ ...u, [p.id]: { assinatura: URL.createObjectURL(data) } }))
      })
  }, [propostas, urls])

  const nomePdf = (p) => `proposta-compra-${p.codigo_imovel}-${p.id.slice(0, 8)}.pdf`

  async function gerarPdf(p) {
    const el = docRefs.current[p.id]
    if (!el) throw new Error('Documento não renderizado')
    const { default: html2pdf } = await import('html2pdf.js')
    const blob = await html2pdf()
      .set({ margin: 10, filename: nomePdf(p), image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } })
      .from(el)
      .outputPdf('blob')
    return blob
  }

  // Gera o PDF, guarda no Storage e registra na proposta (só uma vez por proposta).
  async function gerarESalvarPdf(p) {
    await new Promise((r) => setTimeout(r, 300)) // espera o <img> da assinatura renderizar
    const pdf = await gerarPdf(p)
    const documentoPath = `${p.id}/documento.pdf`
    const { error: erroPdf } = await supabase.storage
      .from('propostas-venda')
      .upload(documentoPath, pdf, { upsert: true, contentType: 'application/pdf' })
    if (erroPdf) throw erroPdf
    const { error: erroReg } = await supabase.rpc('registrar_documento_venda', { p_proposta_id: p.id })
    if (erroReg) throw erroReg
  }

  async function baixarPdf(p) {
    setErroForm('')
    const { data, error } = await supabase.storage
      .from('propostas-venda')
      .createSignedUrl(p.documento_path, 60, { download: nomePdf(p) })
    if (error || !data?.signedUrl) return setErroForm('Não foi possível baixar o PDF. Tente de novo.')
    window.location.assign(data.signedUrl)
  }

  async function handleGerarPdfDepois(p) {
    setErroForm('')
    setEnviandoId(p.id)
    try {
      await gerarESalvarPdf(p)
      await carregar()
    } catch (err) {
      console.error('[venda] falha ao gerar PDF:', err)
      setErroForm('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setEnviandoId(null)
    }
  }

  async function handleConfirmar(p) {
    const form = formPorId[p.id] ?? {}
    setErroForm('')
    const ref = assinaturaRefs.current[p.id]
    if (!form.telefone?.trim()) return setErroForm('Informe seu telefone.')
    if (!form.valor_proposta || Number(form.valor_proposta) <= 0) return setErroForm('Informe o valor da proposta.')
    if (!form.descricao?.trim()) return setErroForm('Descreva sua proposta.')
    if (!ref || ref.vazia()) return setErroForm('Assine no campo indicado.')

    setEnviandoId(p.id)
    try {
      // 1. assinatura → Storage privado
      const blobAss = await ref.toBlob()
      const assinaturaPath = `${p.id}/assinatura.png`
      const { error: erroUp } = await supabase.storage
        .from('propostas-venda')
        .upload(assinaturaPath, blobAss, { upsert: true, contentType: 'image/png' })
      if (erroUp) throw new Error(`Falha ao enviar assinatura: ${erroUp.message}`)

      // 2. confirma (grava valor/endereço/condições no banco p/ inteligência)
      await confirmarPropostaVenda({
        proposta_id: p.id,
        telefone: form.telefone.trim(),
        valor_proposta: Number(form.valor_proposta),
        descricao_proposta: form.descricao.trim(),
        assinatura_path: assinaturaPath,
      })

      // 3. assinatura local (blob) p/ o documento
      setUrls((u) => ({ ...u, [p.id]: { assinatura: URL.createObjectURL(blobAss) } }))
      setOkId(p.id)

      // 4. PDF do documento assinado → Storage + coluna documento_path.
      // Se falhar, a assinatura vale e a tela oferece "Gerar PDF".
      try {
        await gerarESalvarPdf(p)
      } catch (errPdf) {
        console.error('[venda] falha ao gerar PDF, mantendo assinatura:', errPdf)
      }

      await carregar()
    } catch (err) {
      setErroForm(err.message)
    } finally {
      setEnviandoId(null)
    }
  }

  if (carregandoSessao) return <div className="hub-loading">Carregando…</div>
  if (!session) return <Navigate to="/venda/entrar" replace />
  if (carregando) return <div className="hub-loading">Carregando…</div>
  if (erro) return <div className="hub-error">Não foi possível carregar sua proposta: {erro}</div>
  if (propostas.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Nenhuma proposta de compra</div>
        <div className="empty-sub">Quando um corretor criar uma proposta no seu e-mail, ela aparece aqui.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {propostas.map((p) => {
        const status = efetivo(p)
        const form = formPorId[p.id] ?? {}
        const propostaAtual = okId === p.id ? { ...p, ...{ telefone: form.telefone, valor_proposta: Number(form.valor_proposta), descricao_proposta: form.descricao, assinatura_path: `${p.id}/assinatura.png` } } : p
        return (
          <div key={p.id} className="card card-body">
            <div className="page-eyebrow">Proposta de compra</div>
            <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>
              {p.imovel_titulo || `Imóvel ${p.codigo_imovel}`}
            </div>
            <div className="page-sub">
              Cliente/proponente: {p.nome_cliente} · {p.email}
              {p.imovel_endereco ? ` · ${p.imovel_endereco}` : ''} · referência {valorBR(p.valor_referencia)}
            </div>

            {status === 'confirmada' || okId === p.id ? (
              <div>
                <div className="home-tudo-em-dia" style={{ margin: 'var(--space-4) 0' }}>
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>Proposta assinada com sucesso.</strong>
                    <div>Baixe abaixo a sua via da proposta assinada, em PDF.</div>
                  </div>
                </div>
                {urls[p.id]?.assinatura && (
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="page-eyebrow">Assinatura</div>
                    <img src={urls[p.id].assinatura} alt="Assinatura do proponente" style={{ maxWidth: 280, border: '1px solid var(--champagne)', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                )}
                {erroForm && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erroForm}</div>}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {p.documento_path ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => baixarPdf(p)}>
                      Baixar proposta assinada (PDF)
                    </button>
                  ) : enviandoId === p.id ? (
                    <button type="button" className="btn btn-primary btn-sm" disabled>Gerando PDF…</button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleGerarPdfDepois(p)} disabled={!urls[p.id]?.assinatura}>
                      Gerar PDF da proposta
                    </button>
                  )}
                  {ehEquipe ? (
                    <Link to="/admin/vendas/processos" className="btn btn-ghost btn-sm">Voltar ao painel</Link>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={concluirESair}>Concluir e sair</button>
                  )}
                </div>
                {/* bloco oculto p/ gerar o PDF */}
                <div style={{ position: 'absolute', left: -9999, top: 0 }}>
                  <DocumentoVenda proposta={propostaAtual} assinaturaUrl={urls[p.id]?.assinatura} ref={(el) => { docRefs.current[p.id] = el }} />
                </div>
              </div>
            ) : status === 'expirada' ? (
              <div className="hub-error">O link desta proposta expirou. Fale com seu corretor.</div>
            ) : status === 'descartada' ? (
              <div className="hub-error">Esta proposta foi descartada. Fale com seu corretor.</div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); handleConfirmar(p) }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}
              >
                {erroForm && <div className="login-error">{erroForm}</div>}
                <div className="field">
                  <label htmlFor={`pv-tel-${p.id}`}>Telefone</label>
                  <input id={`pv-tel-${p.id}`} required value={form.telefone ?? ''} onChange={(e) => setForm(p.id, { telefone: e.target.value })} placeholder="(19) 99999-9999" />
                </div>
                <div className="field">
                  <label htmlFor={`pv-valor-${p.id}`}>Valor da proposta (R$)</label>
                  <CurrencyInput id={`pv-valor-${p.id}`} required value={form.valor_proposta ?? ''} onChange={(valor) => setForm(p.id, { valor_proposta: valor })} />
                </div>
                <div className="field">
                  <label htmlFor={`pv-desc-${p.id}`}>Descreva sua proposta</label>
                  <textarea
                    id={`pv-desc-${p.id}`}
                    required
                    rows={4}
                    value={form.descricao ?? ''}
                    onChange={(e) => setForm(p.id, { descricao: e.target.value })}
                    placeholder="Condições de pagamento, prazos, cláusulas…"
                  />
                </div>
                <div className="field">
                  <label>Assinatura do proponente</label>
                  <AssinaturaPad ref={(el) => { assinaturaRefs.current[p.id] = el }} />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={enviandoId === p.id}>
                  {enviandoId === p.id ? 'Assinando…' : 'Assinar proposta'}
                </button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
