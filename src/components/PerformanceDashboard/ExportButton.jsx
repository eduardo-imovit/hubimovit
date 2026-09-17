import { useState } from 'react'

// Botão "Exportar PDF" do Dashboard de Performance.
// Props: { data, periodo, targetId }
//   - data      objeto de usePerformanceDashboard (usa data.ultimaAtualizacao p/ "data de coleta")
//   - periodo   { inicio, fim } ISO  ou  { dataInicio, dataFim } Date  (normalizado internamente)
//   - targetId  id do container na página com o conteúdo do relatório (summary + cards + funnel +
//               anomalias + recomendações). Default: 'performance-report'.
//
// html2pdf.js é carregado sob demanda (import dinâmico) para não pesar no bundle principal.

const TAMANHO_A4_PX = 794 // ~210mm a 96dpi

// O html2canvas embutido no html2pdf.js não entende oklch() — a paleta padrão do
// Tailwind v4 usa oklch. Redefinimos os tokens usados no dashboard como hex só no
// container do PDF (não afeta a tela). Se adicionar novas cores Tailwind ao
// dashboard, inclua o token aqui.
const CORES_HEX_PARA_PDF = {
  '--color-white': '#ffffff',
  '--color-black': '#000000',
  '--color-slate-50': '#f8fafc',
  '--color-slate-100': '#f1f5f9',
  '--color-slate-200': '#e2e8f0',
  '--color-slate-300': '#cbd5e1',
  '--color-slate-400': '#94a3b8',
  '--color-slate-500': '#64748b',
  '--color-slate-600': '#475569',
  '--color-slate-700': '#334155',
  '--color-slate-800': '#1e293b',
  '--color-slate-900': '#0f172a',
  '--color-gray-200': '#e5e7eb',
  '--color-gray-300': '#d1d5db',
  '--color-green-50': '#f0fdf4',
  '--color-green-600': '#16a34a',
  '--color-green-700': '#15803d',
  '--color-red-600': '#dc2626',
  '--color-amber-50': '#fffbeb',
  '--color-amber-700': '#b45309',
}

function paraISO(valor) {
  if (!valor) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toLocaleDateString('en-CA')
  return String(valor).slice(0, 10)
}

function normalizarPeriodo(periodo) {
  return {
    inicio: paraISO(periodo?.inicio ?? periodo?.dataInicio),
    fim: paraISO(periodo?.fim ?? periodo?.dataFim),
  }
}

function formatarColeta(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

function cabecalhoHtml({ inicio, fim, coleta }) {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 24px 24px 0;">
      <div style="display:flex; align-items:baseline; gap:12px; border-bottom:2px solid #e8593c; padding-bottom:12px;">
        <span style="font-size:22px; font-weight:700; color:#e8593c; letter-spacing:-0.02em;">imovit</span>
        <span style="font-size:16px; font-weight:600; color:#1e293b;">Relatório de Performance</span>
      </div>
      <p style="margin:12px 0 0; font-size:12px; color:#64748b;">
        Período: ${inicio ?? '—'} a ${fim ?? '—'} &nbsp;·&nbsp; Coletado em: ${coleta}
      </p>
    </div>`
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}

export default function ExportButton({ data, periodo, targetId = 'performance-report' }) {
  const [gerando, setGerando] = useState(false)

  async function exportar() {
    const alvo = document.getElementById(targetId)
    if (!alvo) {
      console.warn(`[ExportButton] elemento #${targetId} não encontrado na página`)
      return
    }

    setGerando(true)
    const container = document.createElement('div')

    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const { inicio, fim } = normalizarPeriodo(periodo)
      const coleta = formatarColeta(data?.ultimaAtualizacao)

      container.style.cssText = `position:fixed; left:-10000px; top:0; width:${TAMANHO_A4_PX}px; background:#ffffff;`
      for (const [prop, valor] of Object.entries(CORES_HEX_PARA_PDF)) {
        container.style.setProperty(prop, valor)
      }
      container.innerHTML = cabecalhoHtml({ inicio, fim, coleta })

      const conteudo = alvo.cloneNode(true)
      conteudo.style.padding = '24px'
      container.appendChild(conteudo)
      document.body.appendChild(container)

      const nome = `Relatorio_Performance_${inicio ?? 'inicio'}_${fim ?? 'fim'}.pdf`

      await html2pdf()
        .set({
          margin: [10, 0, 12, 0],
          filename: nome,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
        })
        .from(container)
        .save()
    } catch (erro) {
      console.error('[ExportButton] falha ao gerar o PDF', erro)
    } finally {
      container.remove()
      setGerando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={gerando || !data}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {gerando ? (
        <>
          <Spinner />
          Gerando PDF…
        </>
      ) : (
        <>📥 Exportar PDF</>
      )}
    </button>
  )
}
