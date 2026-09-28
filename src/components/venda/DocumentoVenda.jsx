import { forwardRef } from 'react'

const moeda = (v) =>
  v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dataBR = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

/**
 * Documento da proposta de compra (proponente assina no portal; equipe baixa
 * em PDF). Renderizado num bloco próprio para o html2pdf capturar.
 */
const DocumentoVenda = forwardRef(function DocumentoVenda({ proposta, assinaturaUrl }, ref) {
  return (
    <div ref={ref} style={{ background: '#fff', color: '#1a1a1a', padding: 40, maxWidth: 640, fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ textAlign: 'center', borderBottom: '4px solid #ff5e4d', paddingBottom: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>imovit</div>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>Proposta de compra</div>
      </div>

      <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>Proposta de compra</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>
        Eu, <strong>{proposta.nome_cliente}</strong> ({proposta.email}
        {proposta.telefone ? ` · ${proposta.telefone}` : ''}), apresento proposta de compra
        {proposta.imovel_titulo ? <> para <strong>{proposta.imovel_titulo}</strong></> : <> para o imóvel <strong>{proposta.codigo_imovel}</strong></>}
        {proposta.imovel_endereco ? <> ({proposta.imovel_endereco})</> : ''} no valor de{' '}
        <strong>{moeda(proposta.valor_proposta ?? proposta.valor_referencia)}</strong>.
      </p>

      {proposta.descricao_proposta && (
        <>
          <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '24px 0 8px' }}>Descrição da proposta</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposta.descricao_proposta}</p>
        </>
      )}

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '24px 0 8px' }}>Assinatura do proponente</h3>
      {assinaturaUrl ? (
        <img src={assinaturaUrl} alt="Assinatura do proponente" style={{ maxWidth: 320, borderBottom: '1px solid #1a1a1a' }} />
      ) : (
        <p style={{ fontSize: 14 }}>(assinatura em arquivo: {proposta.assinatura_path ?? '—'})</p>
      )}
      <p style={{ fontSize: 13, color: '#555' }}>
        {proposta.nome_cliente} · {dataBR(proposta.atualizado_em)}
      </p>

      <p style={{ fontSize: 11, color: '#999', marginTop: 32, borderTop: '1px solid #eee', paddingTop: 12 }}>
        Documento gerado pelo Hub Imovit · proposta {String(proposta.id).slice(0, 8)} · {dataBR(proposta.timestamp_criacao)}
      </p>
    </div>
  )
})

export default DocumentoVenda
