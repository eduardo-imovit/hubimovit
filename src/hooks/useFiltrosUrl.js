import { useSearchParams } from 'react-router-dom'

/**
 * Filtros de painel guardados na URL: cada recorte vira um link que dá pra
 * mandar para alguém. Valores iguais ao padrão não aparecem na URL.
 */
export function useFiltrosUrl(padrao) {
  const [params, setParams] = useSearchParams()
  const filtros = Object.fromEntries(Object.entries(padrao).map(([k, v]) => [k, params.get(k) ?? v]))
  const setFiltro = (chave, valor) => {
    const novo = new URLSearchParams(params)
    if (valor === padrao[chave]) novo.delete(chave)
    else novo.set(chave, valor)
    setParams(novo, { replace: true })
  }
  const limpar = () => setParams(new URLSearchParams(), { replace: true })
  const alterados = Object.keys(padrao).some((k) => params.get(k) != null)
  return { filtros, setFiltro, limpar, alterados }
}
