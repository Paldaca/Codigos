import { useCallback, useEffect, useState } from 'react'
import { useCereipoEmbed } from '@cereipo/embed'

import { AyudaMotorModal } from './components/AyudaMotorModal'
import { BarraModulo } from './components/BarraModulo'
import { AvisosProvider } from './context/AvisosContext'
import { IdentidadProvider, useIdentidad } from './context/IdentidadContext'
import { PanelAdministracionPage } from './pages/administracion/PanelAdministracionPage'
import { AnulacionesPage } from './pages/anulaciones/AnulacionesPage'
import { CatalogosPage } from './pages/catalogos/CatalogosPage'
import { GeneradorPage } from './pages/generador/GeneradorPage'
import { InicioPage } from './pages/inicio/InicioPage'
import { RegistroPage } from './pages/registro/RegistroPage'
import { resolverRuta } from './rutas'
import { configurarManejadorAuth } from './services/http'
import { Aviso } from './ui/componentes'

function rutaActualNavegador() {
  return `${window.location.pathname}${window.location.search}`
}

function ContenidoApp() {
  const [ruta, setRuta] = useState(rutaActualNavegador)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const { identidad, configOrg, puede } = useIdentidad()

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      <div className="cz">
        <main className="shell-interno">
          <div className="esqueleto" style={{ height: 56, marginBottom: 16 }} />
          <div className="esqueleto" style={{ height: 220, borderRadius: 'var(--r-xl)' }} />
        </main>
      </div>
    )
  }

  if (identidad.tipo === 'error') {
    return (
      <div className="cz">
        <main className="shell-interno">
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 21, marginBottom: 10 }}>No se pudo iniciar Códigos</h2>
            <Aviso tono="error">{identidad.mensaje}</Aviso>
          </div>
        </main>
      </div>
    )
  }

  if (identidad.tipo === 'sin-identidad') {
    return (
      <div className="cz">
        <main className="shell-interno">
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 21, marginBottom: 10 }}>Acceso no disponible</h2>
            <Aviso tono="warn">{identidad.mensaje}</Aviso>
          </div>
        </main>
      </div>
    )
  }

  const vista = resolverRuta(ruta)
  const enIframe = embebida
  const abrirAyuda = () => setAyudaAbierta(true)

  return (
    <div className="cz">
      <main className="shell-interno">
        {!enIframe && <BarraModulo vista={vista} ir={ir} alAbrirAyuda={abrirAyuda} />}

        <div key={vista} className="vista-transicion">
          {vista === 'inicio' &&
            (puede('codigos:inicio:ver') ? (
              <InicioPage ir={ir} alAbrirAyuda={abrirAyuda} />
            ) : (
              <Aviso tono="warn">Sin permiso para ver el inicio de Códigos.</Aviso>
            ))}
          {vista === 'generar' &&
            (puede('codigos:codigos:generar') ? (
              <GeneradorPage ir={ir} alAbrirAyuda={abrirAyuda} />
            ) : (
              <Aviso tono="warn">Sin permiso para generar códigos.</Aviso>
            ))}
          {vista === 'registro' &&
            (puede('codigos:registro:ver') ? (
              <RegistroPage ir={ir} alAbrirAyuda={abrirAyuda} />
            ) : (
              <Aviso tono="warn">Sin permiso para consultar el registro.</Aviso>
            ))}
          {vista === 'anulaciones' &&
            (puede('codigos:codigos:anular') ? (
              <AnulacionesPage alAbrirAyuda={abrirAyuda} />
            ) : (
              <Aviso tono="warn">Sin permiso para gestionar anulaciones.</Aviso>
            ))}
          {vista === 'catalogos' &&
            (puede('codigos:catalogos:administrar') ? (
              <CatalogosPage alAbrirAyuda={abrirAyuda} />
            ) : (
              <Aviso tono="warn">Sin permiso para administrar catálogos.</Aviso>
            ))}
          {vista === 'administracion' && <PanelAdministracionPage alAbrirAyuda={abrirAyuda} />}
        </div>

        <AyudaMotorModal
          abierto={ayudaAbierta}
          alCerrar={() => setAyudaAbierta(false)}
          siglaOrg={configOrg?.configurada ? configOrg.sigla : undefined}
        />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <IdentidadProvider>
      <AvisosProvider>
        <ContenidoApp />
      </AvisosProvider>
    </IdentidadProvider>
  )
}
