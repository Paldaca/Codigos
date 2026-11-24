import { useEffect, useState, type FormEvent } from 'react'
import { Database, Lock, Save, Sparkles } from 'lucide-react'
import { useAvisos } from '../context/AvisosContext'
import { useIdentidad } from '../context/IdentidadContext'
import { catalogosApi } from '../services/catalogos'
import { Aviso, Boton, Casilla, Etiqueta } from '../ui/componentes'
import { BotonAyuda } from './BotonAyuda'

type ConfiguracionSiglaCardProps = {
  alAbrirAyuda?: () => void
  alSembrarCatalogos?: () => void
}

export function ConfiguracionSiglaCard({ alAbrirAyuda, alSembrarCatalogos }: ConfiguracionSiglaCardProps) {
  const { configOrg, recargarConfigOrg, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const [sigla, setSigla] = useState('')
  const [correo, setCorreo] = useState('')
  const [notificarCorreo, setNotificarCorreo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [sembrando, setSembrando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (configOrg) {
      setSigla(configOrg.sigla)
      setCorreo(configOrg.correo_notificacion)
      setNotificarCorreo(configOrg.notificar_por_correo)
    }
  }, [configOrg])

  const puedeAdministrar = puede('codigos:catalogos:administrar')
  const bloqueada = Boolean(configOrg?.bloqueada_por_codigos)
  const anioCorto = String(new Date().getFullYear()).slice(-2)
  const siglaVista = sigla.trim().toUpperCase() || 'SIGLA'

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await catalogosApi.guardarConfigOrg({
        sigla: sigla.trim().toUpperCase(),
        correo_notificacion: correo.trim(),
        notificar_por_correo: notificarCorreo,
      })
      await recargarConfigOrg()
      notificar('Configuración guardada', `Sigla de la organización: ${sigla.trim().toUpperCase()}`, 'ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  async function sembrar() {
    setError('')
    setSembrando(true)
    try {
      const r = await catalogosApi.sembrarEstandar()
      notificar('Catálogo original cargado', `${r.creados} elementos agregados (${r.total} en total).`, 'ok')
      alSembrarCatalogos?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSembrando(false)
    }
  }

  return (
    <div className="card tarjeta-generador">
      <div className="config-sigla-head">
        <div>
          <div className="titulo-con-ayuda">
            <h2 className="panel-titulo">Sigla de la organización y notificaciones</h2>
            <BotonAyuda
              titulo="Sigla configurable del módulo"
              texto="Define el prefijo alfanumérico (2 a 10 caracteres) que inicia todos los códigos de tu organización. Una vez que se emite el primer código, la sigla se bloquea automáticamente para proteger el historial."
              destacado="Puedes actualizar el correo de notificación en cualquier momento."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <p className="seccion-sub">
            Configura el prefijo inicial que identifica a tu organización en cada código generado.
          </p>
        </div>
        {bloqueada ? (
          <Etiqueta tono="muted" punto>
            Sigla bloqueada en uso
          </Etiqueta>
        ) : configOrg?.configurada ? (
          <Etiqueta tono="ok" punto>
            Configurada
          </Etiqueta>
        ) : (
          <Etiqueta tono="warn" punto>
            Pendiente de configurar
          </Etiqueta>
        )}
      </div>

      {/* Vista previa en vivo del prefijo */}
      <div className="sigla-preview-band">
        <span className="sigla-preview-lbl">
          <Sparkles size={14} aria-hidden="true" />
          Vista previa del prefijo:
        </span>
        <span className="sigla-preview-code">
          <mark>{siglaVista}</mark>-{anioCorto}-00-0-IN-G-DOC-001
        </span>
      </div>

      <form onSubmit={guardar} className="form-col" style={{ marginTop: 16 }}>
        <div className="rejilla-segmentos">
          <label className="field">
            <span className="field-label">
              {bloqueada && <Lock size={13} aria-hidden="true" />}
              Sigla de organización (2–10 caracteres)
            </span>
            <input
              type="text"
              value={sigla}
              onChange={(e) => setSigla(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
              disabled={!puedeAdministrar || bloqueada}
              placeholder="Ej. PAL, CER, ING"
              maxLength={10}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Correo de notificación (opcional)</span>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={!puedeAdministrar}
              placeholder="control@organizacion.com"
            />
          </label>
        </div>

        <Casilla
          checked={notificarCorreo}
          disabled={!puedeAdministrar}
          onChange={(e) => setNotificarCorreo(e.target.checked)}
        >
          Enviar aviso por correo al confirmar códigos manuales
        </Casilla>

        {bloqueada && (
          <Aviso tono="muted">
            La sigla <code>{configOrg?.sigla}</code> ya tiene códigos emitidos, por lo que no puede modificarse. El
            correo de notificación sigue siendo editable.
          </Aviso>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}

        {puedeAdministrar && (
          <div className="fila-botones">
            <Boton type="submit" variante="primary" tamano="sm" cargando={enviando} disabled={enviando}>
              <Save aria-hidden="true" />
              {enviando ? 'Guardando…' : 'Guardar configuración'}
            </Boton>
            <Boton type="button" variante="secondary" tamano="sm" cargando={sembrando} disabled={sembrando} onClick={sembrar}>
              <Database aria-hidden="true" />
              {sembrando ? 'Cargando…' : 'Cargar catálogo estándar'}
            </Boton>
          </div>
        )}
      </form>
    </div>
  )
}
