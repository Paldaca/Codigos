// Utilidades de movimiento del sistema de diseño (docs/Cereipo_desing_system.md §5).
import { useEffect, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

export function sinMovimiento(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Cuenta de 0 a `valor` con interpolación cúbica suave. */
export function useConteo(valor: number, activo = true, duracion = 850): number {
  const [actual, setActual] = useState(0)

  useEffect(() => {
    if (!activo) return
    if (sinMovimiento() || valor === 0) {
      setActual(valor)
      return
    }
    let cuadro = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      setActual(Math.round(valor * (1 - Math.pow(1 - t, 3))))
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [valor, activo, duracion])

  return actual
}

/** Posición `--i` para la entrada escalonada (`.rev`). */
export function orden(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

/**
 * Deja en el elemento `--mx` y `--my` (posición del cursor en px) para los
 * efectos de resplandor que siguen al puntero.
 */
export function seguirPuntero(evento: PointerEvent<HTMLElement>): void {
  const el = evento.currentTarget
  const caja = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${evento.clientX - caja.left}px`)
  el.style.setProperty('--my', `${evento.clientY - caja.top}px`)
}
