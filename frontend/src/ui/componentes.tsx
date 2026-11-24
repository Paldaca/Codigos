// Componentes reutilizables del sistema de diseño (docs/Cereipo_desing_system.md §8).
import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Info, X } from 'lucide-react'

export type Tono = 'ok' | 'warn' | 'info' | 'danger' | 'muted' | 'module'

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primary' | 'secondary' | 'ghost' | 'danger'
  tamano?: 'sm' | 'md' | 'lg'
  bloque?: boolean
  cargando?: boolean
  exito?: boolean
}

export function Boton({
  variante = 'primary',
  tamano = 'md',
  bloque = false,
  cargando = false,
  exito = false,
  className = '',
  children,
  ...resto
}: BotonProps) {
  const clases = [
    'btn',
    `btn-${variante}`,
    tamano !== 'md' ? `btn-${tamano}` : '',
    bloque ? 'btn-block' : '',
    cargando ? 'is-cargando' : '',
    exito ? 'is-exito' : '',
    className,
  ]
  return (
    <button className={clases.filter(Boolean).join(' ')} aria-busy={cargando || undefined} {...resto}>
      {cargando && <span className="girador" aria-hidden="true" />}
      {exito && <Check aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Etiqueta({
  tono = 'muted',
  punto = false,
  children,
}: {
  tono?: Tono
  punto?: boolean
  children: ReactNode
}) {
  return (
    <span className={`tag tag-${tono}`}>
      {punto && <span className="tag-punto" aria-hidden="true" />}
      {children}
    </span>
  )
}

type CasillaProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode }

export function Casilla({ children, className = '', ...resto }: CasillaProps) {
  return (
    <label className={`casilla ${className}`}>
      <input type="checkbox" {...resto} />
      <span className="casilla-caja" aria-hidden="true">
        <Check />
      </span>
      {children}
    </label>
  )
}

const ICONO_AVISO = { info: Info, muted: Info, success: CheckCircle2, warn: AlertTriangle, error: AlertCircle }

export function Aviso({
  tono = 'info',
  accion,
  className = '',
  children,
}: {
  tono?: 'info' | 'muted' | 'success' | 'warn' | 'error'
  accion?: ReactNode
  className?: string
  children: ReactNode
}) {
  const Icono = ICONO_AVISO[tono]
  return (
    <div className={`form-status is-${tono} ${className}`} role={tono === 'error' ? 'alert' : 'status'}>
      <Icono aria-hidden="true" />
      <div className="form-status-texto">{children}</div>
      {accion}
    </div>
  )
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type DialogoProps = {
  abierto: boolean
  titulo: string
  descripcion?: ReactNode
  tamano?: 'md' | 'lg' | 'xl'
  alCerrar: () => void
  acciones?: ReactNode
  children?: ReactNode
}

export function Dialogo({
  abierto,
  titulo,
  descripcion,
  tamano = 'md',
  alCerrar,
  acciones,
  children,
}: DialogoProps) {
  const caja = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const idDescripcion = useId()

  useEffect(() => {
    if (!abierto) return
    const disparador = document.activeElement as HTMLElement | null
    const primero =
      caja.current?.querySelector<HTMLElement>(`.dialogo-cuerpo :is(${ENFOCABLES})`) ??
      caja.current?.querySelector<HTMLElement>(ENFOCABLES)
    primero?.focus()
    const desplazamiento = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = desplazamiento
      disparador?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null

  function teclado(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      alCerrar()
      return
    }
    if (e.key !== 'Tab' || !caja.current) return
    const enfocables = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null)
    if (enfocables.length === 0) return
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return createPortal(
    <div className="cz-capa dialogo-cortina" onPointerDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div
        ref={caja}
        className={`dialogo ${tamano !== 'md' ? `dialogo-${tamano}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDescripcion : undefined}
        onKeyDown={teclado}
      >
        <div className="dialogo-cabecera">
          <h2 className="dialogo-titulo" id={idTitulo}>
            {titulo}
          </h2>
          <button type="button" className="btn-icono" onClick={alCerrar} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </div>
        {descripcion && (
          <p className="dialogo-texto" id={idDescripcion}>
            {descripcion}
          </p>
        )}
        {children && <div className="dialogo-cuerpo">{children}</div>}
        {acciones && <div className="dialogo-acciones">{acciones}</div>}
      </div>
    </div>,
    document.body,
  )
}
