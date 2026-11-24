import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Check,
  Database,
  Edit3,
  History,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react'
import { BotonAyuda } from '../../components/BotonAyuda'
import { ConfiguracionSiglaCard } from '../../components/ConfiguracionSiglaCard'
import { HistorialCatalogoModal } from '../../components/HistorialCatalogoModal'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { CATALOGO_ORIGINAL } from '../../data/catalogoOriginal'
import { catalogosApi, type HistorialSegmentoItem } from '../../services/catalogos'
import type { CatalogosAgrupados, Segmento, TipoSegmento } from '../../types/catalogos'
import { Aviso, Boton, Casilla, Dialogo, Etiqueta } from '../../ui/componentes'
import { orden } from '../../ui/movimiento'

const METADATOS_TIPO: Record<
  TipoSegmento,
  { sigla: string; titulo: string; descripcion: string; ejemploCodigo: string; ejemploNombre: string }
> = {
  proyecto: {
    sigla: 'NN',
    titulo: 'Proyectos',
    descripcion: 'Identificadores de 2 dígitos (01–99) y «00» para códigos generales.',
    ejemploCodigo: '15',
    ejemploNombre: 'Ampliación Planta Sur',
  },
  subproyecto: {
    sigla: 'S',
    titulo: 'Subproyectos',
    descripcion: 'Divisiones internas (A–Z) y «0» cuando no aplica subproyecto.',
    ejemploCodigo: 'B',
    ejemploNombre: 'Fase B · Obras Civiles',
  },
  departamento: {
    sigla: 'DEPT',
    titulo: 'Departamentos',
    descripcion: 'Gerencias o áreas responsables de emitir documentos.',
    ejemploCodigo: 'OP',
    ejemploNombre: 'Operaciones de Campo',
  },
  disciplina: {
    sigla: 'DISC',
    titulo: 'Disciplinas',
    descripcion: 'Especialidades técnicas (M, C, E, I, P, T, A) o «G» General.',
    ejemploCodigo: 'S',
    ejemploNombre: 'Seguridad Industrial',
  },
  tipo_documento: {
    sigla: 'TIPO',
    titulo: 'Tipos de documento',
    descripcion: 'Naturaleza del entregable (PLA, DOC, INF, PRO, FOR, TRN…).',
    ejemploCodigo: 'MEM',
    ejemploNombre: 'Memoria de Cálculo',
  },
}

const TIPOS_ORDEN: TipoSegmento[] = ['proyecto', 'subproyecto', 'departamento', 'disciplina', 'tipo_documento']

export function CatalogosPage({ alAbrirAyuda }: { alAbrirAyuda?: () => void }) {
  const { configOrg } = useIdentidad()
  const { notificar } = useAvisos()

  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [historialReciente, setHistorialReciente] = useState<HistorialSegmentoItem[]>([])
  const [tipoActivo, setTipoActivo] = useState<TipoSegmento>('proyecto')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos' | 'personalizados'>('todos')

  const [mostrarConfigSigla, setMostrarConfigSigla] = useState(false)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoShell, setNuevoShell] = useState('')
  const [nuevoMotivo, setNuevoMotivo] = useState('')

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editShell, setEditShell] = useState('')
  const [editOrden, setEditOrden] = useState(0)
  const [editMotivo, setEditMotivo] = useState('')

  const [modalReset, setModalReset] = useState<{ alcance: 'tipo' | 'todo' } | null>(null)
  const [desactivarPersonalizados, setDesactivarPersonalizados] = useState(true)
  const [motivoReset, setMotivoReset] = useState('')
  const [modalHistorial, setModalHistorial] = useState(false)

  const [semillaEjemplo, setSemillaEjemplo] = useState(0)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (configOrg && !configOrg.configurada) {
      setMostrarConfigSigla(true)
    }
  }, [configOrg])

  const cargarTodo = useCallback((signal?: AbortSignal) => {
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
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    cargarTodo(ctrl.signal)
    return () => ctrl.abort()
  }, [cargarTodo])

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

  const estadisticas = useMemo(() => {
    let total = 0
    let activos = 0
    let propios = 0
    let modificados = 0
    const porTipo: Record<TipoSegmento, { total: number; activos: number; propios: number }> = {
      proyecto: { total: 0, activos: 0, propios: 0 },
      subproyecto: { total: 0, activos: 0, propios: 0 },
      departamento: { total: 0, activos: 0, propios: 0 },
      disciplina: { total: 0, activos: 0, propios: 0 },
      tipo_documento: { total: 0, activos: 0, propios: 0 },
    }
    if (!catalogos) return { total, activos, propios, modificados, porTipo }

    for (const t of TIPOS_ORDEN) {
      for (const s of catalogos[t]) {
        total += 1
        porTipo[t].total += 1
        if (s.activo) {
          activos += 1
          porTipo[t].activos += 1
        }
        const orig = mapaOriginal.get(`${t}:${s.codigo}`)
        if (!orig) {
          propios += 1
          porTipo[t].propios += 1
        } else if (orig.nombre !== s.nombre || !s.activo) {
          modificados += 1
        }
      }
    }
    return { total, activos, propios, modificados, porTipo }
  }, [catalogos, mapaOriginal])

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

  const ultimoCambioReversible = useMemo(
    () => historialReciente.find((h) => h.reversible) ?? null,
    [historialReciente],
  )

  // Simulador en vivo usando los segmentos activos reales de la organización
  const codigoSimulado = useMemo(() => {
    const sig = configOrg?.configurada ? configOrg.sigla : 'SIGLA'
    const anio = String(new Date().getFullYear()).slice(-2)
    const elegir = (t: TipoSegmento, fallback: string) => {
      const activos = (catalogos?.[t] ?? []).filter((s) => s.activo)
      if (activos.length === 0) return fallback
      return activos[semillaEjemplo % activos.length].codigo
    }
    return {
      sig,
      anio,
      proyecto: elegir('proyecto', '00'),
      subproyecto: elegir('subproyecto', '0'),
      departamento: elegir('departamento', 'IN'),
      disciplina: elegir('disciplina', 'G'),
      tipo_documento: elegir('tipo_documento', 'DOC'),
    }
  }, [catalogos, configOrg, semillaEjemplo])

  async function aplicarPlantillaInicial() {
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.sembrarEstandar()
      cargarTodo()
      notificar('Plantilla original aplicada', `${r.creados} elementos agregados (${r.total} en total).`, 'ok')
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
        motivo: nuevoMotivo,
      })
      notificar('Elemento agregado al esquema', `${nuevoCodigo} · ${nuevoNombre}`, 'ok')
      setNuevoCodigo('')
      setNuevoNombre('')
      setNuevoShell('')
      setNuevoMotivo('')
      setMostrarFormNuevo(false)
      cargarTodo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  function iniciarEdicion(seg: Segmento) {
    setEditandoId(seg.id)
    setEditNombre(seg.nombre)
    setEditShell(seg.codigo_shell)
    setEditOrden(seg.orden)
    setEditMotivo('')
  }

  async function guardarEdicion(seg: Segmento) {
    if (!editNombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.actualizarSegmento(seg.id, {
        nombre: editNombre.trim(),
        codigo_shell: editShell.trim().toUpperCase(),
        orden: editOrden,
        motivo: editMotivo.trim(),
      })
      setEditandoId(null)
      notificar('Segmento actualizado', `${seg.codigo} · ${editNombre.trim()}`, 'ok')
      cargarTodo()
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
      await catalogosApi.actualizarSegmento(seg.id, {
        activo: !seg.activo,
        motivo: !seg.activo ? 'Reactivado desde el diseñador de esquema' : 'Desactivado desde el diseñador de esquema',
      })
      notificar(
        !seg.activo ? 'Segmento activado' : 'Segmento desactivado',
        `${seg.codigo} · ${seg.nombre} (reversible desde Historial)`,
        'info',
      )
      cargarTodo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function ejecutarLote(accion: 'activar_todos' | 'desactivar_todos' | 'solo_general') {
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.loteSegmentos({ tipo: tipoActivo, accion })
      notificar(
        'Actualización en lote aplicada',
        `${r.actualizados} elemento(s) actualizados. Se guardó un punto de restauración.`,
        'ok',
      )
      cargarTodo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarResetPlantilla() {
    if (!modalReset) return
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.restablecerPlantilla({
        tipo: modalReset.alcance === 'tipo' ? tipoActivo : '',
        desactivar_personalizados: desactivarPersonalizados,
        motivo: motivoReset.trim(),
      })
      setModalReset(null)
      setMotivoReset('')
      notificar(
        'Plantilla original restablecida',
        `${r.restaurados} restaurados, ${r.creados} nuevos, ${r.desactivados} personalizados desactivados. Puedes revertirlo desde Historial.`,
        'ok',
      )
      cargarTodo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function deshacerUltimo() {
    if (!ultimoCambioReversible) return
    setError('')
    setEnviando(true)
    try {
      if (ultimoCambioReversible.instantanea_id) {
        await catalogosApi.restaurarInstantanea(ultimoCambioReversible.instantanea_id)
        notificar('Último cambio revertido', 'Se restauró el punto previo del catálogo.', 'ok')
      } else {
        const r = await catalogosApi.revertirCambio(ultimoCambioReversible.id)
        notificar('Último cambio revertido', `${r.segmento.codigo} volvió a su estado anterior.`, 'ok')
      }
      cargarTodo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  const metaActual = METADATOS_TIPO[tipoActivo]
  const esquemaVacio = estadisticas.total === 0
  const esPersonalizado = estadisticas.propios > 0 || estadisticas.modificados > 0

  return (
    <section className="pagina">
      {/* Cabecera */}
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Esquema y catálogos de la organización</h1>
            <BotonAyuda
              titulo="Tu propio esquema sobre la metodología única"
              texto="Tu organización mantiene la estructura de 8 segmentos, pero puedes partir de la plantilla original para activar, desactivar, editar o crear tus propios proyectos, subproyectos, departamentos, disciplinas y tipos. Todo cambio es reversible."
              destacado="Cualquier modificación actualiza automáticamente el maestro codigos.catalogos (tarea 5.5) para Control documental."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">
            Diseña qué valores existen en tu organización usando la plantilla original como base y revierte cambios
            cuando lo necesites.
          </p>
        </div>

        <div className="cabecera-acciones">
          <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
          <Boton variante="secondary" tamano="sm" onClick={() => setMostrarConfigSigla((v) => !v)}>
            <Settings2 aria-hidden="true" />
            {mostrarConfigSigla ? 'Ocultar sigla' : 'Sigla y correo'}
          </Boton>
        </div>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {/* Configuración de sigla colapsable */}
      {mostrarConfigSigla && (
        <div className="rev">
          <ConfiguracionSiglaCard alAbrirAyuda={alAbrirAyuda} alSembrarCatalogos={() => cargarTodo()} />
        </div>
      )}

      {/* Diseñador visual del esquema de 8 segmentos */}
      <div className="card esquema-hero rev" style={orden(1)}>
        <div className="esquema-hero-top">
          <div className="esquema-estado-grupo">
            <span className="kicker">Estructura única · 8 segmentos</span>
            {esquemaVacio ? (
              <Etiqueta tono="warn" punto>
                Sin catálogo cargado
              </Etiqueta>
            ) : esPersonalizado ? (
              <Etiqueta tono="info" punto>
                Esquema personalizado ({estadisticas.propios} propios · {estadisticas.modificados} ajustados)
              </Etiqueta>
            ) : (
              <Etiqueta tono="ok" punto>
                Plantilla original activa
              </Etiqueta>
            )}
          </div>

          <div className="esquema-acciones-top">
            {ultimoCambioReversible && (
              <Boton
                variante="secondary"
                tamano="sm"
                disabled={enviando}
                onClick={deshacerUltimo}
                title="Deshacer la modificación más reciente"
              >
                <RotateCcw aria-hidden="true" />
                Deshacer último
              </Boton>
            )}
            <Boton variante="secondary" tamano="sm" onClick={() => setModalHistorial(true)}>
              <History aria-hidden="true" />
              Historial y reversión
            </Boton>
            {esquemaVacio ? (
              <Boton variante="primary" tamano="sm" cargando={enviando} onClick={aplicarPlantillaInicial}>
                <Database aria-hidden="true" />
                Cargar plantilla original
              </Boton>
            ) : (
              <Boton
                variante="secondary"
                tamano="sm"
                disabled={enviando}
                onClick={() => setModalReset({ alcance: 'todo' })}
              >
                <RefreshCw aria-hidden="true" />
                Restablecer plantilla
              </Boton>
            )}
          </div>
        </div>

        {/* Los 8 bloques interactivos del esquema */}
        <div className="esquema-bloques">
          <button
            type="button"
            className="esquema-bloque is-fijo"
            onClick={() => setMostrarConfigSigla(true)}
            title="Haz clic para configurar la sigla inicial"
          >
            <span className="esquema-bloque-tag">
              <Lock size={11} aria-hidden="true" />
              ORG
            </span>
            <strong>{codigoSimulado.sig}</strong>
            <small>Sigla fija</small>
          </button>

          <div className="esquema-bloque is-fijo" title="Últimos 2 dígitos del año">
            <span className="esquema-bloque-tag">AA</span>
            <strong>{codigoSimulado.anio}</strong>
            <small>Año automático</small>
          </div>

          {TIPOS_ORDEN.map((t) => {
            const meta = METADATOS_TIPO[t]
            const stats = estadisticas.porTipo[t]
            const activo = tipoActivo === t
            const valor =
              t === 'proyecto'
                ? codigoSimulado.proyecto
                : t === 'subproyecto'
                  ? codigoSimulado.subproyecto
                  : t === 'departamento'
                    ? codigoSimulado.departamento
                    : t === 'disciplina'
                      ? codigoSimulado.disciplina
                      : codigoSimulado.tipo_documento
            return (
              <button
                key={t}
                type="button"
                className={`esquema-bloque is-editable ${activo ? 'is-activo' : ''}`}
                onClick={() => setTipoActivo(t)}
              >
                <span className="esquema-bloque-tag">{meta.sigla}</span>
                <strong>{valor}</strong>
                <small>
                  {meta.titulo} ({stats.activos})
                </small>
              </button>
            )
          })}

          <div className="esquema-bloque is-fijo" title="Contador atómico secuencial por combinación">
            <span className="esquema-bloque-tag">CCC</span>
            <strong>001</strong>
            <small>Consecutivo</small>
          </div>
        </div>

        {/* Simulador en vivo del esquema */}
        <div className="esquema-simulador">
          <div className="esquema-simulador-izq">
            <Sparkles size={15} aria-hidden="true" />
            <span>Resultado con tu esquema actual:</span>
            <code className="esquema-codigo-ejemplo">
              {codigoSimulado.sig}-{codigoSimulado.anio}-{codigoSimulado.proyecto}-{codigoSimulado.subproyecto}-
              {codigoSimulado.departamento}-{codigoSimulado.disciplina}-{codigoSimulado.tipo_documento}-001
            </code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Boton
              variante="ghost"
              tamano="sm"
              onClick={() => setSemillaEjemplo((n) => n + 1)}
              title="Probar otra combinación con tus segmentos activos"
            >
              <Shuffle aria-hidden="true" />
              Probar otro ejemplo
            </Boton>
          </div>
        </div>
      </div>

      {/* Editor del segmento seleccionado */}
      <div className="card tarjeta-bloque rev" style={orden(2)}>
        <div className="esquema-editor-cabecera">
          <div className="tabs" role="tablist" aria-label="Segmentos del esquema">
            {TIPOS_ORDEN.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tipoActivo === t}
                className="tab"
                onClick={() => {
                  setTipoActivo(t)
                  setEditandoId(null)
                  setBusqueda('')
                }}
              >
                {METADATOS_TIPO[t].titulo}
                <span className="tab-cuenta">{estadisticas.porTipo[t].activos}</span>
              </button>
            ))}
          </div>

          <div className="fila-botones">
            <Boton variante="primary" tamano="sm" onClick={() => setMostrarFormNuevo((v) => !v)}>
              <Plus aria-hidden="true" />
              {mostrarFormNuevo ? 'Cerrar formulario' : `Agregar a ${metaActual.titulo}`}
            </Boton>
          </div>
        </div>

        {/* Formulario colapsable para crear un nuevo elemento */}
        {mostrarFormNuevo && (
          <form onSubmit={agregarSegmento} className="esquema-nuevo-form">
            <div className="esquema-nuevo-head">
              <strong>
                Nuevo elemento en {metaActual.titulo} ({metaActual.sigla})
              </strong>
              <span className="tenue" style={{ fontSize: 12.5 }}>
                {metaActual.descripcion}
              </span>
            </div>
            <div className="filtros-avanzados" style={{ padding: 0, border: 0, background: 'transparent' }}>
              <label className="field">
                <span className="field-label">Código ({metaActual.sigla})</span>
                <input
                  type="text"
                  placeholder={`Ej. ${metaActual.ejemploCodigo}`}
                  value={nuevoCodigo}
                  onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Nombre descriptivo</span>
                <input
                  type="text"
                  placeholder={`Ej. ${metaActual.ejemploNombre}`}
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label className="field">
                <div className="field-label-row">
                  <span className="field-label">Código Shell (opcional)</span>
                  <BotonAyuda
                    titulo="Equivalencia con Cereipo Shell (D-39)"
                    texto="Si en el Shell o Control documental este elemento usa otro código (por ejemplo CIV en vez de C), escríbelo aquí para que la API los mapee automáticamente."
                  />
                </div>
                <input
                  type="text"
                  placeholder="Ej. CIV"
                  value={nuevoShell}
                  onChange={(e) => setNuevoShell(e.target.value.toUpperCase())}
                />
              </label>
              <label className="field">
                <span className="field-label">Motivo (opcional)</span>
                <input
                  type="text"
                  placeholder="Ej. Nuevo frente de obra"
                  value={nuevoMotivo}
                  onChange={(e) => setNuevoMotivo(e.target.value)}
                />
              </label>
            </div>
            <div className="fila-botones">
              <Boton type="submit" variante="primary" tamano="sm" cargando={enviando} disabled={enviando}>
                <Save aria-hidden="true" />
                Guardar en el esquema
              </Boton>
              <Boton type="button" variante="ghost" tamano="sm" onClick={() => setMostrarFormNuevo(false)}>
                Cancelar
              </Boton>
            </div>
          </form>
        )}

        {/* Barra de búsqueda, filtros y acciones rápidas del segmento */}
        <div className="registro-toolbar" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder={`Buscar en ${metaActual.titulo.toLowerCase()}…`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                className="btn-icono btn-icono-sm"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="registro-chips">
            {[
              { id: 'todos', lbl: 'Todos' },
              { id: 'activos', lbl: 'Activos' },
              { id: 'inactivos', lbl: 'Inactivos' },
              { id: 'personalizados', lbl: 'Personalizados / Editados' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip ${filtroEstado === f.id ? 'is-on' : ''}`}
                onClick={() => setFiltroEstado(f.id as typeof filtroEstado)}
              >
                {f.lbl}
              </button>
            ))}
          </div>

          <div className="fila-botones">
            {(tipoActivo === 'proyecto' || tipoActivo === 'subproyecto') && (
              <Boton
                variante="secondary"
                tamano="sm"
                disabled={enviando || esquemaVacio}
                onClick={() => ejecutarLote('solo_general')}
                title="Deja activo únicamente el código general (00 / 0) y desactiva los demás"
              >
                <Building2 aria-hidden="true" />
                Solo general ({tipoActivo === 'proyecto' ? '00' : '0'})
              </Boton>
            )}
            <Boton
              variante="ghost"
              tamano="sm"
              disabled={enviando || esquemaVacio}
              onClick={() => ejecutarLote('activar_todos')}
            >
              Activar todos
            </Boton>
            <Boton
              variante="ghost"
              tamano="sm"
              disabled={enviando}
              onClick={() => setModalReset({ alcance: 'tipo' })}
            >
              <RefreshCw aria-hidden="true" />
              Restablecer {metaActual.titulo.toLowerCase()}
            </Boton>
          </div>
        </div>

        {/* Tabla editable de segmentos */}
        <div className="table-wrap" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Código Shell</th>
                <th className="num">Orden</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                [0, 1, 2, 3].map((n) => (
                  <tr key={n}>
                    <td colSpan={7}>
                      <div className="esqueleto" style={{ height: 22 }} />
                    </td>
                  </tr>
                ))}

              {!cargando &&
                segmentosFiltrados.map((s) => {
                  const enEdicion = editandoId === s.id
                  const esGeneral =
                    (s.tipo === 'proyecto' || s.tipo === 'subproyecto') && esValorGeneral(s.codigo)
                  const origenEstado = estadoRespectoOriginal(s)

                  return (
                    <tr key={s.id} className={!s.activo ? 'fila-inactiva' : undefined}>
                      <td>
                        <div className="celda-codigo">
                          <span className="code-chip">{s.codigo}</span>
                          {esGeneral && <Etiqueta tono="info">General</Etiqueta>}
                        </div>
                      </td>

                      <td className="principal">
                        {enEdicion ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <input
                              type="text"
                              className="input-inline"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              aria-label="Editar nombre"
                              autoFocus
                            />
                            <input
                              type="text"
                              className="input-inline input-inline-sm"
                              value={editMotivo}
                              onChange={(e) => setEditMotivo(e.target.value)}
                              placeholder="Motivo del cambio (opcional)…"
                              aria-label="Motivo del cambio"
                            />
                          </div>
                        ) : (
                          s.nombre
                        )}
                      </td>

                      <td className="mono">
                        {enEdicion ? (
                          <input
                            type="text"
                            className="input-inline"
                            style={{ maxWidth: 110 }}
                            value={editShell}
                            onChange={(e) => setEditShell(e.target.value.toUpperCase())}
                            placeholder="Opcional"
                            aria-label="Editar código Shell"
                          />
                        ) : (
                          s.codigo_shell || '—'
                        )}
                      </td>

                      <td className="num mono">
                        {enEdicion ? (
                          <input
                            type="number"
                            className="input-inline"
                            style={{ maxWidth: 74, textAlign: 'right' }}
                            value={editOrden}
                            onChange={(e) => setEditOrden(Number(e.target.value) || 0)}
                            min={0}
                            max={32000}
                            aria-label="Editar orden"
                          />
                        ) : (
                          s.orden
                        )}
                      </td>

                      <td>
                        {origenEstado === 'propio' ? (
                          <Etiqueta tono="module">Propio</Etiqueta>
                        ) : origenEstado === 'editado' ? (
                          <Etiqueta tono="warn">Modificado</Etiqueta>
                        ) : (
                          <Etiqueta tono="muted">Plantilla</Etiqueta>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`tag-toggle ${s.activo ? 'is-on' : 'is-off'}`}
                          disabled={enviando}
                          onClick={() => alternarActivo(s)}
                          title={s.activo ? 'Clic para desactivar' : 'Clic para activar'}
                        >
                          <span className="tag-punto" aria-hidden="true" />
                          {s.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>

                      <td>
                        <div className="celda-acciones">
                          {enEdicion ? (
                            <>
                              <Boton
                                variante="primary"
                                tamano="sm"
                                disabled={enviando}
                                onClick={() => guardarEdicion(s)}
                              >
                                <Check aria-hidden="true" />
                                Guardar
                              </Boton>
                              <Boton
                                variante="ghost"
                                tamano="sm"
                                disabled={enviando}
                                onClick={() => setEditandoId(null)}
                              >
                                Cancelar
                              </Boton>
                            </>
                          ) : (
                            <Boton
                              variante="secondary"
                              tamano="sm"
                              disabled={enviando}
                              onClick={() => iniciarEdicion(s)}
                            >
                              <Edit3 aria-hidden="true" />
                              Editar
                            </Boton>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

              {!cargando && segmentosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="vacio">
                      <span className="icon-badge">
                        <Database aria-hidden="true" />
                      </span>
                      <p className="vacio-titulo">
                        {esquemaVacio ? 'Aún no has cargado un catálogo' : 'Sin elementos con este filtro'}
                      </p>
                      <p className="vacio-texto">
                        {esquemaVacio
                          ? 'Aplica la plantilla original en 1 clic o agrega elementos propios para comenzar.'
                          : 'Prueba otro filtro o agrega un nuevo elemento a esta categoría.'}
                      </p>
                      {esquemaVacio && (
                        <div className="vacio-accion">
                          <Boton variante="primary" tamano="sm" cargando={enviando} onClick={aplicarPlantillaInicial}>
                            <Database aria-hidden="true" />
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
      </div>

      {/* Modal confirmar restablecimiento de plantilla */}
      <Dialogo
        abierto={Boolean(modalReset)}
        alCerrar={() => setModalReset(null)}
        titulo={
          modalReset?.alcance === 'tipo'
            ? `Restablecer «${metaActual.titulo}» a la plantilla original`
            : 'Restablecer todo el esquema a la plantilla original'
        }
        descripcion="Se restaurarán los nombres, órdenes y estado activo de la plantilla original. Antes se guardará un punto de restauración automático por si deseas revertir."
        acciones={
          <>
            <Boton variante="secondary" onClick={() => setModalReset(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="primary" cargando={enviando} disabled={enviando} onClick={confirmarResetPlantilla}>
              <RefreshCw aria-hidden="true" />
              Restablecer plantilla
            </Boton>
          </>
        }
      >
        <div className="form-col">
          <Casilla
            checked={desactivarPersonalizados}
            onChange={(e) => setDesactivarPersonalizados(e.target.checked)}
          >
            Desactivar elementos personalizados que no pertenecen a la plantilla (los códigos ya emitidos no se pierden)
          </Casilla>

          <label className="field">
            <span className="field-label">Motivo (opcional)</span>
            <input
              type="text"
              placeholder="Ej. Volver al estándar corporativo"
              value={motivoReset}
              onChange={(e) => setMotivoReset(e.target.value)}
            />
          </label>
        </div>
      </Dialogo>

      {/* Modal de historial y reversión */}
      <HistorialCatalogoModal
        abierto={modalHistorial}
        tipoFiltro=""
        alCerrar={() => setModalHistorial(false)}
        alRevertir={() => cargarTodo()}
      />
    </section>
  )
}
