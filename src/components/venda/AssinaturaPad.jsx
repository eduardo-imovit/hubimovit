import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

/**
 * Captura de assinatura do proponente (canvas, sem dependências novas).
 * Uso: const assinaturaRef = useRef(); <AssinaturaPad ref={assinaturaRef} />
 * API: { vazia(), limpar(), toBlob() }.
 */
const AssinaturaPad = forwardRef(function AssinaturaPad({ onChange }, ref) {
  const canvasRef = useRef(null)
  const desenhando = useRef(false)
  const [temTinta, setTemTinta] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const largura = canvas.clientWidth || 520
    const altura = 180
    canvas.width = largura * dpr
    canvas.height = altura * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  useImperativeHandle(ref, () => ({
    vazia: () => !temTinta,
    limpar: () => limpar(),
    toBlob: () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
  }))

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const t = e.touches?.[0]
    const x = (t ? t.clientX : e.clientX) - r.left
    const y = (t ? t.clientY : e.clientY) - r.top
    return { x, y }
  }

  function iniciar(e) {
    e.preventDefault()
    desenhando.current = true
    const { x, y } = pos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function mover(e) {
    if (!desenhando.current) return
    e.preventDefault()
    const { x, y } = pos(e)
    canvasRef.current.getContext('2d').lineTo(x, y)
    canvasRef.current.getContext('2d').stroke()
    if (!temTinta) {
      setTemTinta(true)
      onChange?.(true)
    }
  }

  function parar() {
    desenhando.current = false
  }

  function limpar() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.clientWidth || 520, 180)
    setTemTinta(false)
    onChange?.(false)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="assinatura-canvas"
        style={{ width: '100%', height: 180, border: '1.5px dashed var(--champagne)', borderRadius: 'var(--radius-md)', background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
        onMouseDown={iniciar}
        onMouseMove={mover}
        onMouseUp={parar}
        onMouseLeave={parar}
        onTouchStart={iniciar}
        onTouchMove={mover}
        onTouchEnd={parar}
        aria-label="Área de assinatura"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="is-muted" style={{ fontSize: 'var(--text-xs)' }}>Assine com o dedo ou o mouse</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={limpar}>Limpar</button>
      </div>
    </div>
  )
})

export default AssinaturaPad
