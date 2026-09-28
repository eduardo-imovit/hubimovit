import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { carregarConsultor } from '../../lib/captacao'

/**
 * Apresentação Imovit (RF23, PRD §5.7): página pública para leads do topo.
 * Texto a partir de "A Alma da Imovit" (posicionamento 2026) e do Perfil de
 * Comunicação; estética Editorial Boutique (creme, grafite, coral como ponto
 * de luz, serifa nos títulos). Com o código do corretor (o mesmo da captação),
 * termina no cartão do consultor com WhatsApp.
 */

const COMO = [
  { titulo: 'Concierge de relacionamento', texto: 'Um consultor dedicado, que entende o que você procura antes de mostrar qualquer imóvel.' },
  { titulo: 'Curadoria', texto: 'Selecionamos com critério. Menos vitrine, mais escolhas certas para o seu momento.' },
  { titulo: 'Campinas de perto', texto: 'Cambuí, Gramado, Sousas e os melhores bairros da cidade, com leitura precisa de valor e de estilo de vida.' },
  { titulo: 'Transparência', texto: 'Clareza em cada documento e em cada número, do primeiro contato à assinatura.' },
]

const SERVICOS = [
  { titulo: 'Compra e venda', texto: 'Da avaliação ao fechamento: posicionamento, divulgação na nossa vitrine exclusiva e acompanhamento de cada etapa.' },
  { titulo: 'Locação e gestão', texto: 'Locação com análise cuidadosa e administração do contrato, com acompanhamento contínuo e suporte jurídico.' },
]

const INSTAGRAM = 'https://www.instagram.com/imovitimobiliaria/'
const SITE_CASADEZOITO = 'https://www.casadezoito.com.br/'

const serif = { fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.01em' }
const eyebrow = { fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase', color: 'var(--coral)', fontWeight: 600, margin: 0 }

function whatsappLink(numero, nome) {
  let d = String(numero ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length <= 11) d = `55${d}`
  const primeiro = nome ? nome.split(' ')[0] : ''
  const msg = `Olá${primeiro ? `, ${primeiro}` : ''}! Vi a apresentação da Imovit e gostaria de conversar.`
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`
}

function Secao({ children, fundo = 'var(--creme)', cor = 'var(--grafite)' }) {
  return (
    <section style={{ background: fundo, color: cor, padding: 'clamp(56px, 9vw, 112px) 20px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
    </section>
  )
}

export default function ApresentacaoImovit() {
  const { token } = useParams()
  const [consultor, setConsultor] = useState(null)

  useEffect(() => {
    document.title = 'Imovit · Lares com a sua alma'
    if (!token || !/^[A-Za-z0-9_-]{10,40}$/.test(token)) return
    // link inválido: a página segue sem o cartão do consultor
    carregarConsultor(token).then(setConsultor).catch(() => setConsultor(null))
  }, [token])

  const wa = consultor ? whatsappLink(consultor.whatsapp, consultor.nome) : null

  return (
    <div style={{ background: 'var(--creme)', color: 'var(--grafite)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      {/* Abertura */}
      <header style={{ position: 'relative', minHeight: 'min(88vh, 760px)', display: 'flex', alignItems: 'flex-end', color: '#fff', overflow: 'hidden' }}>
        <img src="/apresentacao/casadezoito-lounge.jpg" alt="" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,20,20,.15) 0%, rgba(20,20,20,.75) 100%)' }} />
        <div style={{ position: 'relative', maxWidth: 1040, margin: '0 auto', width: '100%', padding: 'clamp(28px, 6vw, 72px) 20px' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--coral)', marginBottom: 24 }}>imovit</div>
          <p style={{ ...eyebrow, color: '#fff', opacity: 0.85 }}>Imobiliária boutique · Campinas</p>
          <h1 style={{ ...serif, fontSize: 'clamp(40px, 7vw, 76px)', lineHeight: 1.05, margin: '14px 0 18px', color: '#fff' }}>
            Lares com a sua alma.
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.6, maxWidth: 560, margin: 0, opacity: 0.92 }}>
            Para quem procura mais do que metros quadrados: um lugar com a sua cara, a sua energia e a sua história.
          </p>
        </div>
      </header>

      {/* Essência */}
      <Secao>
        <p style={eyebrow}>Nossa essência</p>
        <h2 style={{ ...serif, fontSize: 'clamp(30px, 4.6vw, 48px)', lineHeight: 1.15, margin: '16px 0 24px', maxWidth: 760 }}>
          Não vendemos metros quadrados. Vendemos cenários de vida.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.75, maxWidth: 680, margin: 0, color: 'var(--grafite-mid, #555)' }}>
          Há mais de 10 anos a Imovit conecta pessoas e imóveis em Campinas. Ser boutique, para nós, é cuidar de cada
          interação: escutar com atenção, selecionar com critério e acompanhar cada etapa até a chave na mão.
        </p>
      </Secao>

      {/* Como trabalhamos */}
      <Secao fundo="#fff">
        <p style={eyebrow}>Como trabalhamos</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(24px, 4vw, 48px)', marginTop: 32 }}>
          {COMO.map((c) => (
            <div key={c.titulo} style={{ borderTop: '2px solid var(--coral)', paddingTop: 18 }}>
              <h3 style={{ ...serif, fontSize: 22, margin: '0 0 10px' }}>{c.titulo}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, margin: 0, color: 'var(--grafite-mid, #555)' }}>{c.texto}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* Serviços */}
      <Secao>
        <p style={eyebrow}>O que fazemos</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(24px, 4vw, 56px)', marginTop: 32 }}>
          {SERVICOS.map((s) => (
            <div key={s.titulo}>
              <h3 style={{ ...serif, fontSize: 'clamp(26px, 3.4vw, 34px)', margin: '0 0 12px' }}>{s.titulo}</h3>
              <p style={{ fontSize: 16.5, lineHeight: 1.75, margin: 0, color: 'var(--grafite-mid, #555)' }}>{s.texto}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* Nossa casa */}
      <Secao fundo="var(--grafite)" cor="#fff">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'clamp(28px, 5vw, 64px)', alignItems: 'center' }}>
          <div>
            <p style={eyebrow}>Nossa casa</p>
            <h2 style={{ ...serif, fontSize: 'clamp(30px, 4.4vw, 46px)', lineHeight: 1.15, margin: '16px 0 20px', color: '#fff' }}>
              A Imovit mora na CasaDezoito.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, margin: '0 0 24px', opacity: 0.88 }}>
              Um espaço em Campinas que reúne, sob o mesmo teto, imóveis, arquitetura, design, construção e investimentos.
              Venha tomar um café com a gente, com hora marcada.
            </p>
            <p style={{ fontSize: 14, margin: '0 0 24px', opacity: 0.75 }}>Av. Rotary, 134 · Vila Brandina · Campinas/SP</p>
            <a href={SITE_CASADEZOITO} target="_blank" rel="noreferrer"
              style={{ color: 'var(--coral)', textDecoration: 'none', borderBottom: '1px solid var(--coral)', paddingBottom: 2, fontWeight: 600 }}>
              Conheça a CasaDezoito ↗
            </a>
          </div>
          <img src="/apresentacao/casadezoito-fachada.jpg" alt="Fachada da CasaDezoito, em Campinas"
            style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 4 }} loading="lazy" />
        </div>
      </Secao>

      {/* Consultor */}
      <Secao>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          {consultor ? (
            <>
              <p style={eyebrow}>Seu consultor Imovit</p>
              <h2 style={{ ...serif, fontSize: 'clamp(32px, 5vw, 48px)', margin: '14px 0 12px' }}>{consultor.nome}</h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.7, margin: '0 0 28px', color: 'var(--grafite-mid, #555)' }}>
                Conte o que você procura. A primeira conversa é para entender você, não para mostrar imóveis.
              </p>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', background: 'var(--grafite)', color: 'var(--coral)', padding: '16px 30px', textDecoration: 'none', fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', fontSize: 13 }}>
                  Conversar no WhatsApp
                </a>
              )}
            </>
          ) : (
            <>
              <p style={eyebrow}>Vamos conversar</p>
              <h2 style={{ ...serif, fontSize: 'clamp(30px, 4.6vw, 44px)', margin: '14px 0 20px' }}>Fale com a Imovit.</h2>
            </>
          )}
          <p style={{ marginTop: 28, fontSize: 14 }}>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer" style={{ color: 'var(--grafite)' }}>@imovitimobiliaria</a>
          </p>
        </div>
      </Secao>

      <footer style={{ textAlign: 'center', padding: '28px 20px', fontSize: 12, color: '#888', background: 'var(--creme)', borderTop: '1px solid var(--champagne, #e8dfd0)' }}>
        Imovit · Lares com a sua alma · Campinas/SP
      </footer>
    </div>
  )
}
