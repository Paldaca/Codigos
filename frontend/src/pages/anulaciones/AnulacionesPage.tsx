import { useCallback, useEffect, useState } from 'react'
import { Check, Inbox, X } from 'lucide-react'
import { useAvisos } from '../../context/AvisosContext'
import { registroApi } from '../../services/registro'
import type { SolicitudAnulacionItem } from '../../types/registro'
import { Aviso, Boton, Dialogo, Etiqueta } from '../../ui/componentes'

export function AnulacionesPage() {
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
    <section className="pagina-clean">
      <header className="cabecera-clean">
        <div>
          <h1>Anulaciones</h1>
          <p className="tenue">Aprueba o rechaza las solicitudes de anulación de tu organización.</p>
        </div>

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
            Historial
          </button>
        </div>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="surface-clean">
        <div className="table-wrap table-clean-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Solicitante</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => {
                const tono = s.estado === 'aprobada' ? 'ok' : s.estado === 'pendiente' ? 'warn' : 'danger'
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="codigo-texto">{s.codigo}</span>
                    </td>
                    <td>
                      <div className="celda-meta">
                        <span>{s.solicitante_nombre || s.solicitante_persona_id}</span>
                        <small className="mono">{new Date(s.fecha_solicitud).toLocaleDateString('es-VE')}</small>
                      </div>
                    </td>
                    <td className="principal">{s.motivo}</td>
                    <td>
                      <Etiqueta tono={tono} punto>
                        {s.estado}
                      </Etiqueta>
                    </td>
                    <td className="num">
                      <div className="celda-acciones" style={{ justifyContent: 'flex-end' }}>
                        {s.estado === 'pendiente' ? (
                          <>
                            <Boton
                              variante="danger"
                              tamano="sm"
                              disabled={procesandoId === s.id}
                              onClick={() => setConfirmando(s)}
                            >
                              <Check aria-hidden="true" />
                              Aprobar
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
                  <td colSpan={5}>
                    <div className="vacio">
                      <span className="icon-badge">
                        <Inbox aria-hidden="true" />
                      </span>
                      <p className="vacio-titulo">Sin solicitudes en esta vista</p>
                      <p className="vacio-texto">Las solicitudes de anulación aparecerán aquí para revisión.</p>
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
        titulo={confirmando ? `Anular ${confirmando.codigo}` : ''}
        descripcion="Esta acción es irreversible y el consecutivo no se reutilizará."
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
                {procesandoId === confirmando.id ? 'Aprobando…' : `Sí, anular ${confirmando.codigo}`}
              </Boton>
            </>
          )
        }
      >
        {confirmando && (
          <Aviso tono="warn">
            <strong>Motivo:</strong> {confirmando.motivo}
          </Aviso>
        )}
      </Dialogo>
    </section>
  )
}
