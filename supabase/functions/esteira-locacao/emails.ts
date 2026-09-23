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
}

const doImovel = (p: PropostaEmail, prefixo: string) =>
  p.imovel_titulo ? ` ${prefixo} <strong style="color:#000000">${escapeHtml(p.imovel_titulo)}</strong>` : ''

/** 1. Corretor criou a proposta → locatário. */
export function emailPropostaCriada(p: PropostaEmail, linkPortal: string) {
  return {
    assunto: 'Sua proposta de locação foi criada',
    html: emailImovit({
      badge: 'Proposta de locação',
      titulo: 'Sua proposta foi criada',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Uma proposta de locação foi criada em seu nome${doImovel(p, 'para')}.`,
        'Para continuar, acesse o portal com este mesmo e-mail e complete seus dados.',
      ],
      cta: { texto: 'Acessar minha proposta', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}

/** 2. Locatário completou os dados → equipe interna. */
export function emailRevisaoInterna(p: PropostaEmail, linkPropostas: string) {
  return {
    assunto: 'Nova proposta aguardando revisão interna',
    html: emailImovit({
      badge: 'Revisão interna',
      titulo: 'Proposta aguardando revisão',
      paragrafosHtml: [
        `<strong style="color:#000000">${escapeHtml(p.nome_cliente)}</strong> completou os dados da proposta${doImovel(p, 'para')}.`,
        'Revise antes de liberar a etapa de documentos.',
      ],
      cta: { texto: 'Revisar proposta', url: linkPropostas },
      assinatura: ASSINATURA_INTERNA,
    }),
  }
}

/** 3a. Proposta aprovada na revisão interna → locatário. */
export function emailPropostaAprovada(p: PropostaEmail, linkPortal: string) {
  return {
    assunto: 'Proposta aprovada: envie seus documentos',
    html: emailImovit({
      badge: 'Proposta aprovada',
      titulo: 'Sua proposta foi aprovada',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Sua proposta${doImovel(p, 'para')} foi aprovada pela nossa equipe.`,
        'O próximo passo é enviar seus documentos pelo portal. Você pode enviar aos poucos; a lista mostra o que falta.',
      ],
      cta: { texto: 'Enviar documentos', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
    }),
  }
}

/** 3b. Proposta devolvida pra ajuste na revisão interna → locatário. */
export function emailPropostaAjuste(p: PropostaEmail, motivo: string | null | undefined, linkPortal: string) {
  return {
    assunto: 'Revise os dados da sua proposta',
    html: emailImovit({
      badge: 'Ajuste necessário',
      titulo: 'Revise sua proposta',
      saudacaoNome: p.nome_cliente,
      paragrafosHtml: [
        `Nossa equipe pediu um ajuste nos dados da sua proposta${doImovel(p, 'para')}.`,
        'Acesse o portal para corrigir e reenviar.',
      ],
      destaque: motivo ? { rotulo: 'O que ajustar', itensHtml: [escapeHtml(motivo)] } : undefined,
      cta: { texto: 'Corrigir meus dados', url: linkPortal },
      assinatura: ASSINATURA_LOCATARIO,
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
