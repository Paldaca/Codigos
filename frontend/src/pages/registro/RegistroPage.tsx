import { useCallback, useEffect, useMemo, useState } from 'react'
import { HistorialRegistro, type RegistroHistorial } from '@cereipo/ui'
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderSearch,
  HelpCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
import { ModalAnulacion } from '../../components/ModalAnulacion'
import { esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import { registroApi } from '../../services/registro'
import type { CatalogosAgrupados } from '../../types/catalogos'
import type { CodigoItem, ResumenRegistro } from '../../types/registro'
import { Aviso, Boton, Casilla, Etiqueta } from '../../ui/componentes'
import { useConteo } from '../../ui/movimiento'

function CifraLinea({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const animado = useConteo(valor)
  return (
    <span className="kpi-inline">
      <strong>{animado.toLocaleString('es-VE')}</strong> {etiqueta}
    </span>
  )
}

export function RegistroPage({
  ir,
  embebida = false,
  alAbrirAyuda,
}: {
  ir?: (ruta: string) => void
  embebida?: boolean
  alAbrirAyuda?: () => void
}) {
  const { identidad, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const [resumen, setResumen] = useState<ResumenRegistro | null>(null)
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
    const id = window.setTimeout(() => setBusquedaAplicada(busqueda), 220)
    return () => window.clearTimeout(id)
  }, [busqueda])

  const cargarResumen = useCallback(() => {
    if (!puede('codigos:inicio:ver')) return
    registroApi
      .resumen()
      .then(setResumen)
      .catch(() => {})
  }, [puede])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  useEffect(() => {
    const ctrl = new AbortController()
    catalogosApi
      .listarSegmentos(false, ctrl.signal)
      .then((r) => setCatalogos(r.segmentos))
      .catch(() => {})
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

  useEffect(() => {
    if (!detalle) return
    const alEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetalle(null)
    }
    document.addEventListener('keydown', alEsc)
    return () => document.removeEventListener('keydown', alEsc)
  }, [detalle])

  const personaId = identidad.tipo === 'listo' ? identidad.yo.persona.id : ''
  const esAprobador = puede('codigos:codigos:anular')
  const puedeGenerar = puede('codigos:codigos:generar')

  const filtrosAvanzadosActivos = useMemo(() => {
    return (
      [origen, disciplina, tipoDocumento, creadoPor, fechaInicio, fechaFin].filter(Boolean).length +
      (numeroProyecto && numeroProyecto !== '00' ? 1 : 0) +
      (incluirAnulados && estado === '' ? 1 : 0)
    )
  }, [origen, numeroProyecto, disciplina, tipoDocumento, creadoPor, fechaInicio, fechaFin, incluirAnulados, estado])

  const hayAlgunFiltro = Boolean(busqueda || estado || numeroProyecto || filtrosAvanzadosActivos > 0)

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
      window.setTimeout(() => setCopiadoId((p) => (p === item.id ? null : p)), 1600)
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
      notificar('Código anulado', `${modal.item.codigo} quedó anulado.`, 'warn')
    } else {
      await registroApi.solicitarAnulacion(modal.item.id, motivo)
      notificar('Solicitud enviada', `Se notificó a los aprobadores sobre ${modal.item.codigo}.`, 'info')
    }
    setModal(null)
    cargar()
    cargarResumen()
    if (detalle?.codigo.id === modal.item.id) {
      verDetalle(modal.item.id)
    }
  }

  function nombreSegmento(tipo: keyof CatalogosAgrupados, codigo: string): string {
    return catalogos?.[tipo]?.find((s) => s.codigo === codigo)?.nombre ?? codigo
  }

  return (
    <section className="pagina-clean">
      {/* Cabecera minimalista con KPIs en línea y 1 CTA principal */}
      <header className="cabecera-clean">
        <div>
          <h1>Registro de códigos</h1>
          <div className="kpi-inline-bar">
            {resumen ? (
              <>
                <CifraLinea valor={resumen.confirmados} etiqueta="vigentes" />
                <span className="kpi-sep">·</span>
                <CifraLinea valor={resumen.reservados} etiqueta="reservados API" />
                <span className="kpi-sep">·</span>
                <CifraLinea valor={resumen.total} etiqueta="en total" />
                {resumen.solicitudes_pendientes > 0 && esAprobador && ir && (
                  <>
                    <span className="kpi-sep">·</span>
                    <button type="button" className="kpi-alerta-link" onClick={() => ir('/anulaciones/')}>
                      {resumen.solicitudes_pendientes} solicitud(es) pendiente(s)
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <span className="tenue">Consulta y gestiona los códigos de tu organización.</span>
            )}
          </div>
        </div>

        <div className="cabecera-acciones">
          {embebida && alAbrirAyuda && (
            <button
              type="button"
              className="btn-icono"
              onClick={alAbrirAyuda}
              aria-label="Guía del motor de códigos"
              title="Cómo funciona el motor de códigos"
            >
              <HelpCircle aria-hidden="true" />
            </button>
          )}
          {puedeGenerar && ir && (
            <Boton variante="primary" onClick={() => ir('/generar/')}>
              <Plus aria-hidden="true" />
              Generar código
            </Boton>
          )}
        </div>
      </header>

      {ir && <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />}

      {/* Buscador protagonista + filtros limpios */}
      <div className="surface-clean">
        <div className="buscador-bar">
          <div className="search-protagonista">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por código (ej. CER-26-00-0-IN)…"
              aria-label="Buscar código"
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

          <div className="filtros-linea">
            {[
              { valor: '', etiqueta: 'Vigentes' },
              { valor: 'confirmado', etiqueta: 'Confirmados' },
              { valor: 'reservado', etiqueta: 'Reservados' },
              { valor: 'anulado', etiqueta: 'Anulados' },
            ].map((op) => (
              <button
                key={op.valor || 'vigentes'}
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

            <button
              type="button"
              className={`chip ${numeroProyecto === '00' ? 'is-on' : ''}`}
              onClick={() => {
                setPagina(1)
                setNumeroProyecto((p) => (p === '00' ? '' : '00'))
              }}
            >
              <Building2 size={13} aria-hidden="true" />
              Generales (00)
            </button>

            <Boton
              variante="ghost"
              tamano="sm"
              onClick={() => setMostrarAvanzados((v) => !v)}
              aria-expanded={mostrarAvanzados}
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              Más filtros
              {filtrosAvanzadosActivos > 0 && <span className="badge-conteo">{filtrosAvanzadosActivos}</span>}
            </Boton>

            {hayAlgunFiltro && (
              <Boton variante="ghost" tamano="sm" onClick={limpiarFiltros}>
                <RotateCcw size={14} aria-hidden="true" />
                Limpiar
              </Boton>
            )}
          </div>
        </div>

        {mostrarAvanzados && (
          <div className="filtros-avanzados">
            <label className="field">
              <span className="field-label">Origen</span>
              <select
                value={origen}
                onChange={(e) => {
                  setPagina(1)
                  setOrigen(e.target.value)
                }}
              >
                <option value="">Todos</option>
                <option value="manual">Manual</option>
                <option value="api">API automática</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Proyecto</span>
              <select
                value={numeroProyecto}
                onChange={(e) => {
                  setPagina(1)
                  setNumeroProyecto(e.target.value)
                }}
              >
                <option value="">Todos</option>
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
              <span className="field-label">Tipo</span>
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
                placeholder="Nombre…"
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
                Incluir anulados
              </Casilla>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '0 20px 14px' }}>
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        {/* Tabla aireada de 5 columnas */}
        <div className="table-wrap table-clean-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Motivo / Asunto</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                datos.resultados.length === 0 &&
                [0, 1, 2, 3, 4].map((n) => (
                  <tr key={n}>
                    <td colSpan={5}>
                      <div className="esqueleto" style={{ height: 22 }} />
                    </td>
                  </tr>
                ))}

              {!cargando &&
                datos.resultados.map((c) => {
                  const puedeAnularDirecto =
                    c.estado !== 'anulado' &&
                    (esAprobador || (puedeGenerar && c.creado_por_persona_id === personaId))
                  const puedeSolicitar =
                    c.estado !== 'anulado' && !puedeAnularDirecto && puedeGenerar && !c.tiene_solicitud_pendiente
                  const esGeneral = esValorGeneral(c.numero_proyecto)
                  const tonoEstado = c.estado === 'confirmado' ? 'ok' : c.estado === 'reservado' ? 'info' : 'danger'
                  const seleccionado = detalle?.codigo.id === c.id

                  return (
                    <tr
                      key={c.id}
                      className={`fila-clicable ${seleccionado ? 'is-seleccionada' : ''}`}
                      onClick={() => verDetalle(c.id)}
                    >
                      <td>
                        <div className="celda-codigo">
                          <span className="codigo-texto">{c.codigo}</span>
                          {esGeneral && <span className="sub-etiqueta">General</span>}
                        </div>
                      </td>

                      <td className="principal" style={{ maxWidth: 340 }}>
                        <span className="texto-truncado" title={c.motivo}>
                          {c.motivo}
                        </span>
                      </td>

                      <td>
                        <Etiqueta tono={tonoEstado} punto>
                          {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
                        </Etiqueta>
                      </td>

                      <td>
                        <div className="celda-meta">
                          <span>{c.creado_por_nombre || '—'}</span>
                          <small className="mono">{new Date(c.fecha_creacion).toLocaleDateString('es-VE')}</small>
                        </div>
                      </td>

                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        <div className="celda-acciones" style={{ justifyContent: 'flex-end' }}>
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
                              variante="ghost"
                              tamano="sm"
                              onClick={() => setModal({ item: c, modo: 'solicitar' })}
                            >
                              Solicitar anulación
                            </Boton>
                          )}
                          {c.tiene_solicitud_pendiente && <Etiqueta tono="warn">Pendiente</Etiqueta>}
                        </div>
                      </td>
                    </tr>
                  )
                })}

              {!cargando && datos.resultados.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="vacio">
                      <span className="icon-badge">
                        <FolderSearch aria-hidden="true" />
                      </span>
                      <p className="vacio-titulo">Sin códigos que coincidan</p>
                      <p className="vacio-texto">
                        {hayAlgunFiltro
                          ? 'Ajusta la búsqueda o limpia los filtros para ver todo el registro.'
                          : 'Todavía no hay códigos emitidos en esta organización.'}
                      </p>
                      {hayAlgunFiltro ? (
                        <div className="vacio-accion">
                          <Boton variante="secondary" tamano="sm" onClick={limpiarFiltros}>
                            Limpiar filtros
                          </Boton>
                        </div>
                      ) : (
                        puedeGenerar &&
                        ir && (
                          <div className="vacio-accion">
                            <Boton variante="primary" tamano="sm" onClick={() => ir('/generar/')}>
                              <Plus aria-hidden="true" />
                              Generar primer código
                            </Boton>
                          </div>
                        )
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
            {datos.total.toLocaleString('es-VE')} {datos.total === 1 ? 'código' : 'códigos'}
          </span>
          <div className="fila-botones">
            <Boton variante="ghost" tamano="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Boton>
            <span className="mono" style={{ fontSize: 12.5 }}>
              {pagina} / {datos.paginas}
            </span>
            <Boton
              variante="ghost"
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

      {/* Panel lateral deslizable (Drawer) para inspeccionar sin tapar toda la tabla */}
      {(detalle || cargandoDetalle) && (
        <aside className="drawer-panel" aria-label="Detalle del código">
          <div className="drawer-head">
            <div>
              <span className="kicker">Detalle del código</span>
              <h2 className="drawer-codigo">{detalle ? detalle.codigo.codigo : 'Cargando…'}</h2>
            </div>
            <div className="fila-botones">
              {detalle && (
                <Boton variante="secondary" tamano="sm" onClick={() => copiarCodigo(detalle.codigo)}>
                  <Copy size={14} aria-hidden="true" />
                  Copiar
                </Boton>
              )}
              <button
                type="button"
                className="btn-icono"
                onClick={() => setDetalle(null)}
                aria-label="Cerrar panel"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="drawer-body">
            {cargandoDetalle && !detalle && <div className="esqueleto" style={{ height: 180 }} />}
            {detalle && (
              <>
                <p className="drawer-motivo">{detalle.codigo.motivo}</p>

                <div className="drawer-segmentos">
                  {[
                    { lbl: 'Org', val: detalle.codigo.sigla, desc: 'Organización' },
                    { lbl: 'Año', val: detalle.codigo.anio.slice(-2), desc: detalle.codigo.anio },
                    {
                      lbl: 'Proyecto',
                      val: detalle.codigo.numero_proyecto,
                      desc: esValorGeneral(detalle.codigo.numero_proyecto)
                        ? 'General (sin proyecto)'
                        : nombreSegmento('proyecto', detalle.codigo.numero_proyecto),
                    },
                    {
                      lbl: 'Subproy.',
                      val: detalle.codigo.subproyecto,
                      desc: esValorGeneral(detalle.codigo.subproyecto)
                        ? 'General'
                        : nombreSegmento('subproyecto', detalle.codigo.subproyecto),
                    },
                    {
                      lbl: 'Depto',
                      val: detalle.codigo.departamento,
                      desc: nombreSegmento('departamento', detalle.codigo.departamento),
                    },
                    {
                      lbl: 'Disciplina',
                      val: detalle.codigo.disciplina,
                      desc: nombreSegmento('disciplina', detalle.codigo.disciplina),
                    },
                    {
                      lbl: 'Tipo',
                      val: detalle.codigo.tipo_documento,
                      desc: nombreSegmento('tipo_documento', detalle.codigo.tipo_documento),
                    },
                    {
                      lbl: 'Cons.',
                      val: String(detalle.codigo.consecutivo).padStart(3, '0'),
                      desc: 'Secuencial',
                    },
                  ].map((s) => (
                    <div key={s.lbl} className="drawer-seg-item">
                      <small>{s.lbl}</small>
                      <strong>{s.val}</strong>
                      <span>{s.desc}</span>
                    </div>
                  ))}
                </div>

                <dl className="drawer-meta">
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
                    <dt>Creación</dt>
                    <dd>{new Date(detalle.codigo.fecha_creacion).toLocaleString('es-VE')}</dd>
                  </div>
                </dl>

                {detalle.codigo.motivo_anulacion && (
                  <Aviso tono="error">
                    <strong>Anulado:</strong> {detalle.codigo.motivo_anulacion}
                  </Aviso>
                )}

                <div>
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>Historial</h3>
                  <HistorialRegistro registros={detalle.historial} />
                </div>
              </>
            )}
          </div>
        </aside>
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
