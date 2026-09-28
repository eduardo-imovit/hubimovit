import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePerfil } from '../hooks/usePerfil'
import { useCorretores } from '../hooks/useCorretores'
import { baixarPdfDoElemento } from '../lib/pdf'
import DocumentoFeedback from '../components/formularios/DocumentoFeedback'

const vazio = { codigo_imovel: '', imovel_descricao: '', olhar_visitante: '', curadoria_ajustes: '', termometro: 0, corretor: '', nota_consultor: '' }

const ROTULOS = ['Baixo', 'Moderado', 'Bom', 'Alto', 'Muito alto']

/**
 * Feedback de visita (RF23, PRD §5.7): o corretor preenche e baixa o PDF no
 * padrão Imovit para mandar ao proprietário. Fica o histórico (RLS: cada um vê
 * os seus; Gestão/Admin, todos).
 */
export default function FeedbackVisita() {
  const { perfil } = usePerfil()
  const corretores = useCorretores()
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState([])
  const [paraPdf, setParaPdf] = useState(null)
  const docRef = useRef(null)

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('feedbacks_visita').select('*').order('criado_em', { ascending: false }).limit(50)
    setHistorico(data ?? [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Sugere o próprio corretor (e-mail do login = e-mail oficial no CRM).
  useEffect(() => {
    if (form.corretor || !perfil || !corretores.length) return
    const eu = corretores.find((c) => c.email_oficial?.toLowerCase() === perfil.email?.toLowerCase())
    if (eu) setForm((f) => ({ ...f, corretor: eu.nome_completo }))
  }, [perfil, corretores, form.corretor])

  // Baixa o PDF assim que o documento escolhido renderiza fora da tela.
  useEffect(() => {
    if (!paraPdf) return
    const nome = `feedback-visita-${paraPdf.codigo_imovel}-${new Date(paraPdf.criado_em).toISOString().slice(0, 10)}.pdf`
    baixarPdfDoElemento(docRef.current, nome)
      .catch(() => setErro('Não foi possível gerar o PDF. Tente de novo.'))
      .finally(() => setParaPdf(null))
  }, [paraPdf])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!form.termometro) return setErro('Marque o termômetro de interesse.')
    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('feedbacks_visita')
        .insert({
          codigo_imovel: Number(form.codigo_imovel),
          imovel_descricao: form.imovel_descricao.trim() || null,
          olhar_visitante: form.olhar_visitante.trim() || null,
          curadoria_ajustes: form.curadoria_ajustes.trim() || null,
          termometro: form.termometro,
          corretor: form.corretor.trim(),
          nota_consultor: form.nota_consultor.trim() || null,
        })
        .select('*')
        .single()
      if (error) throw error
      setParaPdf(data)
      setForm({ ...vazio, corretor: form.corretor })
      await carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Ferramentas</div>
          <div className="page-title">Feedback de visita</div>
          <div className="page-sub">Preencha depois da visita e baixe o PDF no padrão Imovit para enviar ao proprietário.</div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="card card-body" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label htmlFor="fv-codigo">Código do imóvel</label>
            <input id="fv-codigo" type="number" required value={form.codigo_imovel} onChange={(e) => set({ codigo_imovel: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '3 1 260px' }}>
            <label htmlFor="fv-desc">Imóvel (como aparece no PDF, opcional)</label>
            <input id="fv-desc" value={form.imovel_descricao} onChange={(e) => set({ imovel_descricao: e.target.value })} placeholder="Apto 3 suítes, Cambuí" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="fv-olhar">Olhar do visitante</label>
          <textarea id="fv-olhar" rows={3} value={form.olhar_visitante} onChange={(e) => set({ olhar_visitante: e.target.value })} placeholder="O que mais encantou o cliente nesta experiência?" />
        </div>
        <div className="field">
          <label htmlFor="fv-ajustes">Curadoria de ajustes</label>
          <textarea id="fv-ajustes" rows={3} value={form.curadoria_ajustes} onChange={(e) => set({ curadoria_ajustes: e.target.value })} placeholder="O que podemos ajustar na apresentação para o próximo tour? (Ex.: iluminação, aromas, organização)" />
        </div>
        <div className="field">
          <label>Termômetro de interesse</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }} role="radiogroup">
            {ROTULOS.map((r, i) => (
              <button key={r} type="button" role="radio" aria-checked={form.termometro === i + 1}
                className={`btn btn-sm ${form.termometro === i + 1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set({ termometro: i + 1 })}>
                {i + 1} · {r}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="fv-corretor">Corretor responsável</label>
          <input id="fv-corretor" required list="fv-corretores" value={form.corretor} onChange={(e) => set({ corretor: e.target.value })} />
          <datalist id="fv-corretores">{corretores.map((c) => <option key={c.id_corretor_crm} value={c.nome_completo} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="fv-nota">Nota do consultor</label>
          <textarea id="fv-nota" rows={3} value={form.nota_consultor} onChange={(e) => set({ nota_consultor: e.target.value })} placeholder="Um breve parágrafo de fechamento validando a escolha do cliente." />
        </div>
        {erro && <div className="login-error">{erro}</div>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando || !!paraPdf}>
          {salvando ? 'Salvando…' : paraPdf ? 'Gerando PDF…' : 'Salvar e baixar PDF'}
        </button>
      </form>

      <div className="page-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Histórico</div>
      {historico.length === 0 ? (
        <div className="empty"><div className="empty-sub">Os feedbacks salvos aparecem aqui.</div></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Data</th><th>Imóvel</th><th>Termômetro</th><th>Corretor</th><th></th></tr></thead>
            <tbody>
              {historico.map((f) => (
                <tr key={f.id}>
                  <td>{new Date(f.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>{f.imovel_descricao || `Imóvel ${f.codigo_imovel}`}<div className="avisos-item-sub">cód. {f.codigo_imovel}</div></td>
                  <td>{f.termometro} · {ROTULOS[f.termometro - 1]}</td>
                  <td>{f.corretor}</td>
                  <td><button type="button" className="btn btn-ghost btn-sm" disabled={!!paraPdf} onClick={() => setParaPdf(f)}>Baixar PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paraPdf && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <DocumentoFeedback ref={docRef} feedback={paraPdf} />
        </div>
      )}
    </div>
  )
}
