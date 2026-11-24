import { useCallback, useEffect, useState } from 'react'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { registroApi } from '../../services/registro'
import type { SolicitudAnulacionItem } from '../../types/registro'

export function AnulacionesPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAnulacionItem[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState<'pendiente' | ''>('pendiente')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(() => {
    registroApi
      .listarSolicitudes(estadoFiltro)
      .then((r) => setSolicitudes(r.resultados))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [estadoFiltro])

  useEffect(cargar, [cargar])

  async function resolver(id: number, accion: 'aprobar' | 'rechazar') {
    setError('')
    try {
      await registroApi.resolverSolicitud(id, accion)
      setMensaje(accion === 'aprobar' ? 'Solicitud aprobada y código anulado.' : 'Solicitud rechazada.')
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Bandeja de anulaciones</h1>
          <p className="tenue">Aprueba o rechaza las solicitudes de anulación de tu organización.</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      <div className="tarjeta">
        <div className="fila-botones" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn ${estadoFiltro === 'pendiente' ? 'btn-primario' : 'btn-secundario'}`}
            onClick={() => setEstadoFiltro('pendiente')}
          >
            Pendientes
          </button>
          <button
            type="button"
            className={`btn ${estadoFiltro === '' ? 'btn-primario' : 'btn-secundario'}`}
            onClick={() => setEstadoFiltro('')}
          >
            Todas
          </button>
        </div>

        {mensaje && <p className="ok">{mensaje}</p>}
        {error && <p className="error">{error}</p>}

        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Solicitante</th>
                <th>Motivo de solicitud</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.codigo}</code></td>
                  <td>{s.solicitante_nombre || s.solicitante_persona_id}</td>
                  <td>{s.motivo}</td>
                  <td><span className={`pill pill-${s.estado}`}>{s.estado}</span></td>
                  <td>{new Date(s.fecha_solicitud).toLocaleDateString('es-VE')}</td>
                  <td className="celda-acciones">
                    {s.estado === 'pendiente' ? (
                      <>
                        <button type="button" className="btn btn-sm btn-peligro" onClick={() => resolver(s.id, 'aprobar')}>
                          Aprobar anulación
                        </button>
                        <button type="button" className="btn btn-sm btn-secundario" onClick={() => resolver(s.id, 'rechazar')}>
                          Rechazar
                        </button>
                      </>
                    ) : (
                      <span className="tenue">{s.resuelto_por_nombre || 'Procesada'}</span>
                    )}
                  </td>
                </tr>
              ))}
              {solicitudes.length === 0 && (
                <tr>
                  <td colSpan={6} className="tenue" style={{ textAlign: 'center' }}>
                    No hay solicitudes en esta vista.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
