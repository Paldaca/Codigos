import { useEffect, useState } from 'react'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { integracionApi } from '../../services/integracion'

export function PanelAdministracionPage() {
  const { identidad, puede } = useIdentidad()
  const [ambitos, setAmbitos] = useState<Array<{ proyecto: string; codigo: string; nombre: string; activo: boolean }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    integracionApi
      .ambitos()
      .then((r) => setAmbitos(r.ambitos))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const autorizado =
    identidad.tipo === 'listo' &&
    (identidad.yo.es_admin_organizacion || puede('codigos:administracion:gestionar'))

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

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Administración de Códigos</h1>
          <p className="tenue">Panel de integración y ámbitos locales de la organización (D-42).</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      {error && <p className="error">{error}</p>}

      <div className="tarjeta">
        <h2>Ámbitos propios registrados</h2>
        {ambitos.length === 0 ? (
          <p className="tenue">
            Códigos opera a nivel de toda la organización activa sin ámbitos locales restringidos. Los roles y accesos se asignan desde la consola del Shell.
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
