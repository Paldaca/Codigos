import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, HelpCircle, X } from 'lucide-react'

type BotonAyudaProps = {
  titulo: string
  texto: string
  destacado?: string
  etiquetaAria?: string
  alAbrirGuiaCompleta?: () => void
}

export function BotonAyuda({
  titulo,
  texto,
  destacado,
  etiquetaAria,
  alAbrirGuiaCompleta,
}: BotonAyudaProps) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const idPop = useId()

  const cerrar = useCallback(() => setAbierto(false), [])

  const posicionar = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const ancho = Math.min(320, window.innerWidth - 24)
    const arriba = r.bottom + 180 > window.innerHeight && r.top > 180
    setPos({
      position: 'fixed',
      width: ancho,
      left: Math.max(12, Math.min(r.left - ancho / 2 + r.width / 2, window.innerWidth - ancho - 12)),
      ...(arriba ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
    })
  }, [])

  useEffect(() => {
    if (!abierto) return
    const alPulsarFuera = (e: PointerEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return
      cerrar()
    }
    const alEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    const alMover = () => cerrar()
    document.addEventListener('pointerdown', alPulsarFuera)
    document.addEventListener('keydown', alEsc)
    window.addEventListener('scroll', alMover, true)
    window.addEventListener('resize', alMover)
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera)
      document.removeEventListener('keydown', alEsc)
      window.removeEventListener('scroll', alMover, true)
      window.removeEventListener('resize', alMover)
    }
  }, [abierto, cerrar])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`btn-ayuda ${abierto ? 'is-abierto' : ''}`}
        aria-label={etiquetaAria ?? `Ayuda sobre ${titulo}`}
        aria-expanded={abierto}
        aria-controls={abierto ? idPop : undefined}
        title={`¿Qué es ${titulo}?`}
        onClick={(e) => {
          e.stopPropagation()
          if (abierto) cerrar()
          else {
            posicionar()
            setAbierto(true)
          }
        }}
      >
        <HelpCircle aria-hidden="true" />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={popRef}
            id={idPop}
            role="dialog"
            aria-label={titulo}
            className="cz-capa ayuda-popover"
            style={pos}
          >
            <div className="ayuda-popover-head">
              <strong>{titulo}</strong>
              <button type="button" className="btn-icono btn-icono-sm" onClick={cerrar} aria-label="Cerrar ayuda">
                <X aria-hidden="true" />
              </button>
            </div>
            <p className="ayuda-popover-texto">{texto}</p>
            {destacado && <div className="ayuda-popover-destacado">{destacado}</div>}
            {alAbrirGuiaCompleta && (
              <button
                type="button"
                className="ayuda-popover-link"
                onClick={() => {
                  cerrar()
                  alAbrirGuiaCompleta()
                }}
              >
                <BookOpen aria-hidden="true" />
                Explorar el motor de códigos
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
