import { useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatarDiaCurto } from '../../lib/dateUtils'
import { casarNome, chaveApelido, ehFimDeSemana, lerApelidosSalvos, lerEscalaPdf, salvarApelidos } from '../../lib/escalaPlantao'

const fmtData = (iso) => iso.split('-').reverse().slice(0, 2).join('/')
/** 'sáb., 26/09' */
const diaComMes = (iso) => `${formatarDiaCurto(iso)}/${iso.slice(5, 7)}`

/**
 * Importa a escala mensal de plantão em PDF (docs/01-prd.md §5.3): lê a tabela,
 * casa os apelidos com os corretores, mostra a prévia e só grava quando a
 * pessoa confirma. As datas do arquivo passam a valer: os plantões já
 * cadastrados nesse intervalo são substituídos.
 */
export default function ImportarEscalaPlantao({ colaboradores, onImportado }) {
  const inputRef = useRef(null)
  const [arquivo, setArquivo] = useState(null)
  const [escala, setEscala] = useState(null)
  const [mapa, setMapa] = useState({})
  const [existentes, setExistentes] = useState([])
  // fim de semana com um nome só = dia inteiro (confirmado pelo Eduardo em 24/09)
  const [fdsDiaInteiro, setFdsDiaInteiro] = useState(true)
  const [lendo, setLendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null)

  const porId = useMemo(() => new Map(colaboradores.map((c) => [String(c.id_corretor_crm), c])), [colaboradores])
  const apelidos = useMemo(() => (escala ? [...new Set(escala.flatMap((l) => [l.manha, l.tarde]).filter(Boolean))] : []), [escala])
  const faltando = apelidos.filter((a) => !mapa[chaveApelido(a)])

  function limpar() {
    setArquivo(null)
    setEscala(null)
    setMapa({})
    setExistentes([])
    setErro(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function escolherArquivo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setResultado(null)
    setErro(null)
    setLendo(true)
    try {
      const linhas = await lerEscalaPdf(f)
      const salvos = lerApelidosSalvos()
      const novoMapa = {}
      for (const a of new Set(linhas.flatMap((l) => [l.manha, l.tarde]).filter(Boolean))) {
        const { id } = casarNome(a, colaboradores, salvos)
        if (id) novoMapa[chaveApelido(a)] = id
      }
      const { data, error } = await supabase
        .from('plantao')
        .select('id, data, turno, corretor_nome, status')
        .gte('data', linhas[0].data)
        .lte('data', linhas.at(-1).data)
      if (error) throw error
      setArquivo(f)
      setEscala(linhas)
      setMapa(novoMapa)
      setExistentes(data ?? [])
      setFdsDiaInteiro(true)
    } catch (err) {
      setErro(err.message ?? 'Não foi possível ler o PDF.')
      setEscala(null)
    } finally {
      setLendo(false)
    }
  }

  const registros = useMemo(() => {
    if (!escala) return []
    const out = []
    for (const l of escala) {
      const fdsSoManha = fdsDiaInteiro && ehFimDeSemana(l.data) && l.manha && !l.tarde
      for (const [apelido, turno] of [[l.manha, fdsSoManha ? 'dia_inteiro' : 'manha'], [l.tarde, 'tarde']]) {
        if (!apelido) continue
        const c = porId.get(mapa[chaveApelido(apelido)])
        out.push({ data: l.data, turno, apelido, corretor: c })
      }
    }
    return out
  }, [escala, mapa, porId, fdsDiaInteiro])

  async function importar() {
    if (faltando.length || !registros.length) return
    setImportando(true)
    setErro(null)
    try {
      const linhas = registros.map((r) => ({
        corretor_id: r.corretor.id_corretor_crm,
        corretor_nome: r.corretor.nome_completo,
        data: r.data,
        turno: r.turno,
        status: 'agendado',
        observacao: `Escala importada: ${arquivo.name}`,
      }))
      // grava os novos primeiro; só depois apaga os antigos (falha no meio = duplicado, nunca dia vazio)
      const { error: erroInsert } = await supabase.from('plantao').insert(linhas)
      if (erroInsert) throw erroInsert
      if (existentes.length) {
        const { error: erroDelete } = await supabase.from('plantao').delete().in('id', existentes.map((p) => p.id))
        if (erroDelete) throw new Error(`Os plantões novos foram gravados, mas os antigos não foram apagados (${erroDelete.message}). Remova os duplicados na semana.`)
      }
      const salvos = lerApelidosSalvos()
      for (const a of apelidos) salvos[chaveApelido(a)] = mapa[chaveApelido(a)]
      salvarApelidos(salvos)
      setResultado({ gravados: linhas.length, substituidos: existentes.length, de: escala[0].data, ate: escala.at(-1).data })
      limpar()
      onImportado?.(escala[0].data)
    } catch (err) {
      setErro(err.message)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="escala-import">
      <div className="escala-import-cabeca">
        <div>
          <div className="escala-import-titulo">Importar escala do mês (PDF)</div>
          <div className="escala-import-sub">Suba o PDF "PLANTAO VENDAS". Você confere a prévia antes de gravar.</div>
        </div>
        <label className="btn btn-secondary btn-sm escala-import-botao">
          {lendo ? 'Lendo…' : 'Escolher PDF'}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={escolherArquivo} disabled={lendo || importando} hidden />
        </label>
      </div>

      {erro && <div className="hub-error">{erro}</div>}
      {resultado && (
        <div className="escala-import-ok" role="status">
          ✓ {resultado.gravados} plantões gravados de {fmtData(resultado.de)} a {fmtData(resultado.ate)}
          {resultado.substituidos > 0 && ` (${resultado.substituidos} antigos substituídos)`}.
        </div>
      )}

      {escala && (
        <div className="escala-import-previa">
          <p className="escala-import-resumo">
            <strong>{arquivo.name}</strong>: {escala.length} dias, de {diaComMes(escala[0].data)} a {diaComMes(escala.at(-1).data)}, {registros.length} plantões.
            {existentes.length > 0 && (
              <>
                {' '}
                <strong className="escala-import-alerta">{existentes.length} plantões já cadastrados nesse período serão substituídos.</strong>
              </>
            )}
          </p>

          <div className="escala-import-apelidos">
            <div className="escala-import-rotulo">Nomes na escala</div>
            {apelidos.map((a) => {
              const k = chaveApelido(a)
              return (
                <label key={k} className={`escala-import-apelido${mapa[k] ? '' : ' is-pendente'}`}>
                  <span>{a}</span>
                  <select value={mapa[k] ?? ''} onChange={(e) => setMapa((m) => ({ ...m, [k]: e.target.value }))}>
                    <option value="">Escolher corretor…</option>
                    {colaboradores.map((c) => (
                      <option key={c.id_corretor_crm} value={c.id_corretor_crm}>{c.nome_completo}</option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>

          <label className="escala-import-check">
            <input type="checkbox" checked={fdsDiaInteiro} onChange={(e) => setFdsDiaInteiro(e.target.checked)} />
            Fim de semana com um nome só é plantão do dia inteiro (no PDF o nome aparece na coluna da manhã)
          </label>

          <div className="escala-import-tabela">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Manhã</th>
                  <th>Tarde</th>
                </tr>
              </thead>
              <tbody>
                {escala.map((l) => {
                  const nome = (a) => (a ? porId.get(mapa[chaveApelido(a)])?.nome_completo ?? <span className="escala-import-alerta">{a}?</span> : '—')
                  const diaInteiro = fdsDiaInteiro && ehFimDeSemana(l.data) && l.manha && !l.tarde
                  return (
                    <tr key={l.data} className={ehFimDeSemana(l.data) ? 'is-fds' : undefined}>
                      <td>{diaComMes(l.data)}</td>
                      <td colSpan={diaInteiro ? 2 : 1}>{nome(l.manha)}{diaInteiro && <span className="escala-import-dia-inteiro"> · dia inteiro</span>}</td>
                      {!diaInteiro && <td>{nome(l.tarde)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="escala-import-acoes">
            <button type="button" className="btn btn-secondary btn-sm" onClick={limpar} disabled={importando}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={importar} disabled={importando || faltando.length > 0}>
              {importando
                ? 'Importando…'
                : faltando.length > 0
                  ? `Escolha o corretor de ${faltando.length} ${faltando.length === 1 ? 'nome' : 'nomes'}`
                  : `Importar ${registros.length} plantões${existentes.length ? ` e substituir ${existentes.length}` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
