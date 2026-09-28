import { forwardRef } from 'react'

const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '')

const ROTULO_TERMOMETRO = { 1: 'Baixo', 2: 'Moderado', 3: 'Bom', 4: 'Alto', 5: 'Muito alto' }

function Bloco({ titulo, children }) {
  if (!children) return null
  return (
    <div className="doc-bloco" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 700, marginBottom: 6 }}>{titulo}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

/**
 * Feedback de visita para o proprietário, no padrão Imovit (PDF). Campos do
 * Tally "Feedback da visita": olhar do visitante, curadoria de ajustes,
 * termômetro de interesse (1–5) e nota do consultor.
 */
const DocumentoFeedback = forwardRef(function DocumentoFeedback({ feedback: f }, ref) {
  const nota = Number(f.termometro) || 0
  return (
    <div ref={ref} style={{ background: '#fff', color: '#1a1a1a', padding: 40, width: 680, fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '28px 20px', borderBottom: '4px solid #ff5e4d', marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>imovit</div>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#ff5e4d', marginTop: 10 }}>Feedback da visita</div>
        <div style={{ fontFamily: "'Noto Serif', Georgia, serif", fontStyle: 'italic', fontSize: 20, marginTop: 10 }}>
          {f.imovel_descricao || `Imóvel ${f.codigo_imovel}`}
        </div>
      </div>

      <Bloco titulo="Olhar do visitante">{f.olhar_visitante}</Bloco>
      <Bloco titulo="Curadoria de ajustes">{f.curadoria_ajustes}</Bloco>

      <div className="doc-bloco" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', fontWeight: 700, marginBottom: 8 }}>Termômetro de interesse</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ width: 34, height: 10, borderRadius: 5, background: i <= nota ? '#ff5e4d' : '#eee' }} />
            ))}
          </div>
          <strong style={{ fontSize: 14 }}>{ROTULO_TERMOMETRO[nota] ?? ''}</strong>
        </div>
      </div>

      <Bloco titulo="Nota do consultor">{f.nota_consultor}</Bloco>

      <div style={{ marginTop: 32, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <div style={{ fontFamily: "'Noto Serif', Georgia, serif", fontStyle: 'italic', fontSize: 18, color: '#ff5e4d' }}>{f.corretor}</div>
        <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
          Imovit · A marca da exclusividade{f.criado_em ? ` · ${dataBR(f.criado_em)}` : ''}
        </div>
      </div>
    </div>
  )
})

export default DocumentoFeedback
