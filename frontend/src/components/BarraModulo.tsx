import { useEffect, useState } from 'react'
import { Ban, HelpCircle, Home, ListChecks, PlusCircle, Settings } from 'lucide-react'
import { useIdentidad } from '../context/IdentidadContext'
import type { RutaApp } from '../rutas'
import { registroApi } from '../services/registro'
import { Isotipo } from '../ui/Marca'

type BarraModuloProps = {
  vista: RutaApp
  ir: (ruta: string) => void
  alAbrirAyuda: () => void
}

export function BarraModulo({ vista, ir, alAbrirAyuda }: BarraModuloProps) {
  const { identidad, configOrg, puede } = useIdentidad()
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    if (identidad.tipo !== 'listo' || !puede('codigos:codigos:anular')) return
    let activo = true
    registroApi
      .resumen()
      .then((r) => {
        if (activo) setPendientes(r.solicitudes_pendientes)
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [identidad, puede, vista])

  if (identidad.tipo !== 'listo') return null

  const esConfig = vista === 'catalogos' || vista === 'administracion'
  const puedeConfig =
    puede('codigos:catalogos:administrar') ||
    identidad.yo.es_admin_organizacion ||
    puede('codigos:administracion:gestionar')

  const items = [
    {
      id: 'inicio',
      ruta: '/',
      etiqueta: 'Inicio',
      icono: Home,
      activo: vista === 'inicio',
      visible: puede('codigos:inicio:ver') || puede('codigos:registro:ver'),
      badge: 0,
    },
    {
      id: 'generar',
      ruta: '/generar/',
      etiqueta: 'Generar',
      icono: PlusCircle,
      activo: vista === 'generar',
      visible: puede('codigos:codigos:generar'),
      badge: 0,
    },
    {
      id: 'registro',
      ruta: '/registro/',
      etiqueta: 'Registro',
      icono: ListChecks,
      activo: vista === 'registro',
      visible: puede('codigos:registro:ver'),
      badge: 0,
    },
    {
      id: 'anulaciones',
      ruta: '/anulaciones/',
      etiqueta: 'Anulaciones',
      icono: Ban,
      activo: vista === 'anulaciones',
      visible: puede('codigos:codigos:anular'),
      badge: pendientes,
    },
    {
      id: 'configuracion',
      ruta: puede('codigos:catalogos:administrar') ? '/catalogos/' : '/administracion/',
      etiqueta: 'Configuración',
      icono: Settings,
      activo: esConfig,
      visible: puedeConfig,
      badge: 0,
    },
  ]

  return (
    <header className="barra-minimal">
      <div className="barra-minimal-izq">
        <button type="button" className="barra-marca-btn" onClick={() => ir('/')}>
          <Isotipo color="morado" tamano={26} />
          <strong className="barra-marca-nombre">Códigos</strong>
        </button>

        <nav className="nav-clean" aria-label="Navegación de Códigos" role="tablist">
          {items
            .filter((i) => i.visible)
            .map((item) => {
              const Icono = item.icono
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.activo}
                  className={`nav-clean-tab ${item.activo ? 'is-activo' : ''}`}
                  onClick={() => ir(item.ruta)}
                >
                  <Icono size={16} aria-hidden="true" />
                  <span>{item.etiqueta}</span>
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </button>
              )
            })}
        </nav>
      </div>

      <div className="barra-minimal-der">
        <span className="org-pill" title={identidad.yo.organizacion.nombre}>
          <span className="org-pill-nombre">{identidad.yo.organizacion.nombre}</span>
          <span className={`org-pill-sigla ${configOrg?.configurada ? '' : 'is-warn'}`}>
            {configOrg?.configurada ? configOrg.sigla : 'Sin sigla'}
          </span>
        </span>
        <button
          type="button"
          className="btn-icono"
          onClick={alAbrirAyuda}
          aria-label="Guía del motor de códigos"
          title="Cómo funciona el motor de códigos (8 segmentos y regla 00)"
        >
          <HelpCircle aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
