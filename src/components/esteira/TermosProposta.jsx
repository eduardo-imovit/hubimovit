import { valorBR } from '../../lib/esteiraLabels'

const dataBR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)

/**
 * Condições negociadas da proposta de locação, na ordem do modelo que a equipe
 * já mandava por e-mail. `incluirTaxa`: a taxa de administração é acordo com o
 * proprietário e só aparece para a equipe (nunca no portal do locatário; o
 * valor nem chega lá, fica em propostas_locacao_interno).
 */
export default function TermosProposta({ proposta: p, incluirTaxa = false }) {
  const linhas = [
    ['Corretor responsável', p.corretor_responsavel],
    ['Valor da locação', p.valor_oferta != null ? valorBR(p.valor_oferta) : null,
      p.valor != null && p.valor_oferta != null && Number(p.valor) !== Number(p.valor_oferta) ? `anúncio: ${valorBR(p.valor)}` : null],
    ['Tipo de garantia', p.garantia],
    ['Data da posse', dataBR(p.data_posse)],
    ['Prazo contratual', p.prazo_meses ? `${p.prazo_meses} meses` : null],
    ['Vencimento do aluguel', p.dia_vencimento ? `todo dia ${p.dia_vencimento}` : null],
    ['Cláusula de rescisão', p.clausula_rescisao],
    ['Negociação específica', p.negociacao_especifica],
    ['Outros combinados e benfeitorias', p.observacoes],
    ...(incluirTaxa ? [['Taxa de administração (proprietário)', p.taxa_administracao != null ? `${String(p.taxa_administracao).replace('.', ',')}%` : null]] : []),
  ].filter(([, valor]) => valor != null && String(valor).trim() !== '')

  if (linhas.length === 0) {
    return <div className="stat-sub is-muted" style={{ marginTop: 0 }}>Condições não registradas (proposta do fluxo antigo).</div>
  }

  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, max-content) 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
      {linhas.map(([rotulo, valor, extra]) => (
        <div key={rotulo} style={{ display: 'contents' }}>
          <dt className="page-eyebrow" style={{ marginBottom: 0, alignSelf: 'baseline' }}>{rotulo}</dt>
          <dd style={{ margin: 0, whiteSpace: 'pre-line' }}>
            {valor}
            {extra && <span style={{ color: 'var(--grafite-soft)' }}> ({extra})</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
