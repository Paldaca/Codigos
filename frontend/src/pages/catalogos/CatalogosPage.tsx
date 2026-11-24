import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import type { CatalogosAgrupados, TipoSegmento } from '../../types/catalogos'

const ETIQUETAS_TIPO: Record<TipoSegmento, string> = {
  proyecto: 'Número de proyecto (NN)',
  subproyecto: 'Subproyecto (S)',
  departamento: 'Departamento (DEPT)',
  disciplina: 'Disciplina (DISC)',
  tipo_documento: 'Tipo de documento / plano (TIPO)',
}

export function CatalogosPage() {
  const { configOrg, recargarConfigOrg } = useIdentidad()
  const [sigla, setSigla] = useState('')
  const [correo, setCorreo] = useState('')
  const [notificar, setNotificar] = useState(false)
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [tipoActivo, setTipoActivo] = useState<TipoSegmento>('disciplina')
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoShell, setNuevoShell] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (configOrg) {
      setSigla(configOrg.sigla)
      setCorreo(configOrg.correo_notificacion)
      setNotificar(configOrg.notificar_por_correo)
    }
  }, [configOrg])

  const cargarSegmentos = useCallback(() => {
    catalogosApi
      .listarSegmentos(true)
      .then((r) => setCatalogos(r.segmentos))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(cargarSegmentos, [cargarSegmentos])

  async function guardarSigla(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')
    try {
      await catalogosApi.guardarConfigOrg({
        sigla,
        correo_notificacion: correo,
        notificar_por_correo: notificar,
      })
      await recargarConfigOrg()
      setMensaje('Configuración de la organización guardada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function agregarSegmento(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await catalogosApi.crearSegmento({
        tipo: tipoActivo,
        codigo: nuevoCodigo,
        nombre: nuevoNombre,
        codigo_shell: nuevoShell,
      })
      setNuevoCodigo('')
      setNuevoNombre('')
      setNuevoShell('')
      cargarSegmentos()
      setMensaje('Segmento guardado en el catálogo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function alternarActivo(id: number, activo: boolean) {
    try {
      await catalogosApi.actualizarSegmento(id, { activo: !activo })
      cargarSegmentos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function sembrar() {
    setError('')
    try {
      const r = await catalogosApi.sembrarEstandar()
      cargarSegmentos()
      setMensaje(`Catálogos estándar aplicados (${r.creados} nuevos, ${r.total} en total).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Sigla de organización y catálogos</h1>
          <p className="tenue">Define la sigla inicial fija de tu organización y administra los segmentos permitidos.</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      {mensaje && <p className="ok">{mensaje}</p>}
      {error && <p className="error">{error}</p>}

      <div className="tarjeta">
        <h2>Identificador inicial de la organización</h2>
        <form onSubmit={guardarSigla} className="form-col">
          <div className="rejilla-segmentos">
            <label className="campo">
              <span>Sigla fija (2–10 caracteres)</span>
              <input
                type="text"
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                disabled={Boolean(configOrg?.bloqueada_por_codigos)}
                placeholder="Ej. PAL"
                required
              />
            </label>
            <label className="campo">
              <span>Correo de notificación (opcional)</span>
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="control@empresa.com" />
            </label>
          </div>
          <label className="check-linea">
            <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
            <span>Enviar correo al confirmar códigos manuales</span>
          </label>
          {configOrg?.bloqueada_por_codigos && (
            <p className="tenue">La sigla está bloqueada porque ya existen códigos registrados para esta organización.</p>
          )}
          <div className="fila-botones">
            <button type="submit" className="btn btn-primario">Guardar configuración</button>
            <button type="button" className="btn btn-secundario" onClick={sembrar}>
              Cargar catálogos estándar
            </button>
          </div>
        </form>
      </div>

      <div className="tarjeta">
        <h2>Catálogos de segmentos</h2>
        <div className="fila-botones" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(Object.keys(ETIQUETAS_TIPO) as TipoSegmento[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${tipoActivo === t ? 'btn-primario' : 'btn-secundario'}`}
              onClick={() => setTipoActivo(t)}
            >
              {ETIQUETAS_TIPO[t]}
            </button>
          ))}
        </div>

        <form onSubmit={agregarSegmento} className="filtros-registro" style={{ marginBottom: '1rem' }}>
          <input type="text" placeholder="Código (ej. PLA)" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase())} required />
          <input type="text" placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
          <input type="text" placeholder="Código Shell (opcional, ej. CIV)" value={nuevoShell} onChange={(e) => setNuevoShell(e.target.value.toUpperCase())} />
          <button type="submit" className="btn btn-primario">Agregar / actualizar</button>
        </form>

        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Código Shell</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {(catalogos?.[tipoActivo] ?? []).map((s) => (
                <tr key={s.id}>
                  <td><code>{s.codigo}</code></td>
                  <td>{s.nombre}</td>
                  <td>{s.codigo_shell ? <code>{s.codigo_shell}</code> : '—'}</td>
                  <td><span className={`pill ${s.activo ? 'pill-confirmado' : 'pill-anulado'}`}>{s.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <button type="button" className="btn btn-sm btn-secundario" onClick={() => alternarActivo(s.id, s.activo)}>
                      {s.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
