import { useEffect, useState } from 'react'
import { ExternalLink, Shield } from 'lucide-react'
import { obtenerOrigenShell } from '@cereipo/embed'
import { BotonAyuda } from '../../components/BotonAyuda'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { integracionApi } from '../../services/integracion'
import { Aviso } from '../../ui/componentes'
import { orden } from '../../ui/movimiento'

export function PanelAdministracionPage({ alAbrirAyuda }: { alAbrirAyuda?: () => void }) {
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
        <Aviso tono="warn">
          Este panel requiere ser administrador de la organización o tener el permiso{' '}
          <code>codigos:administracion:gestionar</code>.
        </Aviso>
      </section>
    )
  }

  const origenShell = obtenerOrigenShell()

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Administración de Códigos</h1>
            <BotonAyuda
              titulo="Integración con Cereipo Shell"
              texto="Los roles, permisos y usuarios se administran de forma centralizada desde Cereipo Shell para toda la suite."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">Panel de integración, acceso y ámbitos locales de la organización.</p>
        </div>
        <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="card tarjeta-generador rev" style={orden(1)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span className="icon-badge">
            <Shield aria-hidden="true" />
          </span>
          <div style={{ display: 'grid', gap: 10 }}>
            <h2 className="panel-titulo">Acceso y roles de la organización</h2>
            <p className="tenue">
              La asignación de roles (<code>administrador</code>, <code>aprobador</code>, <code>generador</code>,{' '}
              <code>consulta</code>) y permisos de las personas se administra centralmente desde la consola de Cereipo
              Shell.
            </p>
            {origenShell && (
              <div>
                <a className="btn btn-secondary btn-sm" href={`${origenShell}/administracion/`} target="_top" rel="noreferrer">
                  Abrir consola del Shell
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card tarjeta-generador rev" style={orden(2)}>
        <h2 className="panel-titulo" style={{ marginBottom: 8 }}>
          Ámbitos propios registrados
        </h2>
        {ambitos.length === 0 ? (
          <p className="tenue">
            Códigos opera a nivel de toda la organización activa sin ámbitos locales restringidos.
          </p>
        ) : (
          <ul style={{ display: 'grid', gap: 8 }}>
            {ambitos.map((a) => (
              <li key={a.codigo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="code-chip">{a.codigo}</span>
                <span>{a.nombre}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
