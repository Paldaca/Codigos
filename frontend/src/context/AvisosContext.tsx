import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type TonoAviso = 'ok' | 'info' | 'warn' | 'danger'

type AvisoEmergente = {
  id: number
  titulo: string
  detalle?: string
  tono: TonoAviso
}

type AvisosContexto = {
  notificar: (titulo: string, detalle?: string, tono?: TonoAviso) => void
}

const AvisosContext = createContext<AvisosContexto | null>(null)

const ICONOS = {
  ok: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  danger: XCircle,
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoEmergente[]>([])

  const notificar = useCallback((titulo: string, detalle?: string, tono: TonoAviso = 'ok') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setAvisos((prev) => [...prev.slice(-3), { id, titulo, detalle, tono }])
    window.setTimeout(() => {
      setAvisos((prev) => prev.filter((a) => a.id !== id))
    }, 4500)
  }, [])

  return (
    <AvisosContext.Provider value={{ notificar }}>
      {children}
      {avisos.length > 0 && (
        <div className="avisos-pila" aria-live="polite" aria-atomic="true">
          {avisos.map((a) => {
            const Icono = ICONOS[a.tono]
            return (
              <div key={a.id} className="float-card aviso-emergente">
                <span className={`fc-icon ${a.tono !== 'info' ? `is-${a.tono}` : ''}`}>
                  <Icono aria-hidden="true" />
                </span>
                <span>
                  <b>{a.titulo}</b>
                  {a.detalle && <small>{a.detalle}</small>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </AvisosContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvisos() {
  const ctx = useContext(AvisosContext)
  if (!ctx) throw new Error('useAvisos debe usarse dentro de AvisosProvider')
  return ctx
}
