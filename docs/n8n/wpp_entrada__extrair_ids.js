// n8n · fluxo wpp_entrada · nó "extrair IDs e definir finalidade"
// Versão 2026-11-23 (regra do COD). Cole este conteúdo inteiro no nó (modo "Run Once for Each Item").
//
// Regra (PRD §5.23, pendência 5):
//   - "Atendimento: XXXXXX" (código do GTM do site)  → site (wpp_pag_imovel / wpp_site_geral)
//   - "COD <nº>" + alugar/aluguel                     → campanha_locacao
//   - "COD <nº>" + venda/compra                       → campanha_venda
//   - qualquer outro caso                             → wpp_nao_identificado
// O campo "midia" que o Severino manda é IGNORADO na decisão (fica só no log como midia_severino),
// porque o bot é do prestador e não controlamos o que ele envia.
// "locação/locar" ajudam a definir a FINALIDADE, mas não tornam o lead campanha.

// ===== 1. DESCASCAR O PAYLOAD =====
let payload = $input.item.json;
while (Array.isArray(payload)) payload = payload[0];
while (payload.body) {
  payload = payload.body;
  if (Array.isArray(payload)) payload = payload[0];
}

const mensagem = (payload.mensagem_completa || '').toString().trim();
const midiaSeverino = (payload.midia || '').toString().toLowerCase().trim();

// ===== 2. CÓDIGO DE ATENDIMENTO DO SITE (GTM) =====
const matchAtend = mensagem.match(/Atendimento[:\s]+([A-Z0-9]{4,10})/);
const codigoAtendimento = matchAtend ? matchAtend[1] : null;

// ===== 3. COD DE CAMPANHA E PALAVRA DA CAMPANHA =====
// \b = borda de palavra; \s* = espaços opcionais; (\d{4,9}) = 4 a 9 dígitos (tamanho real dos códigos)
const matchCod = mensagem.match(/\bCOD\s*(\d{4,9})\b/i);
const codCampanha = matchCod ? matchCod[1] : null;
const palavraLocacao = /\balug(ar|uel)\b/i.test(mensagem);
const palavraVenda = /\b(venda|compra)\b/i.test(mensagem);

// ===== 4. MÍDIA =====
const MIDIAS = {
  SITE_GERAL:   'wpp_site_geral',
  SITE_IMOVEL:  'wpp_pag_imovel',
  CAMP_VENDA:   'campanha_venda',
  CAMP_LOCACAO: 'campanha_locacao',
  DESCONHECIDO: 'wpp_nao_identificado'
};

let midia;
let midiaFonte;

if (codigoAtendimento) {
  const temImovel = /C[oó]d[\.\s]*d[oe]\s*Im[oó]vel/i.test(mensagem)
                 || /imovit\.com\.br\/imovel\//i.test(mensagem);
  midia = temImovel ? MIDIAS.SITE_IMOVEL : MIDIAS.SITE_GERAL;
  midiaFonte = 'site_gtm';
} else if (codCampanha && palavraLocacao && !palavraVenda) {
  midia = MIDIAS.CAMP_LOCACAO;
  midiaFonte = 'cod_campanha';
} else if (codCampanha && palavraVenda && !palavraLocacao) {
  midia = MIDIAS.CAMP_VENDA;
  midiaFonte = 'cod_campanha';
} else {
  midia = MIDIAS.DESCONHECIDO;
  midiaFonte = codCampanha ? 'cod_sem_palavra' : 'sem_cod';
}

// ===== 5. CÓDIGO DO IMÓVEL =====
// Campanha: o próprio COD. Senão, os padrões de antes.
let codigoImovel = codCampanha;
if (!codigoImovel) {
  const patterns = [
    /Cod[\.\s]+(\d{4,})/i,
    /[Cc]ódigo[\s:]+(\d{4,})/i,
    /[Cc]ódigo de imóvel[\s:]+(\d{4,})/i,
    /[Ii]móvel[\s:]+(\d{4,})/i,
    /ID[\s:]+(\d{4,})/i,
    /ref[\.\s]+(\d{4,})/i,
  ];
  for (const pattern of patterns) {
    const m = mensagem.match(pattern);
    if (m && m[1]) { codigoImovel = m[1]; break; }
  }
}

// ===== 6. FINALIDADE (1 = locação, 2 = venda, 3 = ambas) =====
// Ordem: palavra da campanha → campo do Severino → palavras soltas → padrão locação.
const finalidadeSeverino = (payload.finalidade || '').toString().toLowerCase().trim();
const falaLocacao = /\b(alug\w*|loca[cç][aã]o|locar)\b/i.test(mensagem);
const falaVenda = /\b(vend\w*|compr\w*)\b/i.test(mensagem);

let finalidade = 1;
if (midia === MIDIAS.CAMP_LOCACAO) {
  finalidade = 1;
} else if (midia === MIDIAS.CAMP_VENDA) {
  finalidade = 2;
} else if (finalidadeSeverino === '3' || (finalidadeSeverino.includes('venda') && finalidadeSeverino.includes('loca'))) {
  finalidade = 3;
} else if (['2', 'venda', 'compra'].includes(finalidadeSeverino)) {
  finalidade = 2;
} else if (['1', 'locacao', 'locação', 'aluguel'].includes(finalidadeSeverino)) {
  finalidade = 1;
} else if (falaLocacao && falaVenda) {
  finalidade = 3;
} else if (falaVenda) {
  finalidade = 2;
}

// ===== 7. TELEFONE =====
const formatPhone = (phone) => {
  if (!phone) return null;
  let n = phone.toString().replace(/\D/g, '');
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) n = n.slice(2);
  if (n.length < 10) return phone;
  const ddd = n.slice(0, 2);
  const numero = n.slice(2);
  if (numero.length === 9) return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
};

return {
  json: {
    codigo_imovel: codigoImovel,
    codigo_atendimento: codigoAtendimento,
    finalidade: finalidade,
    telefone: formatPhone(payload.whatsapp),
    mensagem_testada: mensagem,
    nome: payload.nome,
    midia: midia,
    midia_fonte: midiaFonte,
    midia_severino: midiaSeverino || null
  }
};
