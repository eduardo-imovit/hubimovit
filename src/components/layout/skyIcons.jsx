export function IconeSol({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5v2M4.93 4.93l1.6 1.6M17.47 17.47l1.6 1.6M2 12h2.5M19.5 12h2M4.93 19.07l1.6-1.6M17.47 6.53l1.6-1.6" />
    </svg>
  )
}

export function IconeLua({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  )
}

export function IconeNuvem({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 6.5 19h11z" />
    </svg>
  )
}

export function IconeChuva({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 13a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 5 13h11z" />
      <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </svg>
  )
}

export function IconeNeve({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 13a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 2.02A4 4 0 0 0 5 13h11z" />
      <path d="M8 18v3M12 18v3M16 18v3M7 19.5l2 1M11 19.5l2 1M15 19.5l2 1" />
    </svg>
  )
}

export function IconeRelogio({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function IconeGota({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z" />
    </svg>
  )
}

export function IconeVento({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h9a2 2 0 1 1-2 2" />
    </svg>
  )
}

const MAPA_CONDICAO = {
  '01': { classe: 'clear', Icone: IconeSol },
  '02': { classe: 'clouds', Icone: IconeNuvem },
  '03': { classe: 'clouds', Icone: IconeNuvem },
  '04': { classe: 'clouds', Icone: IconeNuvem },
  '09': { classe: 'rain', Icone: IconeChuva },
  10: { classe: 'rain', Icone: IconeChuva },
  11: { classe: 'storm', Icone: IconeChuva },
  13: { classe: 'snow', Icone: IconeNeve },
  50: { classe: 'mist', Icone: IconeNuvem },
}

// Deriva o par (classe de fundo, ícone) a partir do código do OpenWeatherMap (ex: "01d", "10n")
export function condicaoDoIcone(icone) {
  const codigo = icone?.slice(0, 2)
  const periodo = icone?.slice(2) === 'n' ? 'noite' : 'dia'
  const entry = MAPA_CONDICAO[codigo] ?? MAPA_CONDICAO['02']
  const temVariantePeriodo = entry.classe === 'clear' || entry.classe === 'clouds'
  const classeFundo = temVariantePeriodo ? `sky-${entry.classe}-${periodo}` : `sky-${entry.classe}`
  const Icone = entry.classe === 'clear' && periodo === 'noite' ? IconeLua : entry.Icone
  return { classeFundo, Icone }
}
