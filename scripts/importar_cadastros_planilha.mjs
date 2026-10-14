// =============================================================================
// Importa o histórico dos Google Forms de cadastro para a tabela `cadastros`
// (RF30.6, PRD §5.17). Uso:
//   1. Na planilha do Google: Arquivo → Download → CSV (um arquivo por aba).
//   2. node scripts/importar_cadastros_planilha.mjs <tipo> <arquivo.csv>
//      Ex.: node scripts/importar_cadastros_planilha.mjs locador-pf respostas.csv
//   3. Confere a contagem no final × linhas na lista /admin/cadastros.
//
// - Insere com origem = 'planilha' e email_ok = true (o e-mail já foi pelo
//   Google; nada é reenviado).
// - Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (as mesmas
//   do painel do Supabase; nunca commitar). Roda na máquina do Eduardo.
// - O MAPA_COLUNAS traduz o cabeçalho da planilha (1ª linha do CSV) para os
//   campos do Hub. Ajuste os nomes à esquerda se o seu CSV vier diferente.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const [tipo, arquivo] = process.argv.slice(2)
const TIPOS = ['locador-pf', 'locador-pj', 'locatario-pf', 'locatario-pj', 'fiador-pf', 'fiadora-pj']
if (!TIPOS.includes(tipo) || !arquivo) {
  console.error(`Uso: node scripts/importar_cadastros_planilha.mjs <${TIPOS.join('|')}> <arquivo.csv>`)
  process.exit(1)
}
const DESTINOS = {
  'locador-pf': 'administrativo3@imovit.com.br',
  'locador-pj': 'administrativo3@imovit.com.br',
  'locatario-pf': 'administrativo3@imovit.com.br', // confirmar com o Eduardo
  'locatario-pj': 'administrativo3@imovit.com.br', // confirmar com o Eduardo
  'fiador-pf': 'administrativo@imovit.com.br',
  'fiadora-pj': 'pamela@imovit.com.br',
}

// Cabeçalho do CSV (Google Forms, pt-BR) → campo do Hub. O destino é um dos
// 4 jsonbs (pessoa, acompanhante, financeiro, imovel) ou raiz (email).
// Linhas fora do mapa vão para pessoa.nota (não se perde nada).
const MAPA_COLUNAS = [
  [/^e-mail/i, 'email', null],
  [/^nome completo/i, 'nome', 'pessoa'],
  [/^razão social/i, 'razao_social', 'pessoa'],
  [/cnpj/i, 'cnpj', 'pessoa'],
  [/^cpf$/i, 'cpf', 'pessoa'],
  [/^rg$/i, 'rg', 'pessoa'],
  [/nascimento/i, 'nascimento', 'pessoa'],
  [/estado civil/i, 'estado_civil', 'pessoa'],
  [/nacionalidade/i, 'nacionalidade', 'pessoa'],
  [/profiss/i, 'profissao', 'pessoa'],
  [/celular/i, 'celular', 'pessoa'],
  [/^telefone/i, 'telefone', 'pessoa'],
  [/endereço/i, 'endereco', 'pessoa'],
  [/complemento/i, 'complemento', 'pessoa'],
  [/bairro/i, 'bairro', 'pessoa'],
  [/cidade/i, 'cidade', 'pessoa'],
  [/estado$/i, 'estado', 'pessoa'],
  [/^cep/i, 'cep', 'pessoa'],
  [/favorecido/i, 'favorecido', 'financeiro'],
  [/banco$/i, 'banco', 'financeiro'],
  [/agência/i, 'agencia', 'financeiro'],
  [/número da conta|numero da conta/i, 'numero_conta', 'financeiro'],
  [/tipo de conta|^conta$/i, 'tipo_conta', 'financeiro'],
  [/iptu/i, 'iptu', 'imovel'],
  [/cpfl/i, 'cpfl', 'imovel'],
  [/sanasa/i, 'sanasa', 'imovel'],
  [/gás/i, 'gas', 'imovel'],
  [/administradora/i, 'administradora', 'imovel'],
  [/carimbo|timestamp|data e hora/i, null, null], // ignora
]

function parseCsv(texto) {
  // O Google exporta com ; em conta pt-BR e , em conta en — detecta sozinho.
  const primeira = texto.split(/\r?\n/)[0] ?? ''
  const sep = (primeira.match(/;/g) ?? []).length > (primeira.match(/,/g) ?? []).length ? ';' : ','
  const linhas = []
  let campo = ''
  let linha = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((v) => v.trim())) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((v) => v.trim())) linhas.push(linha)
  return linhas
}

function mapear(cabecalho, valores) {
  const raiz = {}
  const grupos = { pessoa: {}, acompanhante: {}, financeiro: {}, imovel: {} }
  cabecalho.forEach((h, i) => {
    const v = (valores[i] ?? '').trim()
    if (!v) return
    const regra = MAPA_COLUNAS.find(([re]) => re.test(h.trim()))
    if (!regra) {
      grupos.pessoa[`extra_${h.trim().slice(0, 40)}`] = v // não perde nada
      return
    }
    const [, campo, grupo] = regra
    if (!campo) return // coluna ignorada (carimbo)
    if (grupo === null) raiz[campo] = v
    else grupos[grupo][campo] = v
  })
  return { ...raiz, ...grupos }
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}

const [cabecalho, ...dados] = parseCsv(readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, ''))
const supabase = createClient(url, serviceKey)
let ok = 0
const semEmail = []
for (const valores of dados) {
  const m = mapear(cabecalho, valores)
  if (!m.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) { semEmail.push(valores[0] ?? '(linha sem e-mail)'); continue }
  const linha = {
    tipo,
    email: m.email,
    pessoa: m.pessoa,
    acompanhante: Object.keys(m.acompanhante).length ? m.acompanhante : null,
    financeiro: Object.keys(m.financeiro).length ? m.financeiro : null,
    imovel: Object.keys(m.imovel).length ? m.imovel : null,
    destino: DESTINOS[tipo],
    origem: 'planilha',
    email_ok: true,
  }
  const { error } = await supabase.from('cadastros').insert(linha)
  if (error) {
    console.error('Falha numa linha:', error.message)
    continue
  }
  ok++
}
console.log(`Importado: ${ok} de ${dados.length} linhas (${tipo}).`)
if (semEmail.length) console.log(`Puladas sem e-mail válido (${semEmail.length}):`, semEmail.slice(0, 10))
console.log('Confira em /admin/cadastros com o filtro do tipo.')
