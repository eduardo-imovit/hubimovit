// =============================================================================
// Templates de e-mail da esteira de locação.
//
// Seguem o padrão de e-mail da Imovit documentado no Obsidian
// ("E-mails - Templates Imovit"): header preto com logo e borda coral, badge,
// título em serif itálico, caixa de destaque com borda lateral, botão preto
// com texto coral e assinatura. Estilos inline (não em <style>) porque vários
// clientes de e-mail descartam o <head>.
//
// Módulo puro, sem APIs do Deno, pra dar pra gerar prévia fora da function.
// =============================================================================

const CORAL = '#ff5e4d'
const LOGO_URL = 'https://drive.google.com/uc?export=view&id=1t6jzLPHVNqLHZr0Z83m3wkyvPT2rpFPl'
const FONTE_TEXTO = "'DM Sans', Arial, sans-serif"
const FONTE_TITULO = "'Noto Serif', Georgia, serif"

const ASSINATURA_LOCATARIO = 'Equipe de Locação | Imovit'
const ASSINATURA_INTERNA = 'Hub Imovit'

export function escapeHtml(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface Destaque {
  rotulo: string
  itensHtml: string[]
}

interface EmailImovit {
  badge: string
  titulo: string
  saudacaoNome?: string | null
  paragrafosHtml: string[]
  destaque?: Destaque
  cta: { texto: string; url: string }
  assinatura: string
}

function paragrafo(html: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#444444;font-family:${FONTE_TEXTO}">${html}</p>`
}

function caixaDestaque({ rotulo, itensHtml }: Destaque) {
  const itens = itensHtml
    .map((item) => `<li style="margin:0 0 10px">• ${item}</li>`)
    .join('')
  return `<div style="border-left:3px solid ${CORAL};padding:25px;margin:30px 0;background-color:#fffaf9">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999999;font-weight:700;font-family:${FONTE_TEXTO}">${escapeHtml(rotulo)}</span>
      <ul style="margin:15px 0 0;padding:0;list-style-type:none;color:#1a1a1a;font-size:14px;line-height:1.6;font-family:${FONTE_TEXTO}">${itens}</ul>
    </div>`
}

export function emailImovit({ badge, titulo, saudacaoNome, paragrafosHtml, destaque, cta, assinatura }: EmailImovit) {
  const saudacao = saudacaoNome
    ? paragrafo(`Olá, <strong style="color:#000000">${escapeHtml(saudacaoNome)}</strong>.`)
    : ''

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
// Um template por notificação do fluxo, na ordem em que acontecem.
// -----------------------------------------------------------------------------

interface PropostaEmail {
  nome_cliente?: string | null
  imovel_titulo?: string | null
  valor?: number | string | null
  valor_oferta?: number | string | null
  observacoes?: string | null
  corretor_responsavel?: string | null
  garantia?: string | null
  data_posse?: string | null
  prazo_meses?: number | null
  dia_vencimento?: number | null
  clausula_rescisao?: string | null
  negociacao_especifica?: string | null
  taxa_administracao?: number | string | null
}

const dataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)

const moeda = (v: number | string | null | undefined) =>
  v == null || v === '' ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Texto livre em HTML seguro, mantendo as quebras de linha. */
const textoLivre = (t: string) => escapeHtml(t).replace(/\r?\n/g, '<br/>')

const doImovel = (p: PropostaEmail, prefixo: string) =>
  p.imovel_titulo ? ` ${prefixo} <strong style="color:#000000">${escapeHtml(p.imovel_titulo)}</strong>` : ''

/**
 * Caixa com os termos registrados pelo gestor, na ordem do modelo que a equipe
 * já usava. `interno` inclui a taxa de administração (acordo com o proprietário):
 * só para e-mails da equipe, nunca para o locatário.
 */
function detalhesDaProposta(p: PropostaEmail, interno = false) {
  const itens: string[] = []
  const linha = (rotulo: string, valor: string | null | undefined, multilinha = false) => {
    if (valor == null || String(valor).trim() === '') return
    itens.push(`${rotulo}: ${multilinha ? textoLivre(String(valor).trim()) : `<strong>${escapeHtml(String(valor))}</strong>`}`)
  }
  const anuncio = moeda(p.valor)
  const negociado = moeda(p.valor_oferta)
  linha('Corretor responsável', p.corretor_responsavel)
  if (negociado) itens.push(`Valor da locação: <strong>${negociado}</strong>${anuncio && anuncio !== negociado ? ` (anúncio: ${anuncio})` : ''}`)
  linha('Tipo de garantia', p.garantia)
  linha('Data da posse', dataBR(p.data_posse))
  linha('Prazo contratual', p.prazo_meses ? `${p.prazo_meses} meses` : null)
  linha('Cláusula de rescisão', p.clausula_rescisao, true)
  linha('Negociação específica', p.negociacao_especifica, true)
  linha('Outros combinados e benfeitorias', p.observacoes, true)
  linha('Vencimento do aluguel', p.dia_vencimento ? `todo dia ${p.dia_vencimento}` : null)
  if (interno) linha('Taxa de administração (proprietário)', p.taxa_administracao != null && p.taxa_administracao !== '' ? `${String(p.taxa_administracao).replace('.', ',')}%` : null)
  return itens.length ? { rotulo: 'Condições negociadas', itensHtml: itens } : undefined
}

/** 1. Gestor registrou (ou corrigiu) a proposta negociada → locatário valida. */
export function emailPropostaParaValidar(p: PropostaEmail, linkPortal: string, atualizada = false) {
  return {
    assunto: atualizada ? 'Sua proposta de locação foi corrigida: valide de novo' : 'Sua proposta de locação está pronta para validar',
    html: emailImovit({
      badge: 'Proposta de locação',
      titulo: atualizada ? 'Proposta corrigida' : 'Valide sua proposta',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        atualizada
          ? `Corrigimos a proposta de locação${doImovel(p, 'para')} conforme combinado.`
          : `Registramos a proposta de locação${doImovel(p, 'para')} com os termos que você negociou.`,
        'Acesse o portal com este mesmo e-mail, confira e valide. Se algo estiver diferente do combinado, é só pedir correção por lá.',
      ],
      destaque: detalhesDaProposta(p),
      cta: { texto: 'Validar minha proposta', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}

/** 2a. Locatário pediu correção → quem registrou a proposta. */
export function emailCorrecaoPedida(p: PropostaEmail, motivo: string, linkPropostas: string) {
  return {
    assunto: 'Locatário pediu correção na proposta',
    html: emailImovit({
      badge: 'Correção pedida',
      titulo: 'Corrija e reenvie a proposta',
      paragrafosHtml: [
        `<strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong> pediu uma correção na proposta${doImovel(p, 'para')} antes de validar.`,
        'Ajuste em Propostas de locação ("Corrigir e reenviar"); ele recebe um e-mail para validar de novo.',
      ],
      destaque: { rotulo: 'O que o locatário pediu', itensHtml: [textoLivre(motivo)] },
      cta: { texto: 'Corrigir proposta', url: linkPropostas },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}

/** 2b. Locatário validou → esteira aberta, avisa a equipe. */
export function emailEsteiraAberta(p: PropostaEmail, linkEsteiras: string) {
  return {
    assunto: 'Nova esteira aberta: proposta validada pelo locatário',
    html: emailImovit({
      badge: 'Esteira aberta',
      titulo: 'Proposta validada',
      paragrafosHtml: [
        `<strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong> validou a proposta${doImovel(p, 'para')}.`,
        'A esteira de documentos está aberta: o locatário completa o cadastro e envia os documentos.',
      ],
      destaque: detalhesDaProposta(p, true),
      cta: { texto: 'Acompanhar na esteira', url: linkEsteiras },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}

/** 4. Locatário enviou todos os documentos → equipe interna. */
export function emailDocsEnviados(p: PropostaEmail, linkEsteiras: string) {
  return {
    assunto: 'Documentos enviados: aguardando revisão',
    html: emailImovit({
      badge: 'Documentação',
      titulo: 'Documentos para revisar',
      paragrafosHtml: [
        `<strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong> enviou todos os documentos${doImovel(p, 'da proposta de')}.`,
        'Revise cada um e, se algo precisar ser corrigido, use "Solicitar ajustes" para avisar o locatário de uma vez.',
      ],
      cta: { texto: 'Revisar documentos', url: linkEsteiras },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}

/** 5. ADM concluiu a revisão e pediu ajustes → locatário (um e-mail só, com todos os reprovados). */
export function emailAjustesDocumentos(
  p: PropostaEmail,
  reprovados: { nome: string; motivo: string | null }[],
  linkPortal: string
) {
  const plural = reprovados.length > 1
  return {
    assunto: plural ? 'Alguns documentos precisam ser reenviados' : 'Um documento precisa ser reenviado',
    html: emailImovit({
      badge: 'Documentação',
      titulo: plural ? 'Documentos para reenviar' : 'Documento para reenviar',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Revisamos a documentação da sua proposta${doImovel(p, 'para')}. ${plural ? `${reprovados.length} documentos precisam` : 'Um documento precisa'} ser reenviado${plural ? 's' : ''}.`,
        'Os demais já estão aprovados. Acesse o portal para reenviar só o que está listado abaixo.',
      ],
      destaque: {
        rotulo: 'O que reenviar',
        itensHtml: reprovados.map(({ nome, motivo }) =>
          `<strong style="color:#000000">${escapeHtml(nome)}</strong>${motivo ? `: ${escapeHtml(motivo)}` : ''}`
        ),
      },
      cta: { texto: 'Reenviar documentos', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}

/** 6a. Todos os documentos aprovados → locatário. */
export function emailDocsAprovados(p: PropostaEmail, linkPortal: string) {
  return {
    assunto: 'Todos os seus documentos foram aprovados',
    html: emailImovit({
      badge: 'Documentação aprovada',
      titulo: 'Documentação aprovada',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Todos os documentos da sua proposta${doImovel(p, 'para')} foram aprovados.`,
        'Agora estamos finalizando o processo. Avisaremos você assim que estiver concluído.',
      ],
      cta: { texto: 'Ver status', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}

/** 6b. Todos os documentos aprovados → equipe interna. */
export function emailProntoImoview(p: PropostaEmail, linkEsteiras: string) {
  return {
    assunto: 'Proposta pronta para lançar no Imoview',
    html: emailImovit({
      badge: 'Documentação completa',
      titulo: 'Pronta para o Imoview',
      paragrafosHtml: [
        `A proposta de <strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong>${doImovel(p, 'para')} teve todos os documentos aprovados.`,
        'Lance no Imoview e depois finalize o processo no Hub (baixa o .zip e libera o Storage).',
      ],
      cta: { texto: 'Ver proposta', url: linkEsteiras },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}

/** 7. Processo finalizado → locatário. */
export function emailProcessoConcluido(p: PropostaEmail, linkPortal: string) {
  return {
    assunto: 'Processo de locação concluído',
    html: emailImovit({
      badge: 'Processo concluído',
      titulo: 'Tudo certo com a sua locação',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `O processo de locação${doImovel(p, 'de')} foi concluído.`,
        'Obrigado por escolher a Imovit.',
      ],
      cta: { texto: 'Ver detalhes', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}
