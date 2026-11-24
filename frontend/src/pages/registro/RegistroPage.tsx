import { useCallback, useEffect, useState } from 'react'
import { HistorialRegistro, type RegistroHistorial } from '@cereipo/ui'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { ModalAnulacion } from '../../components/ModalAnulacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { registroApi } from '../../services/registro'
import type { CodigoItem } from '../../types/registro'

export function RegistroPage() {
  const { identidad, puede } = useIdentidad()
  const [busqueda, setBusqueda] = useState(() => new URLSearchParams(window.location.search).get('codigo') ?? '')
  const [busquedaAplicada, setBusquedaAplicada] = useState(busqueda)
  const [estado, setEstado] = useState('')
  const [origen, setOrigen] = useState('')
  const [creadoPor, setCreadoPor] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [incluirAnulados, setIncluirAnulados] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<{ total: number; paginas: number; resultados: CodigoItem[] }>({
    total: 0,
    paginas: 1,
    resultados: [],
  })
  const [detalle, setDetalle] = useState<{ codigo: CodigoItem; historial: RegistroHistorial[] } | null>(null)
  const [modal, setModal] = useState<{ item: CodigoItem; modo: 'anular' | 'solicitar' } | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setBusquedaAplicada(busqueda), 250)
    return () => window.clearTimeout(id)
  }, [busqueda])

  const cargar = useCallback((signal?: AbortSignal) => {
    setError('')
    registroApi
      .listar(
        {
          codigo: busquedaAplicada,
          estado,
          origen,
          creado_por: creadoPor,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          incluir_anulados: incluirAnulados,
          pagina,
        },
        signal,
      )
      .then((r) => setDatos({ total: r.total, paginas: r.paginas, resultados: r.resultados }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
  }, [busquedaAplicada, estado, origen, creadoPor, fechaInicio, fechaFin, incluirAnulados, pagina])

  useEffect(() => {
    const ctrl = new AbortController()
    cargar(ctrl.signal)
    return () => ctrl.abort()
  }, [cargar])

  const personaId = identidad.tipo === 'listo' ? identidad.yo.persona.id : ''
  const esAprobador = puede('codigos:codigos:anular')
  const puedeGenerar = puede('codigos:codigos:generar')

  async function verDetalle(id: string) {
    try {
      setDetalle(await registroApi.detalle(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmarModal(motivo: string) {
    if (!modal) return
    if (modal.modo === 'anular') {
      await registroApi.anular(modal.item.id, motivo)
      setMensaje(`Código ${modal.item.codigo} anulado.`)
    } else {
      await registroApi.solicitarAnulacion(modal.item.id, motivo)
      setMensaje(`Solicitud de anulación enviada para ${modal.item.codigo}.`)
    }
    setModal(null)
    cargar()
    if (detalle?.codigo.id === modal.item.id) {
      verDetalle(modal.item.id)
    }
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Registro de códigos</h1>
          <p className="tenue">Consulta códigos generados manualmente o vía API automática, su estado y su historial.</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      <div className="tarjeta">
        <div className="filtros-registro">
          <input
            type="search"
            placeholder="Buscar código…"
            value={busqueda}
            onChange={(e) => {
              setPagina(1)
              setBusqueda(e.target.value)
            }}
          />
          <select
            value={origen}
            onChange={(e) => {
              setPagina(1)
              setOrigen(e.target.value)
            }}
          >
            <option value="">Todos los orígenes</option>
            <option value="manual">Manual (programa)</option>
            <option value="api">Automático (API)</option>
          </select>
          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => {
              setPagina(1)
              setEstado(e.target.value)
            }}
          >
            <option value="">Todos los estados</option>
            <option value="confirmado">Confirmado</option>
            <option value="reservado">Reservado</option>
            <option value="anulado">Anulado</option>
          </select>
          <input
            type="text"
            aria-label="Filtrar por usuario creador"
            placeholder="Usuario creador…"
            value={creadoPor}
            onChange={(e) => {
              setPagina(1)
              setCreadoPor(e.target.value)
            }}
          />
          <input
            type="date"
            aria-label="Fecha desde"
            value={fechaInicio}
            onChange={(e) => {
              setPagina(1)
              setFechaInicio(e.target.value)
            }}
          />
          <input
            type="date"
            aria-label="Fecha hasta"
            value={fechaFin}
            onChange={(e) => {
              setPagina(1)
              setFechaFin(e.target.value)
            }}
          />
          <label className="check-linea">
            <input
              type="checkbox"
              checked={estado === 'anulado' || incluirAnulados}
              disabled={estado !== ''}
              onChange={(e) => {
                setPagina(1)
                setIncluirAnulados(e.target.checked)
              }}
            />
            <span>Mostrar anulados</span>
          </label>
        </div>

        {mensaje && <p className="ok">{mensaje}</p>}
        {error && <p className="error">{error}</p>}

        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Motivo</th>
                <th>Responsable</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos.resultados.map((c) => {
                const puedeAnularDirecto = c.estado !== 'anulado' && (esAprobador || (puedeGenerar && c.creado_por_persona_id === personaId))
                const puedeSolicitar = c.estado !== 'anulado' && !puedeAnularDirecto && puedeGenerar && !c.tiene_solicitud_pendiente
                return (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="btn-enlace" onClick={() => verDetalle(c.id)}>
                        <code>{c.codigo}</code>
                      </button>
                    </td>
                    <td><span className={`pill pill-${c.estado}`}>{c.estado}</span></td>
                    <td>{c.origen === 'api' ? `API (${c.app_origen || 'servicio'})` : 'Manual'}</td>
                    <td>{c.motivo}</td>
                    <td>{c.creado_por_nombre || '—'}</td>
                    <td>{new Date(c.fecha_creacion).toLocaleDateString('es-VE')}</td>
                    <td className="celda-acciones">
                      {puedeAnularDirecto && (
                        <button type="button" className="btn btn-sm btn-peligro" onClick={() => setModal({ item: c, modo: 'anular' })}>
                          Anular
                        </button>
                      )}
                      {puedeSolicitar && (
                        <button type="button" className="btn btn-sm btn-secundario" onClick={() => setModal({ item: c, modo: 'solicitar' })}>
                          Solicitar anulación
                        </button>
                      )}
                      {c.tiene_solicitud_pendiente && <span className="tenue">Solicitud pendiente</span>}
                    </td>
                  </tr>
                )
              })}
              {datos.resultados.length === 0 && (
                <tr>
                  <td colSpan={7} className="tenue" style={{ textAlign: 'center' }}>
                    Sin códigos que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="fila-entre" style={{ marginTop: '0.75rem' }}>
          <span className="tenue">Total: {datos.total}</span>
          <div className="fila-botones">
            <button type="button" className="btn btn-secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </button>
            <span>Página {pagina} de {datos.paginas}</span>
            <button type="button" className="btn btn-secundario" disabled={pagina >= datos.paginas} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {detalle && (
        <div className="tarjeta">
          <div className="fila-entre">
            <h2>Detalle: <code>{detalle.codigo.codigo}</code></h2>
            <button type="button" className="btn btn-secundario" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
          <p><strong>Motivo:</strong> {detalle.codigo.motivo}</p>
          {detalle.codigo.referencia_externa && <p><strong>Referencia externa:</strong> {detalle.codigo.referencia_externa}</p>}
          {detalle.codigo.motivo_anulacion && <p className="error"><strong>Motivo de anulación:</strong> {detalle.codigo.motivo_anulacion}</p>}
          <h3>Historial</h3>
          <HistorialRegistro registros={detalle.historial} />
        </div>
      )}

      {modal && (
        <ModalAnulacion
          codigo={modal.item.codigo}
          modo={modal.modo}
          alCerrar={() => setModal(null)}
          alConfirmar={confirmarModal}
        />
      )}
    </section>
  )
}
