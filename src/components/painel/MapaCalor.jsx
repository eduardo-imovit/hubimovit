import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import L from '../../lib/leafletGlobal'
import 'leaflet.heat'
import { fmtNum } from '../../lib/paineis'

// centro de Campinas; o mapa se ajusta aos pontos quando há algum
const CAMPINAS = [-22.9056, -47.0608]
// raio (km) para listar os bairros "perto daqui" ao passar o mouse ou tocar
const RAIO_KM = 1.2

const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()

function distanciaKm(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// enquadra o miolo do estoque (5% a 95% em cada eixo), para imóveis distantes não afastarem o zoom
function limitesMiolo(pontos) {
  const q = (v, p) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]
  const lats = pontos.map((p) => p.lat).sort((a, b) => a - b)
  const lngs = pontos.map((p) => p.lng).sort((a, b) => a - b)
  return L.latLngBounds([q(lats, 0.05), q(lngs, 0.05)], [q(lats, 0.95), q(lngs, 0.95)])
}

function bairrosPerto(pontos, centro) {
  const m = new Map()
  for (const p of pontos) {
    if (distanciaKm(p, centro) > RAIO_KM) continue
    m.set(p.bairro, (m.get(p.bairro) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
}

/** Mapa de calor do estoque (PRD §5.14, revisão de 16/10): OpenStreetMap + leaflet.heat. */
export default function MapaCalor({ pontos }) {
  const caixa = useRef(null)
  const mapa = useRef(null)
  const camada = useRef(null)
  const [perto, setPerto] = useState(null)

  useEffect(() => {
    const m = L.map(caixa.current, { center: CAMPINAS, zoom: 11, scrollWheelZoom: false, attributionControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      camada.current = null
    }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (camada.current) m.removeLayer(camada.current)
    camada.current = L.heatLayer(
      pontos.map((p) => [p.lat, p.lng, 1]),
      {
        // cada imóvel pesa 1; o tom mais quente pede ~8 imóveis sobrepostos, para não saturar tudo
        max: 8,
        radius: 16,
        blur: 18,
        maxZoom: 13,
        minOpacity: 0.25,
        gradient: { 0.2: token('--info'), 0.45: token('--ninho-vazio'), 0.7: token('--coral'), 1: token('--coral-dark') },
      }
    ).addTo(m)
    if (pontos.length >= 5) m.fitBounds(limitesMiolo(pontos), { padding: [16, 16], maxZoom: 14 })
    setPerto(null)

    const mostrar = (e) => {
      const lista = bairrosPerto(pontos, e.latlng)
      setPerto(lista.length ? lista : [])
    }
    m.on('click', mostrar)
    m.on('mousemove', mostrar)
    return () => {
      m.off('click', mostrar)
      m.off('mousemove', mostrar)
    }
  }, [pontos])

  return (
    <div className="pg-mapa">
      <div ref={caixa} className="pg-mapa-caixa" role="img" aria-label={`Mapa de calor com ${fmtNum(pontos.length)} imóveis em estoque`} />
      <p className="pg-mapa-perto" aria-live="polite">
        {perto == null
          ? 'Passe o mouse ou toque no mapa para ver os bairros com mais imóveis ali.'
          : perto.length
            ? `Num raio de ${fmtNum(RAIO_KM, 1)} km: ${perto.map(([b, n]) => `${b} (${fmtNum(n)})`).join(' · ')}`
            : `Nenhum imóvel num raio de ${fmtNum(RAIO_KM, 1)} km.`}
      </p>
    </div>
  )
}
