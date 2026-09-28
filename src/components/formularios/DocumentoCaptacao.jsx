import { forwardRef } from 'react'

const moeda = (v) => (v == null || v === '' ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const estilo = {
  pagina: { background: '#fff', color: '#1a1a1a', padding: 36, width: 700, fontFamily: "'DM Sans', Arial, sans-serif", fontSize: 12.5, lineHeight: 1.55 },
  topo: { textAlign: 'center', borderBottom: '4px solid #ff5e4d', paddingBottom: 18, marginBottom: 20 },
  secao: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', margin: '18px 0 6px', fontWeight: 700 },
  tabela: { width: '100%', borderCollapse: 'collapse' },
  rotulo: { color: '#666', padding: '3px 12px 3px 0', verticalAlign: 'top', width: '38%' },
}

function Linhas({ itens }) {
  const visiveis = itens.filter(([, v]) => v != null && String(v).trim() !== '')
  if (!visiveis.length) return null
  return (
    <table style={estilo.tabela}>
      <tbody>
        {visiveis.map(([r, v]) => (
          <tr key={r}><td style={estilo.rotulo}>{r}</td><td style={{ padding: '3px 0', whiteSpace: 'pre-wrap' }}>{v}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Autorização de captação assinada pelo proprietário (PDF). Usada na página
 * pública logo após assinar e em /captacoes; renderizada fora da tela e
 * convertida pelo html2pdf. A assinatura é data URL (sem CORS).
 */
const DocumentoCaptacao = forwardRef(function DocumentoCaptacao({ captacao: c }, ref) {
  return (
    <div ref={ref} style={estilo.pagina}>
      <div style={estilo.topo}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>imovit</div>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>Autorização de captação</div>
      </div>

      <div className="doc-bloco">
        <div style={estilo.secao}>Proprietário</div>
        <Linhas itens={[['Nome', c.proprietario_nome], ['CPF', c.proprietario_cpf], ['Telefone', c.proprietario_telefone], ['E-mail', c.proprietario_email], ['Corretor responsável', c.corretor]]} />
      </div>

      <div className="doc-bloco">
        <div style={estilo.secao}>Imóvel</div>
        <Linhas itens={[
          ['Tipo', c.tipo_imovel],
          ['Finalidade', c.finalidade],
          ['Exclusividade Imovit', c.exclusividade ? `Sim, por ${c.exclusividade_periodo}` : 'Não'],
          ['Endereço', [c.logradouro, c.numero].filter(Boolean).join(', ')],
          ['Complemento', [c.apto_sala && `Apto/sala ${c.apto_sala}`, c.bloco && `Bloco ${c.bloco}`, c.quadra && `Quadra ${c.quadra}`].filter(Boolean).join(' · ')],
          ['Bairro', c.bairro],
          ['CEP', c.cep],
        ]} />
      </div>

      <div className="doc-bloco">
        <div style={estilo.secao}>Valores</div>
        <Linhas itens={[['Venda', moeda(c.valor_venda)], ['Locação', moeda(c.valor_locacao)], ['Condomínio', moeda(c.valor_condominio)], ['IPTU mensal', moeda(c.iptu_mensal)]]} />
      </div>

      <div className="doc-bloco">
        <div style={estilo.secao}>Atributos</div>
        <Linhas itens={[
          ['Área interna', c.area_interna != null ? `${c.area_interna} m²` : null],
          ['Área do lote/terreno', c.area_terreno != null ? `${c.area_terreno} m²` : null],
          ['Quartos', c.quartos], ['Suítes', c.suites], ['Banheiros', c.banheiros], ['Salas', c.salas],
          ['Vagas', c.vagas ? `${c.vagas}${c.tipo_vaga ? ` (${c.tipo_vaga.toLowerCase()})` : ''}` : null],
          ['Lazer', c.lazer?.length ? c.lazer.join(', ') : null],
          ['Observações', c.observacoes],
        ]} />
      </div>

      <div className="doc-bloco">
        <div style={estilo.secao}>Declaração de ciência</div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, color: '#333' }}>{c.declaracao}</div>
      </div>

      <div className="doc-bloco" style={{ marginTop: 22 }}>
        <div style={estilo.secao}>Assinatura do proprietário</div>
        {c.assinatura && <img src={c.assinatura} alt="Assinatura do proprietário" style={{ maxWidth: 300, maxHeight: 110, borderBottom: '1px solid #1a1a1a' }} />}
        <div style={{ fontSize: 12, color: '#555' }}>{c.proprietario_nome} · assinado em {dataHora(c.assinado_em ?? c.criado_em)}</div>
      </div>

      <div style={{ fontSize: 10, color: '#999', marginTop: 24, borderTop: '1px solid #eee', paddingTop: 10 }}>
        Documento gerado pelo Hub Imovit{c.id ? ` · captação ${String(c.id).slice(0, 8)}` : ''}
      </div>
    </div>
  )
})

export default DocumentoCaptacao
