// =============================================================================
// Templates de e-mail da proposta de VENDA (compra).
// Padrão visual Imovit (mesmo da locação): header preto + borda coral, badge,
// título serif itálico, botão preto/coral, assinatura. Estilos inline.
// Módulo puro, sem APIs do Deno.
// Diferenças pedidas pela direção: título "proposta de compra", corpo
// "Uma proposta de compra foi criada em seu nome", assinatura
// "Equipe Relacionamento | Imovit", vocabulário cliente/proponente.
// =============================================================================

const CORAL = '#ff5e4d'
const LOGO_URL = 'https://drive.google.com/uc?export=view&id=1t6jzLPHVNqLHZr0Z83m3wkyvPT2rpFPl'
const FONTE_TEXTO = "'DM Sans', Arial, sans-serif"
const FONTE_TITULO = "'Noto Serif', Georgia, serif"

const ASSINATURA_RELACIONAMENTO = 'Equipe Relacionamento | Imovit'
const ASSINATURA_INTERNA = 'Hub Imovit'

export function escapeHtml(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface EmailImovit {
  badge: string
  titulo: string
  saudacaoNome?: string | null
  paragrafosHtml: string[]
  destaque?: { rotulo: string; itensHtml: string[] }
  cta: { texto: string; url: string }
  assinatura: string
}

function paragrafo(html: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#444444;font-family:${FONTE_TEXTO}">${html}</p>`
}

function caixaDestaque({ rotulo, itensHtml }: { rotulo: string; itensHtml: string[] }) {
  const itens = itensHtml.map((item) => `<li style="margin:0 0 10px">• ${item}</li>`).join('')
  return `<div style="border-left:3px solid ${CORAL};padding:25px;margin:30px 0;background-color:#fffaf9">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999999;font-weight:700;font-family:${FONTE_TEXTO}">${escapeHtml(rotulo)}</span>
      <ul style="margin:15px 0 0;padding:0;list-style-type:none;color:#1a1a1a;font-size:14px;line-height:1.6;font-family:${FONTE_TEXTO}">${itens}</ul>
    </div>`
}

export function emailImovit({ badge, titulo, saudacaoNome, paragrafosHtml, destaque, cta, assinatura }: EmailImovit) {
  const saudacao = saudacaoNome ? paragrafo(`Olá, <strong style="color:#000000">${escapeHtml(saudacaoNome)}</strong>.`) : ''
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Noto+Serif:ital,wght@1,300;1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f9f9f9">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border:1px solid #eeeeee">
    <div style="padding:50px 20px;text-align:center;background-color:#000000;border-bottom:4px solid ${CORAL}">
      <img src="${LOGO_URL}" alt="Imovit" width="240" style="max-width:100%;height:auto">
      <div style="margin-top:30px">
        <div style="display:inline-block;padding:6px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;border:1px solid ${CORAL};color:${CORAL};font-family:${FONTE_TEXTO}">${escapeHtml(badge)}</div>
        <h1 style="margin:0;font-size:26px;font-family:${FONTE_TITULO};font-style:italic;font-weight:300;color:#ffffff;letter-spacing:1px">${escapeHtml(titulo)}</h1>
      </div>
    </div>
    <div style="padding:50px 40px">
      ${saudacao}
      ${paragrafosHtml.map(paragrafo).join('\n      ')}
      ${destaque ? caixaDestaque(destaque) : ''}
      <div style="text-align:center">
        <a href="${cta.url}" style="display:inline-block;padding:15px 30px;background-color:#000000;color:${CORAL};text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;border:1px solid ${CORAL};margin-top:20px;font-family:${FONTE_TEXTO}">${escapeHtml(cta.texto)}</a>
      </div>
      <p style="margin:50px 0 0;font-size:13px;border-top:1px solid #eeeeee;padding-top:20px;color:#444444;font-family:${FONTE_TEXTO}">
        Atenciosamente,<br/>
        <span style="display:block;margin-top:10px;font-family:${FONTE_TITULO};font-style:italic;font-weight:300;font-size:20px;color:${CORAL}">${escapeHtml(assinatura)}</span>
        <small style="display:block;margin-top:5px;color:#999999;font-weight:400;text-transform:uppercase;letter-spacing:1px">A marca da exclusividade.</small>
      </p>
    </div>
  </div>
</body>
</html>`
}

// -----------------------------------------------------------------------------
// Templates da venda
// -----------------------------------------------------------------------------

interface PropostaVendaEmail {
  nome_cliente?: string | null
  imovel_titulo?: string | null
  codigo_imovel?: number | null
  imovel_endereco?: string | null
  valor_referencia?: number | string | null
  valor_proposta?: number | string | null
  descricao_proposta?: string | null
}

const moeda = (v: number | string | null | undefined) =>
  v == null || v === '' ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const textoLivre = (t: string) => escapeHtml(t).replace(/\r?\n/g, '<br/>')

/** 1. Corretor criou → proponente. */
export function emailPropostaCompraCriada(p: PropostaVendaEmail, linkPortal: string) {
  const imovel = p.imovel_titulo
    ? ` para <strong style="color:#000000">${escapeHtml(p.imovel_titulo)}</strong>`
    : p.codigo_imovel != null
      ? ` para o imóvel <strong style="color:#000000">${p.codigo_imovel}</strong>`
      : ''
  return {
    assunto: 'Sua proposta de compra foi criada',
    html: emailImovit({
      badge: 'Proposta de compra',
      titulo: 'Proposta de compra',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Uma proposta de compra foi criada em seu nome${imovel}.`,
        'Para continuar, acesse o portal com este mesmo e-mail, confira os dados, preencha o valor e a descrição da sua proposta e assine.',
      ],
      cta: { texto: 'Acessar minha proposta', url: linkPortal },
      assinatura: ASSINATURA_RELACIONAMENTO,
    }),
  }
}

/** 2. Proponente confirmou/assinou → equipe interna. */
export function emailPropostaCompraConfirmada(p: PropostaVendaEmail, linkVendas: string) {
  const itens: string[] = []
  const oferta = moeda(p.valor_proposta)
  const referencia = moeda(p.valor_referencia)
  if (oferta) itens.push(`Valor da proposta: <strong>${oferta}</strong>${referencia && referencia !== oferta ? ` (referência: ${referencia})` : ''}`)
  if (p.descricao_proposta?.trim()) itens.push(`Proposta: ${textoLivre(p.descricao_proposta.trim())}`)
  if (p.imovel_endereco?.trim()) itens.push(`Endereço: ${escapeHtml(p.imovel_endereco.trim())}`)
  return {
    assunto: 'Nova proposta de compra assinada',
    html: emailImovit({
      badge: 'Proposta assinada',
      titulo: 'Proposta de compra assinada',
      paragrafosHtml: [
        `<strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong> assinou a proposta de compra${p.imovel_titulo ? ` para <strong style="color:#000000">${escapeHtml(p.imovel_titulo)}</strong>` : ''}.`,
        'O documento assinado está disponível na proposta.',
      ],
      destaque: itens.length ? { rotulo: 'Resumo da proposta', itensHtml: itens } : undefined,
      cta: { texto: 'Ver proposta de venda', url: linkVendas },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}
