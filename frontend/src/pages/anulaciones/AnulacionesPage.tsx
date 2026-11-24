import { useCallback, useEffect, useState } from 'react'
import { Check, Inbox, X } from 'lucide-react'
import { BotonAyuda } from '../../components/BotonAyuda'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useAvisos } from '../../context/AvisosContext'
import { registroApi } from '../../services/registro'
import type { SolicitudAnulacionItem } from '../../types/registro'
import { Aviso, Boton, Dialogo, Etiqueta } from '../../ui/componentes'
import { orden } from '../../ui/movimiento'

export function AnulacionesPage({ alAbrirAyuda }: { alAbrirAyuda?: () => void }) {
  const { notificar } = useAvisos()
  const [solicitudes, setSolicitudes] = useState<SolicitudAnulacionItem[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState<'pendiente' | ''>('pendiente')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<SolicitudAnulacionItem | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(
    (signal?: AbortSignal) => {
      registroApi
        .listarSolicitudes(estadoFiltro, signal)
        .then((r) => setSolicitudes(r.resultados))
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : String(e))
        })
    },
    [estadoFiltro],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    cargar(ctrl.signal)
    return () => ctrl.abort()
  }, [cargar])

  async function resolver(id: number, accion: 'aprobar' | 'rechazar', codigo: string) {
    setError('')
    setProcesandoId(id)
    try {
      await registroApi.resolverSolicitud(id, accion)
      notificar(
        accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        accion === 'aprobar' ? `${codigo} quedó anulado.` : `Se mantuvo vigente ${codigo}.`,
        accion === 'aprobar' ? 'warn' : 'info',
      )
      setConfirmando(null)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Bandeja de anulaciones</h1>
            <BotonAyuda
              titulo="Solicitudes de anulación"
              texto="Cuando un usuario solicita anular un código creado por otra persona, la solicitud llega aquí para aprobación. Anular un código nunca reutiliza su consecutivo."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">Aprueba o rechaza las solicitudes de anulación de tu organización.</p>
        </div>
        <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
      </header>

      <div className="card tarjeta-bloque rev" style={orden(1)}>
        <div className="registro-toolbar">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={estadoFiltro === 'pendiente'}
              className="tab"
              onClick={() => setEstadoFiltro('pendiente')}
            >
              Pendientes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={estadoFiltro === ''}
              className="tab"
              onClick={() => setEstadoFiltro('')}
            >
              Todas
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0 20px 14px' }}>
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        <div className="table-wrap" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Solicitante</th>
                <th>Motivo de solicitud</th>
                <th>Estado</th>
                <th className="num">Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => {
                const tono = s.estado === 'aprobada' ? 'ok' : s.estado === 'pendiente' ? 'warn' : 'danger'
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="code-chip">{s.codigo}</span>
                    </td>
                    <td>{s.solicitante_nombre || s.solicitante_persona_id}</td>
                    <td className="principal">{s.motivo}</td>
                    <td>
                      <Etiqueta tono={tono} punto>
                        {s.estado}
                      </Etiqueta>
                    </td>
                    <td className="num mono">{new Date(s.fecha_solicitud).toLocaleDateString('es-VE')}</td>
                    <td>
                      <div className="celda-acciones">
                        {s.estado === 'pendiente' ? (
                          <>
                            <Boton
                              variante="danger"
                              tamano="sm"
                              disabled={procesandoId === s.id}
                              onClick={() => setConfirmando(s)}
                            >
                              <Check aria-hidden="true" />
                              Aprobar anulación
                            </Boton>
                            <Boton
                              variante="secondary"
                              tamano="sm"
                              disabled={procesandoId === s.id}
                              onClick={() => resolver(s.id, 'rechazar', s.codigo)}
                            >
                              <X aria-hidden="true" />
                              Rechazar
                            </Boton>
                          </>
                        ) : (
                          <span className="tenue">{s.resuelto_por_nombre || 'Procesada'}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {solicitudes.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="vacio">
                      <span className="icon-badge">
                        <Inbox aria-hidden="true" />
                      </span>
                      <p className="vacio-titulo">No hay solicitudes en esta vista</p>
                      <p className="vacio-texto">Cuando alguien solicite anular un código, aparecerá aquí.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialogo
        abierto={Boolean(confirmando)}
        alCerrar={() => setConfirmando(null)}
        titulo={confirmando ? `Aprobar anulación de ${confirmando.codigo}` : ''}
        descripcion="Esta acción es irreversible y bloqueará el consecutivo de forma permanente."
        acciones={
          confirmando && (
            <>
              <Boton variante="secondary" onClick={() => setConfirmando(null)} disabled={procesandoId === confirmando.id}>
                Cancelar
              </Boton>
              <Boton
                variante="danger"
                cargando={procesandoId === confirmando.id}
                disabled={procesandoId === confirmando.id}
                onClick={() => resolver(confirmando.id, 'aprobar', confirmando.codigo)}
              >
                {procesandoId === confirmando.id ? 'Aprobando…' : `Anular ${confirmando.codigo}`}
              </Boton>
            </>
          )
        }
      >
        {confirmando && (
          <Aviso tono="warn">
            <strong>Motivo reportado por {confirmando.solicitante_nombre || 'usuario'}:</strong> {confirmando.motivo}
          </Aviso>
        )}
      </Dialogo>
    </section>
  )
}
