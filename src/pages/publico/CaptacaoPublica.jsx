import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import CurrencyInput from '../../components/esteira/CurrencyInput'
import AssinaturaPad from '../../components/venda/AssinaturaPad'
import DocumentoCaptacao from '../../components/formularios/DocumentoCaptacao'
import { baixarPdfDoElemento } from '../../lib/pdf'
import {
  BANHEIROS, FINALIDADES, LAZER, PERIODOS_EXCLUSIVIDADE, QUARTOS, SALAS, SUITES, TIPOS_IMOVEL, TIPOS_VAGA, VAGAS,
  carregarFormularioCaptacao, enviarCaptacao,
} from '../../lib/captacao'

const ETAPAS = [
  { titulo: 'Seus dados', texto: 'Para garantir uma experiência exclusiva, informe seus dados de contato e o consultor de sua preferência.' },
  { titulo: 'Natureza do imóvel', texto: 'Identifique a tipologia e a finalidade da oferta para que possamos direcionar ao departamento especializado.' },
  { titulo: 'Endereço e contexto', texto: 'Onde se localiza o cenário desta nova história? A localização é o primeiro pilar da nossa estratégia.' },
  { titulo: 'Expectativa de valorização', texto: 'Com base nas características do imóvel, defina os parâmetros financeiros para nossa análise de mercado.' },
  { titulo: 'Atributos de engenharia e design', texto: 'Detalhes que definem a exclusividade: metragem e cômodos.' },
  { titulo: 'Estilo de vida e comodidades', texto: 'O que o imóvel oferece além das paredes? Espaços de lazer e convivência.' },
  { titulo: 'Declaração de ciência', texto: 'Leia com atenção e assine para autorizar a Imovit a trabalhar o seu imóvel.' },
]

const inicial = {
  proprietario_nome: '', proprietario_email: '', proprietario_telefone: '', proprietario_cpf: '',
  tipo_imovel: '', finalidade: '', exclusividade: '', exclusividade_periodo: '',
  logradouro: '', numero: '', bairro: '', cep: '', apto_sala: '', bloco: '', quadra: '',
  valor_venda: '', valor_locacao: '', valor_condominio: '', iptu_mensal: '',
  area_interna: '', area_terreno: '', quartos: '', suites: '', banheiros: '', salas: '', vagas: '', tipo_vaga: '',
  lazer: [], observacoes: '', site: '',
}

const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

function Moldura({ children }) {
  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">imovit</span>
          <span className="navbar-tagline">Captação de imóvel</span>
        </div>
      </nav>
      <main className="app-main" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>{children}</main>
    </div>
  )
}

function Opcoes({ id, opcoes, valor, onChange }) {
  return (
    <div id={id} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} role="radiogroup">
      {opcoes.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={valor === o}
          className={`btn btn-sm ${valor === o ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

/**
 * Formulário público de captação (RF23, PRD §5.7): o proprietário abre o link
 * fixo do corretor, preenche em etapas e assina. Grava pela Edge Function
 * `captacao` e baixa o PDF da autorização gerado no navegador.
 */
export default function CaptacaoPublica() {
  const { token } = useParams()
  const [config, setConfig] = useState(null)
  const [erroCarga, setErroCarga] = useState('')
  const [form, setForm] = useState(inicial)
  const [etapa, setEtapa] = useState(0)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(null)
  const [baixando, setBaixando] = useState(false)
  const assinaturaRef = useRef(null)
  const docRef = useRef(null)

  useEffect(() => {
    // sem código ou no formato antigo (/captacao/47): nem chega a consultar
    if (!token || !/^[A-Za-z0-9_-]{10,40}$/.test(token)) {
      setErroCarga('Este link de captação não é válido. Peça um novo ao seu corretor.')
      return
    }
    carregarFormularioCaptacao(token)
      .then(setConfig)
      .catch((e) => setErroCarga(e.message))
  }, [token])
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  function validarEtapa(i) {
    const f = form
    if (i === 0) {
      if (f.proprietario_nome.trim().length < 3) return 'Informe seu nome completo.'
      if (!/^\S+@\S+\.\S+$/.test(f.proprietario_email.trim())) return 'Informe um e-mail válido.'
      if (f.proprietario_telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone com DDD.'
      if (f.proprietario_cpf.replace(/\D/g, '').length !== 11) return 'Informe um CPF com 11 dígitos.'
    }
    if (i === 1) {
      if (!f.tipo_imovel) return 'Escolha o tipo de imóvel.'
      if (!f.finalidade) return 'Escolha a finalidade.'
      if (!f.exclusividade) return 'Diga se o imóvel será exclusividade Imovit.'
      if (f.exclusividade === 'Sim' && !f.exclusividade_periodo) return 'Escolha o período da exclusividade.'
    }
    if (i === 2 && (!f.logradouro.trim() || !f.numero.trim() || !f.bairro.trim())) return 'Informe endereço, número e bairro.'
    if (i === 3) {
      if (f.finalidade !== 'Locação' && !num(f.valor_venda)) return 'Informe o valor de venda.'
      if (f.finalidade !== 'Venda' && !num(f.valor_locacao)) return 'Informe o valor de locação.'
    }
    if (i === 4 && !(num(f.area_interna) > 0)) return 'Informe a área interna.'
    return ''
  }

  function avancar() {
    const msg = validarEtapa(etapa)
    setErro(msg)
    if (!msg) {
      setEtapa((e) => e + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function enviar() {
    setErro('')
    const ref = assinaturaRef.current
    if (!ref || ref.vazia()) return setErro('Assine no campo indicado.')
    setEnviando(true)
    try {
      const assinatura = ref.toDataURL()
      const f = form
      const dados = {
        site: f.site || undefined,
        token,
        proprietario_nome: f.proprietario_nome.trim(),
        proprietario_email: f.proprietario_email.trim(),
        proprietario_telefone: f.proprietario_telefone.trim(),
        proprietario_cpf: f.proprietario_cpf.trim(),
        tipo_imovel: f.tipo_imovel,
        finalidade: f.finalidade,
        exclusividade: f.exclusividade === 'Sim',
        exclusividade_periodo: f.exclusividade === 'Sim' ? f.exclusividade_periodo : null,
        logradouro: f.logradouro.trim(), numero: f.numero.trim(), bairro: f.bairro.trim(),
        cep: f.cep.trim() || undefined, apto_sala: f.apto_sala.trim() || undefined, bloco: f.bloco.trim() || undefined, quadra: f.quadra.trim() || undefined,
        valor_venda: num(f.valor_venda), valor_locacao: num(f.valor_locacao), valor_condominio: num(f.valor_condominio), iptu_mensal: num(f.iptu_mensal),
        area_interna: num(f.area_interna), area_terreno: num(f.area_terreno),
        quartos: f.quartos || undefined, suites: f.suites || undefined, banheiros: f.banheiros || undefined, salas: f.salas || undefined,
        vagas: f.vagas || undefined, tipo_vaga: f.tipo_vaga || undefined,
        lazer: f.lazer, observacoes: f.observacoes.trim() || undefined,
        assinatura,
      }
      const { captacao } = await enviarCaptacao(dados)
      setEnviada({ ...dados, ...captacao })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  async function baixarPdf() {
    setBaixando(true)
    try {
      await baixarPdfDoElemento(docRef.current, `autorizacao-captacao-imovit-${String(enviada.id).slice(0, 8)}.pdf`)
    } catch {
      setErro('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setBaixando(false)
    }
  }

  if (erroCarga) return <Moldura><div className="hub-error">{erroCarga}</div></Moldura>
  if (!config) return <Moldura><div className="hub-loading">Carregando…</div></Moldura>

  if (enviada) {
    return (
      <Moldura>
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="page-eyebrow">Autorização assinada</div>
          <div className="page-title" style={{ fontSize: 'var(--text-xl)' }}>Obrigado, {enviada.proprietario_nome.split(' ')[0]}!</div>
          <p className="page-sub" style={{ margin: 0 }}>
            Recebemos os dados do seu imóvel. {enviada.corretor} vai conduzir os próximos passos com você.
          </p>
          {erro && <div className="login-error">{erro}</div>}
          <div>
            <button type="button" className="btn btn-primary btn-sm" disabled={baixando} onClick={baixarPdf}>
              {baixando ? 'Gerando PDF…' : 'Baixar minha autorização (PDF)'}
            </button>
          </div>
        </div>
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <DocumentoCaptacao ref={docRef} captacao={enviada} />
        </div>
      </Moldura>
    )
  }

  const e = ETAPAS[etapa]
  const ultima = etapa === ETAPAS.length - 1

  return (
    <Moldura>
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Acompanhamento personalizado · etapa {etapa + 1} de {ETAPAS.length}</div>
          <div className="page-title">{e.titulo}</div>
          <div className="page-sub">{e.texto}</div>
        </div>
      </header>
      <div className="mini-bar-track" style={{ background: 'var(--champagne)', marginBottom: 'var(--space-4)' }}>
        <div className="mini-bar-fill" style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
      </div>

      <form className="card card-body" onSubmit={(ev) => { ev.preventDefault(); if (ultima) enviar(); else avancar() }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* honeypot: invisível para pessoas */}
        <input type="text" name="site" tabIndex={-1} autoComplete="off" value={form.site} onChange={(ev) => set({ site: ev.target.value })}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

        {etapa === 0 && (
          <>
            <div className="field">
              <label htmlFor="cp-nome">Nome completo</label>
              <input id="cp-nome" required autoComplete="name" value={form.proprietario_nome} onChange={(ev) => set({ proprietario_nome: ev.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cp-email">E-mail</label>
              <input id="cp-email" type="email" required autoComplete="email" value={form.proprietario_email} onChange={(ev) => set({ proprietario_email: ev.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label htmlFor="cp-tel">Telefone</label>
                <input id="cp-tel" type="tel" required autoComplete="tel" value={form.proprietario_telefone} onChange={(ev) => set({ proprietario_telefone: ev.target.value })} placeholder="(19) 99999-9999" />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label htmlFor="cp-cpf">CPF</label>
                <input id="cp-cpf" required inputMode="numeric" value={form.proprietario_cpf} onChange={(ev) => set({ proprietario_cpf: ev.target.value })} placeholder="000.000.000-00" />
              </div>
            </div>
            <div className="field">
              <label>Corretor responsável</label>
              <div>{config.corretor}</div>
            </div>
          </>
        )}

        {etapa === 1 && (
          <>
            <div className="field"><label>Tipo de imóvel</label><Opcoes opcoes={TIPOS_IMOVEL} valor={form.tipo_imovel} onChange={(v) => set({ tipo_imovel: v })} /></div>
            <div className="field"><label>Finalidade</label><Opcoes opcoes={FINALIDADES} valor={form.finalidade} onChange={(v) => set({ finalidade: v })} /></div>
            <div className="field">
              <label>Este imóvel é exclusividade Imovit?</label>
              <span className="field-hint">Será anunciado e trabalhado apenas pela Imovit.</span>
              <Opcoes opcoes={['Sim', 'Não']} valor={form.exclusividade} onChange={(v) => set({ exclusividade: v })} />
            </div>
            {form.exclusividade === 'Sim' && (
              <div className="field"><label>Período</label><Opcoes opcoes={PERIODOS_EXCLUSIVIDADE} valor={form.exclusividade_periodo} onChange={(v) => set({ exclusividade_periodo: v })} /></div>
            )}
          </>
        )}

        {etapa === 2 && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '3 1 260px' }}>
                <label htmlFor="cp-rua">Endereço</label>
                <input id="cp-rua" required autoComplete="address-line1" value={form.logradouro} onChange={(ev) => set({ logradouro: ev.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 100px' }}>
                <label htmlFor="cp-num">Número</label>
                <input id="cp-num" required value={form.numero} onChange={(ev) => set({ numero: ev.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '2 1 220px' }}>
                <label htmlFor="cp-bairro">Bairro</label>
                <input id="cp-bairro" required value={form.bairro} onChange={(ev) => set({ bairro: ev.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 140px' }}>
                <label htmlFor="cp-cep">CEP (opcional)</label>
                <input id="cp-cep" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={(ev) => set({ cep: ev.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {[['apto_sala', 'Apartamento/sala'], ['bloco', 'Bloco'], ['quadra', 'Quadra']].map(([k, r]) => (
                <div className="field" style={{ flex: '1 1 140px' }} key={k}>
                  <label htmlFor={`cp-${k}`}>{r} (opcional)</label>
                  <input id={`cp-${k}`} value={form[k]} onChange={(ev) => set({ [k]: ev.target.value })} />
                </div>
              ))}
            </div>
          </>
        )}

        {etapa === 3 && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {[
              ['valor_venda', 'Valor de venda', form.finalidade !== 'Locação'],
              ['valor_locacao', 'Valor de locação', form.finalidade !== 'Venda'],
              ['valor_condominio', 'Valor do condomínio (opcional)', true],
              ['iptu_mensal', 'IPTU mensal (opcional)', true],
            ].filter(([, , mostra]) => mostra).map(([k, r]) => (
              <div className="field" style={{ flex: '1 1 220px' }} key={k}>
                <label htmlFor={`cp-${k}`}>{r}</label>
                <CurrencyInput id={`cp-${k}`} value={form[k]} onChange={(v) => set({ [k]: v })} />
              </div>
            ))}
          </div>
        )}

        {etapa === 4 && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="cp-area">Área interna (m²)</label>
                <input id="cp-area" required inputMode="decimal" value={form.area_interna} onChange={(ev) => set({ area_interna: ev.target.value })} />
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="cp-terreno">Área do lote/terreno (m², opcional)</label>
                <input id="cp-terreno" inputMode="decimal" value={form.area_terreno} onChange={(ev) => set({ area_terreno: ev.target.value })} />
              </div>
            </div>
            <div className="field"><label>Quartos</label><Opcoes opcoes={QUARTOS} valor={form.quartos} onChange={(v) => set({ quartos: v })} /></div>
            <div className="field"><label>Suítes</label><Opcoes opcoes={SUITES} valor={form.suites} onChange={(v) => set({ suites: v })} /></div>
            <div className="field"><label>Banheiros</label><Opcoes opcoes={BANHEIROS} valor={form.banheiros} onChange={(v) => set({ banheiros: v })} /></div>
            <div className="field"><label>Salas</label><Opcoes opcoes={SALAS} valor={form.salas} onChange={(v) => set({ salas: v })} /></div>
            <div className="field"><label>Vagas de garagem</label><Opcoes opcoes={VAGAS} valor={form.vagas} onChange={(v) => set({ vagas: v })} /></div>
            {form.vagas && form.vagas !== '0' && (
              <div className="field"><label>Tipo de vaga</label><Opcoes opcoes={TIPOS_VAGA} valor={form.tipo_vaga} onChange={(v) => set({ tipo_vaga: v })} /></div>
            )}
          </>
        )}

        {etapa === 5 && (
          <>
            <div className="field">
              <label>Lazer</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {LAZER.map((l) => {
                  const marcado = form.lazer.includes(l)
                  return (
                    <button key={l} type="button" aria-pressed={marcado} className={`btn btn-sm ${marcado ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => set({ lazer: marcado ? form.lazer.filter((x) => x !== l) : [...form.lazer, l] })}>
                      {l}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="field">
              <label htmlFor="cp-obs">Observações (opcional)</label>
              <textarea id="cp-obs" rows={5} value={form.observacoes} onChange={(ev) => set({ observacoes: ev.target.value })}
                placeholder="Descreva aqui o que torna este imóvel único: detalhes da arquitetura, reformas recentes, a vista privilegiada ou o que há de melhor na vizinhança." />
            </div>
          </>
        )}

        {etapa === 6 && (
          <>
            <div style={{ whiteSpace: 'pre-line', background: 'var(--gray-50, #fafafa)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
              {config.declaracao}
            </div>
            <div className="field">
              <label>Assinatura do proprietário</label>
              <AssinaturaPad ref={assinaturaRef} />
            </div>
          </>
        )}

        {erro && <div className="login-error">{erro}</div>}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={etapa === 0 || enviando} onClick={() => { setErro(''); setEtapa((x) => x - 1) }}>
            Voltar
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>
            {ultima ? (enviando ? 'Enviando…' : 'Assinar e enviar') : 'Continuar'}
          </button>
        </div>
      </form>
    </Moldura>
  )
}
