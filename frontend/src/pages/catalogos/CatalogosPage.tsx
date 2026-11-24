import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Database, Plus, Save } from 'lucide-react'
import { BotonAyuda } from '../../components/BotonAyuda'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { catalogosApi } from '../../services/catalogos'
import type { CatalogosAgrupados, TipoSegmento } from '../../types/catalogos'
import { Aviso, Boton, Casilla, Etiqueta } from '../../ui/componentes'
import { orden } from '../../ui/movimiento'

const ETIQUETAS_TIPO: Record<TipoSegmento, string> = {
  proyecto: 'Proyecto (NN)',
  subproyecto: 'Subproyecto (S)',
  departamento: 'Departamento (DEPT)',
  disciplina: 'Disciplina (DISC)',
  tipo_documento: 'Tipo (TIPO)',
}

export function CatalogosPage({ alAbrirAyuda }: { alAbrirAyuda?: () => void }) {
  const { configOrg, recargarConfigOrg } = useIdentidad()
  const { notificar } = useAvisos()
  const [sigla, setSigla] = useState('')
  const [correo, setCorreo] = useState('')
  const [notificarCorreo, setNotificarCorreo] = useState(false)
  const [catalogos, setCatalogos] = useState<CatalogosAgrupados | null>(null)
  const [tipoActivo, setTipoActivo] = useState<TipoSegmento>('proyecto')
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoShell, setNuevoShell] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (configOrg) {
      setSigla(configOrg.sigla)
      setCorreo(configOrg.correo_notificacion)
      setNotificarCorreo(configOrg.notificar_por_correo)
    }
  }, [configOrg])

  const cargarSegmentos = useCallback((signal?: AbortSignal) => {
    catalogosApi
      .listarSegmentos(true, signal)
      .then((r) => setCatalogos(r.segmentos))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    cargarSegmentos(ctrl.signal)
    return () => ctrl.abort()
  }, [cargarSegmentos])

  async function guardarSigla(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.guardarConfigOrg({
        sigla,
        correo_notificacion: correo,
        notificar_por_correo: notificarCorreo,
      })
      await recargarConfigOrg()
      notificar('Configuración guardada', `Sigla activa: ${sigla}`, 'ok')
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
      notificar('Segmento guardado', `${nuevoCodigo} · ${nuevoNombre}`, 'ok')
      setNuevoCodigo('')
      setNuevoNombre('')
      setNuevoShell('')
      cargarSegmentos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function alternarActivo(id: number, activo: boolean) {
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.actualizarSegmento(id, { activo: !activo })
      cargarSegmentos()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function sembrar() {
    setError('')
    setEnviando(true)
    try {
      const r = await catalogosApi.sembrarEstandar()
      cargarSegmentos()
      notificar('Catálogos estándar aplicados', `${r.creados} nuevos elementos (${r.total} en total).`, 'ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="pagina">
      <header className="cabecera-pagina rev" style={orden(0)}>
        <div>
          <div className="titulo-con-ayuda">
            <h1>Sigla de organización y catálogos</h1>
            <BotonAyuda
              titulo="Catálogos de segmentos"
              texto="Aquí defines la sigla fija de tu organización y los valores permitidos para Proyecto, Subproyecto, Departamento, Disciplina y Tipo."
              destacado="Recuerda mantener activo «00» en Proyecto y «0 / 00» en Subproyecto para los códigos generales."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="tenue">Define la sigla inicial fija de tu organización y administra los segmentos permitidos.</p>
        </div>
        <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="card tarjeta-generador rev" style={orden(1)}>
        <div className="panel-head" style={{ padding: '0 0 14px' }}>
          <h2 className="panel-titulo">Identificador inicial de la organización</h2>
        </div>

        <form onSubmit={guardarSigla} className="form-col">
          <div className="rejilla-segmentos">
            <label className="field">
              <span className="field-label">Sigla fija (2–10 caracteres)</span>
              <input
                type="text"
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                disabled={Boolean(configOrg?.bloqueada_por_codigos)}
                placeholder="Ej. CER"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Correo de notificación (opcional)</span>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="control@empresa.com"
              />
            </label>
          </div>

          <Casilla checked={notificarCorreo} onChange={(e) => setNotificarCorreo(e.target.checked)}>
            Enviar correo al confirmar códigos manuales
          </Casilla>

          {configOrg?.bloqueada_por_codigos && (
            <Aviso tono="muted">
              La sigla está bloqueada porque ya existen códigos registrados para esta organización.
            </Aviso>
          )}

          <div className="fila-botones">
            <Boton type="submit" variante="primary" cargando={enviando} disabled={enviando}>
              <Save aria-hidden="true" />
              Guardar configuración
            </Boton>
            <Boton type="button" variante="secondary" onClick={sembrar} disabled={enviando}>
              <Database aria-hidden="true" />
              Cargar catálogos estándar
            </Boton>
          </div>
        </form>
      </div>

      <div className="card tarjeta-bloque rev" style={orden(2)}>
        <div className="panel-head">
          <h2 className="panel-titulo">Catálogos de segmentos</h2>
        </div>

        <div style={{ padding: '0 20px 14px', display: 'grid', gap: 14 }}>
          <div className="tabs" role="tablist">
            {(Object.keys(ETIQUETAS_TIPO) as TipoSegmento[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tipoActivo === t}
                className="tab"
                onClick={() => setTipoActivo(t)}
              >
                {ETIQUETAS_TIPO[t]}
              </button>
            ))}
          </div>

          <form onSubmit={agregarSegmento} className="filtros-avanzados" style={{ padding: 14, borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
            <label className="field">
              <span className="field-label">Código</span>
              <input
                type="text"
                placeholder="Ej. PLA"
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase())}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Nombre</span>
              <input
                type="text"
                placeholder="Descripción"
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
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Boton type="submit" variante="primary" tamano="sm" disabled={enviando}>
                <Plus aria-hidden="true" />
                Agregar / actualizar
              </Boton>
            </div>
          </form>
        </div>

        <div className="table-wrap" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <table className="table">
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
                  <td>
                    <span className="code-chip">{s.codigo}</span>
                  </td>
                  <td className="principal">{s.nombre}</td>
                  <td className="mono">{s.codigo_shell || '—'}</td>
                  <td>
                    <Etiqueta tono={s.activo ? 'ok' : 'danger'} punto>
                      {s.activo ? 'Activo' : 'Inactivo'}
                    </Etiqueta>
                  </td>
                  <td>
                    <Boton
                      variante="secondary"
                      tamano="sm"
                      disabled={enviando}
                      onClick={() => alternarActivo(s.id, s.activo)}
                    >
                      {s.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
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
