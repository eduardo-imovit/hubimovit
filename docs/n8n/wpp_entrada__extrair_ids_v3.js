// n8n · wpp_entrada · nó "extrair IDs e definir finalidade" — versão v3 (25/11, formato "COD <nº> <finalidade>")
// NÃO PUBLICADO. Cole este conteúdo inteiro no nó (modo "Run Once for Each Item"), só com OK do Eduardo.
//
// Formato da campanha (decisão do Eduardo, 25/11):  "COD 12345 locação"  /  "COD 12345 venda"
//   - A finalidade é a palavra logo depois do número (locação, locacao, aluguel, alugar, venda, compra).
//   - Se não vier logo depois, procura a palavra em qualquer lugar da mensagem (como a v2 fazia).
//   - Mudança em relação à v2: a v2 só aceitava "alugar/aluguel" como locação, então "COD 12345 locação"
//     caía em wpp_nao_identificado (midia_fonte = cod_sem_palavra).
// Saída nova: "campanha" = "COD <nº> locação" | "COD <nº> venda" (texto padronizado), só para campanha.
// O campo "midia" do Severino continua ignorado na decisão (fica só no log).

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

// ===== 3. COD DE CAMPANHA E FINALIDADE DA CAMPANHA =====
// Palavras aceitas. \b não funciona bem com "ç"/"ã" em JS, então a borda é feita com (?![a-zà-ú]).
const RE_LOC = /(loca[cç][aã]o|locar|alug(?:ar|uel))(?![a-zà-ú])/i;
const RE_VEN = /(venda|compra|comprar)(?![a-zà-ú])/i;

const matchCod = mensagem.match(/\bCOD\s*[:.#-]?\s*(\d{4,9})\b/i);
const codCampanha = matchCod ? matchCod[1] : null;

let finalidadeCampanha = null; // 'locacao' | 'venda' | null
if (codCampanha) {
  // 3a. palavra logo depois do número (até 3 caracteres de separação: espaço, hífen, ponto, "·")
  const depois = mensagem.slice(matchCod.index + matchCod[0].length).replace(/^[\s\-–·:.,]{0,3}/, '');
  if (/^(loca[cç][aã]o|locar|alug(?:ar|uel))(?![a-zà-ú])/i.test(depois)) finalidadeCampanha = 'locacao';
  else if (/^(venda|compra|comprar)(?![a-zà-ú])/i.test(depois)) finalidadeCampanha = 'venda';
  // 3b. senão, em qualquer lugar da mensagem, desde que só um dos lados apareça
  if (!finalidadeCampanha) {
    const loc = RE_LOC.test(mensagem), ven = RE_VEN.test(mensagem);
    if (loc && !ven) finalidadeCampanha = 'locacao';
    else if (ven && !loc) finalidadeCampanha = 'venda';
  }
}

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
} else if (finalidadeCampanha === 'locacao') {
  midia = MIDIAS.CAMP_LOCACAO;
  midiaFonte = 'cod_campanha';
} else if (finalidadeCampanha === 'venda') {
  midia = MIDIAS.CAMP_VENDA;
  midiaFonte = 'cod_campanha';
} else {
  midia = MIDIAS.DESCONHECIDO;
  midiaFonte = codCampanha ? 'cod_sem_palavra' : 'sem_cod';
}

// Texto da campanha que vai para o Imoview (campo "campanha" do /Lead/IncluirLead)
const campanha = midiaFonte === 'cod_campanha'
  ? `COD ${codCampanha} ${finalidadeCampanha === 'locacao' ? 'locação' : 'venda'}`
  : null;

// ===== 5. CÓDIGO DO IMÓVEL =====
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
const finalidadeSeverino = (payload.finalidade || '').toString().toLowerCase().trim();
const falaLocacao = /\b(alug\w*|loca[cç][aã]o|locar)/i.test(mensagem);
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
    campanha: campanha,
    midia_severino: midiaSeverino || null
  }
};
