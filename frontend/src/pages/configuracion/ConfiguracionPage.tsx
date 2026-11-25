import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit3,
  ExternalLink,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  X,
} from 'lucide-react'
import { obtenerOrigenShell } from '@cereipo/embed'
import { ConfiguracionSiglaCard } from '../../components/ConfiguracionSiglaCard'
import { HistorialCatalogoModal } from '../../components/HistorialCatalogoModal'
import { esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { CATALOGO_ORIGINAL } from '../../data/catalogoOriginal'
import { catalogosApi, type HistorialSegmentoItem } from '../../services/catalogos'
import { integracionApi } from '../../services/integracion'
import type { CatalogosAgrupados, Segmento, TipoSegmento } from '../../types/catalogos'
import { Aviso, Boton, Casilla, Dialogo } from '../../ui/componentes'

type TabConfig = 'catalogos' | 'sigla' | 'acceso'

const TIPOS_INFO: Record<TipoSegmento, { titulo: string; sigla: string; ejCod: string; ejNom: string }> = {
  proyecto: { titulo: 'Proyectos', sigla: 'NN', ejCod: '15', ejNom: 'Ampliación Planta Sur' },
  subproyecto: { titulo: 'Subproyectos', sigla: 'S', ejCod: 'B', ejNom: 'Fase B' },
  departamento: { titulo: 'Departamentos', sigla: 'DEPT', ejCod: 'OP', ejNom: 'Operaciones' },
  disciplina: { titulo: 'Disciplinas', sigla: 'DISC', ejCod: 'S', ejNom: 'Seguridad' },
  tipo_documento: { titulo: 'Tipos', sigla: 'TIPO', ejCod: 'MEM', ejNom: 'Memoria de Cálculo' },
}

const TIPOS_ORDEN: TipoSegmento[] = ['proyecto', 'subproyecto', 'departamento', 'disciplina', 'tipo_documento']
const POR_PAGINA = 25

export function ConfiguracionPage({
  tabInicial = 'catalogos',
  alAbrirAyuda,
}: {
  tabInicial?: TabConfig
  alAbrirAyuda?: () => void
}) {
  const { identidad, puede } = useIdentidad()
  const { notificar } = useAvisos()

  const puedeCatalogos = puede('codigos:catalogos:administrar')
  const puedeAcceso =
    identidad.tipo === 'listo' &&
    (identidad.yo.es_admin_organizacion || puede('codigos:administracion:gestionar'))

  const [tab, setTab] = useState<TabConfig>(() => {
    if (tabInicial === 'acceso' && puedeAcceso) return 'acceso'
    if (puedeCatalogos) return 'catalogos'
    return 'acceso'
  })

  // Catálogos state
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [historialReciente, setHistorialReciente] = useState<HistorialSegmentoItem[]>([])
  const [tipoActivo, setTipoActivo] = useState<TipoSegmento>('proyecto')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos' | 'personalizados'>('todos')
  const [pagina, setPagina] = useState(1)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoShell, setNuevoShell] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editShell, setEditShell] = useState('')
  const [editOrden, setEditOrden] = useState(0)
  const [modalReset, setModalReset] = useState<{ alcance: 'tipo' | 'todo' } | null>(null)
  const [desactivarPersonalizados, setDesactivarPersonalizados] = useState(true)
  const [modalHistorial, setModalHistorial] = useState(false)

  // Acceso state
  const [ambitos, setAmbitos] = useState<Array<{ proyecto: string; codigo: string; nombre: string; activo: boolean }>>([])

  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargarCatalogos = useCallback(
    (signal?: AbortSignal) => {
      if (!puedeCatalogos) {
        setCargando(false)
        return
      }
      setCargando(true)
      Promise.all([
        catalogosApi.listarSegmentos(true, signal),
        catalogosApi.listarHistorial('', signal).catch(() => ({ resultados: [] })),
      ])
        .then(([segRes, histRes]) => {
          setCatalogos(segRes.segmentos)
          setHistorialReciente(histRes.resultados)
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!signal?.aborted) setCargando(false)
        })
    },
    [puedeCatalogos],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    cargarCatalogos(ctrl.signal)
    return () => ctrl.abort()
  }, [cargarCatalogos])

  useEffect(() => {
    if (!puedeAcceso) return
    const ctrl = new AbortController()
    integracionApi
      .ambitos()
      .then((r) => {
        if (!ctrl.signal.aborted) setAmbitos(r.ambitos)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [puedeAcceso])

  const mapaOriginal = useMemo(() => {
    const map = new Map<string, Segmento>()
    for (const t of TIPOS_ORDEN) {
      for (const s of CATALOGO_ORIGINAL[t]) {
        map.set(`${t}:${s.codigo}`, s)
      }
    }
    return map
  }, [])

  const estadoRespectoOriginal = useCallback(
    (seg: Segmento): 'estandar' | 'editado' | 'propio' => {
      const orig = mapaOriginal.get(`${seg.tipo}:${seg.codigo}`)
      if (!orig) return 'propio'
      if (orig.nombre !== seg.nombre || !seg.activo) return 'editado'
      return 'estandar'
    },
    [mapaOriginal],
  )

  const segmentosFiltrados = useMemo(() => {
    const lista = catalogos?.[tipoActivo] ?? []
    const q = busqueda.trim().toLowerCase()
    return lista.filter((s) => {
      if (filtroEstado === 'activos' && !s.activo) return false
      if (filtroEstado === 'inactivos' && s.activo) return false
      if (filtroEstado === 'personalizados' && estadoRespectoOriginal(s) === 'estandar') return false
      if (!q) return true
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.codigo_shell.toLowerCase().includes(q)
      )
    })
  }, [catalogos, tipoActivo, busqueda, filtroEstado, estadoRespectoOriginal])

  const totalPaginas = Math.max(1, Math.ceil(segmentosFiltrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const visibles = segmentosFiltrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  const ultimoReversible = useMemo(() => historialReciente.find((h) => h.reversible) ?? null, [historialReciente])
  const totalCatalogo = useMemo(
    () => (catalogos ? TIPOS_ORDEN.reduce((acc, t) => acc + catalogos[t].length, 0) : 0),
    [catalogos],
  )

  async function sembrarPlantilla() {
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.sembrarEstandar()
      cargarCatalogos()
      notificar('Plantilla original cargada', `${r.creados} elementos agregados.`, 'ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function agregarSegmento(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.crearSegmento({
        tipo: tipoActivo,
        codigo: nuevoCodigo,
        nombre: nuevoNombre,
        codigo_shell: nuevoShell,
      })
      notificar('Elemento agregado', `${nuevoCodigo} · ${nuevoNombre}`, 'ok')
      setNuevoCodigo('')
      setNuevoNombre('')
      setNuevoShell('')
      setMostrarFormNuevo(false)
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function guardarEdicion(seg: Segmento) {
    if (!editNombre.trim()) return
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.actualizarSegmento(seg.id, {
        nombre: editNombre.trim(),
        codigo_shell: editShell.trim().toUpperCase(),
        orden: editOrden,
      })
      setEditandoId(null)
      notificar('Segmento actualizado', `${seg.codigo} · ${editNombre.trim()}`, 'ok')
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function alternarActivo(seg: Segmento) {
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.actualizarSegmento(seg.id, { activo: !seg.activo })
      notificar(
        seg.activo ? 'Elemento desactivado' : 'Elemento reactivado',
        `${seg.codigo} · ${seg.nombre}`,
        'ok',
      )
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function ejecutarLote(accion: 'activar_todos' | 'solo_general') {
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.loteSegmentos({ tipo: tipoActivo, accion })
      notificar('Cambio aplicado', `${r.actualizados} elemento(s) actualizados (reversible).`, 'ok')
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarReset() {
    if (!modalReset) return
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.restablecerPlantilla({
        tipo: modalReset.alcance === 'tipo' ? tipoActivo : '',
        desactivar_personalizados: desactivarPersonalizados,
      })
      setModalReset(null)
      notificar('Plantilla restablecida', `${r.restaurados} restaurados, ${r.desactivados} desactivados.`, 'ok')
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function deshacerUltimo() {
    if (!ultimoReversible) return
    setError('')
    setEnviando(true)
    try {
      if (ultimoReversible.instantanea_id) {
        await catalogosApi.restaurarInstantanea(ultimoReversible.instantanea_id)
      } else {
        await catalogosApi.revertirCambio(ultimoReversible.id)
      }
      notificar('Cambio revertido', 'El catálogo volvió a su estado anterior.', 'ok')
      cargarCatalogos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  if (!puedeCatalogos && !puedeAcceso) {
    return (
      <section className="pagina-clean">
        <Aviso tono="warn">No tienes permisos para administrar la configuración de Códigos.</Aviso>
      </section>
    )
  }

  const infoActual = TIPOS_INFO[tipoActivo]
  const origenShell = obtenerOrigenShell()

  return (
    <section className="pagina-clean">
      <header className="cabecera-clean">
        <div>
          <h1>Configuración del módulo</h1>
          <p className="tenue">Administra el esquema de catálogos, la sigla inicial y el acceso de tu organización.</p>
        </div>

        <div className="tabs" role="tablist">
          {puedeCatalogos && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'catalogos'}
                className="tab"
                onClick={() => setTab('catalogos')}
              >
                Catálogos del esquema
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'sigla'}
                className="tab"
                onClick={() => setTab('sigla')}
              >
                Sigla y correo
              </button>
            </>
          )}
          {puedeAcceso && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'acceso'}
              className="tab"
              onClick={() => setTab('acceso')}
            >
              Acceso y Shell
            </button>
          )}
        </div>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {/* Tab 1: Catálogos del esquema */}
      {tab === 'catalogos' && puedeCatalogos && (
        <div className="surface-clean">
          <div className="config-cat-top">
            <div className="nav-subtabs" role="tablist">
              {TIPOS_ORDEN.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tipoActivo === t}
                  className={`chip ${tipoActivo === t ? 'is-on' : ''}`}
                  onClick={() => {
                    setTipoActivo(t)
                    setPagina(1)
                    setEditandoId(null)
                    setBusqueda('')
                  }}
                >
                  {TIPOS_INFO[t].titulo}
                  <span className="chip-cuenta">
                    {(catalogos?.[t] ?? []).filter((s) => s.activo).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="fila-botones">
              {ultimoReversible && (
                <Boton variante="ghost" tamano="sm" disabled={enviando} onClick={deshacerUltimo}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Deshacer
                </Boton>
              )}
              <Boton variante="ghost" tamano="sm" onClick={() => setModalHistorial(true)}>
                <History size={15} aria-hidden="true" />
                Historial
              </Boton>
              {totalCatalogo === 0 ? (
                <Boton variante="primary" tamano="sm" cargando={enviando} onClick={sembrarPlantilla}>
                  <Database size={15} aria-hidden="true" />
                  Cargar plantilla original
                </Boton>
              ) : (
                <Boton variante="secondary" tamano="sm" disabled={enviando} onClick={() => setModalReset({ alcance: 'todo' })}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Plantilla original
                </Boton>
              )}
              <Boton variante="primary" tamano="sm" onClick={() => setMostrarFormNuevo((v) => !v)}>
                <Plus size={15} aria-hidden="true" />
                Nuevo
              </Boton>
            </div>
          </div>

          {mostrarFormNuevo && (
            <form onSubmit={agregarSegmento} className="esquema-nuevo-form">
              <div className="filtros-avanzados" style={{ padding: 0, border: 0, background: 'transparent' }}>
                <label className="field">
                  <span className="field-label">Código ({infoActual.sigla})</span>
                  <input
                    type="text"
                    placeholder={`Ej. ${infoActual.ejCod}`}
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Nombre</span>
                  <input
                    type="text"
                    placeholder={`Ej. ${infoActual.ejNom}`}
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Código Shell (opcional)</span>
                  <input
                    type="text"
                    placeholder="Ej. CIV"
                    value={nuevoShell}
                    onChange={(e) => setNuevoShell(e.target.value.toUpperCase())}
                  />
                </label>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <Boton type="submit" variante="primary" tamano="sm" cargando={enviando}>
                    <Save size={14} aria-hidden="true" />
                    Guardar
                  </Boton>
                  <Boton type="button" variante="ghost" tamano="sm" onClick={() => setMostrarFormNuevo(false)}>
                    Cancelar
                  </Boton>
                </div>
              </div>
            </form>
          )}

          <div className="buscador-bar" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="search-protagonista" style={{ maxWidth: 320 }}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder={`Filtrar ${infoActual.titulo.toLowerCase()}…`}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setPagina(1)
                }}
              />
              {busqueda && (
                <button type="button" className="btn-icono btn-icono-sm" onClick={() => setBusqueda('')}>
                  <X aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="filtros-linea">
              {[
                { id: 'todos', lbl: 'Todos' },
                { id: 'activos', lbl: 'Activos' },
                { id: 'inactivos', lbl: 'Inactivos' },
                { id: 'personalizados', lbl: 'Modificados' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filtroEstado === f.id ? 'is-on' : ''}`}
                  onClick={() => {
                    setFiltroEstado(f.id as typeof filtroEstado)
                    setPagina(1)
                  }}
                >
                  {f.lbl}
                </button>
              ))}

              {(tipoActivo === 'proyecto' || tipoActivo === 'subproyecto') && totalCatalogo > 0 && (
                <Boton variante="ghost" tamano="sm" disabled={enviando} onClick={() => ejecutarLote('solo_general')}>
                  <Building2 size={14} aria-hidden="true" />
                  Solo general ({tipoActivo === 'proyecto' ? '00' : '0'})
                </Boton>
              )}
              {totalCatalogo > 0 && (
                <Boton variante="ghost" tamano="sm" disabled={enviando} onClick={() => ejecutarLote('activar_todos')}>
                  Activar todos
                </Boton>
              )}
            </div>
          </div>

          <div className="table-wrap table-clean-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Shell</th>
                  <th>Estado</th>
                  <th className="num">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando &&
                  [0, 1, 2, 3].map((n) => (
                    <tr key={n}>
                      <td colSpan={5}>
                        <div className="esqueleto" style={{ height: 20 }} />
                      </td>
                    </tr>
                  ))}

                {!cargando &&
                  visibles.map((s) => {
                    const enEdicion = editandoId === s.id
                    const esGeneral = (s.tipo === 'proyecto' || s.tipo === 'subproyecto') && esValorGeneral(s.codigo)
                    const origen = estadoRespectoOriginal(s)

                    return (
                      <tr key={s.id} className={!s.activo ? 'fila-inactiva' : undefined}>
                        <td>
                          <div className="celda-codigo">
                            <span className="codigo-texto">{s.codigo}</span>
                            {esGeneral && <span className="sub-etiqueta">General</span>}
                            {origen === 'propio' && <span className="sub-etiqueta">Propio</span>}
                          </div>
                        </td>
                        <td className="principal">
                          {enEdicion ? (
                            <input
                              type="text"
                              className="input-inline"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            s.nombre
                          )}
                        </td>
                        <td className="mono">
                          {enEdicion ? (
                            <input
                              type="text"
                              className="input-inline"
                              style={{ maxWidth: 100 }}
                              value={editShell}
                              onChange={(e) => setEditShell(e.target.value.toUpperCase())}
                            />
                          ) : (
                            s.codigo_shell || '—'
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`tag-toggle ${s.activo ? 'is-on' : 'is-off'}`}
                            disabled={enviando}
                            onClick={() => alternarActivo(s)}
                            title={s.activo ? 'Clic para desactivar' : 'Clic para volver a activar'}
                          >
                            <span className="tag-punto" aria-hidden="true" />
                            {s.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="num">
                          <div className="celda-acciones" style={{ justifyContent: 'flex-end' }}>
                            {enEdicion ? (
                              <>
                                <Boton variante="primary" tamano="sm" disabled={enviando} onClick={() => guardarEdicion(s)}>
                                  <Check aria-hidden="true" />
                                  Guardar
                                </Boton>
                                <Boton variante="ghost" tamano="sm" onClick={() => setEditandoId(null)}>
                                  Cancelar
                                </Boton>
                              </>
                            ) : (
                              <>
                                {!s.activo && (
                                  <Boton
                                    variante="secondary"
                                    tamano="sm"
                                    disabled={enviando}
                                    onClick={() => alternarActivo(s)}
                                  >
                                    <RotateCcw size={14} aria-hidden="true" />
                                    Reactivar
                                  </Boton>
                                )}
                                <Boton
                                  variante="ghost"
                                  tamano="sm"
                                  onClick={() => {
                                    setEditandoId(s.id)
                                    setEditNombre(s.nombre)
                                    setEditShell(s.codigo_shell)
                                    setEditOrden(s.orden)
                                  }}
                                >
                                  <Edit3 size={14} aria-hidden="true" />
                                  Editar
                                </Boton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                {!cargando && visibles.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="vacio">
                        <p className="vacio-titulo">
                          {totalCatalogo === 0 ? 'Sin catálogo cargado' : 'Sin resultados'}
                        </p>
                        {totalCatalogo === 0 && (
                          <div className="vacio-accion">
                            <Boton variante="primary" tamano="sm" onClick={sembrarPlantilla}>
                              Cargar plantilla original
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

          {totalPaginas > 1 && (
            <div className="table-pie">
              <span>
                {segmentosFiltrados.length} elementos en {infoActual.titulo.toLowerCase()}
              </span>
              <div className="fila-botones">
                <Boton variante="ghost" tamano="sm" disabled={paginaSegura <= 1} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </Boton>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  {paginaSegura} / {totalPaginas}
                </span>
                <Boton
                  variante="ghost"
                  tamano="sm"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                  <ChevronRight aria-hidden="true" />
                </Boton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sigla y correo */}
      {tab === 'sigla' && puedeCatalogos && (
        <ConfiguracionSiglaCard alAbrirAyuda={alAbrirAyuda} alSembrarCatalogos={() => cargarCatalogos()} />
      )}

      {/* Tab 3: Acceso y Shell */}
      {tab === 'acceso' && puedeAcceso && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="surface-clean" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span className="icon-badge">
                <Shield aria-hidden="true" />
              </span>
              <div style={{ display: 'grid', gap: 8 }}>
                <h2 className="panel-titulo">Roles y permisos</h2>
                <p className="tenue">
                  Los roles (<code>administrador</code>, <code>aprobador</code>, <code>generador</code>,{' '}
                  <code>consulta</code>) se asignan desde la consola central de Cereipo Shell.
                </p>
                {origenShell && (
                  <div>
                    <a
                      className="btn btn-secondary btn-sm"
                      href={`${origenShell}/administracion/`}
                      target="_top"
                      rel="noreferrer"
                    >
                      Abrir consola del Shell
                      <ExternalLink aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="surface-clean" style={{ padding: 22 }}>
            <h2 className="panel-titulo" style={{ marginBottom: 6 }}>
              Ámbitos de la organización
            </h2>
            {ambitos.length === 0 ? (
              <p className="tenue">Códigos opera a nivel de toda la organización activa.</p>
            ) : (
              <ul style={{ display: 'grid', gap: 8 }}>
                {ambitos.map((a) => (
                  <li key={a.codigo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="codigo-texto">{a.codigo}</span>
                    <span>{a.nombre}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Dialogo
        abierto={Boolean(modalReset)}
        alCerrar={() => setModalReset(null)}
        titulo="Restablecer a la plantilla original"
        descripcion="Se restaurará el catálogo estándar guardando antes un punto de restauración automático para poder revertir."
        acciones={
          <>
            <Boton variante="secondary" onClick={() => setModalReset(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primary" cargando={enviando} disabled={enviando} onClick={confirmarReset}>
              Restablecer plantilla
            </Boton>
          </>
        }
      >
        <Casilla checked={desactivarPersonalizados} onChange={(e) => setDesactivarPersonalizados(e.target.checked)}>
          Desactivar elementos personalizados fuera de la plantilla (no afecta códigos ya emitidos)
        </Casilla>
      </Dialogo>

      <HistorialCatalogoModal
        abierto={modalHistorial}
        tipoFiltro=""
        alCerrar={() => setModalHistorial(false)}
        alRevertir={() => cargarCatalogos()}
      />
    </section>
  )
}
