import { Ban, HelpCircle, Home, ListChecks, PlusCircle, Settings, SlidersHorizontal } from 'lucide-react'
import { useIdentidad } from '../context/IdentidadContext'
import type { RutaApp } from '../rutas'
import { Isotipo } from '../ui/Marca'
import { InsigniaOrganizacion } from './InsigniaOrganizacion'

type BarraModuloProps = {
  vista: RutaApp
  ir: (ruta: string) => void
  alAbrirAyuda: () => void
}

export function BarraModulo({ vista, ir, alAbrirAyuda }: BarraModuloProps) {
  const { identidad, puede, salud } = useIdentidad()
  if (identidad.tipo !== 'listo') return null

  const items: Array<{ id: RutaApp; ruta: string; etiqueta: string; icono: typeof Home; visible: boolean }> = [
    { id: 'inicio', ruta: '/', etiqueta: 'Inicio', icono: Home, visible: puede('codigos:inicio:ver') },
    { id: 'generar', ruta: '/generar/', etiqueta: 'Generar código', icono: PlusCircle, visible: puede('codigos:codigos:generar') },
    { id: 'registro', ruta: '/registro/', etiqueta: 'Registro', icono: ListChecks, visible: puede('codigos:registro:ver') },
    { id: 'anulaciones', ruta: '/anulaciones/', etiqueta: 'Anulaciones', icono: Ban, visible: puede('codigos:codigos:anular') },
    { id: 'catalogos', ruta: '/catalogos/', etiqueta: 'Esquema', icono: SlidersHorizontal, visible: puede('codigos:catalogos:administrar') },
    {
      id: 'administracion',
      ruta: '/administracion/',
      etiqueta: 'Administración',
      icono: Settings,
      visible: identidad.yo.es_admin_organizacion || puede('codigos:administracion:gestionar'),
    },
  ]

  return (
    <header className="barra-modulo">
      <div className="barra-modulo-izq">
        <button type="button" className="barra-marca-btn" onClick={() => ir('/')}>
          <Isotipo color="morado" tamano={30} />
          <span className="barra-marca-texto">
            <strong>Códigos</strong>
            <small>
              <span
                className={`punto-vivo ${salud ? (salud.estado === 'ok' ? '' : 'is-error') : 'is-espera'}`}
                style={{ width: 6, height: 6, display: 'inline-block' }}
              />
              Cereipo Suite
            </small>
          </span>
        </button>

        <nav className="tabs barra-tabs" aria-label="Navegación de Códigos" role="tablist">
          {items
            .filter((i) => i.visible)
            .map((item) => {
              const Icono = item.icono
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={vista === item.id}
                  className="tab"
                  onClick={() => ir(item.ruta)}
                >
                  <Icono aria-hidden="true" />
                  <span>{item.etiqueta}</span>
                </button>
              )
            })}
        </nav>
      </div>

      <div className="barra-modulo-der">
        <button type="button" className="btn-guia-pill" onClick={alAbrirAyuda} title="Abrir guía interactiva del motor de códigos">
          <HelpCircle aria-hidden="true" />
          <span>¿Cómo funciona?</span>
        </button>
        <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
      </div>
    </header>
  )
}
