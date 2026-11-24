import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export type OpcionSelector = {
  valor: string
  texto: string
  codigoCorto?: string
  detalle?: string
  esGeneral?: boolean
}

type SelectorBuscableProps = {
  etiqueta: string
  valor: string
  opciones: OpcionSelector[]
  alCambiar: (valor: string) => void
  vacio?: string
  deshabilitado?: boolean
  buscable?: boolean
  id?: string
  className?: string
}

export function SelectorBuscable({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  vacio = 'Elegir…',
  deshabilitado = false,
  buscable,
  id,
  className = '',
}: SelectorBuscableProps) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [activa, setActiva] = useState(0)
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const refMenu = useRef<HTMLDivElement>(null)
  const refInput = useRef<HTMLInputElement>(null)
  const idLista = useId()

  const mostrarBusqueda = buscable ?? opciones.length > 8

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return opciones
    return opciones.filter(
      (o) =>
        o.valor.toLowerCase().includes(q) ||
        o.texto.toLowerCase().includes(q) ||
        (o.detalle?.toLowerCase().includes(q) ?? false),
    )
  }, [opciones, busqueda])

  const elegida = opciones.find((o) => o.valor === valor)

  const cerrar = useCallback(() => {
    setAbierto(false)
    setBusqueda('')
  }, [])

  useEffect(() => {
    if (!abierto) return
    const alPulsarFuera = (e: PointerEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || refMenu.current?.contains(target)) return
      cerrar()
    }
    const cerrarAlMover = (e: Event) => {
      if (refMenu.current?.contains(e.target as Node)) return
      cerrar()
    }
    document.addEventListener('pointerdown', alPulsarFuera)
    window.addEventListener('scroll', cerrarAlMover, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera)
      window.removeEventListener('scroll', cerrarAlMover, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto, cerrar])

  useEffect(() => {
    if (abierto && mostrarBusqueda) {
      window.setTimeout(() => refInput.current?.focus(), 20)
    }
  }, [abierto, mostrarBusqueda])

  function ubicar() {
    const boton = ref.current?.querySelector('button')
    if (!boton) return
    const r = boton.getBoundingClientRect()
    const alto = Math.min(340, opciones.length * 42 + 64)
    const arriba = r.bottom + alto + 8 > window.innerHeight && r.top > alto
    const ancho = Math.max(r.width, 250)
    setPosicion({
      position: 'fixed',
      left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
      width: ancho,
      ...(arriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    })
  }

  function abrirMenu() {
    ubicar()
    const idx = filtradas.findIndex((o) => o.valor === valor)
    setActiva(Math.max(0, idx))
    setAbierto(true)
  }

  function elegir(o: OpcionSelector) {
    cerrar()
    if (o.valor !== valor) alCambiar(o.valor)
    ref.current?.querySelector('button')?.focus()
  }

  function teclado(e: KeyboardEvent) {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        abrirMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiva((a) => Math.min(filtradas.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiva((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && filtradas[activa]) {
      e.preventDefault()
      elegir(filtradas[activa])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      cerrar()
      ref.current?.querySelector('button')?.focus()
    } else if (e.key === 'Tab') {
      cerrar()
    }
  }

  return (
    <div className={`selector ${className}`} ref={ref}>
      <button
        type="button"
        id={id}
        className={`selector-boton ${abierto ? 'is-abierto' : ''} ${elegida ? '' : 'is-vacio'}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={`${etiqueta}: ${elegida?.texto ?? vacio}`}
        disabled={deshabilitado}
        onClick={() => (abierto ? cerrar() : abrirMenu())}
        onKeyDown={teclado}
      >
        {elegida?.codigoCorto && <span className="selector-codigo-pill">{elegida.codigoCorto}</span>}
        <span className="selector-texto">{elegida?.texto ?? vacio}</span>
        {elegida?.esGeneral && <span className="tag tag-info">General</span>}
        <ChevronDown aria-hidden="true" />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={refMenu}
            className="cz-capa menu selector-menu"
            role="listbox"
            id={idLista}
            aria-label={etiqueta}
            style={posicion}
            onKeyDown={teclado}
          >
            {mostrarBusqueda && (
              <div className="selector-busqueda">
                <Search aria-hidden="true" />
                <input
                  ref={refInput}
                  type="text"
                  placeholder="Filtrar opciones…"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    setActiva(0)
                  }}
                />
              </div>
            )}
            <div className="selector-opciones">
              {filtradas.map((o, i) => (
                <div
                  key={o.valor}
                  role="option"
                  aria-selected={o.valor === valor}
                  className={`menu-item ${i === activa ? 'is-activa' : ''}`}
                  onPointerEnter={() => setActiva(i)}
                  onClick={() => elegir(o)}
                >
                  {o.codigoCorto && <span className="selector-codigo-pill">{o.codigoCorto}</span>}
                  <span className="menu-item-texto">
                    {o.texto}
                    {o.detalle && <small>{o.detalle}</small>}
                  </span>
                  {o.esGeneral && <span className="tag tag-info">General</span>}
                  {o.valor === valor && <Check className="menu-check" aria-hidden="true" />}
                </div>
              ))}
              {filtradas.length === 0 && (
                <div className="menu-item" style={{ cursor: 'default', color: 'var(--ink-400)' }}>
                  Sin coincidencias
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
