import { useCallback, useEffect, useState } from 'react'
import ModalPortal from '../esteira/ModalPortal'
import { supabase } from '../../lib/supabaseClient'
import { fmtDataHora } from '../../lib/distrato'
import {
  INSTRUCAO_REPIQUE, aprovarOnboarding, cancelarOnboarding, checklist, criarOnboarding, enderecoTexto, equipeLabel,
  formatarCpf, linkOnboarding, linkWhatsApp, listarOnboardings, marcarEtapa, mascararCpf, mensagemAcesso, mensagemLink, situacao,
} from '../../lib/onboarding'

function copiar(texto, avisar) {
  navigator.clipboard.writeText(texto).then(() => avisar?.())
}

function Modal({ titulo, onClose, children, rodape }) {
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{titulo}</div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>{children}</div>
          <div className="modal-footer">
            {rodape}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

/** Link do formulário: copiar ou abrir no WhatsApp. */
function AcoesLink({ o }) {
  const [msg, setMsg] = useState('')
  const link = linkOnboarding(o.token)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <input readOnly value={link} onFocus={(ev) => ev.target.select()} aria-label="Link do onboarding" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(link, () => setMsg('Link copiado.'))}>Copiar link</button>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={linkWhatsApp('', mensagemLink(o.nome_completo, link))}>Abrir no WhatsApp</a>
      </div>
      {msg && <span className="field-hint">{msg}</span>}
      <span className="field-hint">O link vale até {fmtDataHora(o.expira_em)}.</span>
    </div>
  )
}

function NovoColaborador({ onClose, onCriado }) {
  const [nome, setNome] = useState('')
  const [criado, setCriado] = useState(null)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  async function criar(ev) {
    ev.preventDefault()
    setCriando(true)
    setErro('')
    try {
      const { onboarding } = await criarOnboarding(nome.trim())
      setCriado({ ...onboarding, nome_completo: nome.trim() })
      onCriado()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCriando(false)
    }
  }

  return (
    <Modal titulo={criado ? 'Link criado' : 'Novo colaborador'} onClose={onClose}>
      {criado ? (
        <>
          <p style={{ margin: 0 }}>Envie o link para {criado.nome_completo ? <strong>{criado.nome_completo}</strong> : 'o colaborador'}. Quando ele preencher, você recebe um e-mail.</p>
          <AcoesLink o={criado} />
        </>
      ) : (
        <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="nc-nome">Nome (opcional)</label>
            <input id="nc-nome" autoFocus value={nome} onChange={(ev) => setNome(ev.target.value)} maxLength={160} />
            <span className="field-hint">Só para achar na lista. O nome completo vem do formulário.</span>
          </div>
          {erro && <div className="login-error">{erro}</div>}
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={criando}>{criando ? 'Gerando…' : 'Gerar link'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** Dado com botão de copiar (para criar o e-mail e o usuário no Imoview). */
function Dado({ rotulo, valor, copiavel = valor, onCopiado }) {
  return (
    <>
      <dt className="muted">{rotulo}</dt>
      <dd style={{ margin: 0, display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span>{valor ?? '—'}</span>
        {copiavel && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }}
            onClick={() => copiar(copiavel, () => onCopiado(rotulo))}>Copiar</button>
        )}
      </dd>
    </>
  )
}

function Aprovar({ o, onAprovado }) {
  const [form, setForm] = useState({ nome: o.nome_completo ?? '', email: '', codigo: '' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aprovar(ev) {
    ev.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (form.nome.trim().length < 3) return setErro('Informe o nome exatamente como está no Imoview.')
    if (!email) return setErro('Informe o e-mail @imovit que você criou.')
    if (!email.endsWith('@imovit.com.br')) return setErro('O e-mail precisa ser @imovit.com.br.')
    if (!/^\d+$/.test(form.codigo.trim())) return setErro('Informe o código numérico do corretor no Imoview.')
    setEnviando(true)
    setErro('')
    try {
      await aprovarOnboarding(o.id, { email_imovit: email, id_corretor_crm: Number(form.codigo), nome_crm: form.nome.trim() })
      onAprovado()
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aprovar} noValidate className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flexShrink: 0 }}>
      <div className="page-eyebrow" style={{ marginBottom: 0 }}>Aprovar</div>
      <p className="muted" style={{ margin: 0 }}>Crie o e-mail @imovit e o usuário no Imoview com os dados acima e informe os dois aqui. Ao aprovar, o colaborador entra no Hub (dashboards, plantão, aniversários).</p>
      <div className="field">
        <label htmlFor="ap-nome">Nome exatamente como no Imoview</label>
        <input id="ap-nome" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} required />
        <span className="field-hint">Os dashboards ligam os atendimentos pelo nome: tem que ser igual ao do CRM.</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="ap-email">E-mail @imovit</label>
          <input id="ap-email" type="email" placeholder="nome@imovit.com.br" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} required />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="ap-cod">Código no Imoview</label>
          <input id="ap-cod" inputMode="numeric" value={form.codigo} onChange={(ev) => setForm({ ...form, codigo: ev.target.value })} required />
        </div>
      </div>
      {erro && <div className="login-error">{erro}</div>}
      <div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>{enviando ? 'Aprovando…' : 'Aprovar'}</button>
      </div>
    </form>
  )
}

function Checklist({ o, onMudou }) {
  const [ocupado, setOcupado] = useState(null)
  const [erro, setErro] = useState('')
  const aprovado = ['aprovado', 'concluido'].includes(o.status)

  async function alternar(etapa, feito) {
    setOcupado(etapa)
    setErro('')
    try {
      await marcarEtapa(o.id, etapa, feito)
      onMudou()
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  async function definirCorretor() {
    setOcupado('nivel')
    setErro('')
    const { error } = await supabase.from('perfis').update({ role: 'corretor' }).eq('id', o.perfil.id)
    if (error) setErro(error.message)
    setOcupado(null)
    onMudou()
  }

  const etapas = checklist(o)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div className="page-eyebrow" style={{ marginBottom: 0 }}>Checklist · {etapas.filter((e) => e.feito).length}/{etapas.length}</div>
      {!aprovado && <div className="login-error">Aprove o colaborador (acima) para liberar as etapas manuais.</div>}
      {etapas.map((e) => (
        <div key={e.chave} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={e.feito} disabled={e.auto || !aprovado || ocupado != null}
            onChange={(ev) => alternar(e.chave, ev.target.checked)} style={{ marginTop: 4 }} aria-label={e.label} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span>{e.label}</span>
            {e.auto && <span className="badge badge-gray" style={{ marginLeft: 'var(--space-2)' }}>automático</span>}
            {e.chave === 'repique' && aprovado && !e.feito && (
              <div className="field-hint">{INSTRUCAO_REPIQUE(o.equipe, o.id_corretor_crm)}</div>
            )}
            {e.chave === 'login' && aprovado && !e.feito && (
              <div className="field-hint">O colaborador cria a conta no Hub com {o.email_imovit}.</div>
            )}
            {e.chave === 'nivel' && o.perfil && !e.feito && (
              <div style={{ marginTop: 4 }}>
                <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado != null} onClick={definirCorretor}>
                  {ocupado === 'nivel' ? 'Salvando…' : 'Definir nível Corretor'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {erro && <div className="login-error">{erro}</div>}
    </div>
  )
}

function Ficha({ o, onClose, onMudou }) {
  const [msg, setMsg] = useState('')
  const [verCpf, setVerCpf] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const s = situacao(o)
  const aprovado = ['aprovado', 'concluido'].includes(o.status)
  const copiado = (rotulo) => setMsg(`${rotulo} copiado.`)

  async function cancelar() {
    setCancelando(true)
    try {
      await cancelarOnboarding(o.id)
      onMudou()
      onClose()
    } catch (e) {
      setMsg(e.message)
      setCancelando(false)
    }
  }

  async function enviarAcesso() {
    if (!o.marcacoes?.acesso_enviado) {
      try {
        await marcarEtapa(o.id, 'acesso_enviado', true)
        onMudou()
      } catch (e) {
        setMsg(e.message)
      }
    }
  }

  const podeCancelar = ['link_enviado', 'dados_recebidos'].includes(o.status)

  return (
    <Modal titulo={o.nome_completo || 'Colaborador novo'} onClose={onClose}
      rodape={podeCancelar && (
        <button type="button" className="btn btn-ghost btn-sm" disabled={cancelando} onClick={cancelar}>
          {cancelando ? 'Cancelando…' : 'Cancelar onboarding'}
        </button>
      )}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span className={`badge ${s.badge}`}>{s.label}</span>
        {o.equipe && <span className="badge badge-gray">{equipeLabel(o.equipe)}</span>}
      </div>

      {o.status === 'link_enviado' && <AcoesLink o={o} />}

      {o.enviado_em && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
          <Dado rotulo="Nome" valor={o.nome_completo} onCopiado={copiado} />
          <Dado rotulo="WhatsApp" valor={o.telefone} onCopiado={copiado} />
          <dt className="muted">CPF</dt>
          <dd style={{ margin: 0, display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span>{verCpf ? formatarCpf(o.cpf) : mascararCpf(o.cpf)}</span>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => setVerCpf(!verCpf)}>{verCpf ? 'Esconder' : 'Mostrar'}</button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 10px' }} onClick={() => copiar(o.cpf, () => copiado('CPF'))}>Copiar</button>
          </dd>
          <Dado rotulo="CRECI" valor={`${o.creci_numero}/${o.creci_uf}`} onCopiado={copiado} />
          <Dado rotulo="Equipe" valor={equipeLabel(o.equipe)} copiavel={null} onCopiado={copiado} />
          <Dado rotulo="Endereço" valor={enderecoTexto(o.endereco)} onCopiado={copiado} />
          <Dado rotulo="Enviado em" valor={fmtDataHora(o.enviado_em)} copiavel={null} onCopiado={copiado} />
          {aprovado && <Dado rotulo="E-mail @imovit" valor={o.email_imovit} onCopiado={copiado} />}
          {aprovado && <Dado rotulo="Código Imoview" valor={String(o.id_corretor_crm)} onCopiado={copiado} />}
        </dl>
      )}
      {msg && <span className="field-hint">{msg}</span>}

      {o.status === 'dados_recebidos' && <Aprovar o={o} onAprovado={onMudou} />}

      {aprovado && (
        <div>
          <a className="btn btn-primary btn-sm" target="_blank" rel="noreferrer" onClick={enviarAcesso}
            href={linkWhatsApp(o.telefone, mensagemAcesso(o.nome_completo, o.email_imovit))}>
            Enviar acesso pelo WhatsApp
          </a>
        </div>
      )}

      {o.status !== 'cancelado' && <Checklist o={o} onMudou={onMudou} />}
    </Modal>
  )
}

/**
 * Configurações ▸ Onboarding (RF32.1, PRD §5.18), só Gestão: links para o
 * colaborador novo preencher, a ficha com os dados para criar o e-mail e o
 * usuário no Imoview, a aprovação (→ colaboradores_raw) e o checklist.
 */
export default function OnboardingAdmin() {
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(false)
  const [abertoId, setAbertoId] = useState(null)
  const [verTodos, setVerTodos] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      setLista(await listarOnboardings())
      setErro('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Recarrega ao voltar para a aba: o colaborador preenche em outro lugar.
  useEffect(() => {
    recarregar()
    window.addEventListener('focus', recarregar)
    return () => window.removeEventListener('focus', recarregar)
  }, [recarregar])

  const visiveis = verTodos ? lista : lista.filter((o) => !['cancelado', 'concluido'].includes(situacao(o).chave))
  const aberto = lista.find((o) => o.id === abertoId)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <div className="page-eyebrow">Onboarding de colaboradores</div>
          <p className="muted" style={{ margin: 0 }}>O colaborador preenche os dados pelo link; você cria o e-mail e o usuário no Imoview e aprova aqui.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', cursor: 'pointer' }} className="muted">
            <input type="checkbox" checked={verTodos} onChange={(ev) => setVerTodos(ev.target.checked)} />
            Mostrar concluídos e cancelados
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setNovo(true)}>Novo colaborador</button>
        </div>
      </div>

      {erro && <div className="hub-error">Não foi possível carregar: {erro}</div>}
      {carregando && <div className="hub-loading">Carregando…</div>}
      {!carregando && !erro && visiveis.length === 0 && <div className="empty">Nenhum onboarding em andamento.</div>}

      {visiveis.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Colaborador</th><th>Equipe</th><th>Situação</th><th>Checklist</th><th>Criado em</th></tr>
            </thead>
            <tbody>
              {visiveis.map((o) => {
                const s = situacao(o)
                const etapas = checklist(o)
                return (
                  <tr key={o.id} onClick={() => setAbertoId(o.id)} style={{ cursor: 'pointer' }}>
                    <td>{o.nome_completo || <span className="muted">aguardando o formulário</span>}</td>
                    <td>{equipeLabel(o.equipe)}</td>
                    <td><span className={`badge ${s.badge}`}>{s.label}</span></td>
                    <td>{etapas.filter((e) => e.feito).length}/{etapas.length}</td>
                    <td>{fmtDataHora(o.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {novo && <NovoColaborador onClose={() => setNovo(false)} onCriado={recarregar} />}
      {aberto && <Ficha o={aberto} onClose={() => setAbertoId(null)} onMudou={recarregar} />}
    </section>
  )
}
