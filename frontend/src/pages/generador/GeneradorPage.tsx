import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  Eye,
  FolderKanban,
  HelpCircle,
  Layers,
  ListChecks,
  Lock,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
import { BotonAyuda } from '../../components/BotonAyuda'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { VistaPreviaCodigo } from '../../components/VistaPreviaCodigo'
import { esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import { registroApi, type ItemGenerar } from '../../services/registro'
import type { CatalogosAgrupados, Segmento } from '../../types/catalogos'
import type { CodigoItem, PrevisualizacionItem } from '../../types/registro'
import { Aviso, Boton, Etiqueta } from '../../ui/componentes'
import { SelectorBuscable, type OpcionSelector } from '../../ui/SelectorBuscable'
import { orden } from '../../ui/movimiento'

function nuevaClaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ui-${crypto.randomUUID()}`
  }
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function encontrarCodigoGeneral(lista: Segmento[] | undefined, fallback: string): string {
  if (!lista || lista.length === 0) return fallback
  const gen = lista.find((s) => esValorGeneral(s.codigo))
  return gen ? gen.codigo : lista[0].codigo
}

function encontrarPrimerProyectoEspecifico(lista: Segmento[] | undefined): string {
  if (!lista || lista.length === 0) return '01'
  const esp = lista.find((s) => !esValorGeneral(s.codigo))
  return esp ? esp.codigo : lista[0].codigo
}

function crearFilaVacia(catalogos: CatalogosAgrupados | null, iniciarGeneral = false): ItemGenerar {
  const proyGeneral = encontrarCodigoGeneral(catalogos?.proyecto, '00')
  const subGeneral = encontrarCodigoGeneral(catalogos?.subproyecto, '0')
  return {
    anio: String(new Date().getFullYear()),
    numero_proyecto: iniciarGeneral ? proyGeneral : (catalogos?.proyecto[0]?.codigo ?? '00'),
    subproyecto: iniciarGeneral ? subGeneral : (catalogos?.subproyecto[0]?.codigo ?? '0'),
    departamento: catalogos?.departamento[0]?.codigo ?? 'IN',
    disciplina: catalogos?.disciplina[0]?.codigo ?? 'G',
    tipo_documento: catalogos?.tipo_documento[0]?.codigo ?? 'DOC',
    motivo: '',
    clave_idempotencia: nuevaClaveIdempotencia(),
  }
}

export function GeneradorPage({
  ir,
  alAbrirAyuda,
}: {
  ir: (ruta: string) => void
  alAbrirAyuda?: () => void
}) {
  const { configOrg, recargarConfigOrg } = useIdentidad()
  const { notificar } = useAvisos()
  const iniciarGeneral = useMemo(() => new URLSearchParams(window.location.search).get('general') === '1', [])
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [modoLote, setModoLote] = useState(false)
  const [filas, setFilas] = useState<ItemGenerar[]>([crearFilaVacia(null, iniciarGeneral)])
  const [previews, setPreviews] = useState<PrevisualizacionItem[] | null>(null)
  const [generados, setGenerados] = useState<CodigoItem[] | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [ultimoCambio, setUltimoCambio] = useState<string>('')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    catalogosApi
      .listarSegmentos(false, ctrl.signal)
      .then((r) => {
        setCatalogos(r.segmentos)
        setFilas([crearFilaVacia(r.segmentos, iniciarGeneral)])
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [iniciarGeneral])

  function actualizarFila(idx: number, campo: keyof ItemGenerar, valor: string) {
    setPreviews(null)
    setGenerados(null)
    setUltimoCambio(`${idx}-${campo}-${valor}`)
    setFilas((prev) =>
      prev.map((f, i) =>
        i === idx
          ? {
              ...f,
              [campo]: valor,
              clave_idempotencia: campo === 'motivo' ? f.clave_idempotencia : nuevaClaveIdempotencia(),
            }
          : f,
      ),
    )
  }

  function aplicarAlcanceGeneral(idx: number, activarGeneral: boolean) {
    setPreviews(null)
    setGenerados(null)
    const proyGen = encontrarCodigoGeneral(catalogos?.proyecto, '00')
    const subGen = encontrarCodigoGeneral(catalogos?.subproyecto, '0')
    const proyEsp = encontrarPrimerProyectoEspecifico(catalogos?.proyecto)
    setUltimoCambio(`${idx}-alcance-${activarGeneral ? 'gen' : 'proy'}`)
    setFilas((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f
        const nuevoProyecto = activarGeneral
          ? proyGen
          : esValorGeneral(f.numero_proyecto)
            ? proyEsp
            : f.numero_proyecto
        const nuevoSub = activarGeneral ? subGen : f.subproyecto
        return {
          ...f,
          numero_proyecto: nuevoProyecto,
          subproyecto: nuevoSub,
          clave_idempotencia: nuevaClaveIdempotencia(),
        }
      }),
    )
  }

  function agregarFila() {
    setPreviews(null)
    setFilas((prev) => [...prev, crearFilaVacia(catalogos, iniciarGeneral)])
  }

  function duplicarFila(idx: number) {
    setPreviews(null)
    setFilas((prev) => {
      const base = prev[idx]
      if (!base) return prev
      const copia: ItemGenerar = {
        ...base,
        motivo: base.motivo ? `${base.motivo} (copia)` : '',
        clave_idempotencia: nuevaClaveIdempotencia(),
      }
      return [...prev.slice(0, idx + 1), copia, ...prev.slice(idx + 1)]
    })
  }

  function quitarFila(idx: number) {
    setPreviews(null)
    setFilas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function previsualizar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    setGenerados(null)
    try {
      const r = await registroApi.previsualizar(filas)
      setPreviews(r.previsualizaciones)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  async function confirmarGeneracion() {
    setCargando(true)
    setError('')
    try {
      const r = await registroApi.generar(filas)
      setGenerados(r.resultados)
      setAdvertencia(r.advertencia_correo)
      setPreviews(null)
      setFilas([crearFilaVacia(catalogos, iniciarGeneral)])
      notificar(
        r.resultados.length > 1 ? `${r.resultados.length} códigos generados` : 'Código generado y confirmado',
        r.resultados[0]?.codigo,
        'ok',
      )
      if (!configOrg?.bloqueada_por_codigos) {
        void recargarConfigOrg()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  async function copiar(codigo: string, id: string) {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiadoId(id)
      notificar('Código copiado', codigo, 'ok')
      window.setTimeout(() => setCopiadoId((p) => (p === id ? null : p)), 1800)
    } catch {
      notificar('No se pudo copiar', 'Copia el código manualmente.', 'warn')
    }
  }

  const anioTope = Math.max(2029, new Date().getFullYear() + 2)
  const opcionesAnio: OpcionSelector[] = useMemo(
    () =>
      Array.from({ length: anioTope - 2015 + 1 }, (_, i) => {
        const y = String(2015 + i)
        return { valor: y, codigoCorto: y.slice(-2), texto: `Año ${y}` }
      }).reverse(),
    [anioTope],
  )

  const aOpciones = (lista: Segmento[] | undefined, marcarGeneral = false): OpcionSelector[] =>
    (lista ?? []).map((s) => ({
      valor: s.codigo,
      codigoCorto: s.codigo,
      texto: s.nombre,
      esGeneral: marcarGeneral && esValorGeneral(s.codigo),
    }))

  const opcionesProyecto = useMemo(() => aOpciones(catalogos?.proyecto, true), [catalogos])
  const opcionesSubproyecto = useMemo(() => aOpciones(catalogos?.subproyecto, true), [catalogos])
  const opcionesDepto = useMemo(() => aOpciones(catalogos?.departamento), [catalogos])
  const opcionesDisciplina = useMemo(() => aOpciones(catalogos?.disciplina), [catalogos])
  const opcionesTipo = useMemo(() => aOpciones(catalogos?.tipo_documento), [catalogos])

  const sigla = configOrg?.configurada ? configOrg.sigla : 'SIGLA'
  const filaPrincipal = filas[0]
  const previewPrincipal = previews?.[0]
  const pasoFlujo = generados ? 3 : previews ? 2 : 1

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Generar código manual</h1>
            <BotonAyuda
              titulo="¿Cómo funciona el generador manual?"
              texto="1) Elige los 6 segmentos variables (la sigla es fija por organización) y escribe el motivo. 2) Pulsa «Vista previa» para calcular el consecutivo estimado. 3) Confirma para reservar el código definitivamente."
              destacado="Si el código es general y no cae en ningún proyecto, selecciona Proyecto «00» y Subproyecto «0 / 00»."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">
            Ensambla códigos bajo la metodología de 8 segmentos con previsualización atómica en dos pasos.
          </p>
        </div>
        <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      {/* Barra de pasos del flujo (2 pasos + confirmación) */}
      <div className="card flujo-pasos-card rev" style={orden(1)}>
        <ol className="ms-list" aria-label="Progreso de generación">
          {[
            { num: 1, titulo: 'Configurar segmentos', sub: 'Selección y motivo' },
            { num: 2, titulo: 'Vista previa', sub: 'Consecutivo estimado' },
            { num: 3, titulo: 'Confirmado', sub: 'Código único emitido' },
          ].map((p) => {
            const hecho = pasoFlujo > p.num || (p.num === 3 && pasoFlujo === 3)
            const actual = pasoFlujo === p.num && p.num !== 3
            return (
              <li key={p.num} className={`ms-item ${hecho ? 'is-hecho' : actual ? 'is-actual' : ''}`}>
                <span className="ms-nodo">{hecho ? <Check size={13} aria-hidden="true" /> : p.num}</span>
                <span>
                  <b>{p.titulo}</b>
                  <small>{p.sub}</small>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="tabs" role="tablist" aria-label="Modo de generación">
          <button
            type="button"
            role="tab"
            aria-selected={!modoLote}
            className="tab"
            onClick={() => {
              setModoLote(false)
              setPreviews(null)
              setFilas((f) => [f[0] || crearFilaVacia(catalogos, iniciarGeneral)])
            }}
          >
            Individual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoLote}
            className="tab"
            onClick={() => {
              setModoLote(true)
              setPreviews(null)
            }}
          >
            <Layers aria-hidden="true" />
            En lote ({filas.length})
          </button>
        </div>
      </div>

      {/* Cinta interactiva en vivo del código (modo individual) */}
      {!modoLote && filaPrincipal && !generados && (
        <div className="card constructor-vivo rev" style={orden(2)}>
          <div className="constructor-vivo-head">
            <span className="constructor-vivo-titulo">
              <Sparkles size={16} aria-hidden="true" />
              Vista en tiempo real del código
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {esValorGeneral(filaPrincipal.numero_proyecto) && esValorGeneral(filaPrincipal.subproyecto) ? (
                <Etiqueta tono="info" punto>
                  Código general (00) · Sin proyecto
                </Etiqueta>
              ) : (
                <Etiqueta tono="module">Proyecto {filaPrincipal.numero_proyecto}</Etiqueta>
              )}
              <BotonAyuda
                titulo="Constructor de 8 segmentos"
                texto="Cada ficha representa un segmento del código final. El último segmento (CCC) se calcula automáticamente al pulsar «Vista previa» según la combinación exacta de los 7 anteriores."
                alAbrirGuiaCompleta={alAbrirAyuda}
              />
            </div>
          </div>

          <div className="constructor-bloques">
            {[
              { lbl: 'Org', val: sigla, fijo: true },
              { lbl: 'Año', val: filaPrincipal.anio.slice(-2), clave: 'anio' },
              {
                lbl: 'Proy',
                val: filaPrincipal.numero_proyecto,
                clave: 'numero_proyecto',
                general: esValorGeneral(filaPrincipal.numero_proyecto),
              },
              {
                lbl: 'Sub',
                val: filaPrincipal.subproyecto,
                clave: 'subproyecto',
                general: esValorGeneral(filaPrincipal.subproyecto),
              },
              { lbl: 'Depto', val: filaPrincipal.departamento, clave: 'departamento' },
              { lbl: 'Disc', val: filaPrincipal.disciplina, clave: 'disciplina' },
              { lbl: 'Tipo', val: filaPrincipal.tipo_documento, clave: 'tipo_documento' },
              {
                lbl: 'Cons',
                val: previewPrincipal ? String(previewPrincipal.consecutivo_tentativo).padStart(3, '0') : '???',
                cons: true,
                calculado: Boolean(previewPrincipal),
              },
            ].map((b, i) => (
              <div
                key={`${b.lbl}-${ultimoCambio === `0-${b.clave}-${b.val}` ? ultimoCambio : i}`}
                className={`constructor-bloque ${b.fijo ? 'is-fijo' : ''} ${b.general ? 'is-general' : ''} ${
                  b.cons ? 'is-cons' : ''
                } ${b.calculado ? 'is-calculado' : ''} ${
                  ultimoCambio.startsWith(`0-${b.clave}-`) ? 'is-pop' : ''
                }`}
              >
                <span className="constructor-bloque-val">{b.val}</span>
                <small className="constructor-bloque-lbl">{b.lbl}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario de segmentos */}
      <div className="card tarjeta-generador rev" style={orden(3)}>
        <form onSubmit={previsualizar} className="form-col">
          {filas.map((fila, idx) => {
            const proyEsGeneral = esValorGeneral(fila.numero_proyecto)
            const subEsGeneral = esValorGeneral(fila.subproyecto)
            const esCodigoGeneral = proyEsGeneral && subEsGeneral

            return (
              <div key={idx} className="fila-lote-card">
                <div className="fila-lote-head">
                  <div className="alcance-toggle-grupo">
                    <span className="alcance-etiqueta">
                      {modoLote ? `Código #${idx + 1} · Alcance:` : 'Alcance del código:'}
                    </span>
                    <div className="alcance-pills" role="group" aria-label="Elegir si el código es de proyecto o general">
                      <button
                        type="button"
                        className={`chip ${esCodigoGeneral ? 'is-on' : ''}`}
                        onClick={() => aplicarAlcanceGeneral(idx, true)}
                      >
                        <Building2 size={14} aria-hidden="true" />
                        Código general (00)
                      </button>
                      <button
                        type="button"
                        className={`chip ${!proyEsGeneral ? 'is-on' : ''}`}
                        onClick={() => aplicarAlcanceGeneral(idx, false)}
                      >
                        <FolderKanban size={14} aria-hidden="true" />
                        Proyecto específico
                      </button>
                    </div>
                    <BotonAyuda
                      titulo="¿Proyecto específico o Código general (00)?"
                      texto="Usa «Código general (00)» cuando el documento no cae en ningún proyecto (normas corporativas, manuales, instructivos transversales). Si pertenece a un proyecto u obra, elige «Proyecto específico»."
                      destacado="00 en Proyecto + 0 / 00 en Subproyecto = Código general fuera de proyecto."
                      alAbrirGuiaCompleta={alAbrirAyuda}
                    />
                  </div>

                  {modoLote && (
                    <div className="fila-lote-acciones">
                      <span className="code-chip" style={{ fontSize: 12 }}>
                        {sigla}-{fila.anio.slice(-2)}-{fila.numero_proyecto}-{fila.subproyecto}-{fila.departamento}-
                        {fila.disciplina}-{fila.tipo_documento}-???
                      </span>
                      <button
                        type="button"
                        className="btn-icono btn-icono-sm"
                        onClick={() => duplicarFila(idx)}
                        title="Duplicar esta fila"
                        aria-label={`Duplicar fila ${idx + 1}`}
                      >
                        <CopyPlus aria-hidden="true" />
                      </button>
                      {filas.length > 1 && (
                        <button
                          type="button"
                          className="btn-icono btn-icono-sm"
                          style={{ color: 'var(--danger-fg)' }}
                          onClick={() => quitarFila(idx)}
                          title="Quitar fila"
                          aria-label={`Quitar fila ${idx + 1}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Banner contextual explicativo para 00 */}
                {proyEsGeneral && (
                  <Aviso tono="info" className="aviso-00">
                    <strong>Modo código general (00):</strong> Al usar <code>00</code> en Proyecto
                    {subEsGeneral ? (
                      <>
                        {' '}
                        y <code>{fila.subproyecto}</code> en Subproyecto
                      </>
                    ) : null}
                    , este código queda clasificado como documento general de la organización y{' '}
                    <b>no cae en ningún proyecto</b>.
                  </Aviso>
                )}

                {!proyEsGeneral && subEsGeneral && (
                  <Aviso tono="muted" className="aviso-00">
                    <strong>Sin subproyecto ({fila.subproyecto}):</strong> El código pertenece al Proyecto{' '}
                    <code>{fila.numero_proyecto}</code> a nivel general, sin subdivisión por subproyecto.
                  </Aviso>
                )}

                <div className="rejilla-segmentos">
                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">
                        <Lock size={13} aria-hidden="true" />
                        Organización (ORG)
                      </span>
                      <BotonAyuda
                        titulo="Organización fija"
                        texto="Primer segmento del código. Se toma automáticamente de tu organización activa y no se edita manualmente."
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <input type="text" value={configOrg?.configurada ? configOrg.sigla : 'Sin sigla'} disabled />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">Año (AA)</span>
                      <BotonAyuda
                        titulo="Año del código (AA)"
                        texto="Se toman los últimos 2 dígitos (ej. 2026 → 26). Los consecutivos se cuentan por separado cada año."
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Año"
                      valor={fila.anio}
                      opciones={opcionesAnio}
                      buscable={false}
                      alCambiar={(v) => actualizarFila(idx, 'anio', v)}
                    />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">N.º Proyecto (NN)</span>
                      <BotonAyuda
                        titulo="Número de proyecto (NN)"
                        texto="Identifica el proyecto u obra (01–99). El valor «00» significa que es un código general de la organización que no cae en ningún proyecto."
                        destacado="00 = Código general (sin proyecto)"
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Número de proyecto"
                      valor={fila.numero_proyecto}
                      opciones={opcionesProyecto}
                      alCambiar={(v) => actualizarFila(idx, 'numero_proyecto', v)}
                    />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">Subproyecto (S)</span>
                      <BotonAyuda
                        titulo="Subproyecto (S)"
                        texto="Subdivisión interna dentro del proyecto (A–Z). Si el documento es general (Proyecto 00) o el proyecto no se subdivide, usa el valor general (0 / 00)."
                        destacado="00 / 0 = General / Sin subproyecto"
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Subproyecto"
                      valor={fila.subproyecto}
                      opciones={opcionesSubproyecto}
                      alCambiar={(v) => actualizarFila(idx, 'subproyecto', v)}
                    />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">Departamento (DEPT)</span>
                      <BotonAyuda
                        titulo="Departamento responsable (DEPT)"
                        texto="Área o gerencia emisora del documento (ej. IN Ingeniería, GG Gerencia General, CD Control de Documentos)."
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Departamento"
                      valor={fila.departamento}
                      opciones={opcionesDepto}
                      alCambiar={(v) => actualizarFila(idx, 'departamento', v)}
                    />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">Disciplina (DISC)</span>
                      <BotonAyuda
                        titulo="Disciplina técnica (DISC)"
                        texto="Especialidad del documento (M Mecánica, C Civil, E Electricidad, etc.) o «G» General para documentos multidisciplinarios o corporativos."
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Disciplina"
                      valor={fila.disciplina}
                      opciones={opcionesDisciplina}
                      alCambiar={(v) => actualizarFila(idx, 'disciplina', v)}
                    />
                  </div>

                  <div className="field">
                    <div className="field-label-row">
                      <span className="field-label">Tipo (TIPO)</span>
                      <BotonAyuda
                        titulo="Tipo de documento o plano (TIPO)"
                        texto="Clasifica el entregable: Plano (PLA), Documento (DOC), Procedimiento (PRO), Informe (INF), Formulario (FOR), etc."
                        alAbrirGuiaCompleta={alAbrirAyuda}
                      />
                    </div>
                    <SelectorBuscable
                      etiqueta="Tipo de documento"
                      valor={fila.tipo_documento}
                      opciones={opcionesTipo}
                      alCambiar={(v) => actualizarFila(idx, 'tipo_documento', v)}
                    />
                  </div>
                </div>

                <label className="field">
                  <div className="field-label-row">
                    <span className="field-label">Motivo / Asunto obligatorio</span>
                    <BotonAyuda
                      titulo="Motivo del código"
                      texto="Describe qué documento o plano recibirá este código. Queda guardado permanentemente en el registro y en la auditoría."
                    />
                  </div>
                  <input
                    type="text"
                    value={fila.motivo || ''}
                    onChange={(e) => actualizarFila(idx, 'motivo', e.target.value)}
                    placeholder={
                      proyEsGeneral
                        ? 'Ej. Procedimiento general de control documental corporativo'
                        : 'Ej. Plano de cimentación edificio norte'
                    }
                    required
                  />
                </label>
              </div>
            )
          })}

          {error && (
            <Aviso tono="error" className="aviso-sacudir">
              {error}
            </Aviso>
          )}

          <div className="generador-acciones">
            <div className="fila-botones">
              {modoLote && (
                <Boton type="button" variante="secondary" onClick={agregarFila}>
                  <Plus aria-hidden="true" />
                  Agregar fila al lote
                </Boton>
              )}
              <Boton
                type="button"
                variante="ghost"
                onClick={alAbrirAyuda}
              >
                <HelpCircle aria-hidden="true" />
                Entender los 8 segmentos
              </Boton>
            </div>

            <Boton
              type="submit"
              variante="primary"
              cargando={cargando && !previews}
              disabled={cargando || !configOrg?.configurada || !catalogos}
            >
              <Eye aria-hidden="true" />
              {cargando && !previews ? 'Calculando…' : 'Calcular vista previa'}
              <ArrowRight className="btn-flecha" aria-hidden="true" />
            </Boton>
          </div>
        </form>
      </div>

      {/* Paso 2: Vista previa antes de confirmar */}
      {previews && (
        <div className="card tarjeta-preview rev">
          <div className="preview-cabecera">
            <div>
              <span className="kicker">Paso 2 · Verificación</span>
              <h2 className="panel-titulo" style={{ marginTop: 4 }}>
                Vista previa ({previews.length} {previews.length === 1 ? 'código' : 'códigos'})
              </h2>
              <p className="tenue">
                El consecutivo definitivo se asigna de forma atómica al pulsar «Confirmar y generar».
              </p>
            </div>
            <BotonAyuda
              titulo="¿Por qué hay una vista previa?"
              texto="La vista previa consulta el último consecutivo sin bloquear la base de datos. Al confirmar, el motor adquiere un bloqueo transaccional atómico para garantizar que nadie más reciba este mismo número."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>

          <div className="form-col" style={{ marginTop: 14 }}>
            {previews.map((p, i) => (
              <VistaPreviaCodigo key={i} item={p} indice={i} />
            ))}
          </div>

          <div className="dialogo-acciones" style={{ marginTop: 18 }}>
            <Boton variante="secondary" onClick={() => setPreviews(null)} disabled={cargando}>
              Ajustar segmentos
            </Boton>
            <Boton variante="primary" onClick={confirmarGeneracion} cargando={cargando} disabled={cargando}>
              <Check aria-hidden="true" />
              {cargando ? 'Generando…' : 'Confirmar y generar'}
            </Boton>
          </div>
        </div>
      )}

      {/* Paso 3: Éxito animado */}
      {generados && (
        <div className="card tarjeta-exito rev-escala">
          <div className="exito-cabecera">
            <span className="exito-sello">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <span className="kicker" style={{ color: 'var(--ok-fg)' }}>
                Paso 3 · Emitido y registrado
              </span>
              <h2>
                {generados.length === 1 ? 'Código generado correctamente' : `${generados.length} códigos generados`}
              </h2>
            </div>
          </div>

          {advertencia && <Aviso tono="warn">{advertencia}</Aviso>}

          <ul className="exito-lista">
            {generados.map((g, i) => (
              <li key={g.id} className="exito-item rev" style={orden(i)}>
                <div>
                  <div className="exito-codigo">{g.codigo}</div>
                  <p className="exito-motivo">{g.motivo}</p>
                </div>
                <div className="fila-botones">
                  {esValorGeneral(g.numero_proyecto) && <Etiqueta tono="info">General (00)</Etiqueta>}
                  <Boton variante="secondary" tamano="sm" onClick={() => copiar(g.codigo, g.id)}>
                    {copiadoId === g.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copiadoId === g.id ? 'Copiado' : 'Copiar'}
                  </Boton>
                </div>
              </li>
            ))}
          </ul>

          <div className="fila-botones" style={{ marginTop: 16 }}>
            <Boton
              variante="primary"
              onClick={() => ir(`/registro/?codigo=${encodeURIComponent(generados[0]?.codigo ?? '')}`)}
            >
              <ListChecks aria-hidden="true" />
              Ver en el registro
              <ArrowRight className="btn-flecha" aria-hidden="true" />
            </Boton>
            <Boton
              variante="secondary"
              onClick={() => {
                setGenerados(null)
                setAdvertencia(null)
              }}
            >
              <Plus aria-hidden="true" />
              Generar otro código
            </Boton>
          </div>
        </div>
      )}
    </section>
  )
}
