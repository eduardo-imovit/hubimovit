// Busca do estoque (PRD §5.14, revisão de 16/10): a frase vira filtros por regras,
// sem IA, e a busca roda no navegador sobre a ficha comercial (`estoque_busca()`).
// Margens do "quase lá" (decisão B1, 08/10): preço e área 10%, 1 quarto/suíte/vaga,
// bairro vizinho a até 2 km, uma característica ausente.

import { fmtMoedaCurta } from './admLocacao'

export const MARGEM = { preco: 0.1, area: 0.1, unidade: 1 }

/** minúsculas, sem acento, espaços simples */
export const normalizar = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/** chave do Imoview → rótulo e jeitos de pedir (já normalizados) */
export const CARACTERISTICAS = {
  piscina: { label: 'Piscina', termos: ['piscina'] },
  churrasqueira: { label: 'Churrasqueira', termos: ['churrasqueira', 'churrasco'] },
  permiteanimais: { label: 'Aceita pet', termos: ['aceita pet', 'aceita animais', 'aceita animal', 'aceita cachorro', 'permite animais', 'permite pet', 'pet friendly', 'pet'] },
  mobiliado: { label: 'Mobiliado', termos: ['mobiliado', 'mobiliada', 'mobilia'] },
  portaria24horas: { label: 'Portaria 24h', termos: ['portaria 24 horas', 'portaria 24h', 'portaria 24', 'portaria'] },
  seguranca24horas: { label: 'Segurança 24h', termos: ['seguranca 24 horas', 'seguranca 24h', 'seguranca'] },
  varandagourmet: { label: 'Varanda gourmet', termos: ['varanda gourmet', 'sacada gourmet', 'varanda', 'sacada'] },
  espacogourmet: { label: 'Espaço gourmet', termos: ['espaco gourmet', 'area gourmet'] },
  academia: { label: 'Academia', termos: ['academia', 'fitness'] },
  arcondicionado: { label: 'Ar-condicionado', termos: ['ar condicionado', 'ar-condicionado', 'climatizado'] },
  closet: { label: 'Closet', termos: ['closet'] },
  escritorio: { label: 'Escritório', termos: ['escritorio', 'home office'] },
  lareira: { label: 'Lareira', termos: ['lareira'] },
  sauna: { label: 'Sauna', termos: ['sauna'] },
  salaofestas: { label: 'Salão de festas', termos: ['salao de festas', 'salao de festa'] },
  salaojogos: { label: 'Salão de jogos', termos: ['salao de jogos', 'sala de jogos'] },
  playground: { label: 'Playground', termos: ['playground', 'parquinho'] },
  quadraesportiva: { label: 'Quadra', termos: ['quadra poliesportiva', 'quadra esportiva', 'quadra'] },
  quadratenis: { label: 'Quadra de tênis', termos: ['quadra de tenis', 'tenis'] },
  beachtenis: { label: 'Beach tennis', termos: ['beach tennis', 'beach tenis'] },
  quintal: { label: 'Quintal', termos: ['quintal'] },
  jardim: { label: 'Jardim', termos: ['com jardim'] },
  gramado: { label: 'Gramado', termos: ['gramado'] },
  hidromassagem: { label: 'Hidromassagem', termos: ['hidromassagem', 'banheira', 'jacuzzi', 'spa'] },
  aquecedorsolar: { label: 'Aquecimento solar', termos: ['aquecimento solar', 'aquecedor solar'] },
  gascanalizado: { label: 'Gás encanado', termos: ['gas encanado', 'gas canalizado'] },
  lavabo: { label: 'Lavabo', termos: ['lavabo'] },
  despensa: { label: 'Despensa', termos: ['despensa'] },
  dce: { label: 'Dependência de empregada', termos: ['dependencia de empregada', 'dependencia de servico', 'quarto de empregada', 'dce'] },
  areaservico: { label: 'Área de serviço', termos: ['area de servico'] },
  lavanderia: { label: 'Lavanderia', termos: ['lavanderia'] },
  armariocozinha: { label: 'Armário na cozinha', termos: ['cozinha planejada', 'armario na cozinha', 'armarios na cozinha', 'planejados', 'planejado'] },
  armarioquarto: { label: 'Armário no quarto', termos: ['armario no quarto', 'armarios nos quartos'] },
  aguaindividual: { label: 'Água individual', termos: ['agua individual', 'hidrometro individual'] },
  aceitafinanciamento: { label: 'Aceita financiamento', termos: ['aceita financiamento', 'financiamento', 'financiavel'] },
  aceitapermuta: { label: 'Aceita permuta', termos: ['aceita permuta', 'permuta'] },
  naplanta: { label: 'Na planta', termos: ['na planta', 'lancamento'] },
  vistamontanha: { label: 'Vista para a montanha', termos: ['vista montanha', 'vista para a montanha', 'vista para montanha'] },
  vistalago: { label: 'Vista para o lago', termos: ['vista lago', 'vista para o lago'] },
  homecinema: { label: 'Home cinema', termos: ['home cinema', 'cinema'] },
  wifi: { label: 'Wi-Fi', termos: ['wifi', 'wi-fi', 'internet'] },
  alarme: { label: 'Alarme', termos: ['alarme'] },
  cercaeletrica: { label: 'Cerca elétrica', termos: ['cerca eletrica'] },
  circuitotv: { label: 'Câmeras (CFTV)', termos: ['cftv', 'cameras', 'circuito de tv'] },
  portaoeletronico: { label: 'Portão eletrônico', termos: ['portao eletronico', 'portao automatico'] },
  interfone: { label: 'Interfone', termos: ['interfone'] },
  solmanha: { label: 'Sol da manhã', termos: ['sol da manha', 'face norte'] },
  areaprivativa: { label: 'Área privativa', termos: ['area privativa'] },
  rouparia: { label: 'Rouparia', termos: ['rouparia'] },
  armariobanheiro: { label: 'Armário no banheiro', termos: ['armario no banheiro'] },
  box: { label: 'Box no banheiro', termos: ['box blindex', 'box de vidro'] },
  boxdespejo: { label: 'Depósito', termos: ['deposito', 'box despejo', 'hobby box'] },
  cabeamentoestruturado: { label: 'Cabeamento estruturado', termos: ['cabeamento estruturado'] },
  conexaointernet: { label: 'Ponto de internet', termos: ['ponto de internet'] },
  tvacabo: { label: 'TV a cabo', termos: ['tv a cabo'] },
  garageband: { label: 'Garage band', termos: ['garage band', 'estudio de musica'] },
  salamassagem: { label: 'Sala de massagem', termos: ['sala de massagem', 'massagem'] },
  quadrasquash: { label: 'Quadra de squash', termos: ['squash'] },
  vistamar: { label: 'Vista para o mar', termos: ['vista mar', 'vista para o mar'] },
  'extra:Energia Fotovoltaica': { label: 'Energia solar', termos: ['energia solar', 'fotovoltaica', 'placa solar', 'placas solares'] },
  'extra:Brinquedoteca': { label: 'Brinquedoteca', termos: ['brinquedoteca'] },
  'extra:Espaço pet': { label: 'Espaço pet', termos: ['espaco pet', 'pet place'] },
  'extra:Tomada para veículo Elétrico': { label: 'Tomada p/ carro elétrico', termos: ['carro eletrico', 'veiculo eletrico', 'carregador'] },
  'extra:Automação': { label: 'Automação', termos: ['automacao', 'casa inteligente'] },
  'extra:Espaço pilates': { label: 'Espaço pilates', termos: ['pilates'] },
  'extra:Sala de reunião': { label: 'Sala de reunião', termos: ['sala de reuniao', 'coworking'] },
  'extra:Chute a gol': { label: 'Chute a gol', termos: ['chute a gol'] },
}

/** termo → tipos do Imoview (o tipo pedido inclui as variações) */
const TIPOS = [
  [['casa em condominio', 'casa de condominio', 'casa condominio', 'casa em cond', 'condominio fechado'], ['Casa em Condomínio']],
  [['casa de rua', 'casa terrea de rua'], ['Casa de rua', 'Casa']],
  [['apartamento garden', 'garden'], ['Apartamento Garden']],
  [['apartamento duplex', 'duplex'], ['Apartamento Duplex']],
  [['cobertura'], ['Cobertura']],
  [['apartamento', 'apartamentos', 'apto', 'aptos', 'ap'], ['Apartamento', 'Apartamento Duplex', 'Apartamento Garden', 'Cobertura']],
  [['studio', 'loft', 'kitnet', 'kitinete'], ['Loft', 'Flat']],
  [['flat'], ['Flat']],
  [['terreno', 'terrenos', 'lote', 'lotes'], ['Terreno']],
  [['sala comercial', 'sala', 'salas', 'loja', 'lojas', 'galpao', 'barracao', 'comercial', 'ponto comercial', 'predio'], ['Comercial']],
  [['chacara', 'chacaras'], ['Chácara']],
  [['sitio', 'sitios'], ['Sítio']],
  [['fazenda'], ['Fazenda']],
  [['casa', 'casas', 'sobrado'], ['Casa', 'Casa de rua', 'Casa em Condomínio']],
]

const FINALIDADE = [
  [['para alugar', 'pra alugar', 'alugar', 'aluguel', 'locacao', 'locar', 'alugo', 'alugado'], 'Aluguel'],
  [['para comprar', 'pra comprar', 'comprar', 'compra', 'a venda', 'venda', 'vender'], 'Venda'],
]

const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }
const N = '(?<![a-z0-9])(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis)'
const UNIDADES = [
  ['quartos', `${N}\\s*(?:quartos?|qtos?|dormitorios?|dorms?|dormis?)`],
  ['suites', `${N}\\s*(?:suites?)`],
  ['vagas', `${N}\\s*(?:vagas?|garagens?|vagas de garagem)`],
  ['banheiros', `${N}\\s*(?:banheiros?|wcs?)`],
]

const VAZIAS = new Set(
  'a o as os de da do das dos e em no na nos nas com sem para pra por um uma uns umas que quero procuro busco preciso tem ter algo algum alguma imovel imoveis quarto quartos opcao opcoes perto proximo proxima regiao bairro cidade campinas de ate ou mais menos bem bom boa novo nova'.split(' ')
)

// ---------------------------------------------------------------------------
// Frase → filtros
// ---------------------------------------------------------------------------

export const FILTROS_VAZIOS = {
  finalidade: 'todas',
  tipos: [],
  bairros: [],
  vizinhos: false,
  precoMin: null,
  precoMax: null,
  quartos: null,
  suites: null,
  vagas: null,
  banheiros: null,
  area: null,
  caracteristicas: [],
  texto: '',
  todoEstoque: false,
  ordem: 'atualizados',
}

/** "1,5 mi" · "800 mil" · "800k" · "R$ 5.000" · "2 milhões" → reais */
function lerValor(numero, unidade) {
  let n = numero.replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g, '').replace(',', '.')
  else n = n.replace(',', '.')
  let v = Number(n)
  if (Number.isNaN(v)) return null
  const u = (unidade ?? '').trim()
  if (/^(mi|mil?h(ao|oes)|milhao|milhoes|mm)$/.test(u)) v *= 1_000_000
  else if (/^(mil|k)$/.test(u)) v *= 1000
  else if (v < 1000) return null // número solto pequeno não é preço
  return v
}

const VALOR = '(?:r\\$\\s*)?(\\d[\\d.,]*)\\s*(mi|milhao|milhoes|mil|k|mm)?\\b(?:\\s*reais)?'

/** tira de `texto` o trecho casado e devolve o resto (com espaço no lugar) */
const tirar = (texto, inicio, fim) => `${texto.slice(0, inicio)} ${texto.slice(fim)}`

function casaTermo(texto, termo) {
  const re = new RegExp(`(^|[^a-z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`)
  const m = re.exec(texto)
  return m ? { inicio: m.index + m[1].length, fim: m.index + m[0].length } : null
}

/** distância de edição (para tolerar erro de digitação no bairro) */
function levenshtein(a, b) {
  if (a === b) return 0
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = t
    }
  }
  return d[b.length]
}

// palavras que não identificam um bairro sozinhas ("Jardim", "Parque", "Campinas"…)
const GENERICOS = new Set(
  'jardim jardins vila parque residencial loteamento condominio chacara chacaras sitio sitios recreio bairro fazenda village ville estancia quinta reserva campinas alto nova novo santa santo sao dom bela vista grupo cidade conjunto'.split(' ')
)

/** bairros do estoque com uma palavra marcante igual (ou a 1 letra de distância) a `palavra` */
function bairrosPorPalavra(palavra, porTamanho) {
  if (GENERICOS.has(palavra) || VAZIAS.has(palavra)) return []
  const achados = []
  for (const [nb, b] of porTamanho) {
    const marcantes = nb.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERICOS.has(w))
    if (marcantes.some((w) => w === palavra || (palavra.length >= 5 && Math.abs(w.length - palavra.length) <= 1 && levenshtein(w, palavra) <= 1))) achados.push(b)
  }
  return achados.slice(0, 12)
}

/**
 * Lê a frase e devolve os filtros + o que foi reconhecido.
 * `bairros`: lista de nomes de bairro do estoque (de `estoque_bairros()`).
 */
export function interpretarFrase(frase, bairros = []) {
  const f = { ...FILTROS_VAZIOS, tipos: [], bairros: [], caracteristicas: [] }
  let t = ` ${normalizar(frase)} `

  // finalidade
  for (const [termos, fin] of FINALIDADE) {
    for (const termo of termos) {
      const m = casaTermo(t, termo)
      if (m) {
        f.finalidade = fin
        t = tirar(t, m.inicio, m.fim)
        break
      }
    }
    if (f.finalidade !== 'todas') break
  }

  // preço: "entre X e Y", "de X a Y", "até X", "a partir de X"
  const entre = new RegExp(`(?:entre|de)\\s+${VALOR}\\s+(?:e|a|ate)\\s+${VALOR}`).exec(t)
  if (entre) {
    const b = lerValor(entre[3], entre[4])
    // "entre 800 e 1,2 mi": o primeiro herda a unidade do segundo, ou vira "mil" se passar dele
    let a = lerValor(entre[1], entre[2] ?? entre[4])
    if (!entre[2] && a != null && b != null && a > b) a = lerValor(entre[1], 'mil')
    if (a != null && b != null) {
      f.precoMin = Math.min(a, b)
      f.precoMax = Math.max(a, b)
      t = tirar(t, entre.index, entre.index + entre[0].length)
    }
  }
  const ate = new RegExp(`(?:ate|no maximo|maximo|max|abaixo de|menos de|por ate)\\s+${VALOR}`).exec(t)
  if (ate) {
    const v = lerValor(ate[1], ate[2])
    if (v != null) {
      f.precoMax = v
      t = tirar(t, ate.index, ate.index + ate[0].length)
    }
  }
  const desde = new RegExp(`(?:a partir de|acima de|mais de|minimo de|no minimo|minimo)\\s+${VALOR}`).exec(t)
  if (desde) {
    const v = lerValor(desde[1], desde[2])
    if (v != null) {
      f.precoMin = v
      t = tirar(t, desde.index, desde.index + desde[0].length)
    }
  }

  // sem "alugar"/"comprar" na frase, o preço diz a finalidade: aluguel passa de R$ 100 mil só por engano
  if (f.finalidade === 'todas') {
    const preco = f.precoMax ?? f.precoMin
    if (preco >= 100_000) f.finalidade = 'Venda'
    else if (preco != null && preco <= 60_000) f.finalidade = 'Aluguel'
  }

  // área: "120 m²", "120m2", "120 metros"
  const area = /(\d+[.,]?\d*)\s*(?:m2|m²|mts?2?|metros quadrados|metros)(?=$|[^a-z0-9])/.exec(t)
  if (area) {
    f.area = Number(area[1].replace(',', '.'))
    t = tirar(t, area.index, area.index + area[0].length)
  }

  // quartos, suítes, vagas, banheiros (sempre mínimo)
  for (const [campo, padrao] of UNIDADES) {
    const m = new RegExp(`(?:pelo menos |no minimo |minimo )?${padrao}`).exec(t)
    if (m) {
      f[campo] = NUMEROS[m[1]] ?? Number(m[1])
      t = tirar(t, m.index, m.index + m[0].length)
    }
  }
  // "suíte" ou "vaga" sem número = pelo menos 1
  for (const [campo, termos] of [['suites', ['suites', 'suite']], ['vagas', ['vagas', 'vaga', 'garagem']]]) {
    if (f[campo] != null) continue
    for (const termo of termos) {
      const m = casaTermo(t, termo)
      if (m) {
        f[campo] = 1
        t = tirar(t, m.inicio, m.fim)
        break
      }
    }
  }

  // bairro (antes das características: "Jardim das Paineiras" não é "jardim")
  if (/\b(perto|proximo|proxima|regiao|arredores|vizinhan)/.test(t)) f.vizinhos = true
  const porTamanho = [...new Set(bairros)].map((b) => [normalizar(b), b]).sort((a, b) => b[0].length - a[0].length)
  for (const [nb, b] of porTamanho) {
    if (nb.length < 3) continue
    const m = casaTermo(t, nb)
    if (m) {
      if (!f.bairros.includes(b)) f.bairros.push(b)
      // "Sousas" leva junto os loteamentos "(Sousas)"; "Taquaral", o Parque Taquaral
      for (const [outro, b2] of porTamanho) if (outro !== nb && casaTermo(outro, nb) && !f.bairros.includes(b2)) f.bairros.push(b2)
      t = tirar(t, m.inicio, m.fim)
    }
  }
  // "no Gramado", "em Sousas": uma palavra marcante do nome basta (vem antes da característica "gramado")
  for (const m of [...t.matchAll(/(?:^|[^a-z0-9])(?:no|na|em|do|da|de|perto do|perto da)\s+([a-z]{5,})(?=$|[^a-z0-9])/g)]) {
    const achados = bairrosPorPalavra(m[1], porTamanho)
    if (!achados.length) continue
    for (const b of achados) if (!f.bairros.includes(b)) f.bairros.push(b)
    t = t.replace(new RegExp(`(^|[^a-z0-9])${m[1]}(?=$|[^a-z0-9])`), '$1 ')
  }

  // características (termos mais longos primeiro)
  const termosCar = Object.entries(CARACTERISTICAS)
    .flatMap(([chave, c]) => c.termos.map((termo) => [termo, chave]))
    .sort((a, b) => b[0].length - a[0].length)
  for (const [termo, chave] of termosCar) {
    const m = casaTermo(t, termo)
    if (m) {
      if (!f.caracteristicas.includes(chave)) f.caracteristicas.push(chave)
      t = tirar(t, m.inicio, m.fim)
    }
  }

  // tipo (depois das características: "sala de jogos" não é sala comercial)
  for (const [termos, tipos] of TIPOS) {
    for (const termo of termos) {
      const m = casaTermo(t, termo)
      if (m) {
        for (const tp of tipos) if (!f.tipos.includes(tp)) f.tipos.push(tp)
        t = tirar(t, m.inicio, m.fim)
        break
      }
    }
  }

  // sobras: bairro com erro de digitação (1 a 4 palavras), senão vira texto livre
  let palavras = t.split(/[^a-z0-9]+/).filter((p) => p && !VAZIAS.has(p))
  if (palavras.length && porTamanho.length) {
    for (let tam = Math.min(4, palavras.length); tam >= 1; tam--) {
      for (let i = 0; i + tam <= palavras.length; i++) {
        const trecho = palavras.slice(i, i + tam).join(' ')
        if (trecho.length < 5) continue
        const limite = trecho.length >= 9 ? 2 : 1
        let melhor = null
        for (const [nb, b] of porTamanho) {
          if (Math.abs(nb.length - trecho.length) > limite) continue
          const d = levenshtein(trecho, nb)
          if (d <= limite && (!melhor || d < melhor.d)) melhor = { b, d }
        }
        if (melhor && !f.bairros.includes(melhor.b)) {
          f.bairros.push(melhor.b)
          palavras = [...palavras.slice(0, i), ...palavras.slice(i + tam)]
          i = -1
        }
      }
    }
    // por fim, uma palavra marcante do nome ("taquaral" → Taquaral, Parque Taquaral…)
    palavras = palavras.filter((p) => {
      if (p.length < 5) return true
      const achados = bairrosPorPalavra(p, porTamanho)
      for (const b of achados) if (!f.bairros.includes(b)) f.bairros.push(b)
      return !achados.length
    })
  }
  f.texto = palavras.filter((p) => p.length >= 3 && !/^\d+$/.test(p)).join(' ')
  return f
}

// ---------------------------------------------------------------------------
// Filtros → resultado (exatos, quase lá, o que mais restringe)
// ---------------------------------------------------------------------------

export const DISPONIVEIS = ['Vago/Disponível', 'Em desocupação']

/** "Sousas, Jardim Botânico (Sousas) +3" */
const resumoLista = (l) => (l.length > 2 ? `${l.slice(0, 2).join(', ')} +${l.length - 2}` : l.join(', '))
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const moeda = (v, i) => `${fmtMoedaCurta(v)}${i.finalidade === 'Aluguel' ? '/mês' : ''}`

/**
 * Cada critério ativo devolve, para um imóvel: true (atende), um texto (falha
 * dentro da margem: vira "quase lá" com esse motivo) ou false (fora).
 */
function criterios(f, vizinhosDe) {
  const lista = []
  if (f.finalidade !== 'todas') lista.push({ id: 'finalidade', rotulo: f.finalidade === 'Venda' ? 'venda' : 'locação', teste: (i) => i.finalidade === f.finalidade })
  if (!f.todoEstoque) lista.push({ id: 'situacao', rotulo: 'só disponíveis', teste: (i) => DISPONIVEIS.includes(i.situacao) })
  if (f.tipos.length) lista.push({ id: 'tipos', rotulo: resumoLista(f.tipos), teste: (i) => f.tipos.includes(i.tipo) })
  if (f.bairros.length) {
    const pedidos = new Set(f.bairros)
    const perto = new Map()
    for (const b of f.bairros) for (const v of vizinhosDe(b)) if (!pedidos.has(v) && !perto.has(v)) perto.set(v, b)
    lista.push({
      id: 'bairros',
      rotulo: resumoLista(f.bairros),
      teste: (i) => {
        if (pedidos.has(i.bairro)) return true
        if (perto.has(i.bairro)) return f.vizinhos ? true : `em ${i.bairro}, a até 2 km de ${perto.get(i.bairro)}`
        return false
      },
    })
  }
  if (f.precoMax != null) {
    lista.push({
      id: 'precoMax',
      rotulo: `até ${fmtMoedaCurta(f.precoMax)}`,
      teste: (i) => {
        const v = Number(i.valor)
        if (!(v > 0)) return false
        if (v <= f.precoMax) return true
        return v <= f.precoMax * (1 + MARGEM.preco) ? `${moeda(v, i)}, ${Math.round(((v - f.precoMax) / f.precoMax) * 100)}% acima do teto` : false
      },
    })
  }
  if (f.precoMin != null) {
    lista.push({
      id: 'precoMin',
      rotulo: `a partir de ${fmtMoedaCurta(f.precoMin)}`,
      teste: (i) => {
        const v = Number(i.valor)
        if (!(v > 0)) return false
        if (v >= f.precoMin) return true
        return v >= f.precoMin * (1 - MARGEM.preco) ? `${moeda(v, i)}, ${Math.round(((f.precoMin - v) / f.precoMin) * 100)}% abaixo do piso` : false
      },
    })
  }
  for (const [campo, um, varios] of [
    ['quartos', 'quarto', 'quartos'],
    ['suites', 'suíte', 'suítes'],
    ['vagas', 'vaga', 'vagas'],
    ['banheiros', 'banheiro', 'banheiros'],
  ]) {
    if (f[campo] == null) continue
    lista.push({
      id: campo,
      rotulo: `${f[campo]}+ ${f[campo] === 1 ? um : varios}`,
      teste: (i) => {
        const n = Number(i[campo]) || 0
        if (n >= f[campo]) return true
        return f[campo] - n <= MARGEM.unidade ? `${plural(n, um, varios)} (1 a menos)` : false
      },
    })
  }
  if (f.area != null) {
    lista.push({
      id: 'area',
      rotulo: `${f.area}+ m²`,
      teste: (i) => {
        const a = Number(i.area_principal) || 0
        if (a >= f.area) return true
        return a >= f.area * (1 - MARGEM.area) && a > 0 ? `${Math.round(a)} m², ${Math.round(((f.area - a) / f.area) * 100)}% menor` : false
      },
    })
  }
  for (const c of f.caracteristicas) {
    const label = CARACTERISTICAS[c]?.label ?? c
    lista.push({ id: `car:${c}`, rotulo: label, teste: (i) => (i.caracteristicas ?? []).includes(c) || `sem ${label.toLowerCase()}` })
  }
  if (f.texto) {
    const palavras = normalizar(f.texto).split(' ').filter(Boolean)
    lista.push({
      id: 'texto',
      rotulo: `"${f.texto}"`,
      teste: (i) => {
        const alvo = normalizar([i.titulo, i.condominio, i.logradouro, i.bairro, i.cidade, i.tipo, i.codigo].join(' '))
        return palavras.every((p) => alvo.includes(p))
      },
    })
  }
  return lista
}


// ---------------------------------------------------------------------------
// Ordenação: não é critério, só a ordem dos cartões (vale para "atende a tudo" e "quase lá")
// ---------------------------------------------------------------------------

const positivo = (v) => (Number(v) > 0 ? Number(v) : null)
const precoM2 = (i) => (positivo(i.valor) && positivo(i.area_principal) ? i.valor / i.area_principal : null)
const cadastro = (i) => (i.cadastrado_em ? Date.parse(i.cadastrado_em) : null)

function atualizados(a, b) {
  return (a.desatualizado === true) - (b.desatualizado === true) || (a.dias_sem_atualizar ?? 9999) - (b.dias_sem_atualizar ?? 9999) || a.codigo - b.codigo
}

// sem o dado (preço sob consulta, sem área…) vai para o fim, nos dois sentidos
const por = (valor, sentido) => (a, b) => {
  const va = valor(a)
  const vb = valor(b)
  if (va == null || vb == null) return (va == null) - (vb == null) || atualizados(a, b)
  return (va - vb) * sentido || atualizados(a, b)
}

export const ORDENACOES = {
  atualizados: { rotulo: 'Atualizados há menos tempo', comparar: atualizados },
  menorPreco: { rotulo: 'Menor preço', comparar: por((i) => positivo(i.valor), 1) },
  maiorPreco: { rotulo: 'Maior preço', comparar: por((i) => positivo(i.valor), -1) },
  maiorArea: { rotulo: 'Maior área', comparar: por((i) => positivo(i.area_principal) ?? positivo(i.area_lote), -1) },
  menorPrecoM2: { rotulo: 'Menor preço por m²', comparar: por(precoM2, 1) },
  recentes: { rotulo: 'Cadastrados mais recentemente', comparar: por(cadastro, -1) },
}

const ordenar = (ordem) => (ORDENACOES[ordem] ?? ORDENACOES.atualizados).comparar

/**
 * Busca: `imoveis` = ficha de `estoque_busca()`, `bairros` = `estoque_bairros()`.
 * Devolve { exatos, quaseLa: [{ imovel, motivo }], restricao, criterios }.
 */
export function buscar(imoveis, f, bairros = []) {
  const vizinhos = new Map(bairros.map((b) => [b.bairro, b.vizinhos ?? []]))
  const lista = criterios(f, (b) => vizinhos.get(b) ?? [])
  const exatos = []
  const quaseLa = []
  const falhas = new Map(lista.map((c) => [c.id, 0])) // quantos entram ao tirar só esse critério
  for (const i of imoveis) {
    let falhou = null
    let motivo = null
    let fora = 0
    for (const c of lista) {
      const r = c.teste(i)
      if (r === true) continue
      fora++
      falhou = c
      motivo = typeof r === 'string' ? r : null
      if (fora > 1) break
    }
    if (fora === 0) exatos.push(i)
    else if (fora === 1) {
      falhas.set(falhou.id, falhas.get(falhou.id) + 1)
      if (motivo) quaseLa.push({ imovel: i, motivo, criterio: falhou.id })
    }
  }
  const comparar = ordenar(f.ordem)
  exatos.sort(comparar)
  quaseLa.sort((a, b) => comparar(a.imovel, b.imovel))

  // o que mais restringe: o critério cuja retirada traz mais imóveis (só quando há poucos exatos)
  let restricao = null
  if (exatos.length < 5 && lista.length > 1) {
    const [id, n] = [...falhas.entries()].filter(([k]) => k !== 'situacao').sort((a, b) => b[1] - a[1])[0] ?? []
    if (n > 0) restricao = { id, rotulo: lista.find((c) => c.id === id).rotulo, n: exatos.length + n }
  }
  return { exatos, quaseLa, restricao, criterios: lista.map(({ id, rotulo }) => ({ id, rotulo })) }
}

/** remove um critério dos filtros (chip "x" e "tirar o que mais restringe") */
export function semCriterio(f, id) {
  if (id.startsWith('car:')) return { ...f, caracteristicas: f.caracteristicas.filter((c) => `car:${c}` !== id) }
  const vazio = { finalidade: 'todas', tipos: [], bairros: [], texto: '' }
  if (id === 'situacao') return { ...f, todoEstoque: true }
  if (id in vazio) return { ...f, [id]: vazio[id] }
  return { ...f, [id]: null }
}

// ---------------------------------------------------------------------------
// URL: os filtros viram parâmetros curtos para mandar a busca a alguém
// ---------------------------------------------------------------------------

const LISTAS = ['tipos', 'bairros', 'caracteristicas']
const NUMERICOS = ['precoMin', 'precoMax', 'quartos', 'suites', 'vagas', 'banheiros', 'area']

export function filtrosParaUrl(f, frase) {
  const p = new URLSearchParams()
  if (frase) p.set('q', frase)
  if (f.finalidade !== 'todas') p.set('finalidade', f.finalidade)
  for (const k of LISTAS) if (f[k].length) p.set(k, f[k].join('|'))
  for (const k of NUMERICOS) if (f[k] != null) p.set(k, String(f[k]))
  if (f.texto) p.set('texto', f.texto)
  if (f.vizinhos) p.set('vizinhos', '1')
  if (f.todoEstoque) p.set('todo', '1')
  if (f.ordem && f.ordem !== 'atualizados') p.set('ordem', f.ordem)
  return p
}

export function filtrosDaUrl(p) {
  const f = { ...FILTROS_VAZIOS, tipos: [], bairros: [], caracteristicas: [] }
  const fin = p.get('finalidade')
  if (fin === 'Venda' || fin === 'Aluguel') f.finalidade = fin
  for (const k of LISTAS) if (p.get(k)) f[k] = p.get(k).split('|').filter(Boolean)
  for (const k of NUMERICOS) {
    const v = Number(p.get(k))
    if (p.get(k) != null && !Number.isNaN(v)) f[k] = v
  }
  f.texto = p.get('texto') ?? ''
  f.vizinhos = p.get('vizinhos') === '1'
  f.todoEstoque = p.get('todo') === '1'
  f.ordem = p.get('ordem') in ORDENACOES ? p.get('ordem') : 'atualizados'
  return { filtros: f, frase: p.get('q') ?? '' }
}
