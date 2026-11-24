import { useCallback, useEffect, useState } from 'react'
import { useCereipoEmbed } from '@cereipo/embed'

import { IdentidadProvider, useIdentidad } from './context/IdentidadContext'
import { PanelAdministracionPage } from './pages/administracion/PanelAdministracionPage'
import { AnulacionesPage } from './pages/anulaciones/AnulacionesPage'
import { CatalogosPage } from './pages/catalogos/CatalogosPage'
import { GeneradorPage } from './pages/generador/GeneradorPage'
import { InicioPage } from './pages/inicio/InicioPage'
import { RegistroPage } from './pages/registro/RegistroPage'
import { resolverRuta } from './rutas'
import { configurarManejadorAuth } from './services/http'

function rutaActualNavegador() {
  return `${window.location.pathname}${window.location.search}`
}

function ContenidoApp() {
  const [ruta, setRuta] = useState(rutaActualNavegador)
  const { identidad, puede } = useIdentidad()

  useEffect(() => {
    const alVolver = () => setRuta(rutaActualNavegador())
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  const ir = useCallback((destino: string) => {
    const limpia = destino.startsWith('/') ? destino : `/${destino}`
    if (rutaActualNavegador() !== limpia) {
      window.history.pushState(null, '', limpia)
    }
    setRuta(limpia)
  }, [])

  const { embebida, notificarSesionVencida, notificarSinAcceso } = useCereipoEmbed({
    app: 'codigos',
    ruta,
    capacidades: ['navegar'],
    listo: identidad.tipo !== 'cargando',
    alIrA: (nuevaRuta) => {
      ir(nuevaRuta)
      return true
    },
  })

  useEffect(() => {
    configurarManejadorAuth((status, codigo) => {
      if (status === 401 || codigo === 'sin-sesion' || codigo === 'sesion-vencida') {
        notificarSesionVencida()
      } else if (status === 403 && codigo === 'sin-acceso') {
        notificarSinAcceso()
      }
    })
    return () => configurarManejadorAuth(null)
  }, [notificarSesionVencida, notificarSinAcceso])

  useEffect(() => {
    if (identidad.tipo !== 'sin-identidad') return
    if (identidad.status === 403 || identidad.codigo === 'sin-acceso') notificarSinAcceso()
    else notificarSesionVencida()
  }, [identidad, notificarSesionVencida, notificarSinAcceso])

  if (identidad.tipo === 'cargando') {
    return (
      <main className="pagina">
        <div className="tarjeta">Cargando sesión de Códigos…</div>
      </main>
    )
  }

  if (identidad.tipo === 'error') {
    return (
      <main className="pagina">
        <div className="tarjeta">
          <h2>No se pudo iniciar Códigos</h2>
          <p className="error">{identidad.mensaje}</p>
        </div>
      </main>
    )
  }

  if (identidad.tipo === 'sin-identidad') {
    return (
      <main className="pagina">
        <div className="tarjeta">
          <h2>Acceso no disponible</h2>
          <p className="tenue">{identidad.mensaje}</p>
        </div>
      </main>
    )
  }

  const vista = resolverRuta(ruta)
  const enIframe = embebida

  return (
    <main className="shell-interno">
      {!enIframe && (
        <nav className="nav-local" aria-label="Navegación local de Códigos">
          <button type="button" className={`nav-btn ${vista === 'inicio' ? 'activo' : ''}`} onClick={() => ir('/')}>
            Inicio
          </button>
          {puede('codigos:codigos:generar') && (
            <button type="button" className={`nav-btn ${vista === 'generar' ? 'activo' : ''}`} onClick={() => ir('/generar/')}>
              Generar códigos
            </button>
          )}
          {puede('codigos:registro:ver') && (
            <button type="button" className={`nav-btn ${vista === 'registro' ? 'activo' : ''}`} onClick={() => ir('/registro/')}>
              Registro
            </button>
          )}
          {puede('codigos:codigos:anular') && (
            <button type="button" className={`nav-btn ${vista === 'anulaciones' ? 'activo' : ''}`} onClick={() => ir('/anulaciones/')}>
              Anulaciones
            </button>
          )}
          {puede('codigos:catalogos:administrar') && (
            <button type="button" className={`nav-btn ${vista === 'catalogos' ? 'activo' : ''}`} onClick={() => ir('/catalogos/')}>
              Catálogos
            </button>
          )}
          {(identidad.yo.es_admin_organizacion || puede('codigos:administracion:gestionar')) && (
            <button type="button" className={`nav-btn ${vista === 'administracion' ? 'activo' : ''}`} onClick={() => ir('/administracion/')}>
              Administración
            </button>
          )}
        </nav>
      )}

      {vista === 'inicio' &&
        (puede('codigos:inicio:ver') ? (
          <InicioPage ir={ir} />
        ) : (
          <div className="tarjeta">Sin permiso para ver el inicio de Códigos.</div>
        ))}
      {vista === 'generar' &&
        (puede('codigos:codigos:generar') ? (
          <GeneradorPage ir={ir} />
        ) : (
          <div className="tarjeta">Sin permiso para generar códigos.</div>
        ))}
      {vista === 'registro' &&
        (puede('codigos:registro:ver') ? (
          <RegistroPage />
        ) : (
          <div className="tarjeta">Sin permiso para consultar el registro.</div>
        ))}
      {vista === 'anulaciones' &&
        (puede('codigos:codigos:anular') ? (
          <AnulacionesPage />
        ) : (
          <div className="tarjeta">Sin permiso para gestionar anulaciones.</div>
        ))}
      {vista === 'catalogos' &&
        (puede('codigos:catalogos:administrar') ? (
          <CatalogosPage />
        ) : (
          <div className="tarjeta">Sin permiso para administrar catálogos.</div>
        ))}
      {vista === 'administracion' && <PanelAdministracionPage />}
    </main>
  )
}

export default function App() {
  return (
    <IdentidadProvider>
      <ContenidoApp />
    </IdentidadProvider>
  )
}
