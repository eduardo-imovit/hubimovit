import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { carregarConsultor, SITE_CASADEZOITO } from '../../lib/captacao'
import { EQUIPE, pessoaPorNomeCrm } from '../../lib/equipeImovit'
import '../../styles/apresentacao.css'

/**
 * Apresentação Imovit (RF23, PRD §5.7): página pública para lead de topo,
 * qualquer finalidade. Texto a partir de "A Alma da Imovit" (posicionamento
 * 2026) e do Perfil de Comunicação; estética Editorial Boutique. Com o código
 * do corretor (o mesmo da captação), abre e fecha com o consultor e WhatsApp.
 */

const PILARES = [
  { titulo: 'Concierge de relacionamento', texto: 'Um consultor dedicado a você, do primeiro café à chave na mão. Ele entende o que você procura antes de mostrar qualquer imóvel.' },
  { titulo: 'Curadoria, não vitrine', texto: 'Selecionamos com critério. Em vez de uma lista infinita de anúncios, uma seleção enxuta de lares com a sua cara.' },
  { titulo: 'Campinas de perto', texto: 'Conhecemos a cidade rua a rua: o valor de cada endereço, o ritmo de cada bairro e o estilo de vida que ele oferece.' },
  { titulo: 'Transparência e segurança', texto: 'Clareza em cada número e em cada documento. Você sabe o que está acontecendo em todas as etapas.' },
]

const JORNADA = [
  { titulo: 'Escuta', texto: 'Antes de qualquer imóvel, entendemos o seu momento: rotina, estilo de vida, prazos e orçamento.' },
  { titulo: 'Curadoria', texto: 'Uma seleção feita para você, com imóveis que conversam com o que você nos contou.' },
  { titulo: 'Visitas', texto: 'No seu tempo, com contexto do imóvel e do bairro. Sem pressa e sem pressão.' },
  { titulo: 'Negociação', texto: 'Conduzida pelo seu consultor, com transparência em cada proposta e em cada número.' },
  { titulo: 'Segurança', texto: 'Análise de documentos e contratos, com acompanhamento até a assinatura.' },
  { titulo: 'A chave, e depois dela', texto: 'O relacionamento continua. Na locação, acompanhamos o contrato; na compra, seguimos por perto.' },
]

const COMPRAR = [
  'Curadoria de imóveis de médio e alto padrão em Campinas e região',
  'Visitas organizadas com contexto do bairro e do imóvel',
  'Negociação conduzida pelo seu consultor',
  'Acompanhamento da documentação até a escritura',
]

const ALUGAR = [
  'Seleção alinhada à sua rotina e ao seu estilo de vida',
  'Proposta, validação e documentos pelo nosso portal digital, sem papelada',
  'Garantias flexíveis: seguro-fiança, fiador, caução ou título de capitalização',
  'Contrato acompanhado pela nossa equipe durante toda a locação',
]

const BAIRROS = ['Cambuí', 'Gramado', 'Sousas']
const INSTAGRAM = 'https://www.instagram.com/imovitimobiliaria/'

function whatsappLink(numero, nome) {
  let d = String(numero ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length <= 11) d = `55${d}`
  const primeiro = nome ? nome.split(' ')[0] : ''
  const msg = `Olá${primeiro ? `, ${primeiro}` : ''}! Vi a apresentação da Imovit e gostaria de conversar.`
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`
}

function Pessoa({ p }) {
  return (
    <figure className="ap-pessoa" style={{ margin: 0 }}>
      <img src={p.foto} alt={p.nome} loading="lazy" width="720" height="900" />
      <figcaption>
        <strong>{p.nome}</strong>
        <span>{p.area}</span>
      </figcaption>
    </figure>
  )
}

export default function ApresentacaoImovit() {
  const { token } = useParams()
  const [consultor, setConsultor] = useState(null)

  useEffect(() => {
    document.title = 'Imovit · Lares com a sua alma'
    if (!token || !/^[A-Za-z0-9_-]{10,40}$/.test(token)) return
    // link inválido: a página segue, sem o consultor
    carregarConsultor(token).then(setConsultor).catch(() => setConsultor(null))
  }, [token])

  const pessoa = consultor ? pessoaPorNomeCrm(consultor.nome) : null
  const nomeConsultor = pessoa?.nome ?? consultor?.nome ?? null
  const primeiroNome = nomeConsultor ? nomeConsultor.split(' ')[0] : null
  const wa = consultor ? whatsappLink(consultor.whatsapp, nomeConsultor) : null

  const direcao = EQUIPE.filter((p) => p.grupo === 'Direção')
  const consultoria = EQUIPE.filter((p) => p.grupo === 'Consultoria')
  const bastidores = EQUIPE.filter((p) => p.grupo === 'Bastidores')

  return (
    <div className="ap">
      <nav className="ap-barra" aria-label="Imovit">
        <div className="ap-wrap">
          <a className="ap-logo" href="#inicio"><img src="/apresentacao/logo-imovit-lares.png" alt="Imovit · Lares com a sua alma." width="1200" height="162" /></a>
          {wa ? (
            <a className="ap-btn ap-btn--pequeno" href={wa} target="_blank" rel="noreferrer">Falar com {primeiroNome}</a>
          ) : (
            <a className="ap-btn ap-btn--pequeno" href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram</a>
          )}
        </div>
      </nav>

      {/* Abertura */}
      <header className="ap-hero" id="inicio">
        <img src="/apresentacao/casadezoito-lounge.jpg" alt="" aria-hidden="true" />
        <div className="ap-wrap">
          <p className="ap-eyebrow">Imobiliária boutique · Campinas · 10 anos</p>
          <h1 className="ap-serif">Lares com a sua alma.</h1>
          <p>Para quem procura mais do que metros quadrados: um lugar com a sua cara, a sua energia e a sua história.</p>
          <div className="ap-ctas">
            {wa && <a className="ap-btn" href={wa} target="_blank" rel="noreferrer">Conversar com {primeiroNome}</a>}
            <a className="ap-btn ap-btn--claro" href="#equipe">Conheça a equipe</a>
          </div>
        </div>
      </header>

      {/* Manifesto */}
      <section className="ap-sec">
        <div className="ap-wrap">
          <div className="ap-manifesto">
            <blockquote className="ap-serif">Não vendemos metros quadrados. <em>Vendemos cenários de vida.</em></blockquote>
            <div>
              <p className="ap-eyebrow">Nossa essência</p>
              <p className="ap-lead">
                Há 10 anos a Imovit conecta pessoas e imóveis em Campinas. Ser boutique, para nós, é ser cirúrgico: cuidar de
                cada interação, escutar antes de oferecer e tratar cada busca como a história única que ela é. Porque
                imóvel é frio; lar é vida.
              </p>
            </div>
          </div>
          <div className="ap-numeros">
            <div className="ap-numero"><strong>10</strong><span>anos em Campinas</span></div>
            <div className="ap-numero"><strong>{EQUIPE.length}</strong><span>pessoas no time</span></div>
            <div className="ap-numero"><strong>2</strong><span>frentes: compra e locação</span></div>
            <div className="ap-numero"><strong>1</strong><span>lar: CasaDezoito</span></div>
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section className="ap-sec ap-sec--grafite">
        <div className="ap-wrap">
          <p className="ap-eyebrow">O jeito Imovit</p>
          <h2 className="ap-h2 ap-serif" style={{ color: '#fff', maxWidth: 760 }}>Atendimento de concierge, do primeiro café à chave.</h2>
          <div className="ap-pilares">
            {PILARES.map((p, i) => (
              <div className="ap-pilar" key={p.titulo}>
                <div className="n">{String(i + 1).padStart(2, '0')}</div>
                <div><h3>{p.titulo}</h3><p>{p.texto}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jornada */}
      <section className="ap-sec">
        <div className="ap-wrap">
          <p className="ap-eyebrow">Sua jornada</p>
          <h2 className="ap-h2 ap-serif" style={{ maxWidth: 760 }}>Cada etapa pensada para você decidir com calma.</h2>
          <ol className="ap-jornada">
            {JORNADA.map((j) => (
              <li key={j.titulo}><h3>{j.titulo}</h3><p>{j.texto}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {/* Comprar ou alugar */}
      <section className="ap-sec ap-sec--branco">
        <div className="ap-wrap">
          <p className="ap-eyebrow">Comprar ou alugar</p>
          <h2 className="ap-h2 ap-serif" style={{ maxWidth: 760 }}>O mesmo cuidado, qualquer que seja o seu próximo passo.</h2>
          <div className="ap-duas">
            <div className="ap-card">
              <h3>Para quem vai comprar</h3>
              <ul>{COMPRAR.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="ap-card">
              <h3>Para quem vai alugar</h3>
              <ul>{ALUGAR.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bairros */}
      <section className="ap-sec">
        <div className="ap-wrap">
          <p className="ap-eyebrow">Onde estamos</p>
          <div className="ap-bairros">
            {BAIRROS.map((b, i) => (
              <span className="ap-serif" key={b}>{b}{i < BAIRROS.length - 1 ? <span style={{ color: 'var(--coral)' }}> · </span> : ''}</span>
            ))}
            <small>e os melhores endereços de Campinas e região.</small>
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section className="ap-sec ap-sec--branco" id="equipe">
        <div className="ap-wrap">
          <p className="ap-eyebrow">Nossa equipe</p>
          <h2 className="ap-h2 ap-serif" style={{ maxWidth: 780 }}>As pessoas por trás de cada lar.</h2>
          <p className="ap-lead">Consultores que conhecem Campinas de perto e uma equipe de bastidores que cuida de cada detalhe, para você só se preocupar em escolher.</p>
          <div className="ap-equipe">
            {[...direcao, ...consultoria].map((p) => <Pessoa key={p.nome} p={p} />)}
          </div>
          <div className="ap-subgrupo">
            <p className="ap-eyebrow">Bastidores</p>
            <div className="ap-equipe ap-equipe--menor">
              {bastidores.map((p) => <Pessoa key={p.nome} p={p} />)}
            </div>
          </div>
        </div>
      </section>

      {/* CasaDezoito */}
      <section className="ap-sec ap-sec--grafite">
        <div className="ap-wrap">
          <div className="ap-casa">
            <div>
              <p className="ap-eyebrow">Nossa casa</p>
              <h2 className="ap-h2 ap-serif" style={{ color: '#fff' }}>A Imovit mora na CasaDezoito.</h2>
              <p className="ap-lead" style={{ marginBottom: 20 }}>
                Um espaço em Campinas que reúne, sob o mesmo teto, imóveis, arquitetura, design, construção e investimentos.
                Um lugar para conversar sem pressa, com café, conforto e discrição.
              </p>
              <p style={{ fontSize: 14, margin: '0 0 28px', color: 'rgba(245,240,232,.6)' }}>Av. Rotary, 134 · Vila Brandina · Campinas/SP · visitas com hora marcada</p>
              <a className="ap-link" href={SITE_CASADEZOITO} target="_blank" rel="noreferrer">Conheça a CasaDezoito ↗</a>
            </div>
            <div className="ap-casa-fotos">
              <img src="/apresentacao/casadezoito-fachada.jpg" alt="Fachada da CasaDezoito" loading="lazy" />
              <img src="/apresentacao/casadezoito-lounge.jpg" alt="Lounge da CasaDezoito" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Consultor */}
      <section className="ap-sec">
        <div className="ap-wrap">
          {consultor ? (
            <div className={`ap-consultor${pessoa ? '' : ' ap-consultor--sem-foto'}`}>
              {pessoa && <img src={pessoa.foto} alt={pessoa.nome} />}
              <div>
                <p className="ap-eyebrow">Seu consultor Imovit</p>
                <h2 className="ap-h2 ap-serif" style={{ marginBottom: 8 }}>{nomeConsultor}</h2>
                {pessoa && <p style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', margin: 0 }}>{pessoa.area}</p>}
                <p className="ap-assinatura">“Conte o que você procura. A primeira conversa é para entender você, não para mostrar imóveis.”</p>
                <div className="ap-ctas">
                  {wa && <a className="ap-btn" href={wa} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>}
                  <a className="ap-link" href={INSTAGRAM} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>@imovitimobiliaria</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="ap-consultor ap-consultor--sem-foto">
              <div>
                <p className="ap-eyebrow">Vamos conversar</p>
                <h2 className="ap-h2 ap-serif">O seu próximo lar começa com uma boa conversa.</h2>
                <div className="ap-ctas">
                  <a className="ap-btn" href={INSTAGRAM} target="_blank" rel="noreferrer">Fale com a Imovit</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="ap-rodape">
        <img src="/apresentacao/logo-imovit-lares-creme.png" alt="Imovit · Lares com a sua alma." width="1200" height="162" loading="lazy" />
        <p>Campinas/SP · @imovitimobiliaria</p>
      </footer>
    </div>
  )
}
