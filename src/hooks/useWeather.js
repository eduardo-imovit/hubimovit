import { useCallback, useEffect, useState } from 'react'

const LAT = -22.9068
const LON = -47.0605
const CACHE_KEY = 'hub-imovit:weather-cache'
const REFRESH_MS = 30 * 60 * 1000

function lerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function gravarCache(dados) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dados, atualizadoEm: Date.now() }))
  } catch {
    // localStorage indisponível (aba anônima etc.) — segue sem cache
  }
}

export function useWeather() {
  const cacheInicial = lerCache()
  const [clima, setClima] = useState(cacheInicial?.dados ?? null)
  const [carregando, setCarregando] = useState(!cacheInicial)
  const [erro, setErro] = useState(false)

  const buscar = useCallback(async () => {
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY
    if (!apiKey) {
      setErro(true)
      setCarregando(false)
      return
    }
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&lang=pt_br&appid=${apiKey}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`weather api: ${resp.status}`)
      const json = await resp.json()
      const dados = {
        temperatura: Math.round(json.main.temp),
        descricao: json.weather[0].description,
        icone: json.weather[0].icon,
      }
      setClima(dados)
      setErro(false)
      gravarCache(dados)
    } catch {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const cache = lerCache()
    const idadeMs = cache ? Date.now() - cache.atualizadoEm : Infinity
    if (idadeMs >= REFRESH_MS) buscar()

    const id = setInterval(buscar, REFRESH_MS)
    return () => clearInterval(id)
  }, [buscar])

  return { clima, carregando, erro }
}
