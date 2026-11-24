import { useEffect, useState } from 'react'
import { obtenerOrigenShell } from '@cereipo/embed'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { integracionApi } from '../../services/integracion'

export function PanelAdministracionPage() {
  const { identidad, puede } = useIdentidad()
  const [ambitos, setAmbitos] = useState<Array<{ proyecto: string; codigo: string; nombre: string; activo: boolean }>>([])
  const [error, setError] = useState('')

  const autorizado =
    identidad.tipo === 'listo' &&
    (identidad.yo.es_admin_organizacion || puede('codigos:administracion:gestionar'))

  useEffect(() => {
    if (!autorizado) return
    const ctrl = new AbortController()
    integracionApi
      .ambitos()
      .then((r) => {
        if (!ctrl.signal.aborted) setAmbitos(r.ambitos)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [autorizado])

  if (!autorizado) {
    return (
      <section className="pagina">
        <div className="tarjeta">
          <h2>Acceso restringido</h2>
          <p className="tenue">
            Este panel requiere ser administrador de la organización o tener el permiso <code>codigos:administracion:gestionar</code>.
          </p>
        </div>
      </section>
    )
  }

  const origenShell = obtenerOrigenShell()

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Administración de Códigos</h1>
          <p className="tenue">Panel de integración, acceso y ámbitos locales de la organización (D-42).</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      {error && <p className="error">{error}</p>}

      <div className="tarjeta">
        <h2>Acceso y roles de la organización</h2>
        <p className="tenue">
          La asignación de roles (<code>administrador</code>, <code>aprobador</code>, <code>generador</code>, <code>consulta</code>)
          y permisos de las personas se administra centralmente desde la consola de Cereipo Shell.
        </p>
        {origenShell && (
          <p>
            <a className="btn btn-secundario" href={`${origenShell}/administracion/`} target="_top" rel="noreferrer">
              Abrir consola del Shell
            </a>
          </p>
        )}
      </div>

      <div className="tarjeta">
        <h2>Ámbitos propios registrados</h2>
        {ambitos.length === 0 ? (
          <p className="tenue">
            Códigos opera a nivel de toda la organización activa sin ámbitos locales restringidos.
          </p>
        ) : (
          <ul>
            {ambitos.map((a) => (
              <li key={a.codigo}>
                <code>{a.codigo}</code> · {a.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
