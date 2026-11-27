// =============================================================================
// Cliente Imoview com o login de integração (Fase 30, 27/11).
//
// Por que existe: desde 24-25/11 Contratos e Financeiro exigem os cabeçalhos
// `codigousuario` + `codigoacesso` do POST /Usuario/Integracao_ValidarAcesso (usuário 111).
// A sessão é UMA por usuário: um login novo derruba a anterior. O n8n (carteira 6h30,
// wpp_entrada, etc.) usa o mesmo usuário, então esta Edge NÃO decide sozinha quando logar:
// pergunta à tabela imoview_sessao pelas RPCs (Schema §2.24), igual ao sub-fluxo
// "Imoview: obter sessão" (doc imoview-auth-arquitetura §4.3 e §8).
//
//   obter → 'usar'    usa a sessão guardada
//         → 'esperar' outro está logando: espera e pergunta de novo
//         → 'login'   pegou a trava: faz o login → gravar (ou liberar, se o login falhar)
//   401 + sessaoinvalida → obter com p_forcar + p_recusado (relogin 1× por requisição)
//
// Regra de erro (§4.4): 200 ok · 404 vazio · 429 espera `segundosparaliberar` (teto 60 s, 3×)
// · 5xx/rede 2× (5 s, 20 s) · resto = erro com a mensagem do Imoview.
// Nunca põe chave, senha nem codigoacesso em log ou mensagem de erro.
//
// Sem dependência do Deno: recebe fetch/rpc/esperar por injeção (testado com node + mocks).
// =============================================================================

export type Rpc = (funcao: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>

export type Dependencias = {
  chave: string
  email: string
  senha: string
  rpc: Rpc
  fetch?: typeof fetch
  esperar?: (ms: number) => Promise<void>
  log?: (msg: string) => void
  /** Limite de tempo total (ms desde a criação). A Edge morre em 150 s; paramos antes, com erro claro. */
  prazoMs?: number
  base?: string
}

type Sessao = { codigousuario: number; codigoacesso: string; desde: number }

export class ImoviewErro extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ImoviewErro'
    this.status = status
  }
}

const PERFIL = 'integracao'
const OCIOSO_SEG = 480 // a API expira com 10 min sem uso; a RPC reaproveita até 8 min
const RECONFIRMAR_MS = 60_000 // pergunta de novo à RPC a cada 1 min (mantém usado_em e pega renovação do n8n)

export function criarClienteImoview(d: Dependencias) {
  const fetcher = d.fetch ?? fetch
  const esperar = d.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const log = d.log ?? ((m: string) => console.log(m))
  const base = d.base ?? 'https://api.imoview.com.br'
  const prazo = Date.now() + (d.prazoMs ?? 120_000)
  const stats = { logins: 0, reaproveitadas: 0, esperas: 0, relogins: 0, n429: 0, n5xx: 0, requisicoes: 0 }

  let sessao: Sessao | null = null
  // Uma só obtenção por vez dentro desta execução: 6 páginas em paralelo que levam 401
  // juntas pedem UM relogin, não seis.
  let obtendo: Promise<Sessao> | null = null

  async function pausar(ms: number, motivo: string) {
    if (Date.now() + ms > prazo) {
      throw new ImoviewErro(`Imoview: sem tempo para esperar ${Math.round(ms / 1000)} s (${motivo}). Nada foi gravado.`)
    }
    await esperar(ms)
  }

  async function login(): Promise<{ codigousuario: number; codigoacesso: string }> {
    let status = 0
    let corpo: Record<string, unknown> = {}
    try {
      const resp = await fetcher(`${base}/Usuario/Integracao_ValidarAcesso`, {
        method: 'POST',
        headers: { chave: d.chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: d.email, senha: d.senha }),
        signal: AbortSignal.timeout(20_000),
      })
      status = resp.status
      corpo = lerJson(await resp.text())
    } catch (e) {
      throw new ImoviewErro(`Imoview: login de integração sem resposta (${(e as Error).message}).`)
    }
    if (status === 200 && corpo.codigoacesso && corpo.codigousuario) {
      stats.logins++
      return { codigousuario: Number(corpo.codigousuario), codigoacesso: String(corpo.codigoacesso) }
    }
    const dica = corpo.senhafraca ? ' (senha fraca: o Imoview pediu troca por e-mail)' : corpo.chavesemassunto ? ' (chave sem o assunto)' : ''
    throw new ImoviewErro(
      `Imoview: login de integração recusado. HTTP ${status}: ${mensagem(corpo) || 'sem mensagem'}${dica}. Conferir as secrets IMOVIEW_CHAVE / IMOVIEW_EMAIL / IMOVIEW_SENHA.`,
      status,
    )
  }

  async function obterDaRpc(forcar: boolean, recusado: string | null): Promise<Sessao> {
    for (let volta = 1; volta <= 15; volta++) {
      const r = await d.rpc('imoview_sessao_obter', { p_perfil: PERFIL, p_forcar: forcar, p_recusado: recusado, p_ocioso_seg: OCIOSO_SEG })
      if (r.acao === 'usar') {
        stats.reaproveitadas++
        return { codigousuario: Number(r.codigousuario), codigoacesso: String(r.codigoacesso), desde: Date.now() }
      }
      if (r.acao === 'esperar') {
        stats.esperas++
        const seg = Math.min(Math.max(Number(r.segundos) || 2, 1), 5)
        await pausar(seg * 1000, 'outro chamador está fazendo login')
        continue
      }
      if (r.acao === 'login') {
        const dono = String(r.dono)
        let nova
        try {
          nova = await login()
        } catch (e) {
          // solta a trava para o próximo (n8n ou a Edge de amanhã) não esperar 30 s à toa
          await d.rpc('imoview_sessao_liberar', { p_perfil: PERFIL, p_dono: dono }).catch(() => {})
          throw e
        }
        const g = await d.rpc('imoview_sessao_gravar', {
          p_perfil: PERFIL, p_dono: dono, p_codigousuario: nova.codigousuario, p_codigoacesso: nova.codigoacesso,
        })
        if (g.gravado !== true) {
          throw new ImoviewErro('Imoview: login feito, mas a trava expirou antes de gravar (login > 30 s?). Rodar de novo.')
        }
        log(`[imoview] login de integração feito (usuário ${nova.codigousuario})`)
        return { ...nova, desde: Date.now() }
      }
      throw new ImoviewErro(`Imoview: resposta inesperada de imoview_sessao_obter: ${JSON.stringify(r).slice(0, 120)}`)
    }
    throw new ImoviewErro('Imoview: esperei 15× pela trava de login (outro chamador preso?). Nada foi gravado.')
  }

  /** Sessão atual; com `recusado`, pede renovação (só se ninguém já renovou). */
  async function obterSessao(recusado: string | null = null): Promise<Sessao> {
    if (!recusado && sessao && Date.now() - sessao.desde < RECONFIRMAR_MS) return sessao
    if (recusado && sessao && sessao.codigoacesso !== recusado) return sessao // outra página já renovou
    if (!obtendo) {
      obtendo = obterDaRpc(recusado !== null, recusado)
        .then((s) => (sessao = s))
        .finally(() => (obtendo = null))
    }
    return await obtendo
  }

  /** GET com a regra do §4.4. Devolve o corpo (200) ou null (404 = vazio). */
  async function get(caminho: string, params: Record<string, string>, rotulo: string): Promise<Record<string, unknown> | null> {
    const url = new URL(`${base}/${caminho}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    let relogou = false
    let n429 = 0
    let n5xx = 0
    for (let tentativa = 1; tentativa <= 8; tentativa++) {
      const s = await obterSessao()
      let status = 0
      let texto = ''
      let retryAfter = ''
      let erroRede = ''
      try {
        stats.requisicoes++
        const resp = await fetcher(url, {
          headers: { chave: d.chave, codigousuario: String(s.codigousuario), codigoacesso: s.codigoacesso },
          signal: AbortSignal.timeout(30_000),
        })
        status = resp.status
        retryAfter = resp.headers.get('retry-after') ?? ''
        texto = await resp.text()
      } catch (e) {
        erroRede = (e as Error).message
      }
      const corpo = lerJson(texto)
      const onde = `Imoview ${caminho} (${rotulo})`

      if (status >= 200 && status < 300) {
        if (!ehJson(texto)) throw new ImoviewErro(`${onde}: HTTP ${status} com corpo que não é JSON.`, status)
        return corpo
      }
      if (status === 404) return null
      if (status === 401) {
        if (corpo.sessaoinvalida === true && !relogou) {
          relogou = true
          stats.relogins++
          log(`[imoview] ${onde}: sessão recusada, pedindo relogin`)
          await obterSessao(s.codigoacesso)
          continue
        }
        const tipo = corpo.chavesemassunto ? 'a chave não tem o assunto deste endpoint'
          : corpo.atualizarapp ? 'endpoint de aplicativo (App_) recusado'
          : corpo.sessaoinvalida ? 'sessão recusada mesmo depois de novo login'
          : 'chave recusada'
        throw new ImoviewErro(`${onde}: HTTP 401, ${tipo}. ${mensagem(corpo)}`, 401)
      }
      if (status === 429 && n429 < 3) {
        n429++
        stats.n429++
        const seg = Number(corpo.segundosparaliberar) || Number(retryAfter) || 10
        if (seg > 60) throw new ImoviewErro(`${onde}: HTTP 429, só libera em ${seg} s. ${mensagem(corpo)}`, 429)
        log(`[imoview] ${onde}: 429, esperando ${seg} s`)
        await pausar(seg * 1000, '429')
        continue
      }
      if ((status === 0 || status >= 500) && n5xx < 2) {
        n5xx++
        stats.n5xx++
        const ms = n5xx === 1 ? 5_000 : 20_000
        log(`[imoview] ${onde}: ${status || 'sem resposta'}${erroRede ? ` (${erroRede})` : ''}, nova tentativa em ${ms / 1000} s`)
        await pausar(ms, `HTTP ${status || 'sem resposta'}`)
        continue
      }
      throw new ImoviewErro(`${onde}: HTTP ${status || 'sem resposta'}. ${mensagem(corpo) || erroRede || 'sem mensagem'}`, status)
    }
    throw new ImoviewErro(`Imoview ${caminho} (${rotulo}): desisti depois de 8 tentativas.`)
  }

  /**
   * Lê todas as páginas: a 1ª diz a `quantidade`; as outras vão de `emParalelo` em `emParalelo`.
   * `numeroPagina` = nº da página (1, 2, …), como a Edge e o n8n sempre usaram (822 contratos em 17 páginas).
   * Confere o total e para se faltar algo.
   */
  async function lerTudo(caminho: string, params: Record<string, string>, porPagina: number, emParalelo = 3) {
    const pg = (n: number) => get(caminho, { ...params, numeroPagina: String(n), numeroRegistros: String(porPagina) }, `página ${n}`)
    const primeira = await pg(1)
    if (!primeira) return [] // 404 = nada a ler (a trava de volume decide se isso é aceitável)
    const quantidade = Number(primeira.quantidade ?? 0)
    const paginas = Math.ceil(quantidade / porPagina)
    if (paginas > 200) throw new ImoviewErro(`Imoview ${caminho}: ${quantidade} registros (${paginas} páginas) é fora do normal. Nada foi gravado.`)
    const porCodigo = new Map<number, Record<string, unknown>>()
    const juntar = (lote: Record<string, unknown> | null) => {
      for (const item of (lote?.lista as Record<string, unknown>[] | undefined) ?? []) porCodigo.set(Number(item.codigo), item)
    }
    juntar(primeira)
    for (let inicio = 2; inicio <= paginas; inicio += emParalelo) {
      const numeros = Array.from({ length: Math.min(emParalelo, paginas - inicio + 1) }, (_, i) => inicio + i)
      for (const lote of await Promise.all(numeros.map(pg))) juntar(lote)
    }
    if (porCodigo.size !== quantidade) {
      throw new ImoviewErro(`Leitura incompleta de ${caminho}: ${porCodigo.size} de ${quantidade}. Nada foi gravado.`)
    }
    return [...porCodigo.values()]
  }

  return { get, lerTudo, stats }
}

function lerJson(texto: string): Record<string, unknown> {
  if (!texto) return {}
  try {
    const v = JSON.parse(texto)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function ehJson(texto: string) {
  try {
    const v = JSON.parse(texto)
    return v !== null && typeof v === 'object'
  } catch {
    return false
  }
}

function mensagem(corpo: Record<string, unknown>) {
  return String(corpo.mensagem ?? corpo.Message ?? '').slice(0, 300)
}
