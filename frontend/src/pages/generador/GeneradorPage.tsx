import { useEffect, useState, type FormEvent } from 'react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { VistaPreviaCodigo } from '../../components/VistaPreviaCodigo'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import { registroApi, type ItemGenerar } from '../../services/registro'
import type { CatalogosAgrupados } from '../../types/catalogos'
import type { CodigoItem, PrevisualizacionItem } from '../../types/registro'

function nuevaClaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ui-${crypto.randomUUID()}`
  }
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function crearFilaVacia(catalogos: CatalogosAgrupados | null): ItemGenerar {
  return {
    anio: String(new Date().getFullYear()),
    numero_proyecto: catalogos?.proyecto[0]?.codigo ?? '00',
    subproyecto: catalogos?.subproyecto[0]?.codigo ?? '0',
    departamento: catalogos?.departamento[0]?.codigo ?? 'IN',
    disciplina: catalogos?.disciplina[0]?.codigo ?? 'G',
    tipo_documento: catalogos?.tipo_documento[0]?.codigo ?? 'DOC',
    motivo: '',
    clave_idempotencia: nuevaClaveIdempotencia(),
  }
}

export function GeneradorPage({ ir }: { ir: (ruta: string) => void }) {
  const { configOrg, recargarConfigOrg } = useIdentidad()
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [modoLote, setModoLote] = useState(false)
  const [filas, setFilas] = useState<ItemGenerar[]>([crearFilaVacia(null)])
  const [previews, setPreviews] = useState<PrevisualizacionItem[] | null>(null)
  const [generados, setGenerados] = useState<CodigoItem[] | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    catalogosApi
      .listarSegmentos(false, ctrl.signal)
      .then((r) => {
        setCatalogos(r.segmentos)
        setFilas([crearFilaVacia(r.segmentos)])
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [])

  function actualizarFila(idx: number, campo: keyof ItemGenerar, valor: string) {
    setPreviews(null)
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

  function agregarFila() {
    setPreviews(null)
    setFilas((prev) => [...prev, crearFilaVacia(catalogos)])
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
      setFilas([crearFilaVacia(catalogos)])
      if (!configOrg?.bloqueada_por_codigos) {
        void recargarConfigOrg()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  const anioTope = Math.max(2029, new Date().getFullYear() + 2)
  const anios = Array.from({ length: anioTope - 2015 + 1 }, (_, i) => String(2015 + i))

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Generar códigos</h1>
          <p className="tenue">
            Metodología única de 8 segmentos. La sigla inicial pertenece a tu organización activa y no se selecciona manualmente.
          </p>
        </div>
        <InsigniaOrganizacion />
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      <div className="tarjeta">
        <div className="fila-entre" style={{ marginBottom: '1rem' }}>
          <h2>{modoLote ? 'Generación manual en lote' : 'Generación manual individual'}</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              setModoLote((v) => !v)
              setPreviews(null)
              if (modoLote) setFilas((f) => [f[0] || crearFilaVacia(catalogos)])
            }}
          >
            {modoLote ? 'Cambiar a individual' : 'Generar en lote'}
          </button>
        </div>

        <form onSubmit={previsualizar} className="form-col">
          {filas.map((fila, idx) => (
            <div key={idx} className="fila-lote">
              <div className="rejilla-segmentos">
                <label className="campo">
                  <span>Organización (fija)</span>
                  <input type="text" value={configOrg?.configurada ? configOrg.sigla : 'Sin sigla'} disabled />
                </label>
                <label className="campo">
                  <span>Año</span>
                  <select value={fila.anio} onChange={(e) => actualizarFila(idx, 'anio', e.target.value)}>
                    {anios.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>N.º Proyecto</span>
                  <select value={fila.numero_proyecto} onChange={(e) => actualizarFila(idx, 'numero_proyecto', e.target.value)}>
                    {(catalogos?.proyecto ?? []).map((s) => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Subproyecto</span>
                  <select value={fila.subproyecto} onChange={(e) => actualizarFila(idx, 'subproyecto', e.target.value)}>
                    {(catalogos?.subproyecto ?? []).map((s) => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Departamento</span>
                  <select value={fila.departamento} onChange={(e) => actualizarFila(idx, 'departamento', e.target.value)}>
                    {(catalogos?.departamento ?? []).map((s) => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Disciplina</span>
                  <select value={fila.disciplina} onChange={(e) => actualizarFila(idx, 'disciplina', e.target.value)}>
                    {(catalogos?.disciplina ?? []).map((s) => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Tipo (Doc / Plano)</span>
                  <select value={fila.tipo_documento} onChange={(e) => actualizarFila(idx, 'tipo_documento', e.target.value)}>
                    {(catalogos?.tipo_documento ?? []).map((s) => (
                      <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fila-entre" style={{ marginTop: '0.6rem', gap: '0.75rem' }}>
                <label className="campo" style={{ flex: 1 }}>
                  <span>Motivo / Asunto obligatorio</span>
                  <input
                    type="text"
                    value={fila.motivo || ''}
                    onChange={(e) => actualizarFila(idx, 'motivo', e.target.value)}
                    placeholder="Ej. Plano de cimentación edificio norte"
                    required
                  />
                </label>
                {modoLote && filas.length > 1 && (
                  <button type="button" className="btn btn-secundario" onClick={() => quitarFila(idx)}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && <p className="error">{error}</p>}

          <div className="fila-botones">
            {modoLote && (
              <button type="button" className="btn btn-secundario" onClick={agregarFila}>
                + Agregar fila al lote
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primario"
              disabled={cargando || !configOrg?.configurada || !catalogos}
            >
              {cargando ? 'Calculando…' : 'Vista previa'}
            </button>
          </div>
        </form>
      </div>

      {previews && (
        <div className="tarjeta">
          <h2>Vista previa ({previews.length})</h2>
          <p className="tenue">El consecutivo definitivo se asigna de forma atómica al confirmar.</p>
          <div className="form-col">
            {previews.map((p, i) => (
              <VistaPreviaCodigo key={i} item={p} />
            ))}
          </div>
          <div className="fila-botones" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secundario" onClick={() => setPreviews(null)} disabled={cargando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primario" onClick={confirmarGeneracion} disabled={cargando}>
              {cargando ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          </div>
        </div>
      )}

      {generados && (
        <div className="tarjeta aviso-ok">
          <h2>Códigos generados correctamente</h2>
          {advertencia && <p className="error">{advertencia}</p>}
          <ul>
            {generados.map((g) => (
              <li key={g.id}>
                <code>{g.codigo}</code> — {g.motivo}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secundario" onClick={() => ir('/registro/')}>
            Ver en el registro
          </button>
        </div>
      )}
    </section>
  )
}
