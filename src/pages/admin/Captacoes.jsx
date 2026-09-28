import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import MeuLinkCaptacao from '../../components/formularios/MeuLinkCaptacao'
import { baixarPdfDoElemento } from '../../lib/pdf'
import { valorBR } from '../../lib/esteiraLabels'
import ModalPortal from '../../components/esteira/ModalPortal'
import DocumentoCaptacao from '../../components/formularios/DocumentoCaptacao'

const data = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

/**
 * Captações assinadas pelos proprietários (RF23, PRD §5.7). Só registro: o
 * corretor conduz o processo. Gestão/Admin veem todas; o corretor, as dele (RLS).
 */
export default function Captacoes() {
  const [captacoes, setCaptacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    // assinatura (base64) só é buscada no detalhe
    const { data: linhas, error } = await supabase
      .from('captacoes')
      .select('id, criado_em, corretor, proprietario_nome, proprietario_telefone, tipo_imovel, finalidade, bairro, valor_venda, valor_locacao, exclusividade')
      .order('criado_em', { ascending: false })
    if (error) setErro(error.message)
    else setCaptacoes(linhas ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Ferramentas</div>
          <div className="page-title">Captações</div>
          <div className="page-sub">Autorizações preenchidas e assinadas pelos proprietários pelo link de cada corretor.</div>
        </div>
      </header>

      <div className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div className="page-eyebrow" style={{ marginBottom: 0 }}>Seu link de captação</div>
        <div className="avisos-item-sub">Mande ao proprietário: ele preenche e assina, e a captação chega para você.</div>
        <MeuLinkCaptacao />
      </div>

      {carregando && <div className="hub-loading">Carregando…</div>}
      {erro && <div className="hub-error">Não foi possível carregar as captações: {erro}</div>}
      {!carregando && !erro && captacoes.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nenhuma captação ainda</div>
          <div className="empty-sub">Envie o link de captação ao proprietário; quando ele assinar, aparece aqui.</div>
        </div>
      )}

      {captacoes.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Data</th><th>Proprietário</th><th>Imóvel</th><th>Valor</th><th>Corretor</th><th></th></tr>
            </thead>
            <tbody>
              {captacoes.map((c) => (
                <tr key={c.id}>
                  <td>{data(c.criado_em)}</td>
                  <td>{c.proprietario_nome}<div className="avisos-item-sub">{c.proprietario_telefone}</div></td>
                  <td>{c.tipo_imovel} · {c.bairro}<div className="avisos-item-sub">{c.finalidade}{c.exclusividade ? ' · exclusividade' : ''}</div></td>
                  <td>{c.finalidade === 'Locação' ? valorBR(c.valor_locacao) : valorBR(c.valor_venda)}</td>
                  <td>{c.corretor}</td>
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalhe(c.id)}>Visualizar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && <DetalheCaptacao id={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}

function DetalheCaptacao({ id, onClose }) {
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [baixando, setBaixando] = useState(false)
  const docRef = useRef(null)

  useEffect(() => {
    supabase.from('captacoes').select('*').eq('id', id).single()
      .then(({ data: linha, error }) => (error ? setErro(error.message) : setC(linha)))
  }, [id])

  async function baixar() {
    setBaixando(true)
    setErro('')
    try {
      const nome = `autorizacao-captacao-${c.proprietario_nome.split(' ')[0].toLowerCase()}-${c.id.slice(0, 8)}.pdf`
      await baixarPdfDoElemento(docRef.current, nome)
    } catch {
      setErro('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="page-eyebrow">Captação</div>
              <div className="modal-title">{c ? c.proprietario_nome : 'Carregando…'}</div>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body">
            {erro && <div className="login-error" style={{ marginBottom: 'var(--space-3)' }}>{erro}</div>}
            {c && (
              <div style={{ overflowX: 'auto', border: '1px solid var(--champagne)', borderRadius: 'var(--radius-md)' }}>
                <DocumentoCaptacao ref={docRef} captacao={c} />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!c || baixando} onClick={baixar}>
              {baixando ? 'Gerando PDF…' : 'Baixar PDF da autorização'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
