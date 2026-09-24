// Leitura da escala de plantão em PDF (docs/01-prd.md §5.3).
// O PDF mensal "PLANTAO VENDAS" é uma tabela DATA | DIA | MANHÃ | TARDE.
// Lemos as palavras com a posição de cada uma (pdf.js) e usamos as colunas do
// cabeçalho para separar manhã e tarde, porque nomes como "MARIA INES" têm
// espaço e não dá para cortar a linha só pelo texto.

const normalizar = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const RE_DATA = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/

async function carregarPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/** Palavras de todas as páginas, com x (esquerda), largura, y (linha) e página. */
async function extrairPalavras(arquivo) {
  const pdfjs = await carregarPdfJs()
  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer(), isEvalSupported: false }).promise
  const palavras = []
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const pagina = await pdf.getPage(n)
    const { items } = await pagina.getTextContent()
    for (const it of items) {
      const texto = it.str?.trim()
      if (!texto) continue
      palavras.push({ texto, x: it.transform[4], largura: it.width ?? 0, y: Math.round(it.transform[5]), pagina: n })
    }
  }
  return palavras
}

/**
 * Lê o PDF e devolve as linhas da escala: [{ data: 'AAAA-MM-DD', dia, manha, tarde }].
 * Lança erro com mensagem clara quando o arquivo não tem o formato esperado.
 */
export async function lerEscalaPdf(arquivo) {
  return montarEscala(await extrairPalavras(arquivo))
}

/** Monta as linhas da escala a partir das palavras posicionadas (função pura, testável sem navegador). */
export function montarEscala(palavras) {
  const cabecalho = (nome) => palavras.find((p) => normalizar(p.texto) === nome)
  const hManha = cabecalho('manha')
  const hTarde = cabecalho('tarde')
  const hDia = cabecalho('dia')
  if (!hManha || !hTarde) {
    throw new Error('Não achei as colunas MANHÃ e TARDE no PDF. Confira se é a escala no formato "PLANTAO VENDAS".')
  }
  const centro = (p) => p.x + p.largura / 2
  const limiteTarde = (centro(hManha) + centro(hTarde)) / 2
  const inicioNomes = hDia ? (centro(hDia) + centro(hManha)) / 2 : hManha.x - 40

  // agrupa por linha (mesma página, y parecido)
  const linhas = new Map()
  for (const p of palavras) {
    const chave = `${p.pagina}|${Math.round(p.y / 3)}`
    if (!linhas.has(chave)) linhas.set(chave, [])
    linhas.get(chave).push(p)
  }

  const escala = []
  for (const itens of linhas.values()) {
    const data = itens.find((p) => RE_DATA.test(p.texto))
    if (!data) continue
    const [, d, m, a] = data.texto.match(RE_DATA)
    const ano = a.length === 2 ? 2000 + Number(a) : Number(a)
    const iso = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const nomesDe = (filtro) =>
      itens
        .filter((p) => p !== data && centro(p) > inicioNomes && filtro(centro(p)))
        .sort((a1, b1) => a1.x - b1.x)
        .map((p) => p.texto)
        .join(' ')
        .trim()
    const dia = itens.find((p) => p !== data && centro(p) <= inicioNomes && !RE_DATA.test(p.texto))?.texto ?? ''
    escala.push({ data: iso, dia, manha: nomesDe((c) => c < limiteTarde), tarde: nomesDe((c) => c >= limiteTarde) })
  }

  escala.sort((a, b) => a.data.localeCompare(b.data))
  if (escala.length === 0) throw new Error('Não achei nenhuma data no formato dd/mm/aa no PDF.')
  return escala
}

// ---------------------------------------------------------------------------
// Casamento dos apelidos com os corretores
// ---------------------------------------------------------------------------

const CHAVE_APELIDOS = 'hub:plantao-apelidos'

export function lerApelidosSalvos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_APELIDOS) ?? '{}')
  } catch {
    return {}
  }
}

export function salvarApelidos(mapa) {
  try {
    localStorage.setItem(CHAVE_APELIDOS, JSON.stringify(mapa))
  } catch {
    // sem armazenamento local: só não lembra no mês seguinte
  }
}

/**
 * Casa um apelido do PDF ("BETTI", "MARIA INES") com um colaborador: todas as
 * palavras do apelido precisam existir no nome do cadastro. Um só candidato =
 * casado; nenhum ou vários = fica para a pessoa escolher.
 */
export function casarNome(apelido, colaboradores, apelidosSalvos = {}) {
  const chave = normalizar(apelido)
  if (!chave) return { id: null, candidatos: [] }
  const salvo = apelidosSalvos[chave]
  if (salvo && colaboradores.some((c) => String(c.id_corretor_crm) === String(salvo))) return { id: String(salvo), candidatos: [] }
  const tokens = chave.split(' ')
  const candidatos = colaboradores.filter((c) => {
    const nome = normalizar(c.nome_completo).split(' ')
    return tokens.every((t) => nome.includes(t))
  })
  if (candidatos.length === 1) return { id: String(candidatos[0].id_corretor_crm), candidatos }
  // desempate: o apelido é o primeiro nome de exatamente um candidato
  const pelaFrente = candidatos.filter((c) => normalizar(c.nome_completo).startsWith(chave))
  if (pelaFrente.length === 1) return { id: String(pelaFrente[0].id_corretor_crm), candidatos }
  return { id: null, candidatos }
}

export const chaveApelido = normalizar

/** Fim de semana pela data (sábado/domingo). */
export function ehFimDeSemana(iso) {
  const d = new Date(`${iso}T12:00:00`).getDay()
  return d === 0 || d === 6
}
