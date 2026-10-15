import { useEffect, useState } from 'react'
import SubnavPropostas from '../../components/layout/SubnavPropostas'
import { supabase } from '../../lib/supabaseClient'
import { TIPOS_CADASTRO, linkCadastros } from '../../lib/cadastros'
import { ListaLinksCadastro } from '../CadastrosLinks'

const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const quem = (c) => c.pessoa?.nome ?? c.pessoa?.razao_social ?? '—'
const contato = (c) => [c.email, c.pessoa?.celular ?? c.pessoa?.telefone ?? ''].filter(Boolean).join(' · ')
const onde = (c) => (c.imovel ? `${c.imovel.endereco} · ${c.imovel.bairro}, ${c.imovel.cidade}/${c.imovel.estado}` : '—')

/**
 * Central de cadastros (RF30, PRD §5.17): o que chegou pelos formulários
 * públicos e pelo histórico importado das planilhas. Só gestão/adm.
 */
export default function Cadastros() {
  const [itens, setItens] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    supabase.from('cadastros').select('id, tipo, email, pessoa, imovel, origem, email_ok, created_at').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErro(error.message)
        else setItens(data ?? [])
        setCarregando(false)
      })
  }, [])

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastros()).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const tiposComDados = [...new Set(itens.map((c) => c.tipo))]
  const visiveis = filtro === 'todos' ? itens : itens.filter((c) => c.tipo === filtro)

  return (
    <div>
      <SubnavPropostas area="locacao" />
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Locação</div>
          <div className="page-title">Cadastros</div>
          <div className="page-sub">Quem preencheu os cadastros públicos. Compartilhe o link com o cliente.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copiarLink}>
          {copiado ? 'Link copiado!' : 'Copiar link dos cadastros'}
        </button>
      </header>

      <details className="card card-body" style={{ marginBottom: 'var(--space-4)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Links para enviar ao cliente (PF e PJ)</summary>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <ListaLinksCadastro />
        </div>
      </details>

      {tiposComDados.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }} role="radiogroup" aria-label="Filtrar por tipo">
          {['todos', ...tiposComDados].map((t) => (
            <button key={t} type="button" role="radio" aria-checked={filtro === t}
              className={`btn btn-sm ${filtro === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro(t)}>
              {t === 'todos' ? 'Todos' : (TIPOS_CADASTRO[t]?.titulo ?? t)}
            </button>
          ))}
        </div>
      )}

      {erro && <div className="hub-error">Não foi possível carregar: {erro}</div>}
      {!carregando && !erro && visiveis.length === 0 && (
        <div className="card card-body">Nenhum cadastro recebido ainda.</div>
      )}
      {visiveis.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Quem</th><th>Tipo</th><th>Contato</th><th>Imóvel</th><th>Recebido em</th><th>Origem</th><th>E-mail</th></tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id}>
                  <td>{quem(c)}</td>
                  <td>{TIPOS_CADASTRO[c.tipo]?.titulo ?? c.tipo}</td>
                  <td>{contato(c)}</td>
                  <td>{onde(c)}</td>
                  <td>{fmtData(c.created_at)}</td>
                  <td>{c.origem === 'planilha' ? 'Planilha' : 'Hub'}</td>
                  <td>{c.email_ok ? 'enviado' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
