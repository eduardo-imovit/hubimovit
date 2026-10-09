import { useEffect, useState } from 'react'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import { supabase } from '../../lib/supabaseClient'
import { linkCadastroLocador } from '../../lib/cadastroLocador'

const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Cadastros de locador PF (RF28, PRD §5.15): lista do que chegou pelo form
 * público /cadastro-locador. Só gestão/adm (rota + RLS).
 */
export default function CadastrosLocador() {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    supabase.from('cadastros_locador').select('id, email, locador, imovel, email_ok, created_at').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErro(error.message)
        else setItens(data ?? [])
        setCarregando(false)
      })
  }, [])

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastroLocador()).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div>
      <SubnavPropostas area="locacao" />
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Propostas · Locação</div>
          <div className="page-title">Cadastros de locador</div>
          <div className="page-sub">Quem preencheu o cadastro público. Compartilhe o link com o locador.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copiarLink}>
          {copiado ? 'Link copiado!' : 'Copiar link do cadastro'}
        </button>
      </header>

      {erro && <div className="hub-error">Não foi possível carregar: {erro}</div>}
      {!carregando && !erro && itens.length === 0 && (
        <div className="card card-body">Nenhum cadastro recebido ainda.</div>
      )}
      {itens.length > 0 && (
        <div className="card card-body" style={{ overflowX: 'auto' }}>
          <table className="hub-table">
            <thead>
              <tr><th>Locador</th><th>Contato</th><th>Imóvel</th><th>Recebido em</th><th>E-mail</th></tr>
            </thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id}>
                  <td>{c.locador?.nome ?? '—'}</td>
                  <td>{c.email}<br />{c.locador?.celular ?? ''}</td>
                  <td>{c.imovel ? `${c.imovel.endereco} · ${c.imovel.bairro}, ${c.imovel.cidade}/${c.imovel.estado}` : '—'}</td>
                  <td>{fmtData(c.created_at)}</td>
                  <td>{c.email_ok ? 'enviado' : 'falhou'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
