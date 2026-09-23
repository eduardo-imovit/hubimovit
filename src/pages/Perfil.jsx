import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePerfil, avisarPerfilAtualizado } from '../hooks/usePerfil'
import { PAPEL_DESCRICAO, PAPEL_LABEL, PAPEIS_SOLICITAVEIS } from '../lib/acessos'

const STATUS_SOLICITACAO = {
  pendente: { label: 'Aguardando a Gestão', variant: 'warning' },
  aprovada: { label: 'Aprovada', variant: 'success' },
  recusada: { label: 'Recusada', variant: 'danger' },
  cancelada: { label: 'Cancelada', variant: 'gray' },
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Perfil() {
  const { perfil, carregando } = usePerfil()

  if (carregando) return <div className="hub-loading">Carregando…</div>
  if (!perfil) {
    return <div className="hub-error">Seu usuário ainda não tem perfil no Hub. Fale com a Gestão.</div>
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Minha conta</div>
          <div className="page-title">Perfil</div>
          <div className="page-sub">Seus dados no Hub e seu nível de acesso.</div>
        </div>
      </header>

      <div className="perfil-layout">
        <DadosPerfil perfil={perfil} />
        <NivelAcesso perfil={perfil} />
      </div>
    </div>
  )
}

function DadosPerfil({ perfil }) {
  const [form, setForm] = useState({ nome: perfil.nome ?? '', telefone: perfil.telefone ?? '', cargo: perfil.cargo ?? '' })
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const iniciais = (perfil.nome || perfil.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setMensagem('')
    setSalvando(true)
    const { error } = await supabase
      .from('perfis')
      .update({ nome: form.nome.trim() || null, telefone: form.telefone.trim() || null, cargo: form.cargo.trim() || null })
      .eq('id', perfil.id)
    setSalvando(false)
    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`)
      return
    }
    setMensagem('Dados salvos.')
    avisarPerfilAtualizado()
  }

  async function trocarFoto(arquivo) {
    if (!arquivo) return
    setErro('')
    setMensagem('')
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro('A foto precisa ter no máximo 2 MB.')
      return
    }
    setEnviandoFoto(true)
    try {
      const extensao = arquivo.name.split('.').pop().toLowerCase()
      // Nome novo a cada troca: evita o navegador mostrar a foto antiga do cache.
      const path = `${perfil.id}/avatar-${Date.now()}.${extensao}`
      const { error: erroUpload } = await supabase.storage.from('avatares').upload(path, arquivo, { upsert: true })
      if (erroUpload) throw erroUpload
      const { data } = supabase.storage.from('avatares').getPublicUrl(path)
      const { error: erroPerfil } = await supabase.from('perfis').update({ foto_url: data.publicUrl }).eq('id', perfil.id)
      if (erroPerfil) throw erroPerfil
      // Remove as fotos anteriores; falha aqui não atrapalha a troca.
      const { data: antigas } = await supabase.storage.from('avatares').list(perfil.id)
      const remover = (antigas ?? []).map((a) => `${perfil.id}/${a.name}`).filter((p) => p !== path)
      if (remover.length) await supabase.storage.from('avatares').remove(remover)
      setMensagem('Foto atualizada.')
      avisarPerfilAtualizado()
    } catch (err) {
      setErro(`Não foi possível trocar a foto: ${err.message}`)
    } finally {
      setEnviandoFoto(false)
    }
  }

  return (
    <form onSubmit={salvar} className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Seus dados</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {perfil.foto_url
          ? <img src={perfil.foto_url} alt="Sua foto" className="avatar avatar-xl" style={{ objectFit: 'cover' }} />
          : <span className="avatar avatar-xl">{iniciais || '?'}</span>}
        <label className="btn btn-ghost btn-sm" style={{ cursor: enviandoFoto ? 'wait' : 'pointer' }}>
          {enviandoFoto ? 'Enviando…' : perfil.foto_url ? 'Trocar foto' : 'Adicionar foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            disabled={enviandoFoto}
            onChange={(e) => trocarFoto(e.target.files?.[0])}
          />
        </label>
        <span className="stat-sub is-muted" style={{ marginTop: 0 }}>JPG, PNG ou WebP, até 2 MB.</span>
      </div>

      {erro && <div className="login-error">{erro}</div>}
      {mensagem && <div className="stat-sub is-muted" style={{ marginTop: 0 }}>{mensagem}</div>}

      <div className="field">
        <label htmlFor="pf-nome">Nome</label>
        <input id="pf-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Como você quer aparecer no Hub" />
      </div>
      <div className="field">
        <label htmlFor="pf-email">E-mail</label>
        <input id="pf-email" value={perfil.email} disabled />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="pf-telefone">Telefone</label>
          <input id="pf-telefone" type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(19) 99999-9999" />
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="pf-cargo">Cargo</label>
          <input id="pf-cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex.: Corretor de locação" />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando} style={{ alignSelf: 'flex-start' }}>
        {salvando ? 'Salvando…' : 'Salvar dados'}
      </button>
    </form>
  )
}

function NivelAcesso({ perfil }) {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const opcoes = PAPEIS_SOLICITAVEIS.filter((p) => p !== perfil.role)
  const [form, setForm] = useState({ role_solicitado: opcoes[0], motivo: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from('solicitacoes_acesso')
      .select('*')
      .eq('perfil_id', perfil.id)
      .order('criado_em', { ascending: false })
      .limit(5)
    setSolicitacoes(data ?? [])
    setCarregando(false)
  }, [perfil.id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const pendente = solicitacoes.find((s) => s.status === 'pendente')

  async function solicitar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.from('solicitacoes_acesso').insert({
      perfil_id: perfil.id,
      role_atual: perfil.role,
      role_solicitado: form.role_solicitado,
      motivo: form.motivo.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErro(`Não foi possível enviar a solicitação: ${error.message}`)
      return
    }
    setForm({ ...form, motivo: '' })
    await recarregar()
  }

  async function cancelar() {
    setErro('')
    const { error } = await supabase.from('solicitacoes_acesso').update({ status: 'cancelada' }).eq('id', pendente.id)
    if (error) setErro(`Não foi possível cancelar: ${error.message}`)
    await recarregar()
  }

  return (
    <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="page-eyebrow">Nível de acesso</div>
      <div>
        <span className="badge badge-info">{PAPEL_LABEL[perfil.role] ?? perfil.role}</span>
        <p className="page-sub" style={{ margin: 'var(--space-2) 0 0' }}>{PAPEL_DESCRICAO[perfil.role]}</p>
      </div>

      {erro && <div className="login-error">{erro}</div>}

      {!carregando && pendente && (
        <div className="perfil-solicitacao">
          <div>
            Você pediu para mudar para <strong>{PAPEL_LABEL[pendente.role_solicitado]}</strong> em {formatarData(pendente.criado_em)}.
            A Gestão vai analisar.
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={cancelar}>Cancelar pedido</button>
        </div>
      )}

      {!carregando && !pendente && perfil.role !== 'tvaccess' && (
        <form onSubmit={solicitar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="pf-nivel">Solicitar alteração para</label>
            <select id="pf-nivel" value={form.role_solicitado} onChange={(e) => setForm({ ...form, role_solicitado: e.target.value })}>
              {opcoes.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </select>
            <span className="stat-sub is-muted">{PAPEL_DESCRICAO[form.role_solicitado]}</span>
          </div>
          <div className="field">
            <label htmlFor="pf-motivo">Motivo (opcional)</label>
            <textarea id="pf-motivo" rows={2} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: entrei no time de locação" />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando} style={{ alignSelf: 'flex-start' }}>
            {enviando ? 'Enviando…' : 'Enviar solicitação'}
          </button>
          <span className="stat-sub is-muted" style={{ marginTop: 0 }}>Só a Gestão pode alterar níveis de acesso.</span>
        </form>
      )}

      {solicitacoes.some((s) => s.status !== 'pendente') && (
        <div>
          <div className="page-eyebrow" style={{ marginTop: 'var(--space-2)' }}>Pedidos anteriores</div>
          <div className="upload-list" style={{ marginTop: 'var(--space-2)' }}>
            {solicitacoes.filter((s) => s.status !== 'pendente').map((s) => (
              <div className="upload-item" key={s.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="upload-item-name">{PAPEL_LABEL[s.role_solicitado]}</div>
                  <div className="timeline-sub">
                    {formatarData(s.criado_em)}{s.resposta ? ` · ${s.resposta}` : ''}
                  </div>
                </div>
                <span className={`badge badge-${STATUS_SOLICITACAO[s.status].variant}`}>{STATUS_SOLICITACAO[s.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
