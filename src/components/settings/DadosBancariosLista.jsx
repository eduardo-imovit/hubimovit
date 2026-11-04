import { useEffect, useState } from 'react'
import { equipeLabel, listarDadosBancarios, tipoContaLabel, tipoPixLabel } from '../../lib/onboarding'

function copiar(texto, avisar) {
  navigator.clipboard.writeText(texto).then(() => avisar?.())
}

/**
 * Configurações ▸ Usuários ▸ Dados bancários (PRD §5.18b): Gestão e ADM
 * (Financeiro). Lê pela RPC dados_bancarios_colaboradores, que confere o
 * papel e devolve só nome, equipe e o bancário (sem CPF e sem endereço).
 */
export default function DadosBancariosLista() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    listarDadosBancarios().then(setLista).catch((e) => setErro(e.message))
  }, [])

  const copiado = (o) => setMsg(`${o} copiado.`)

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <div className="page-eyebrow">Dados bancários</div>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Enviados pelo colaborador no link de onboarding. A conta é sempre no nome dele. Quem entrou antes de 04/11 não aparece aqui.
      </p>
      {erro && <div className="hub-error">Não foi possível carregar os dados bancários: {erro}</div>}
      {!lista && !erro && <div className="hub-loading">Carregando…</div>}
      {lista && lista.length === 0 && <div className="stat-sub is-muted">Nenhum colaborador enviou dados bancários ainda.</div>}
      {msg && <div className="field-hint" style={{ marginBottom: 'var(--space-2)' }}>{msg}</div>}
      {lista && lista.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Conta</th>
                <th>PIX</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const conta = d.banco ? `${d.banco} · ag. ${d.agencia} · conta ${d.conta}` : null
                return (
                  <tr key={d.onboarding_id}>
                    <td>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{d.nome_completo || '—'}</div>
                      <div className="timeline-sub" style={{ marginTop: 0 }}>{[equipeLabel(d.equipe), d.email_imovit].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>
                      {conta ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span>{conta} <span className="muted">({tipoContaLabel(d.tipo_conta)})</span></span>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => copiar(conta, () => copiado('Conta'))}>Copiar</button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {d.pix_tipo ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span><span className="muted">{tipoPixLabel(d.pix_tipo)}:</span> {d.pix_chave}</span>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => copiar(d.pix_chave, () => copiado('PIX'))}>Copiar</button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
