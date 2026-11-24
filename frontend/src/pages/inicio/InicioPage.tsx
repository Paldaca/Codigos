import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowRight,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileCode2,
  FolderKanban,
  Hash,
  HelpCircle,
  ListChecks,
  PlusCircle,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
import { BotonAyuda } from '../../components/BotonAyuda'
import { FranjaEstado } from '../../components/FranjaEstado'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { SEGMENTOS_GUIA, esValorGeneral } from '../../components/motorCodigosInfo'
import { useAvisos } from '../../context/AvisosContext'
import { useIdentidad } from '../../context/IdentidadContext'
import { registroApi } from '../../services/registro'
import type { CodigoItem, ResumenRegistro } from '../../types/registro'
import { Aviso, Boton, Etiqueta } from '../../ui/componentes'
import { Isotipo } from '../../ui/Marca'
import { orden, seguirPuntero, sinMovimiento, useConteo } from '../../ui/movimiento'

function KpiNumero({
  etiqueta,
  valor,
  nota,
  icono: Icono,
  tono,
  indice,
  alPulsar,
}: {
  etiqueta: string
  valor: number
  nota: string
  icono: typeof Hash
  tono?: 'ok' | 'warn' | 'info' | 'danger' | 'module'
  indice: number
  alPulsar?: () => void
}) {
  const animado = useConteo(valor)
  return (
    <div
      className={`kpi rev ${alPulsar ? 'is-clicable' : ''}`}
      style={orden(indice)}
      onClick={alPulsar}
      role={alPulsar ? 'button' : undefined}
      tabIndex={alPulsar ? 0 : undefined}
      onKeyDown={
        alPulsar
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                alPulsar()
              }
            }
          : undefined
      }
    >
      <div className="kpi-top">
        <span className="kpi-label">{etiqueta}</span>
        <span className="icon-badge icon-badge-sm">
          <Icono aria-hidden="true" />
        </span>
      </div>
      <span className="kpi-value">{animado.toLocaleString('es-VE')}</span>
      <div className="kpi-foot">
        <span className="kpi-note">{nota}</span>
        {tono && (
          <Etiqueta tono={tono} punto>
            {tono === 'ok' ? 'Activos' : tono === 'info' ? 'API' : tono === 'warn' ? 'Pendientes' : 'Histórico'}
          </Etiqueta>
        )}
      </div>
    </div>
  )
}

export function InicioPage({
  ir,
  alAbrirAyuda,
}: {
  ir: (ruta: string) => void
  alAbrirAyuda?: () => void
}) {
  const { identidad, configOrg, puede } = useIdentidad()
  const { notificar } = useAvisos()
  const [resumen, setResumen] = useState<ResumenRegistro | null>(null)
  const [recientes, setRecientes] = useState<CodigoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ejemploModo, setEjemploModo] = useState<'general' | 'proyecto'>('general')
  const [pasoEscena, setPasoEscena] = useState(0)
  const [segmentoHover, setSegmentoHover] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    const promesas: Promise<unknown>[] = [
      registroApi.resumen().then((r) => {
        if (activo) setResumen(r)
      }),
    ]
    if (puede('codigos:registro:ver')) {
      promesas.push(
        registroApi
          .listar({ tamano: 5, pagina: 1 })
          .then((r) => {
            if (activo) setRecientes(r.resultados)
          })
          .catch(() => {
            // Si falla la vista reciente, el resumen sigue funcionando.
          }),
      )
    }
    Promise.all(promesas)
      .catch((e: unknown) => {
        if (activo) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [puede])

  useEffect(() => {
    if (sinMovimiento()) {
      setPasoEscena(10)
      return
    }
    const id = window.setInterval(() => {
      setPasoEscena((p) => (p + 1) % 11)
    }, 620)
    return () => window.clearInterval(id)
  }, [])

  const nombreUsuario = identidad.tipo === 'listo' ? identidad.yo.persona.nombre.split(' ')[0] : ''
  const sigla = configOrg?.configurada ? configOrg.sigla : 'CER'
  const pasoActual = pasoEscena
  const segmentoDestacado = SEGMENTOS_GUIA.find((s) => s.clave === segmentoHover)

  async function copiarCodigo(item: CodigoItem) {
    try {
      await navigator.clipboard.writeText(item.codigo)
      setCopiadoId(item.id)
      notificar('Código copiado', item.codigo, 'ok')
      window.setTimeout(() => setCopiadoId((prev) => (prev === item.id ? null : prev)), 1800)
    } catch {
      notificar('No se pudo copiar', 'Copia el código manualmente desde la tabla.', 'warn')
    }
  }

  const pctManual =
    resumen && resumen.manuales + resumen.automaticos > 0
      ? Math.round((resumen.manuales / (resumen.manuales + resumen.automaticos)) * 100)
      : 0

  return (
    <section className="pagina">
      {/* Portada interactiva */}
      <div className="inicio-portada card rev" onPointerMove={seguirPuntero}>
        <div className="portada-fondo" aria-hidden="true" />
        <div className="portada-sello" aria-hidden="true">
          <Isotipo color="turquesa" variante="glifo" tamano={280} />
        </div>

        <div className="portada-grid">
          <div className="portada-texto">
            <div className="portada-top-fila">
              <FranjaEstado />
              <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
            </div>

            <h1 className="portada-titulo">
              {nombreUsuario ? `Hola, ${nombreUsuario}. ` : ''}
              Cada código,{' '}
              <span className="portada-nombre">único, ordenado y trazable.</span>
            </h1>

            <p className="portada-bajada">
              Centraliza la generación manual y automática de códigos bajo la metodología de{' '}
              <b>8 segmentos</b> de tu organización. Usa <b>00</b> en proyecto y subproyecto cuando el documento es{' '}
              <b>general</b> y no cae en ningún proyecto.
            </p>

            <div className="portada-acciones">
              {puede('codigos:codigos:generar') && (
                <Boton variante="primary" onClick={() => ir('/generar/')}>
                  <PlusCircle aria-hidden="true" />
                  Generar código manual
                  <ArrowRight className="btn-flecha" aria-hidden="true" />
                </Boton>
              )}
              {puede('codigos:registro:ver') && (
                <Boton variante="secondary" onClick={() => ir('/registro/')}>
                  <ListChecks aria-hidden="true" />
                  Registro de la organización
                </Boton>
              )}
              <Boton variante="ghost" onClick={alAbrirAyuda}>
                <HelpCircle aria-hidden="true" />
                ¿Cómo funciona el motor?
              </Boton>
            </div>
          </div>

          {/* Escena animada en vivo del motor de códigos */}
          <div className="escena-codigo-panel">
            <div className="escena-codigo-head">
              <span className="escena-codigo-titulo">
                <Sparkles aria-hidden="true" />
                Así se ensambla un código
              </span>
              <div className="escena-switch" role="group" aria-label="Modo de ejemplo">
                <button
                  type="button"
                  className={`chip ${ejemploModo === 'general' ? 'is-on' : ''}`}
                  onClick={() => {
                    setEjemploModo('general')
                    setPasoEscena(0)
                  }}
                >
                  General (00)
                </button>
                <button
                  type="button"
                  className={`chip ${ejemploModo === 'proyecto' ? 'is-on' : ''}`}
                  onClick={() => {
                    setEjemploModo('proyecto')
                    setPasoEscena(0)
                  }}
                >
                  Proyecto (04)
                </button>
              </div>
            </div>

            <div className={`escena-segmentos ${pasoActual >= 8 ? 'is-completo' : ''}`}>
              <ol className="escena-lista">
                {SEGMENTOS_GUIA.map((seg, i) => {
                  const puesto = i <= pasoActual
                  const valor =
                    seg.clave === 'sigla'
                      ? sigla
                      : ejemploModo === 'general'
                        ? seg.ejemploGeneral
                        : seg.ejemploProyecto
                  const es00 =
                    ejemploModo === 'general' && (seg.clave === 'proyecto' || seg.clave === 'subproyecto')
                  return (
                    <li
                      key={seg.clave}
                      className={`escena-item ${puesto ? 'is-puesto' : ''} ${es00 ? 'is-general' : ''} ${segmentoHover === seg.clave ? 'is-hover' : ''}`}
                      onMouseEnter={() => setSegmentoHover(seg.clave)}
                      onMouseLeave={() => setSegmentoHover(null)}
                      onClick={() => setSegmentoHover((prev) => (prev === seg.clave ? null : seg.clave))}
                    >
                      <b>{valor}</b>
                      <small>{seg.sigla}</small>
                    </li>
                  )
                })}
              </ol>

              <div className="escena-pie">
                {segmentoDestacado ? (
                  <span className="escena-hint">
                    <strong>{segmentoDestacado.titulo}:</strong> {segmentoDestacado.resumen}
                  </span>
                ) : (
                  <span className={`escena-sello ${pasoActual >= 8 ? 'is-visible' : ''}`}>
                    <Check aria-hidden="true" />
                    {ejemploModo === 'general'
                      ? 'Código general (00) · No cae en ningún proyecto'
                      : 'Consecutivo único asignado atómicamente'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      {error && <Aviso tono="error">{error}</Aviso>}

      {/* KPIs animados */}
      {cargando && !resumen && (
        <div className="rejilla-kpi" aria-label="Cargando indicadores">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="esqueleto esqueleto-kpi" />
          ))}
        </div>
      )}

      {resumen && (
        <div className="rejilla-kpi">
          <KpiNumero
            indice={0}
            etiqueta="Total registrados"
            valor={resumen.total}
            nota="En la organización activa"
            icono={Hash}
            alPulsar={puede('codigos:registro:ver') ? () => ir('/registro/') : undefined}
          />
          <KpiNumero
            indice={1}
            etiqueta="Confirmados"
            valor={resumen.confirmados}
            nota="Vigentes en uso"
            icono={CheckCircle2}
            tono="ok"
          />
          <KpiNumero
            indice={2}
            etiqueta="Reservados (API)"
            valor={resumen.reservados}
            nota="En flujo automático"
            icono={FileCode2}
            tono="info"
          />
          <div className="kpi rev" style={orden(3)}>
            <div className="kpi-top">
              <span className="kpi-label">Manual vs Automático</span>
              <BotonAyuda
                titulo="Origen de los códigos"
                texto="Los códigos manuales los crea un usuario desde el Generador. Los automáticos los reservan otras apps de Cereipo (como Control de Documentos) vía API."
                alAbrirGuiaCompleta={alAbrirAyuda}
              />
            </div>
            <span className="kpi-value">
              {resumen.manuales.toLocaleString('es-VE')}{' '}
              <small className="kpi-divisor">/ {resumen.automaticos.toLocaleString('es-VE')}</small>
            </span>
            <div className="bar" role="progressbar" aria-valuenow={pctManual} aria-valuemin={0} aria-valuemax={100}>
              <div className="bar-fill" style={{ width: `${pctManual}%` }} />
            </div>
            <span className="kpi-note">{pctManual} % generados manualmente</span>
          </div>
          <KpiNumero
            indice={4}
            etiqueta="Solicitudes pendientes"
            valor={resumen.solicitudes_pendientes}
            nota={`${resumen.anulados} anulados históricos`}
            icono={resumen.solicitudes_pendientes > 0 ? Clock : Ban}
            tono={resumen.solicitudes_pendientes > 0 ? 'warn' : undefined}
            alPulsar={puede('codigos:codigos:anular') ? () => ir('/anulaciones/') : undefined}
          />
        </div>
      )}

      {/* Tarjetas interactivas de acceso y regla del 00 */}
      <div className="inicio-tarjetas">
        {puede('codigos:codigos:generar') && (
          <div
            className="card app-card rev"
            style={{ ...orden(1), '--mod': 'var(--accent-600)' } as CSSProperties}
            onPointerMove={seguirPuntero}
            onClick={() => ir('/generar/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                ir('/generar/')
              }
            }}
          >
            <div className="app-cabecera">
              <span className="icon-badge">
                <PlusCircle aria-hidden="true" />
              </span>
              <Etiqueta tono="module">Individual o lote</Etiqueta>
            </div>
            <h2 className="app-nombre">Generador manual de códigos</h2>
            <p className="app-descripcion">
              Arma códigos paso a paso con previsualización en tiempo real, buscador en catálogos y reserva atómica.
            </p>
            <span className="app-pie">
              Abrir generador
              <ArrowRight aria-hidden="true" />
            </span>
          </div>
        )}

        {puede('codigos:registro:ver') && (
          <div
            className="card app-card rev"
            style={{ ...orden(2), '--mod': 'var(--brand-blue)' } as CSSProperties}
            onPointerMove={seguirPuntero}
            onClick={() => ir('/registro/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                ir('/registro/')
              }
            }}
          >
            <div className="app-cabecera">
              <span className="icon-badge" style={{ background: 'var(--info-bg)', borderColor: '#C9DCF9', color: 'var(--info-fg)' }}>
                <ListChecks aria-hidden="true" />
              </span>
              <Etiqueta tono="info">Búsqueda e historial</Etiqueta>
            </div>
            <h2 className="app-nombre">Registro de la organización</h2>
            <p className="app-descripcion">
              Consulta todos los códigos emitidos (manuales y API), filtra por proyecto o estado e inspecciona su auditoría.
            </p>
            <span className="app-pie">
              Consultar registro
              <ArrowRight aria-hidden="true" />
            </span>
          </div>
        )}

        <div
          className="card app-card rev"
          style={{ ...orden(3), '--mod': 'var(--brand-purple)' } as CSSProperties}
          onPointerMove={seguirPuntero}
        >
          <div className="app-cabecera">
            <span className="icon-badge" style={{ background: '#F3F0FD', borderColor: '#DDD5FA', color: '#5B43B2' }}>
              <Building2 aria-hidden="true" />
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Etiqueta tono="muted">Regla del 00</Etiqueta>
              <BotonAyuda
                titulo="¿Cuándo usar 00 en Proyecto y Subproyecto?"
                texto="El valor «00» en Proyecto y «0 / 00» en Subproyecto identifica códigos generales de la organización que no pertenecen a ningún proyecto específico (políticas, manuales, instructivos internos)."
                destacado="Ejemplo: CER-26-00-0-GG-G-PRO-001"
                alAbrirGuiaCompleta={alAbrirAyuda}
              />
            </div>
          </div>
          <h2 className="app-nombre">Códigos generales (00)</h2>
          <p className="app-descripcion">
            ¿El documento <b>no cae en ningún proyecto</b>? Usa <code>00</code> en Proyecto y <code>0 / 00</code> en Subproyecto.
          </p>
          <div className="app-pie-acciones">
            {puede('codigos:codigos:generar') ? (
              <button type="button" className="panel-link" onClick={() => ir('/generar/?general=1')}>
                Crear código general (00)
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="panel-link" onClick={alAbrirAyuda}>
                Ver explicación del motor
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Últimos códigos emitidos + accesos secundarios */}
      <div className="inicio-inferior">
        {puede('codigos:registro:ver') && (
          <div className="card rev" style={orden(4)}>
            <div className="panel-head">
              <div>
                <h2 className="panel-titulo">Últimos códigos de la organización</h2>
                <p className="seccion-sub">Haz clic para copiar o abrir en el registro completo.</p>
              </div>
              <button type="button" className="panel-link" onClick={() => ir('/registro/')}>
                Ver todo el registro
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            {recientes.length === 0 ? (
              <div className="vacio" style={{ padding: '24px 16px' }}>
                <span className="icon-badge">
                  <FolderKanban aria-hidden="true" />
                </span>
                <p className="vacio-titulo">Aún no hay códigos visibles</p>
                <p className="vacio-texto">Genera el primer código manual para verlo aparecer aquí al instante.</p>
              </div>
            ) : (
              <ul className="recientes-lista">
                {recientes.map((item) => {
                  const esGeneral = esValorGeneral(item.numero_proyecto) && esValorGeneral(item.subproyecto)
                  const tono = item.estado === 'confirmado' ? 'ok' : item.estado === 'reservado' ? 'info' : 'danger'
                  return (
                    <li key={item.id} className="reciente-fila">
                      <div className="reciente-izq">
                        <button
                          type="button"
                          className="code-chip"
                          onClick={() => ir(`/registro/?codigo=${encodeURIComponent(item.codigo)}`)}
                          title="Abrir en el registro"
                        >
                          {item.codigo}
                        </button>
                        {esGeneral && <Etiqueta tono="info">General 00</Etiqueta>}
                        <Etiqueta tono={tono} punto>
                          {item.estado}
                        </Etiqueta>
                      </div>
                      <p className="reciente-motivo">{item.motivo}</p>
                      <div className="reciente-der">
                        <small>{new Date(item.fecha_creacion).toLocaleDateString('es-VE')}</small>
                        <button
                          type="button"
                          className="btn-icono btn-icono-sm"
                          onClick={() => copiarCodigo(item)}
                          aria-label={`Copiar ${item.codigo}`}
                          title="Copiar código"
                        >
                          {copiadoId === item.id ? <Check aria-hidden="true" style={{ color: 'var(--ok-fg)' }} /> : <Copy aria-hidden="true" />}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {(puede('codigos:codigos:anular') || puede('codigos:catalogos:administrar')) && (
          <div className="card rev" style={orden(5)}>
            <div className="panel-head">
              <div>
                <h2 className="panel-titulo">Gestión y gobierno</h2>
                <p className="seccion-sub">Configuración de catálogos y solicitudes.</p>
              </div>
            </div>
            <div className="gestion-lista">
              {puede('codigos:catalogos:administrar') && (
                <button type="button" className="gestion-item" onClick={() => ir('/catalogos/')}>
                  <span className="icon-badge icon-badge-sm">
                    <SlidersHorizontal aria-hidden="true" />
                  </span>
                  <span>
                    <b>Catálogos y sigla</b>
                    <small>Administra proyectos, subproyectos, departamentos, disciplinas y tipos.</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              {puede('codigos:codigos:anular') && (
                <button type="button" className="gestion-item" onClick={() => ir('/anulaciones/')}>
                  <span className="icon-badge icon-badge-sm">
                    <Ban aria-hidden="true" />
                  </span>
                  <span>
                    <b>Solicitudes y anulaciones</b>
                    <small>
                      {resumen && resumen.solicitudes_pendientes > 0
                        ? `${resumen.solicitudes_pendientes} solicitud(es) esperando revisión.`
                        : 'Sin solicitudes pendientes de aprobación.'}
                    </small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
