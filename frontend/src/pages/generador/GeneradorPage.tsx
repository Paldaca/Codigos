import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  FolderKanban,
  Layers,
  ListChecks,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
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
import { Aviso, Boton, Dialogo } from '../../ui/componentes'
import { SelectorBuscable, type OpcionSelector } from '../../ui/SelectorBuscable'

const CLAVE_ULTIMO = 'cereipo-codigos-ultimo-uso'

function leerUltimoUso(): Partial<Pick<ItemGenerar, 'departamento' | 'disciplina' | 'tipo_documento'>> {
  try {
    const raw = window.localStorage.getItem(CLAVE_ULTIMO)
    return raw ? (JSON.parse(raw) as Partial<Pick<ItemGenerar, 'departamento' | 'disciplina' | 'tipo_documento'>>) : {}
  } catch {
    return {}
  }
}

function guardarUltimoUso(fila: ItemGenerar) {
  try {
    window.localStorage.setItem(
      CLAVE_ULTIMO,
      JSON.stringify({
        departamento: fila.departamento,
        disciplina: fila.disciplina,
        tipo_documento: fila.tipo_documento,
      }),
    )
  } catch {
    // Sin almacenamiento disponible.
  }
}

function nuevaClaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ui-${crypto.randomUUID()}`
  }
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function encontrarCodigoGeneral(lista: Segmento[], fallback: string): string {
  return lista.find((s) => esValorGeneral(s.codigo))?.codigo ?? lista[0]?.codigo ?? fallback
}

function encontrarPrimerProyectoEspecifico(lista: Segmento[]): string {
  return lista.find((s) => !esValorGeneral(s.codigo))?.codigo ?? lista[0]?.codigo ?? '01'
}

function crearFilaInicial(catalogos: CatalogosAgrupados, iniciarGeneral = false): ItemGenerar {
  const ult = leerUltimoUso()
  const proyGen = encontrarCodigoGeneral(catalogos.proyecto, '00')
  const subGen = encontrarCodigoGeneral(catalogos.subproyecto, '0')
  const tieneDepto = ult.departamento && catalogos.departamento.some((d) => d.codigo === ult.departamento)
  const tieneDisc = ult.disciplina && catalogos.disciplina.some((d) => d.codigo === ult.disciplina)
  const tieneTipo = ult.tipo_documento && catalogos.tipo_documento.some((t) => t.codigo === ult.tipo_documento)

  return {
    anio: String(new Date().getFullYear()),
    numero_proyecto: iniciarGeneral ? proyGen : (catalogos.proyecto[0]?.codigo ?? '00'),
    subproyecto: iniciarGeneral ? subGen : (catalogos.subproyecto[0]?.codigo ?? '0'),
    departamento: tieneDepto
      ? ult.departamento!
      : (catalogos.departamento.find((d) => d.codigo === 'IN')?.codigo ?? catalogos.departamento[0]?.codigo ?? 'IN'),
    disciplina: tieneDisc
      ? ult.disciplina!
      : (catalogos.disciplina.find((d) => d.codigo === 'G')?.codigo ?? catalogos.disciplina[0]?.codigo ?? 'G'),
    tipo_documento: tieneTipo
      ? ult.tipo_documento!
      : (catalogos.tipo_documento.find((t) => t.codigo === 'DOC')?.codigo ?? catalogos.tipo_documento[0]?.codigo ?? 'DOC'),
    motivo: '',
    clave_idempotencia: nuevaClaveIdempotencia(),
  }
}

export function GeneradorPage({ ir }: { ir: (ruta: string) => void }) {
  const { configOrg, recargarConfigOrg, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const iniciarGeneral = useMemo(() => new URLSearchParams(window.location.search).get('general') === '1', [])

  const [catalogos, setCatalogos] = useState<CatalogosAgrupados>(CATALOGO_ORIGINAL)
  const [modoLote, setModoLote] = useState(false)
  const [filas, setFilas] = useState<ItemGenerar[]>(() => [crearFilaInicial(CATALOGO_ORIGINAL, iniciarGeneral)])
  const [previewsAuto, setPreviewsAuto] = useState<PrevisualizacionItem[] | null>(null)
  const [calculandoAuto, setCalculandoAuto] = useState(false)
  const [confirmandoModal, setConfirmandoModal] = useState<PrevisualizacionItem[] | null>(null)
  const [generados, setGenerados] = useState<CodigoItem[] | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
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
            // Fallback al catálogo original si no se pudo sembrar.
          }
        }
        const resuelto = resolverCatalogoConOriginal(segmentos)
        if (!cancelado) {
          setCatalogos(resuelto)
          setFilas([crearFilaInicial(resuelto, iniciarGeneral)])
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

  // Previsualización automática en segundo plano (sin bloquear contador) para ver el consecutivo real
  const firmaSegmentos = useMemo(
    () =>
      filas
        .map(
          (f) =>
            `${f.anio}|${f.numero_proyecto}|${f.subproyecto}|${f.departamento}|${f.disciplina}|${f.tipo_documento}`,
        )
        .join(';'),
    [filas],
  )

  useEffect(() => {
    if (!configOrg?.configurada || generados) return
    let cancelado = false
    const id = window.setTimeout(() => {
      setCalculandoAuto(true)
      registroApi
        .previsualizar(filas)
        .then((r) => {
          if (!cancelado) setPreviewsAuto(r.previsualizaciones)
        })
        .catch(() => {
          if (!cancelado) setPreviewsAuto(null)
        })
        .finally(() => {
          if (!cancelado) setCalculandoAuto(false)
        })
    }, 280)
    return () => {
      cancelado = true
      window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaSegmentos, configOrg?.configurada, generados])

  function actualizarFila(idx: number, campo: keyof ItemGenerar, valor: string) {
    setError('')
    setGenerados(null)
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
    setError('')
    setGenerados(null)
    const proyGen = encontrarCodigoGeneral(catalogos.proyecto, '00')
    const subGen = encontrarCodigoGeneral(catalogos.subproyecto, '0')
    const proyEsp = encontrarPrimerProyectoEspecifico(catalogos.proyecto)
    setFilas((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f
        return {
          ...f,
          numero_proyecto: activarGeneral ? proyGen : esValorGeneral(f.numero_proyecto) ? proyEsp : f.numero_proyecto,
          subproyecto: activarGeneral ? subGen : f.subproyecto,
          clave_idempotencia: nuevaClaveIdempotencia(),
        }
      }),
    )
  }

  function agregarFila() {
    setFilas((prev) => [...prev, crearFilaInicial(catalogos, iniciarGeneral)])
  }

  function duplicarFila(idx: number) {
    setFilas((prev) => {
      const base = prev[idx]
      if (!base) return prev
      return [
        ...prev.slice(0, idx + 1),
        { ...base, motivo: base.motivo ? `${base.motivo} (copia)` : '', clave_idempotencia: nuevaClaveIdempotencia() },
        ...prev.slice(idx + 1),
      ]
    })
  }

  function quitarFila(idx: number) {
    setFilas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function abrirConfirmacion(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const r = await registroApi.previsualizar(filas)
      setPreviewsAuto(r.previsualizaciones)
      setConfirmandoModal(r.previsualizaciones)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function ejecutarGeneracion() {
    setEnviando(true)
    setError('')
    try {
      const r = await registroApi.generar(filas)
      if (filas[0]) guardarUltimoUso(filas[0])
      setConfirmandoModal(null)
      setGenerados(r.resultados)
      setAdvertencia(r.advertencia_correo)
      setFilas([crearFilaInicial(catalogos, iniciarGeneral)])
      notificar(
        r.resultados.length > 1 ? `${r.resultados.length} códigos generados` : 'Código generado',
        r.resultados[0]?.codigo,
        'ok',
      )
      if (!configOrg?.bloqueada_por_codigos) {
        void recargarConfigOrg()
      }
    } catch (err) {
      setConfirmandoModal(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(codigo: string, id: string) {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiadoId(id)
      notificar('Código copiado', codigo, 'ok')
      window.setTimeout(() => setCopiadoId((p) => (p === id ? null : p)), 1600)
    } catch {
      notificar('No se pudo copiar', 'Copia el código manualmente.', 'warn')
    }
  }

  const opcionesAnio: OpcionSelector[] = useMemo(
    () => obtenerAniosOriginales().map((y) => ({ valor: y, codigoCorto: y.slice(-2), texto: y })),
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

  const nombreDe = (tipo: keyof CatalogosAgrupados, cod: string) =>
    catalogos[tipo].find((s) => s.codigo === cod)?.nombre ?? cod

  const sigla = configOrg?.configurada ? configOrg.sigla : 'SIGLA'
  const fila0 = filas[0]
  const preview0 = previewsAuto?.[0]
  const codigoVivo = fila0
    ? `${sigla}-${fila0.anio.slice(-2)}-${fila0.numero_proyecto}-${fila0.subproyecto}-${fila0.departamento}-${fila0.disciplina}-${fila0.tipo_documento}-${
        preview0 ? String(preview0.consecutivo_tentativo).padStart(3, '0') : '•••'
      }`
    : ''

  return (
    <section className="pagina-clean pagina-estrecha">
      <header className="cabecera-clean">
        <div>
          <h1>Generar código</h1>
          <p className="tenue">Arma tu código y verifica el resultado antes de confirmarlo.</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Modo de generación">
          <button
            type="button"
            role="tab"
            aria-selected={!modoLote}
            className="tab"
            onClick={() => {
              setModoLote(false)
              setFilas((f) => [f[0] || crearFilaInicial(catalogos, iniciarGeneral)])
            }}
          >
            Individual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoLote}
            className="tab"
            onClick={() => setModoLote(true)}
          >
            <Layers size={15} aria-hidden="true" />
            En lote ({filas.length})
          </button>
        </div>
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      {generados ? (
        <div className="surface-clean gen-exito">
          <div className="exito-cabecera">
            <span className="exito-sello">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <h2>{generados.length === 1 ? 'Código emitido' : `${generados.length} códigos emitidos`}</h2>
              <p className="tenue">Ya está registrado y disponible en el historial de tu organización.</p>
            </div>
          </div>

          {advertencia && <Aviso tono="warn">{advertencia}</Aviso>}

          <ul className="exito-lista">
            {generados.map((g) => (
              <li key={g.id} className="exito-item">
                <div>
                  <div className="exito-codigo">{g.codigo}</div>
                  <p className="exito-motivo">{g.motivo}</p>
                </div>
                <Boton variante="secondary" tamano="sm" onClick={() => copiar(g.codigo, g.id)}>
                  {copiadoId === g.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copiadoId === g.id ? 'Copiado' : 'Copiar'}
                </Boton>
              </li>
            ))}
          </ul>

          <div className="fila-botones" style={{ marginTop: 18 }}>
            <Boton
              variante="primary"
              onClick={() => ir(`/registro/?codigo=${encodeURIComponent(generados[0]?.codigo ?? '')}`)}
            >
              <ListChecks aria-hidden="true" />
              Ver en el registro
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
      ) : (
        <div className="surface-clean gen-canvas">
          {/* Código estimado en tiempo real (en modo individual) */}
          {!modoLote && fila0 && (
            <div className="gen-live-strip">
              <span className="gen-live-label">
                Código estimado {calculandoAuto ? '· calculando consecutivo…' : ''}
              </span>
              <div className={`gen-live-code ${calculandoAuto ? 'is-cargando' : ''}`}>{codigoVivo}</div>
              <span className="gen-live-meta">
                {esValorGeneral(fila0.numero_proyecto)
                  ? 'Código general (00) · No pertenece a ningún proyecto'
                  : `${nombreDe('proyecto', fila0.numero_proyecto)} · Subproyecto ${fila0.subproyecto}`}
                {' · '}
                {nombreDe('departamento', fila0.departamento)} · {nombreDe('disciplina', fila0.disciplina)} ·{' '}
                {nombreDe('tipo_documento', fila0.tipo_documento)}
              </span>
            </div>
          )}

          <form onSubmit={abrirConfirmacion} className="gen-form">
            {filas.map((fila, idx) => {
              const esGeneral = esValorGeneral(fila.numero_proyecto) && esValorGeneral(fila.subproyecto)
              const previewFila = previewsAuto?.[idx]

              return (
                <div key={idx} className={modoLote ? 'gen-lote-fila' : 'gen-campos-grupo'}>
                  <div className="gen-alcance-bar">
                    <div className="alcance-pills" role="group" aria-label="Tipo de alcance">
                      <button
                        type="button"
                        className={`chip ${esGeneral ? 'is-on' : ''}`}
                        onClick={() => aplicarAlcanceGeneral(idx, true)}
                      >
                        <Building2 size={13} aria-hidden="true" />
                        General (00)
                      </button>
                      <button
                        type="button"
                        className={`chip ${!esValorGeneral(fila.numero_proyecto) ? 'is-on' : ''}`}
                        onClick={() => aplicarAlcanceGeneral(idx, false)}
                      >
                        <FolderKanban size={13} aria-hidden="true" />
                        De proyecto
                      </button>
                    </div>

                    {modoLote && (
                      <div className="fila-lote-acciones">
                        <span className="codigo-texto" style={{ fontSize: 12.5 }}>
                          {previewFila?.codigo_tentativo ??
                            `${sigla}-${fila.anio.slice(-2)}-${fila.numero_proyecto}-${fila.subproyecto}-${fila.departamento}-${fila.disciplina}-${fila.tipo_documento}-•••`}
                        </span>
                        <button
                          type="button"
                          className="btn-icono btn-icono-sm"
                          onClick={() => duplicarFila(idx)}
                          title="Duplicar fila"
                          aria-label="Duplicar fila"
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
                            aria-label="Quitar fila"
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="gen-grid">
                    <div className="field">
                      <span className="field-label">Año</span>
                      <SelectorBuscable
                        etiqueta="Año"
                        valor={fila.anio}
                        opciones={opcionesAnio}
                        buscable={false}
                        alCambiar={(v) => actualizarFila(idx, 'anio', v)}
                      />
                    </div>

                    <div className="field">
                      <span className="field-label">N.º Proyecto</span>
                      <SelectorBuscable
                        etiqueta="Proyecto"
                        valor={fila.numero_proyecto}
                        opciones={opcionesProyecto}
                        alCambiar={(v) => actualizarFila(idx, 'numero_proyecto', v)}
                      />
                      <span className="field-help">Usa 00 si es un código general sin proyecto.</span>
                    </div>

                    <div className="field">
                      <span className="field-label">Subproyecto</span>
                      <SelectorBuscable
                        etiqueta="Subproyecto"
                        valor={fila.subproyecto}
                        opciones={opcionesSubproyecto}
                        alCambiar={(v) => actualizarFila(idx, 'subproyecto', v)}
                      />
                      <span className="field-help">Usa 0 cuando no aplique subproyecto.</span>
                    </div>

                    <div className="field">
                      <span className="field-label">Departamento</span>
                      <SelectorBuscable
                        etiqueta="Departamento"
                        valor={fila.departamento}
                        opciones={opcionesDepto}
                        alCambiar={(v) => actualizarFila(idx, 'departamento', v)}
                      />
                    </div>

                    <div className="field">
                      <span className="field-label">Disciplina</span>
                      <SelectorBuscable
                        etiqueta="Disciplina"
                        valor={fila.disciplina}
                        opciones={opcionesDisciplina}
                        alCambiar={(v) => actualizarFila(idx, 'disciplina', v)}
                      />
                    </div>

                    <div className="field">
                      <span className="field-label">Tipo de documento</span>
                      <SelectorBuscable
                        etiqueta="Tipo de documento"
                        valor={fila.tipo_documento}
                        opciones={opcionesTipo}
                        alCambiar={(v) => actualizarFila(idx, 'tipo_documento', v)}
                      />
                    </div>
                  </div>

                  <label className="field">
                    <span className="field-label">Motivo / Asunto</span>
                    <input
                      type="text"
                      value={fila.motivo || ''}
                      onChange={(e) => actualizarFila(idx, 'motivo', e.target.value)}
                      placeholder={
                        esGeneral
                          ? 'Ej. Procedimiento general de control documental'
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

            <div className="gen-footer">
              <div>
                {modoLote && (
                  <Boton type="button" variante="secondary" tamano="sm" onClick={agregarFila}>
                    <Plus aria-hidden="true" />
                    Agregar otra fila
                  </Boton>
                )}
              </div>
              <Boton
                type="submit"
                variante="primary"
                cargando={enviando}
                disabled={enviando || !configOrg?.configurada}
              >
                <ShieldCheck aria-hidden="true" />
                {modoLote ? `Revisar y generar (${filas.length})` : 'Revisar y generar'}
                <ArrowRight className="btn-flecha" aria-hidden="true" />
              </Boton>
            </div>
          </form>
        </div>
      )}

      {/* Diálogo de verificación obligatoria antes de consumir el consecutivo */}
      <Dialogo
        abierto={Boolean(confirmandoModal)}
        alCerrar={() => !enviando && setConfirmandoModal(null)}
        tamano={confirmandoModal && confirmandoModal.length > 1 ? 'lg' : 'md'}
        titulo={
          confirmandoModal && confirmandoModal.length > 1
            ? `Confirmar generación de ${confirmandoModal.length} códigos`
            : 'Verifica el código antes de generarlo'
        }
        descripcion="Revisa que cada segmento sea el correcto. Una vez generado, el consecutivo se consume de forma definitiva y no se puede borrar."
        acciones={
          <>
            <Boton variante="secondary" onClick={() => setConfirmandoModal(null)} disabled={enviando}>
              Volver y corregir
            </Boton>
            <Boton variante="primary" cargando={enviando} disabled={enviando} onClick={ejecutarGeneracion}>
              <Check aria-hidden="true" />
              {enviando ? 'Generando…' : 'Sí, generar código'}
            </Boton>
          </>
        }
      >
        {confirmandoModal && (
          <div className="confirm-lista">
            {confirmandoModal.map((item, i) => (
              <div key={i} className="confirm-item">
                <div className="confirm-codigo">{item.codigo_tentativo}</div>
                <p className="confirm-motivo">{filas[i]?.motivo}</p>
                <div className="confirm-desglose">
                  <span>
                    <b>Proyecto:</b>{' '}
                    {esValorGeneral(item.numero_proyecto)
                      ? '00 (General, sin proyecto)'
                      : `${item.numero_proyecto} · ${nombreDe('proyecto', item.numero_proyecto)}`}
                  </span>
                  <span>
                    <b>Subproyecto:</b> {item.subproyecto}
                  </span>
                  <span>
                    <b>Depto:</b> {nombreDe('departamento', item.departamento)}
                  </span>
                  <span>
                    <b>Disciplina:</b> {nombreDe('disciplina', item.disciplina)}
                  </span>
                  <span>
                    <b>Tipo:</b> {nombreDe('tipo_documento', item.tipo_documento)}
                  </span>
                </div>
              </div>
            ))}

            <Aviso tono="warn">
              <AlertTriangle style={{ display: 'none' }} aria-hidden="true" />
              Si te equivocas después de generar, solo podrás anular el código y ese número consecutivo no se volverá a
              usar.
            </Aviso>
          </div>
        )}
      </Dialogo>
    </section>
  )
}
