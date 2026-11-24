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
import {
  CATALOGO_ORIGINAL,
  catalogoEstaVacio,
  obtenerAniosOriginales,
  resolverCatalogoConOriginal,
} from '../../data/catalogoOriginal'
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

function encontrarCodigoGeneral(lista: Segmento[], fallback: string): string {
  const gen = lista.find((s) => esValorGeneral(s.codigo))
  return gen ? gen.codigo : (lista[0]?.codigo ?? fallback)
}

function encontrarPrimerProyectoEspecifico(lista: Segmento[]): string {
  const esp = lista.find((s) => !esValorGeneral(s.codigo))
  return esp ? esp.codigo : (lista[0]?.codigo ?? '01')
}

function crearFilaVacia(catalogos: CatalogosAgrupados, iniciarGeneral = false): ItemGenerar {
  const proyGeneral = encontrarCodigoGeneral(catalogos.proyecto, '00')
  const subGeneral = encontrarCodigoGeneral(catalogos.subproyecto, '0')
  return {
    anio: String(new Date().getFullYear()),
    numero_proyecto: iniciarGeneral ? proyGeneral : (catalogos.proyecto[0]?.codigo ?? '00'),
    subproyecto: iniciarGeneral ? subGeneral : (catalogos.subproyecto[0]?.codigo ?? '0'),
    departamento: catalogos.departamento.find((d) => d.codigo === 'IN')?.codigo ?? catalogos.departamento[0]?.codigo ?? 'IN',
    disciplina: catalogos.disciplina.find((d) => d.codigo === 'G')?.codigo ?? catalogos.disciplina[0]?.codigo ?? 'G',
    tipo_documento: catalogos.tipo_documento.find((t) => t.codigo === 'DOC')?.codigo ?? catalogos.tipo_documento[0]?.codigo ?? 'DOC',
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
  const { configOrg, recargarConfigOrg, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const iniciarGeneral = useMemo(() => new URLSearchParams(window.location.search).get('general') === '1', [])
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados>(CATALOGO_ORIGINAL)
  const [modoLote, setModoLote] = useState(false)
  const [filas, setFilas] = useState<ItemGenerar[]>(() => [crearFilaVacia(CATALOGO_ORIGINAL, iniciarGeneral)])
  const [previews, setPreviews] = useState<PrevisualizacionItem[] | null>(null)
  const [generados, setGenerados] = useState<CodigoItem[] | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [ultimoCambio, setUltimoCambio] = useState<string>('')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelado = false

    async function cargarCatalogos() {
      try {
        const r = await catalogosApi.listarSegmentos(false, ctrl.signal)
        if (cancelado) return

        let segmentos = r.segmentos
        if (catalogoEstaVacio(segmentos) && puede('codigos:catalogos:administrar')) {
          try {
            await catalogosApi.sembrarEstandar()
            const r2 = await catalogosApi.listarSegmentos(false, ctrl.signal)
            if (!cancelado) segmentos = r2.segmentos
          } catch {
            // Si no se pudo sembrar automáticamente, usamos el catálogo original local.
          }
        }

        const resuelto = resolverCatalogoConOriginal(segmentos)
        if (!cancelado) {
          setCatalogos(resuelto)
          setFilas([crearFilaVacia(resuelto, iniciarGeneral)])
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return
        if (!cancelado) setCatalogos(CATALOGO_ORIGINAL)
      }
    }

    void cargarCatalogos()
    return () => {
      cancelado = true
      ctrl.abort()
    }
  }, [iniciarGeneral, puede])

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
    const proyGen = encontrarCodigoGeneral(catalogos.proyecto, '00')
    const subGen = encontrarCodigoGeneral(catalogos.subproyecto, '0')
    const proyEsp = encontrarPrimerProyectoEspecifico(catalogos.proyecto)
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

  const opcionesAnio: OpcionSelector[] = useMemo(
    () =>
      obtenerAniosOriginales().map((y) => ({
        valor: y,
        codigoCorto: y.slice(-2),
        texto: y,
      })),
    [],
  )

  const aOpciones = (lista: Segmento[], marcarGeneral = false): OpcionSelector[] =>
    lista.map((s) => ({
      valor: s.codigo,
      codigoCorto: s.codigo,
      texto: s.nombre,
      esGeneral: marcarGeneral && esValorGeneral(s.codigo),
    }))

  const opcionesProyecto = useMemo(() => aOpciones(catalogos.proyecto, true), [catalogos])
  const opcionesSubproyecto = useMemo(() => aOpciones(catalogos.subproyecto, true), [catalogos])
  const opcionesDepto = useMemo(() => aOpciones(catalogos.departamento), [catalogos])
  const opcionesDisciplina = useMemo(() => aOpciones(catalogos.disciplina), [catalogos])
  const opcionesTipo = useMemo(() => aOpciones(catalogos.tipo_documento), [catalogos])

  const sigla = configOrg?.configurada ? configOrg.sigla : 'SIGLA'
  const filaPrincipal = filas[0]
  const previewPrincipal = previews?.[0]
  const pasoFlujo = generados ? 3 : previews ? 2 : 1

  const codigoEnVivo = filaPrincipal
    ? `${sigla}-${filaPrincipal.anio.slice(-2)}-${filaPrincipal.numero_proyecto}-${filaPrincipal.subproyecto}-${filaPrincipal.departamento}-${filaPrincipal.disciplina}-${filaPrincipal.tipo_documento}-${
        previewPrincipal ? String(previewPrincipal.consecutivo_tentativo).padStart(3, '0') : '###'
      }`
    : ''

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Generar código manual</h1>
            <BotonAyuda
              titulo="¿Cómo funciona el generador manual?"
              texto="Selecciona los segmentos del catálogo estándar y escribe el motivo. Pulsa «Vista previa» para ver el consecutivo estimado y luego «Confirmar y generar» para registrarlo atómicamente."
              destacado="Usa 00 en Proyecto y 0 en Subproyecto para asuntos generales que no caen en ningún proyecto."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">
            Catálogo estándar de 8 segmentos con previsualización en tiempo real y consecutivo atómico.
          </p>
        </div>

        <div className="cabecera-acciones">
          <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
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
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      {/* Layout fluido: 2 columnas en individual (formulario + panel fijo), 1 columna en lote */}
      <div className={modoLote ? 'generador-layout-lote' : 'generador-layout'}>
        <div className="generador-col-form">
          <div className="card tarjeta-generador rev" style={orden(1)}>
            <form id="form-generador" onSubmit={previsualizar} className="form-col">
              {filas.map((fila, idx) => {
                const proyEsGeneral = esValorGeneral(fila.numero_proyecto)
                const subEsGeneral = esValorGeneral(fila.subproyecto)
                const esCodigoGeneral = proyEsGeneral && subEsGeneral

                return (
                  <div key={idx} className={modoLote ? 'fila-lote-card' : 'form-col'}>
                    <div className="fila-lote-head">
                      <div className="alcance-toggle-grupo">
                        <span className="alcance-etiqueta">
                          {modoLote ? `Código #${idx + 1} · Alcance:` : 'Alcance:'}
                        </span>
                        <div className="alcance-pills" role="group" aria-label="Alcance del código">
                          <button
                            type="button"
                            className={`chip ${esCodigoGeneral ? 'is-on' : ''}`}
                            onClick={() => aplicarAlcanceGeneral(idx, true)}
                          >
                            <Building2 size={14} aria-hidden="true" />
                            General (00)
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
                          titulo="¿Cuándo usar 00?"
                          texto="Usa «General (00)» cuando el documento no pertenece a ningún proyecto específico (asuntos generales, manuales, políticas o procedimientos corporativos)."
                          destacado="00 en Proyecto + 0 en Subproyecto = Código general sin proyecto."
                          alAbrirGuiaCompleta={alAbrirAyuda}
                        />
                      </div>

                      {modoLote && (
                        <div className="fila-lote-acciones">
                          <span className="code-chip" style={{ fontSize: 12 }}>
                            {sigla}-{fila.anio.slice(-2)}-{fila.numero_proyecto}-{fila.subproyecto}-{fila.departamento}-
                            {fila.disciplina}-{fila.tipo_documento}-###
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

                    {proyEsGeneral && (
                      <Aviso tono="info" className="aviso-00">
                        <strong>Asunto general (00):</strong> Este código no cae en ningún proyecto específico de la
                        organización.
                      </Aviso>
                    )}

                    <div className="rejilla-segmentos">
                      <div className="field">
                        <div className="field-label-row">
                          <span className="field-label">
                            <Lock size={13} aria-hidden="true" />
                            Sigla organización
                          </span>
                          <BotonAyuda
                            titulo="Sigla de la organización"
                            texto="Define el prefijo (sigla) que iniciará el código. Se configura en Administración / Catálogos del módulo."
                            alAbrirGuiaCompleta={alAbrirAyuda}
                          />
                        </div>
                        <input
                          type="text"
                          value={configOrg?.configurada ? configOrg.sigla : 'Sin sigla'}
                          disabled
                        />
                      </div>

                      <div className="field">
                        <div className="field-label-row">
                          <span className="field-label">Año</span>
                          <BotonAyuda
                            titulo="Año"
                            texto="Año del proyecto o del documento. Se muestran los últimos 2 dígitos en el código."
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
                          <span className="field-label">N.º Proyecto</span>
                          <BotonAyuda
                            titulo="Número de proyecto"
                            texto="Identificador numérico del proyecto (dos dígitos, 00 a 99). Usa 00 para asuntos generales."
                            destacado="00 = Código general (no cae en ningún proyecto)"
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
                          <span className="field-label">Subproyecto</span>
                          <BotonAyuda
                            titulo="Subproyecto"
                            texto="Letra (A–Z) o 0 según la estructura del proyecto. Usa 0 cuando aplique como general."
                            destacado="0 = General / Sin subproyecto"
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
                          <span className="field-label">Departamento</span>
                          <BotonAyuda
                            titulo="Departamento"
                            texto="Área responsable; define el segmento departamental en el código."
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
                          <span className="field-label">Disciplina</span>
                          <BotonAyuda
                            titulo="Disciplina"
                            texto="Disciplina técnica asociada al entregable (o G para General)."
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
                          <span className="field-label">Tipo de documento</span>
                          <BotonAyuda
                            titulo="Tipo de documento"
                            texto="Clasificación del documento (contrato, plano, procedimiento, etc.)."
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
                          titulo="Motivo"
                          texto="Describe brevemente el documento o plano que llevará este código. Queda registrado en la auditoría."
                        />
                      </div>
                      <input
                        type="text"
                        value={fila.motivo || ''}
                        onChange={(e) => actualizarFila(idx, 'motivo', e.target.value)}
                        placeholder={
                          proyEsGeneral
                            ? 'Ej. Procedimiento general de gestión de calidad'
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

              {modoLote && (
                <div className="generador-acciones">
                  <Boton type="button" variante="secondary" onClick={agregarFila}>
                    <Plus aria-hidden="true" />
                    Agregar fila al lote
                  </Boton>
                  <Boton
                    type="submit"
                    variante="primary"
                    cargando={cargando && !previews}
                    disabled={cargando || !configOrg?.configurada}
                  >
                    <Eye aria-hidden="true" />
                    {cargando && !previews ? 'Calculando…' : `Vista previa (${filas.length})`}
                    <ArrowRight className="btn-flecha" aria-hidden="true" />
                  </Boton>
                </div>
              )}
            </form>
          </div>

          {/* Vista previa en lote */}
          {modoLote && previews && (
            <div className="card tarjeta-preview rev" style={{ marginTop: 16 }}>
              <div className="preview-cabecera">
                <div>
                  <span className="kicker">Verificación de lote</span>
                  <h2 className="panel-titulo" style={{ marginTop: 4 }}>
                    Vista previa ({previews.length} códigos)
                  </h2>
                </div>
              </div>
              <div className="form-col" style={{ marginTop: 14 }}>
                {previews.map((p, i) => (
                  <VistaPreviaCodigo key={i} item={p} indice={i} />
                ))}
              </div>
              <div className="dialogo-acciones" style={{ marginTop: 18 }}>
                <Boton variante="secondary" onClick={() => setPreviews(null)} disabled={cargando}>
                  Ajustar
                </Boton>
                <Boton variante="primary" onClick={confirmarGeneracion} cargando={cargando} disabled={cargando}>
                  <Check aria-hidden="true" />
                  {cargando ? 'Generando…' : 'Confirmar y generar lote'}
                </Boton>
              </div>
            </div>
          )}

          {/* Resultado exitoso */}
          {generados && (
            <div className="card tarjeta-exito rev-escala" style={{ marginTop: 16 }}>
              <div className="exito-cabecera">
                <span className="exito-sello">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <div>
                  <span className="kicker" style={{ color: 'var(--ok-fg)' }}>
                    Emitido y registrado
                  </span>
                  <h2>
                    {generados.length === 1
                      ? 'Código generado correctamente'
                      : `${generados.length} códigos generados`}
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
                  Generar otro
                </Boton>
              </div>
            </div>
          )}
        </div>

        {/* Panel fijo derecho en modo individual: vista previa en tiempo real + acción */}
        {!modoLote && filaPrincipal && (
          <aside className="generador-sticky rev" style={orden(2)}>
            <div className="card panel-vivo">
              <div className="panel-vivo-head">
                <span className="constructor-vivo-titulo">
                  <Sparkles size={16} aria-hidden="true" />
                  Código en tiempo real
                </span>
                <Etiqueta tono={pasoFlujo === 3 ? 'ok' : pasoFlujo === 2 ? 'module' : 'muted'} punto>
                  {pasoFlujo === 3 ? 'Confirmado' : pasoFlujo === 2 ? 'Listo para confirmar' : 'Borrador'}
                </Etiqueta>
              </div>

              <div className={`panel-vivo-codigo ${previewPrincipal ? 'is-calculado' : ''}`}>
                {codigoEnVivo}
              </div>

              <div className="panel-vivo-bloques">
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
                    val: previewPrincipal ? String(previewPrincipal.consecutivo_tentativo).padStart(3, '0') : '###',
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

              <div className="panel-vivo-acciones">
                {!previewPrincipal ? (
                  <Boton
                    type="submit"
                    form="form-generador"
                    variante="primary"
                    bloque
                    cargando={cargando}
                    disabled={cargando || !configOrg?.configurada}
                  >
                    <Eye aria-hidden="true" />
                    {cargando ? 'Calculando…' : 'Calcular vista previa'}
                    <ArrowRight className="btn-flecha" aria-hidden="true" />
                  </Boton>
                ) : (
                  <>
                    <Aviso tono="info">
                      Consecutivo estimado: <b>#{String(previewPrincipal.consecutivo_tentativo).padStart(3, '0')}</b>.
                      Al confirmar se reserva atómicamente.
                    </Aviso>
                    <Boton
                      type="button"
                      variante="primary"
                      bloque
                      cargando={cargando}
                      disabled={cargando}
                      onClick={confirmarGeneracion}
                    >
                      <Check aria-hidden="true" />
                      {cargando ? 'Generando…' : 'Confirmar y generar'}
                    </Boton>
                    <Boton
                      type="button"
                      variante="secondary"
                      bloque
                      disabled={cargando}
                      onClick={() => setPreviews(null)}
                    >
                      Seguir editando
                    </Boton>
                  </>
                )}

                <button type="button" className="panel-link" style={{ justifyContent: 'center' }} onClick={alAbrirAyuda}>
                  <HelpCircle size={14} aria-hidden="true" />
                  ¿Cómo funciona el motor de códigos?
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}
