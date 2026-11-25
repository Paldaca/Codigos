import { useEffect, useState } from 'react'
import { ArrowRight, Ban, HelpCircle, ListChecks, PlusCircle, Settings } from 'lucide-react'
import { useIdentidad } from '../../context/IdentidadContext'
import { registroApi } from '../../services/registro'
import type { ResumenRegistro } from '../../types/registro'
import { Aviso } from '../../ui/componentes'

type InicioPageProps = {
  ir: (ruta: string) => void
  embebida?: boolean
  alAbrirAyuda?: () => void
}

export function InicioPage({ ir, embebida = false, alAbrirAyuda }: InicioPageProps) {
  const { identidad, configOrg, puede } = useIdentidad()
  const [resumen, setResumen] = useState<ResumenRegistro | null>(null)

  const puedeGenerar = puede('codigos:codigos:generar')
  const puedeVerRegistro = puede('codigos:registro:ver')
  const puedeAnular = puede('codigos:codigos:anular')
  const puedeConfig =
    puede('codigos:catalogos:administrar') ||
    (identidad.tipo === 'listo' && identidad.yo.es_admin_organizacion) ||
    puede('codigos:administracion:gestionar')

  useEffect(() => {
    let activo = true
    registroApi
      .resumen()
      .then((r) => {
        if (activo) setResumen(r)
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const primerNombre =
    identidad.tipo === 'listo' && identidad.yo.persona.nombre
      ? identidad.yo.persona.nombre.trim().split(/\s+/)[0]
      : null

  const orgNombre = identidad.tipo === 'listo' ? identidad.yo.organizacion.nombre : 'Organización'
  const vigentes = resumen ? resumen.confirmados + resumen.reservados : null

  return (
    <section className="inicio-wrap">
      <header className="inicio-hero">
        <div className="inicio-hero-texto">
          <div className="inicio-org-linea">
            <span className="inicio-org-nombre">{orgNombre}</span>
            <span className={`org-pill-sigla ${configOrg?.configurada ? '' : 'is-warn'}`}>
              {configOrg?.configurada ? configOrg.sigla : 'Sin sigla'}
            </span>
          </div>
          <h1>{primerNombre ? `Hola, ${primerNombre}` : 'Códigos'}</h1>
          <p className="inicio-subtitulo">
            Elige si deseas emitir un nuevo código o consultar el registro de la organización.
          </p>
        </div>

        {embebida && alAbrirAyuda && (
          <button
            type="button"
            className="btn-fantasma"
            onClick={alAbrirAyuda}
            title="Cómo funciona el motor de códigos"
          >
            <HelpCircle size={16} aria-hidden="true" />
            Guía del motor
          </button>
        )}
      </header>

      {configOrg && !configOrg.configurada && (
        <Aviso tono="warn">
          Tu organización aún no tiene sigla configurada.{' '}
          {puedeConfig ? (
            <button type="button" className="btn-link" onClick={() => ir('/catalogos/')}>
              Configurar sigla ahora
            </button>
          ) : (
            'Solicita a un administrador que defina la sigla para poder generar códigos.'
          )}
        </Aviso>
      )}

      <div className="inicio-acciones-grid">
        {puedeGenerar && (
          <button
            type="button"
            className="inicio-card is-primaria"
            onClick={() => ir('/generar/')}
          >
            <div className="inicio-card-icono is-primaria" aria-hidden="true">
              <PlusCircle size={24} />
            </div>
            <div className="inicio-card-cuerpo">
              <h2>Generar código</h2>
              <p>
                Selecciona año, proyecto, departamento, disciplina y tipo de documento con vista previa antes de
                confirmar.
              </p>
            </div>
            <span className="inicio-card-cta">
              Ir al generador
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        )}

        {puedeVerRegistro && (
          <button
            type="button"
            className="inicio-card"
            onClick={() => ir('/registro/')}
          >
            <div className="inicio-card-icono" aria-hidden="true">
              <ListChecks size={24} />
            </div>
            <div className="inicio-card-cuerpo">
              <h2>Ver registro de códigos</h2>
              <p>
                Busca por código o palabra clave, filtra por estado o proyecto, copia códigos e inspecciona su
                historial.
              </p>
            </div>
            <span className="inicio-card-cta">
              Explorar registro
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>

      <footer className="inicio-resumen-bar" aria-label="Resumen rápido">
        <div className="inicio-resumen-items">
          <div className="inicio-stat">
            <strong>{vigentes ?? '—'}</strong>
            <span>vigentes</span>
          </div>
          <span className="inicio-stat-sep" aria-hidden="true">·</span>
          <div className="inicio-stat">
            <strong>{resumen ? resumen.reservados : '—'}</strong>
            <span>reservados</span>
          </div>
          <span className="inicio-stat-sep" aria-hidden="true">·</span>
          <div className="inicio-stat">
            <strong>{resumen ? resumen.total : '—'}</strong>
            <span>totales</span>
          </div>
        </div>

        <div className="inicio-resumen-links">
          {puedeAnular && (
            <button type="button" className="inicio-link-discreto" onClick={() => ir('/anulaciones/')}>
              <Ban size={14} aria-hidden="true" />
              <span>Anulaciones</span>
              {resumen && resumen.solicitudes_pendientes > 0 && (
                <span className="nav-badge">{resumen.solicitudes_pendientes}</span>
              )}
            </button>
          )}
          {puedeConfig && (
            <button type="button" className="inicio-link-discreto" onClick={() => ir('/catalogos/')}>
              <Settings size={14} aria-hidden="true" />
              <span>Configuración</span>
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}
