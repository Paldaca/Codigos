import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ErrorApi } from '../services/http'
import { catalogosApi } from '../services/catalogos'
import { integracionApi } from '../services/integracion'
import type { ConfiguracionOrg } from '../types/catalogos'
import type { IdentidadYo, SaludEstado } from '../types/identidad'

type EstadoIdentidad =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; yo: IdentidadYo }
  | { tipo: 'sin-identidad'; codigo: string; mensaje: string }
  | { tipo: 'error'; mensaje: string }

type ContextoValor = {
  salud: SaludEstado | null
  identidad: EstadoIdentidad
  configOrg: ConfiguracionOrg | null
  puede: (permiso: string) => boolean
  recargarConfigOrg: () => Promise<void>
}

const IdentidadContext = createContext<ContextoValor | null>(null)

export function IdentidadProvider({ children }: { children: ReactNode }) {
  const [salud, setSalud] = useState<SaludEstado | null>(null)
  const [identidad, setIdentidad] = useState<EstadoIdentidad>({ tipo: 'cargando' })
  const [configOrg, setConfigOrg] = useState<ConfiguracionOrg | null>(null)

  const recargarConfigOrg = useCallback(async () => {
    try {
      const cfg = await catalogosApi.obtenerConfigOrg()
      setConfigOrg(cfg)
    } catch {
      setConfigOrg(null)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    integracionApi
      .salud()
      .then((s) => vigente && setSalud(s))
      .catch(() => {})

    integracionApi
      .yo()
      .then(async (yo) => {
        if (!vigente) return
        setIdentidad({ tipo: 'listo', yo })
        try {
          const cfg = await catalogosApi.obtenerConfigOrg()
          if (vigente) setConfigOrg(cfg)
        } catch {
          if (vigente) setConfigOrg(null)
        }
      })
      .catch((err: unknown) => {
        if (!vigente) return
        if (err instanceof ErrorApi && (err.status === 401 || err.status === 403)) {
          setIdentidad({ tipo: 'sin-identidad', codigo: err.codigo, mensaje: err.message })
        } else {
          setIdentidad({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) })
        }
      })

    return () => {
      vigente = false
    }
  }, [])

  const puede = useCallback(
    (permiso: string) => {
      if (identidad.tipo !== 'listo') return false
      return identidad.yo.permisos.includes(permiso)
    },
    [identidad],
  )

  return (
    <IdentidadContext.Provider value={{ salud, identidad, configOrg, puede, recargarConfigOrg }}>
      {children}
    </IdentidadContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIdentidad() {
  const ctx = useContext(IdentidadContext)
  if (!ctx) throw new Error('useIdentidad debe usarse dentro de IdentidadProvider')
  return ctx
}
