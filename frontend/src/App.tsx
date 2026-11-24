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

function ContenidoApp() {
  const [ruta, setRuta] = useState(() => window.location.pathname)
  const { identidad, puede } = useIdentidad()

  useEffect(() => {
    const alVolver = () => setRuta(window.location.pathname)
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  const ir = useCallback((destino: string) => {
    const limpia = destino.startsWith('/') ? destino : `/${destino}`
    if (window.location.pathname !== limpia) {
      window.history.pushState(null, '', limpia)
    }
    setRuta(limpia)
  }, [])

  const { notificarSesionVencida, notificarSinAcceso } = useCereipoEmbed({
    app: 'codigos',
    ruta,
    listo: identidad.tipo !== 'cargando',
    alIrA: (nuevaRuta) => {
      ir(nuevaRuta)
      return true
    },
  })

  useEffect(() => {
    if (identidad.tipo !== 'sin-identidad') return
    if (identidad.codigo === 'sin-acceso') notificarSinAcceso()
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
  const enIframe = window.self !== window.top

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

      {vista === 'inicio' && <InicioPage ir={ir} />}
      {vista === 'generar' && <GeneradorPage ir={ir} />}
      {vista === 'registro' && <RegistroPage />}
      {vista === 'anulaciones' && <AnulacionesPage />}
      {vista === 'catalogos' && <CatalogosPage />}
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
