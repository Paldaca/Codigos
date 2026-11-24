import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { useAvisos } from '../context/AvisosContext'
import { catalogosApi, type HistorialSegmentoItem } from '../services/catalogos'
import type { InstantaneaCatalogoItem, TipoSegmento } from '../types/catalogos'
import { Aviso, Boton, Dialogo, Etiqueta } from '../ui/componentes'

type HistorialCatalogoModalProps = {
  abierto: boolean
  tipoFiltro: TipoSegmento | ''
  alCerrar: () => void
  alRevertir: () => void
}

export function HistorialCatalogoModal({
  abierto,
  tipoFiltro,
  alCerrar,
  alRevertir,
}: HistorialCatalogoModalProps) {
  const { notificar } = useAvisos()
  const [pestana, setPestana] = useState<'cambios' | 'instantaneas'>('cambios')
  const [cambios, setCambios] = useState<HistorialSegmentoItem[]>([])
  const [instantaneas, setInstantaneas] = useState<InstantaneaCatalogoItem[]>([])
  const [cargando, setCargando] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    if (!abierto) return
    setCargando(true)
    setError('')
    Promise.all([catalogosApi.listarHistorial(tipoFiltro), catalogosApi.listarInstantaneas()])
      .then(([h, snaps]) => {
        setCambios(h.resultados)
        setInstantaneas(snaps.resultados)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false))
  }, [abierto, tipoFiltro])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function revertirEvento(item: HistorialSegmentoItem) {
    setError('')
    setProcesandoId(`h-${item.id}`)
    try {
      if (item.instantanea_id) {
        await catalogosApi.restaurarInstantanea(item.instantanea_id)
        notificar('Estado restaurado', 'El catálogo volvió al estado previo a esa acción.', 'ok')
      } else {
        const r = await catalogosApi.revertirCambio(item.id)
        notificar('Cambio revertido', `${r.segmento.codigo} · ${r.segmento.nombre}`, 'ok')
      }
      alRevertir()
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProcesandoId(null)
    }
  }

  async function restaurarSnap(snap: InstantaneaCatalogoItem) {
    setError('')
    setProcesandoId(`s-${snap.id}`)
    try {
      const r = await catalogosApi.restaurarInstantanea(snap.id)
      notificar('Instantánea restaurada', `${r.restaurados} elemento(s) sincronizados.`, 'ok')
      alRevertir()
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      tamano="lg"
      titulo="Historial y reversión del esquema"
      descripcion="Deshaz cambios individuales en segmentos o restaura el catálogo completo a un punto anterior."
      acciones={
        <Boton variante="primary" onClick={alCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'cambios'}
            className="tab"
            onClick={() => setPestana('cambios')}
          >
            Cambios recientes ({cambios.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'instantaneas'}
            className="tab"
            onClick={() => setPestana('instantaneas')}
          >
            Puntos de restauración ({instantaneas.length})
          </button>
        </div>

        {error && <Aviso tono="error">{error}</Aviso>}
        {cargando && <div className="esqueleto" style={{ height: 140 }} />}

        {!cargando && pestana === 'cambios' && (
          <div className="historial-lista">
            {cambios.length === 0 && (
              <Aviso tono="muted">No hay modificaciones registradas todavía en este catálogo.</Aviso>
            )}
            {cambios.map((item) => {
              const tono =
                item.accion === 'creado'
                  ? 'ok'
                  : item.accion === 'revertido'
                    ? 'info'
                    : item.accion === 'restablecer_plantilla'
                      ? 'warn'
                      : 'muted'
              return (
                <div key={item.id} className="historial-card">
                  <div className="historial-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Etiqueta tono={tono}>{item.accion}</Etiqueta>
                      <strong>{item.objeto_texto || item.resumen}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <small className="tenue">{new Date(item.creado_en).toLocaleString('es-VE')}</small>
                      {item.reversible && (
                        <Boton
                          variante="secondary"
                          tamano="sm"
                          cargando={procesandoId === `h-${item.id}`}
                          disabled={procesandoId !== null}
                          onClick={() => revertirEvento(item)}
                        >
                          <RotateCcw aria-hidden="true" />
                          Revertir
                        </Boton>
                      )}
                    </div>
                  </div>
                  {item.resumen && <p className="tenue" style={{ fontSize: 13 }}>{item.resumen}</p>}
                  {item.cambios.length > 0 && (
                    <div className="historial-cambios-grid">
                      {item.cambios.map((c, idx) => (
                        <span key={idx} className="historial-cambio-pill">
                          <b>{c.etiqueta || c.campo}:</b>{' '}
                          <span className="tenue">{String(c.antes ?? '—')}</span> →{' '}
                          <span>{String(c.despues ?? '—')}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <small className="tenue">
                    Por {item.actor?.nombre || 'Sistema'}
                    {item.motivo ? ` · Motivo: ${item.motivo}` : ''}
                  </small>
                </div>
              )
            })}
          </div>
        )}

        {!cargando && pestana === 'instantaneas' && (
          <div className="historial-lista">
            {instantaneas.length === 0 && (
              <Aviso tono="muted">
                Los puntos de restauración se crean automáticamente antes de restablecer la plantilla o ejecutar cambios
                en lote.
              </Aviso>
            )}
            {instantaneas.map((s) => (
              <div key={s.id} className="historial-card">
                <div className="historial-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="icon-badge icon-badge-sm">
                      <History aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{s.descripcion}</strong>
                      <div className="tenue" style={{ fontSize: 12 }}>
                        {s.total_segmentos} segmentos guardados · Por {s.actor_nombre} ·{' '}
                        {new Date(s.creado_en).toLocaleString('es-VE')}
                      </div>
                    </div>
                  </div>
                  <Boton
                    variante="secondary"
                    tamano="sm"
                    cargando={procesandoId === `s-${s.id}`}
                    disabled={procesandoId !== null}
                    onClick={() => restaurarSnap(s)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Restaurar
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialogo>
  )
}
