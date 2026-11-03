// Processo de Locação (RF33, PRD §5.20, Schema §2.20): regras puras, sem React.
// Mesma lógica da página HTML da Direção, que continua no ar até a ADM validar o guia (D7).

/** Os dois processos guardados em locacao_etapas.processo. */
export const PROCESSOS = {
  contrato: {
    nome: 'Processo de Contrato',
    desc: 'Do fechamento da negociação até a emissão do primeiro boleto.',
  },
  adm: {
    nome: 'Administração do Contrato',
    desc: 'Solicitações que chegam durante a vigência, cada uma com seu próprio fluxo.',
    nota: 'Entrada das solicitações: e-mail, WhatsApp ou telefone (menos usado). Cada tipo de solicitação segue o fluxo da sua fase abaixo.',
  },
}

/** Abas da página (a "Em andamento" fica escondida na v1, D5). */
export const ABAS = [
  { chave: 'contrato', label: 'Contrato' },
  { chave: 'adm', label: 'Administração' },
  { chave: 'equipe', label: 'Equipe e papéis' },
]

const porOrdem = (a, b) => Number(a.ordem) - Number(b.ordem)

/** Etapas de um processo, na ordem do desenho. */
export function etapasDe(etapas, processo) {
  return etapas.filter((e) => e.processo === processo).sort(porOrdem)
}

/**
 * Fases (campo `grupo`) na ordem da 1ª aparição, cada uma com TODAS as suas etapas
 * (igual à página da Direção, mesmo se uma fase aparecer em pontos separados da ordem).
 */
export function fasesDe(etapasOrdenadas) {
  const fases = new Map()
  for (const e of etapasOrdenadas) {
    if (!fases.has(e.grupo)) fases.set(e.grupo, { nome: e.grupo, etapas: [] })
    fases.get(e.grupo).etapas.push(e)
  }
  return [...fases.values()]
}

/** Papéis que aparecem em pelo menos uma etapa do processo, na ordem dos papéis. */
export function papeisUsados(papeis, etapasOrdenadas) {
  const ids = new Set(etapasOrdenadas.map((e) => e.papel))
  return papeis.filter((p) => ids.has(p.id)).sort(porOrdem)
}

export const ordenarPapeis = (papeis) => [...papeis].sort(porOrdem)

/** Cor de fallback quando a etapa não tem papel (mesma do padrão da tabela). */
export const COR_SEM_PAPEL = '#7a8a99'

/** Itens do checklist como texto (aceita string ou { texto }). */
export function itensChecklist(etapa) {
  return (Array.isArray(etapa?.checklist) ? etapa.checklist : [])
    .map((c) => (typeof c === 'string' ? c : c?.texto))
    .filter(Boolean)
}

/** Sugestões do campo Canal (o campo aceita texto livre). */
export const CANAIS = [
  'Sistema', 'E-mail', 'Telefone', 'WhatsApp', 'E-mail + WhatsApp',
  'Telefone, WhatsApp ou e-mail', 'Sistema + Telefone', 'Presencial', 'APP',
]

/**
 * `ordem` de uma etapa NOVA na fase `grupo`: logo depois da última etapa da fase.
 * Se houver uma etapa depois dela, usa o meio-termo (ex.: entre 20 e 30 → 25),
 * por isso `ordem` é numeric. Fase nova vai para o fim do processo.
 */
export function ordemNova(todas, grupo) {
  const daFase = todas.filter((e) => e.grupo === grupo)
  if (daFase.length === 0) return (todas.length ? Number(todas[todas.length - 1].ordem) : 0) + 10
  const ultima = daFase[daFase.length - 1]
  const proxima = todas[todas.indexOf(ultima) + 1]
  return proxima ? (Number(ultima.ordem) + Number(proxima.ordem)) / 2 : Number(ultima.ordem) + 10
}

/**
 * Subir (dir = -1) ou descer (dir = +1): troca a `ordem` com a vizinha.
 * Se a vizinha for de outra fase, a etapa muda para essa fase (igual à página da Direção).
 * Devolve as duas atualizações, ou null se não houver vizinha.
 */
export function trocaDeOrdem(todas, etapa, dir) {
  const i = todas.indexOf(etapa)
  const vizinha = todas[i + dir]
  if (i < 0 || !vizinha) return null
  return [
    { id: etapa.id, patch: vizinha.grupo !== etapa.grupo ? { ordem: vizinha.ordem, grupo: vizinha.grupo } : { ordem: vizinha.ordem } },
    { id: vizinha.id, patch: { ordem: etapa.ordem } },
  ]
}

/** Converte o formulário do editor em linha de locacao_etapas. */
export function etapaDoFormulario(f) {
  return {
    titulo: f.titulo.trim(),
    papel: f.papel || null,
    grupo: f.grupo.trim() || 'Sem fase',
    canal: f.canal.trim(),
    prazo: f.prazo === '' ? null : Number(f.prazo),
    detalhes: f.detalhes.trim(),
    checklist: f.checklist.split('\n').map((s) => s.trim()).filter(Boolean),
    decisao: f.decisao.trim(),
    melhoria: f.melhoria.trim(),
  }
}

/** Linha de locacao_etapas → valores do formulário (tudo string, como o input espera). */
export function formularioDaEtapa(e) {
  return {
    titulo: e?.titulo ?? '',
    papel: e?.papel ?? '',
    grupo: e?.grupo ?? '',
    canal: e?.canal ?? '',
    prazo: e?.prazo == null ? '' : String(e.prazo),
    detalhes: e?.detalhes ?? '',
    checklist: itensChecklist(e).join('\n'),
    decisao: e?.decisao ?? '',
    melhoria: e?.melhoria ?? '',
  }
}
