import { useCallback, useEffect, useMemo, useState } from 'react'
import { HistorialRegistro, type RegistroHistorial } from '@cereipo/ui'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  FolderSearch,
  PlusCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { BotonAyuda } from '../../components/BotonAyuda'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { ModalAnulacion } from '../../components/ModalAnulacion'
import { esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import { registroApi } from '../../services/registro'
import type { CatalogosAgrupados } from '../../types/catalogos'
import type { CodigoItem } from '../../types/registro'
import { Aviso, Boton, Casilla, Dialogo, Etiqueta } from '../../ui/componentes'
import { orden } from '../../ui/movimiento'

export function RegistroPage({
  ir,
  alAbrirAyuda,
}: {
  ir?: (ruta: string) => void
  alAbrirAyuda?: () => void
}) {
  const { identidad, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const [busqueda, setBusqueda] = useState(() => new URLSearchParams(window.location.search).get('codigo') ?? '')
  const [busquedaAplicada, setBusquedaAplicada] = useState(busqueda)
  const [estado, setEstado] = useState('')
  const [origen, setOrigen] = useState('')
  const [numeroProyecto, setNumeroProyecto] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [creadoPor, setCreadoPor] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [incluirAnulados, setIncluirAnulados] = useState(false)
  const [mostrarAvanzados, setMostrarAvanzados] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [datos, setDatos] = useState<{ total: number; paginas: number; resultados: CodigoItem[] }>({
    total: 0,
    paginas: 1,
    resultados: [],
  })
  const [detalle, setDetalle] = useState<{ codigo: CodigoItem; historial: RegistroHistorial[] } | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [modal, setModal] = useState<{ item: CodigoItem; modo: 'anular' | 'solicitar' } | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setBusquedaAplicada(busqueda), 240)
    return () => window.clearTimeout(id)
  }, [busqueda])

  useEffect(() => {
    const ctrl = new AbortController()
    catalogosApi
      .listarSegmentos(false, ctrl.signal)
      .then((r) => setCatalogos(r.segmentos))
      .catch(() => {
        // Los nombres de catálogo enriquecen el inspector; si no están, igual funciona.
      })
    return () => ctrl.abort()
  }, [])

  const cargar = useCallback(
    (signal?: AbortSignal) => {
      setError('')
      setCargando(true)
      registroApi
        .listar(
          {
            codigo: busquedaAplicada,
            estado,
            origen,
            numero_proyecto: numeroProyecto,
            disciplina,
            tipo_documento: tipoDocumento,
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
        .finally(() => {
          if (!signal?.aborted) setCargando(false)
        })
    },
    [
      busquedaAplicada,
      estado,
      origen,
      numeroProyecto,
      disciplina,
      tipoDocumento,
      creadoPor,
      fechaInicio,
      fechaFin,
      incluirAnulados,
      pagina,
    ],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    cargar(ctrl.signal)
    return () => ctrl.abort()
  }, [cargar])

  const personaId = identidad.tipo === 'listo' ? identidad.yo.persona.id : ''
  const esAprobador = puede('codigos:codigos:anular')
  const puedeGenerar = puede('codigos:codigos:generar')

  const filtrosActivosCount = useMemo(() => {
    return [estado, origen, numeroProyecto, disciplina, tipoDocumento, creadoPor, fechaInicio, fechaFin].filter(Boolean)
      .length + (incluirAnulados && estado === '' ? 1 : 0)
  }, [estado, origen, numeroProyecto, disciplina, tipoDocumento, creadoPor, fechaInicio, fechaFin, incluirAnulados])

  function limpiarFiltros() {
    setBusqueda('')
    setBusquedaAplicada('')
    setEstado('')
    setOrigen('')
    setNumeroProyecto('')
    setDisciplina('')
    setTipoDocumento('')
    setCreadoPor('')
    setFechaInicio('')
    setFechaFin('')
    setIncluirAnulados(false)
    setPagina(1)
  }

  async function copiarCodigo(item: CodigoItem) {
    try {
      await navigator.clipboard.writeText(item.codigo)
      setCopiadoId(item.id)
      notificar('Código copiado', item.codigo, 'ok')
      window.setTimeout(() => setCopiadoId((p) => (p === item.id ? null : p)), 1800)
    } catch {
      notificar('No se pudo copiar', 'Copia el código manualmente.', 'warn')
    }
  }

  async function verDetalle(id: string) {
    setCargandoDetalle(true)
    try {
      setDetalle(await registroApi.detalle(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function confirmarModal(motivo: string) {
    if (!modal) return
    if (modal.modo === 'anular') {
      await registroApi.anular(modal.item.id, motivo)
      notificar('Código anulado', `${modal.item.codigo} quedó marcado como anulado.`, 'warn')
    } else {
      await registroApi.solicitarAnulacion(modal.item.id, motivo)
      notificar('Solicitud enviada', `Se notificó a los aprobadores sobre ${modal.item.codigo}.`, 'info')
    }
    setModal(null)
    cargar()
    if (detalle?.codigo.id === modal.item.id) {
      verDetalle(modal.item.id)
    }
  }

  function nombreSegmento(tipo: keyof CatalogosAgrupados, codigo: string): string {
    const encontrado = catalogos?.[tipo]?.find((s) => s.codigo === codigo)
    return encontrado?.nombre ?? codigo
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Registro de códigos de la organización</h1>
            <BotonAyuda
              titulo="Registro único e historial"
              texto="Aquí viven todos los códigos generados manualmente o reservados por otras apps de Cereipo. Por defecto se ocultan los anulados; activa «Anulados» para auditarlos."
              destacado="Los códigos con Proyecto 00 (y Subproyecto 0/00) son códigos generales que no pertenecen a ningún proyecto."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">
            Consulta, filtra, copia e inspecciona los códigos emitidos de toda tu organización.
          </p>
        </div>

        <div className="cabecera-acciones">
          <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
          {puedeGenerar && ir && (
            <Boton variante="primary" tamano="sm" onClick={() => ir('/generar/')}>
              <PlusCircle aria-hidden="true" />
              Nuevo código
            </Boton>
          )}
        </div>
      </header>

      <div className="card tarjeta-bloque rev" style={orden(1)}>
        {/* Barra superior de búsqueda y chips rápidos */}
        <div className="registro-toolbar">
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por código (ej. CER-26-00)…"
              aria-label="Buscar por código"
              value={busqueda}
              onChange={(e) => {
                setPagina(1)
                setBusqueda(e.target.value)
              }}
            />
            {busqueda && (
              <button
                type="button"
                className="btn-icono btn-icono-sm"
                onClick={() => {
                  setBusqueda('')
                  setPagina(1)
                }}
                aria-label="Limpiar búsqueda"
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="registro-chips" role="group" aria-label="Filtros rápidos">
            {[
              { valor: '', etiqueta: 'Vigentes' },
              { valor: 'confirmado', etiqueta: 'Confirmados' },
              { valor: 'reservado', etiqueta: 'Reservados' },
              { valor: 'anulado', etiqueta: 'Anulados' },
            ].map((op) => (
              <button
                key={op.valor || 'todos'}
                type="button"
                className={`chip ${estado === op.valor ? 'is-on' : ''}`}
                onClick={() => {
                  setPagina(1)
                  setEstado(op.valor)
                }}
              >
                {op.etiqueta}
              </button>
            ))}

            <BotonAyuda
              titulo="Estados del código"
              texto="Confirmado: emitido y activo. Reservado: apartado vía API antes de emitirse el documento. Anulado: invalidado con motivo; su consecutivo nunca se reutiliza."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />

            <span className="chips-sep" aria-hidden="true" />

            <button
              type="button"
              className={`chip ${numeroProyecto === '00' ? 'is-on' : ''}`}
              onClick={() => {
                setPagina(1)
                setNumeroProyecto((p) => (p === '00' ? '' : '00'))
              }}
              title="Filtrar solo códigos generales que no pertenecen a ningún proyecto"
            >
              <Building2 size={14} aria-hidden="true" />
              Generales (00)
            </button>

            <button
              type="button"
              className={`chip ${origen === 'manual' ? 'is-on' : ''}`}
              onClick={() => {
                setPagina(1)
                setOrigen((o) => (o === 'manual' ? '' : 'manual'))
              }}
            >
              Manual
            </button>
            <button
              type="button"
              className={`chip ${origen === 'api' ? 'is-on' : ''}`}
              onClick={() => {
                setPagina(1)
                setOrigen((o) => (o === 'api' ? '' : 'api'))
              }}
            >
              API
            </button>
          </div>

          <div className="registro-toolbar-der">
            <Boton
              variante="secondary"
              tamano="sm"
              onClick={() => setMostrarAvanzados((v) => !v)}
              aria-expanded={mostrarAvanzados}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filtros
              {filtrosActivosCount > 0 && <span className="badge-conteo">{filtrosActivosCount}</span>}
            </Boton>
            {(filtrosActivosCount > 0 || busqueda) && (
              <Boton variante="ghost" tamano="sm" onClick={limpiarFiltros}>
                <RotateCcw aria-hidden="true" />
                Limpiar
              </Boton>
            )}
          </div>
        </div>

        {/* Filtros avanzados colapsables */}
        {mostrarAvanzados && (
          <div className="filtros-avanzados">
            <label className="field">
              <span className="field-label">Proyecto (NN)</span>
              <select
                value={numeroProyecto}
                onChange={(e) => {
                  setPagina(1)
                  setNumeroProyecto(e.target.value)
                }}
              >
                <option value="">Todos los proyectos</option>
                {(catalogos?.proyecto ?? []).map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} · {p.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Disciplina</span>
              <select
                value={disciplina}
                onChange={(e) => {
                  setPagina(1)
                  setDisciplina(e.target.value)
                }}
              >
                <option value="">Todas</option>
                {(catalogos?.disciplina ?? []).map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.codigo} · {d.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Tipo de documento</span>
              <select
                value={tipoDocumento}
                onChange={(e) => {
                  setPagina(1)
                  setTipoDocumento(e.target.value)
                }}
              >
                <option value="">Todos</option>
                {(catalogos?.tipo_documento ?? []).map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.codigo} · {t.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Responsable</span>
              <input
                type="text"
                placeholder="Nombre del creador…"
                value={creadoPor}
                onChange={(e) => {
                  setPagina(1)
                  setCreadoPor(e.target.value)
                }}
              />
            </label>

            <label className="field">
              <span className="field-label">Desde</span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setPagina(1)
                  setFechaInicio(e.target.value)
                }}
              />
            </label>

            <label className="field">
              <span className="field-label">Hasta</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setPagina(1)
                  setFechaFin(e.target.value)
                }}
              />
            </label>

            <div className="filtro-casilla-wrap">
              <Casilla
                checked={estado === 'anulado' || incluirAnulados}
                disabled={estado !== ''}
                onChange={(e) => {
                  setPagina(1)
                  setIncluirAnulados(e.target.checked)
                }}
              >
                Incluir códigos anulados
              </Casilla>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '0 20px 14px' }}>
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        {/* Tabla */}
        <div className="table-wrap" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estado</th>
                <th>Alcance</th>
                <th>Origen</th>
                <th>Motivo / Asunto</th>
                <th>Responsable</th>
                <th className="num">Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                datos.resultados.length === 0 &&
                [0, 1, 2, 3, 4].map((n) => (
                  <tr key={n}>
                    <td colSpan={8}>
                      <div className="esqueleto" style={{ height: 22 }} />
                    </td>
                  </tr>
                ))}

              {!cargando &&
                datos.resultados.map((c, idx) => {
                  const puedeAnularDirecto =
                    c.estado !== 'anulado' &&
                    (esAprobador || (puedeGenerar && c.creado_por_persona_id === personaId))
                  const puedeSolicitar =
                    c.estado !== 'anulado' && !puedeAnularDirecto && puedeGenerar && !c.tiene_solicitud_pendiente
                  const esGeneral = esValorGeneral(c.numero_proyecto)
                  const tonoEstado = c.estado === 'confirmado' ? 'ok' : c.estado === 'reservado' ? 'info' : 'danger'

                  return (
                    <tr key={c.id} className="fila-animada" style={{ '--i': Math.min(idx, 10) } as React.CSSProperties}>
                      <td>
                        <div className="celda-codigo">
                          <button
                            type="button"
                            className="code-chip"
                            onClick={() => verDetalle(c.id)}
                            title="Inspeccionar segmentos e historial"
                          >
                            {c.codigo}
                          </button>
                          <button
                            type="button"
                            className="btn-icono btn-icono-sm"
                            onClick={() => copiarCodigo(c)}
                            aria-label={`Copiar ${c.codigo}`}
                            title="Copiar código"
                          >
                            {copiadoId === c.id ? (
                              <Check aria-hidden="true" style={{ color: 'var(--ok-fg)' }} />
                            ) : (
                              <Copy aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        <Etiqueta tono={tonoEstado} punto>
                          {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
                        </Etiqueta>
                      </td>
                      <td>
                        {esGeneral ? (
                          <Etiqueta tono="info">General (00)</Etiqueta>
                        ) : (
                          <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>
                            Proy {c.numero_proyecto} · Sub {c.subproyecto}
                          </span>
                        )}
                      </td>
                      <td>
                        <Etiqueta tono={c.origen === 'api' ? 'module' : 'muted'}>
                          {c.origen === 'api' ? `API (${c.app_origen || 'servicio'})` : 'Manual'}
                        </Etiqueta>
                      </td>
                      <td className="principal" style={{ maxWidth: 280 }}>
                        <span className="texto-truncado" title={c.motivo}>
                          {c.motivo}
                        </span>
                      </td>
                      <td>{c.creado_por_nombre || '—'}</td>
                      <td className="num mono">{new Date(c.fecha_creacion).toLocaleDateString('es-VE')}</td>
                      <td>
                        <div className="celda-acciones">
                          <button
                            type="button"
                            className="btn-icono btn-icono-sm"
                            onClick={() => verDetalle(c.id)}
                            aria-label={`Ver detalle de ${c.codigo}`}
                            title="Ver detalle e historial"
                          >
                            <Eye aria-hidden="true" />
                          </button>
                          {puedeAnularDirecto && (
                            <Boton
                              variante="ghost"
                              tamano="sm"
                              style={{ color: 'var(--danger-fg)' }}
                              onClick={() => setModal({ item: c, modo: 'anular' })}
                            >
                              Anular
                            </Boton>
                          )}
                          {puedeSolicitar && (
                            <Boton
                              variante="secondary"
                              tamano="sm"
                              onClick={() => setModal({ item: c, modo: 'solicitar' })}
                            >
                              Solicitar anulación
                            </Boton>
                          )}
                          {c.tiene_solicitud_pendiente && <Etiqueta tono="warn">Solicitud pendiente</Etiqueta>}
                        </div>
                      </td>
                    </tr>
                  )
                })}

              {!cargando && datos.resultados.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="vacio">
                      <span className="icon-badge">
                        <FolderSearch aria-hidden="true" />
                      </span>
                      <p className="vacio-titulo">Sin códigos que coincidan</p>
                      <p className="vacio-texto">
                        Prueba ajustando la búsqueda o limpia los filtros activos para ver todo el registro.
                      </p>
                      {(filtrosActivosCount > 0 || busqueda) && (
                        <div className="vacio-accion">
                          <Boton variante="secondary" tamano="sm" onClick={limpiarFiltros}>
                            <Filter aria-hidden="true" />
                            Restablecer filtros
                          </Boton>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pie">
          <span>
            Mostrando <b>{datos.resultados.length}</b> de <b>{datos.total.toLocaleString('es-VE')}</b> códigos
          </span>
          <div className="fila-botones">
            <Boton variante="secondary" tamano="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Boton>
            <span className="mono" style={{ fontSize: 12.5 }}>
              Página {pagina} / {datos.paginas}
            </span>
            <Boton
              variante="secondary"
              tamano="sm"
              disabled={pagina >= datos.paginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Boton>
          </div>
        </div>
      </div>

      {/* Inspector interactivo del código seleccionado */}
      <Dialogo
        abierto={Boolean(detalle) || cargandoDetalle}
        alCerrar={() => setDetalle(null)}
        tamano="lg"
        titulo={detalle ? `Inspector · ${detalle.codigo.codigo}` : 'Cargando código…'}
        descripcion={detalle?.codigo.motivo}
        acciones={
          detalle && (
            <>
              <Boton variante="secondary" onClick={() => copiarCodigo(detalle.codigo)}>
                <Copy aria-hidden="true" />
                Copiar código
              </Boton>
              <Boton variante="primary" onClick={() => setDetalle(null)}>
                Cerrar
              </Boton>
            </>
          )
        }
      >
        {cargandoDetalle && !detalle && <div className="esqueleto" style={{ height: 180 }} />}
        {detalle && (
          <div className="inspector-cuerpo">
            {/* Desglose de los 8 segmentos */}
            <div className="inspector-segmentos">
              {[
                { lbl: 'Org', val: detalle.codigo.sigla, desc: 'Organización fija' },
                { lbl: 'Año', val: detalle.codigo.anio.slice(-2), desc: detalle.codigo.anio },
                {
                  lbl: 'Proy',
                  val: detalle.codigo.numero_proyecto,
                  desc: esValorGeneral(detalle.codigo.numero_proyecto)
                    ? 'General (sin proyecto)'
                    : nombreSegmento('proyecto', detalle.codigo.numero_proyecto),
                  general: esValorGeneral(detalle.codigo.numero_proyecto),
                },
                {
                  lbl: 'Sub',
                  val: detalle.codigo.subproyecto,
                  desc: esValorGeneral(detalle.codigo.subproyecto)
                    ? 'General / Sin subproyecto'
                    : nombreSegmento('subproyecto', detalle.codigo.subproyecto),
                  general: esValorGeneral(detalle.codigo.subproyecto),
                },
                { lbl: 'Depto', val: detalle.codigo.departamento, desc: nombreSegmento('departamento', detalle.codigo.departamento) },
                { lbl: 'Disc', val: detalle.codigo.disciplina, desc: nombreSegmento('disciplina', detalle.codigo.disciplina) },
                { lbl: 'Tipo', val: detalle.codigo.tipo_documento, desc: nombreSegmento('tipo_documento', detalle.codigo.tipo_documento) },
                { lbl: 'Cons', val: String(detalle.codigo.consecutivo).padStart(3, '0'), desc: 'Secuencial único', cons: true },
              ].map((s) => (
                <div key={s.lbl} className={`inspector-seg ${s.general ? 'is-general' : ''} ${s.cons ? 'is-cons' : ''}`}>
                  <small>{s.lbl}</small>
                  <strong>{s.val}</strong>
                  <span>{s.desc}</span>
                </div>
              ))}
            </div>

            {esValorGeneral(detalle.codigo.numero_proyecto) && (
              <Aviso tono="info">
                <strong>Código general (00):</strong> Este código no cae en ningún proyecto específico; aplica a nivel
                general de la organización.
              </Aviso>
            )}

            {/* Ficha de datos (§8.19) */}
            <dl className="sc-fields">
              <div>
                <dt>Estado</dt>
                <dd>
                  <Etiqueta
                    tono={
                      detalle.codigo.estado === 'confirmado'
                        ? 'ok'
                        : detalle.codigo.estado === 'reservado'
                          ? 'info'
                          : 'danger'
                    }
                    punto
                  >
                    {detalle.codigo.estado}
                  </Etiqueta>
                </dd>
              </div>
              <div>
                <dt>Origen</dt>
                <dd>{detalle.codigo.origen === 'api' ? `API (${detalle.codigo.app_origen || 'servicio'})` : 'Manual'}</dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{detalle.codigo.creado_por_nombre || '—'}</dd>
              </div>
              <div>
                <dt>Fecha de creación</dt>
                <dd>{new Date(detalle.codigo.fecha_creacion).toLocaleString('es-VE')}</dd>
              </div>
              {detalle.codigo.referencia_externa && (
                <div>
                  <dt>Referencia externa</dt>
                  <dd className="mono">{detalle.codigo.referencia_externa}</dd>
                </div>
              )}
              {detalle.codigo.fecha_confirmacion && (
                <div>
                  <dt>Confirmación</dt>
                  <dd>{new Date(detalle.codigo.fecha_confirmacion).toLocaleString('es-VE')}</dd>
                </div>
              )}
            </dl>

            {detalle.codigo.motivo_anulacion && (
              <Aviso tono="error">
                <strong>Motivo de anulación:</strong> {detalle.codigo.motivo_anulacion}
              </Aviso>
            )}

            <div>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>Historial de auditoría</h3>
              <HistorialRegistro registros={detalle.historial} />
            </div>
          </div>
        )}
      </Dialogo>

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
