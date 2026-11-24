import { useEffect, useState } from 'react'
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
import { orden, useConteo } from '../../ui/movimiento'

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function KpiLimpio({
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
  tono?: 'ok' | 'warn' | 'info' | 'muted'
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
            {tono === 'ok' ? 'Vigentes' : tono === 'info' ? 'API' : tono === 'warn' ? 'Por revisar' : 'Total'}
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
  const [modoFormula, setModoFormula] = useState<'general' | 'proyecto'>('general')
  const [segActivo, setSegActivo] = useState<string>('proyecto')
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
          .listar({ tamano: 6, pagina: 1 })
          .then((r) => {
            if (activo) setRecientes(r.resultados)
          })
          .catch(() => {
            // Si falla la vista reciente, el resumen sigue disponible.
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

  const nombreUsuario = identidad.tipo === 'listo' ? identidad.yo.persona.nombre.split(' ')[0] : ''
  const sigla = configOrg?.configurada ? configOrg.sigla : 'ORG'
  const infoSeg = SEGMENTOS_GUIA.find((s) => s.clave === segActivo) ?? SEGMENTOS_GUIA[2]

  async function copiarCodigo(item: CodigoItem) {
    try {
      await navigator.clipboard.writeText(item.codigo)
      setCopiadoId(item.id)
      notificar('Código copiado', item.codigo, 'ok')
      window.setTimeout(() => setCopiadoId((prev) => (prev === item.id ? null : prev)), 1800)
    } catch {
      notificar('No se pudo copiar', 'Copia el código manualmente.', 'warn')
    }
  }

  return (
    <section className="pagina">
      {/* Cabecera limpia de inicio */}
      <header className="home-cabecera rev" style={orden(0)}>
        <div className="home-cabecera-izq">
          <div className="portada-top-fila">
            <FranjaEstado />
            <InsigniaOrganizacion alAbrirGuia={alAbrirAyuda} />
          </div>
          <h1 className="home-titulo">
            {saludo()}
            {nombreUsuario ? `, ${nombreUsuario}` : ''}
          </h1>
          <p className="home-subtitulo">
            Genera, consulta y administra los códigos de tu organización bajo la metodología estándar de 8 segmentos.
          </p>
        </div>

        <div className="home-cabecera-acciones">
          {puede('codigos:codigos:generar') && (
            <Boton variante="primary" onClick={() => ir('/generar/')}>
              <PlusCircle aria-hidden="true" />
              Generar código
              <ArrowRight className="btn-flecha" aria-hidden="true" />
            </Boton>
          )}
          {puede('codigos:registro:ver') && (
            <Boton variante="secondary" onClick={() => ir('/registro/')}>
              <ListChecks aria-hidden="true" />
              Registro
            </Boton>
          )}
          <button
            type="button"
            className="btn-icono"
            onClick={alAbrirAyuda}
            aria-label="¿Cómo funciona el motor de códigos?"
            title="¿Cómo funciona el motor de códigos?"
          >
            <HelpCircle aria-hidden="true" />
          </button>
        </div>
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />

      {error && <Aviso tono="error">{error}</Aviso>}

      {/* Banda clara e interactiva de la estructura de 8 segmentos */}
      <div className="banda-formula rev" style={orden(1)}>
        <div className="banda-formula-top">
          <div className="titulo-con-ayuda">
            <span className="kicker">Estructura del código</span>
            <BotonAyuda
              titulo="¿Cómo funciona el motor de códigos?"
              texto="Cada código se forma con 8 segmentos separados por guion. El consecutivo final se incrementa automáticamente por cada combinación única."
              destacado="00 en Proyecto y 0 en Subproyecto = Código general que no cae en ningún proyecto."
              alAbrirGuiaCompleta={alAbrirAyuda}
            />
          </div>
          <div className="banda-formula-switch" role="group" aria-label="Tipo de ejemplo">
            <button
              type="button"
              className={`chip ${modoFormula === 'general' ? 'is-on' : ''}`}
              onClick={() => {
                setModoFormula('general')
                setSegActivo('proyecto')
              }}
            >
              <Building2 size={13} aria-hidden="true" />
              General (00)
            </button>
            <button
              type="button"
              className={`chip ${modoFormula === 'proyecto' ? 'is-on' : ''}`}
              onClick={() => {
                setModoFormula('proyecto')
                setSegActivo('proyecto')
              }}
            >
              <FolderKanban size={13} aria-hidden="true" />
              Proyecto (04)
            </button>
          </div>
        </div>

        <div className="banda-segmentos" role="list">
          {SEGMENTOS_GUIA.map((seg) => {
            const val =
              seg.clave === 'sigla'
                ? sigla
                : modoFormula === 'general'
                  ? seg.ejemploGeneral
                  : seg.ejemploProyecto
            const es00 = modoFormula === 'general' && (seg.clave === 'proyecto' || seg.clave === 'subproyecto')
            const activo = segActivo === seg.clave
            return (
              <button
                key={seg.clave}
                type="button"
                className={`banda-seg ${activo ? 'is-activo' : ''} ${es00 ? 'is-general' : ''}`}
                onClick={() => setSegActivo(seg.clave)}
                onMouseEnter={() => setSegActivo(seg.clave)}
              >
                <b>{val}</b>
                <small>{seg.sigla}</small>
              </button>
            )
          })}
        </div>

        <p key={`${segActivo}-${modoFormula}`} className="banda-formula-nota">
          <strong>{infoSeg.titulo}:</strong> {infoSeg.resumen}
          {infoSeg.regla00 && (
            <span className="banda-formula-00"> · {infoSeg.regla00}</span>
          )}
        </p>
      </div>

      {/* 4 KPIs limpios */}
      {cargando && !resumen && (
        <div className="rejilla-kpi-4" aria-label="Cargando indicadores">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="esqueleto esqueleto-kpi" />
          ))}
        </div>
      )}

      {resumen && (
        <div className="rejilla-kpi-4">
          <KpiLimpio
            indice={0}
            etiqueta="Total registrados"
            valor={resumen.total}
            nota={`${resumen.manuales} manuales · ${resumen.automaticos} API`}
            icono={Hash}
            alPulsar={puede('codigos:registro:ver') ? () => ir('/registro/') : undefined}
          />
          <KpiLimpio
            indice={1}
            etiqueta="Confirmados"
            valor={resumen.confirmados}
            nota="En uso dentro de la organización"
            icono={CheckCircle2}
            tono="ok"
            alPulsar={puede('codigos:registro:ver') ? () => ir('/registro/') : undefined}
          />
          <KpiLimpio
            indice={2}
            etiqueta="Reservados (API)"
            valor={resumen.reservados}
            nota="Pendientes de confirmación"
            icono={FileCode2}
            tono="info"
          />
          <KpiLimpio
            indice={3}
            etiqueta="Solicitudes pendientes"
            valor={resumen.solicitudes_pendientes}
            nota={`${resumen.anulados} anulados históricos`}
            icono={resumen.solicitudes_pendientes > 0 ? Clock : Ban}
            tono={resumen.solicitudes_pendientes > 0 ? 'warn' : undefined}
            alPulsar={puede('codigos:codigos:anular') ? () => ir('/anulaciones/') : undefined}
          />
        </div>
      )}

      {/* Cuerpo principal en 2 columnas limpias */}
      <div className="inicio-inferior">
        {puede('codigos:registro:ver') && (
          <div className="card rev" style={orden(3)}>
            <div className="panel-head">
              <div>
                <h2 className="panel-titulo">Actividad reciente</h2>
                <p className="seccion-sub">Últimos códigos emitidos en tu organización.</p>
              </div>
              <button type="button" className="panel-link" onClick={() => ir('/registro/')}>
                Ver todo
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            {recientes.length === 0 ? (
              <div className="vacio" style={{ padding: '28px 16px' }}>
                <span className="icon-badge">
                  <FolderKanban aria-hidden="true" />
                </span>
                <p className="vacio-titulo">Sin códigos registrados todavía</p>
                <p className="vacio-texto">Crea tu primer código manual para verlo aparecer aquí.</p>
                {puede('codigos:codigos:generar') && (
                  <div className="vacio-accion">
                    <Boton variante="primary" tamano="sm" onClick={() => ir('/generar/')}>
                      <PlusCircle aria-hidden="true" />
                      Crear primer código
                    </Boton>
                  </div>
                )}
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
                      <p className="reciente-motivo" title={item.motivo}>
                        {item.motivo}
                      </p>
                      <div className="reciente-der">
                        <small>{new Date(item.fecha_creacion).toLocaleDateString('es-VE')}</small>
                        <button
                          type="button"
                          className="btn-icono btn-icono-sm"
                          onClick={() => copiarCodigo(item)}
                          aria-label={`Copiar ${item.codigo}`}
                          title="Copiar código"
                        >
                          {copiadoId === item.id ? (
                            <Check aria-hidden="true" style={{ color: 'var(--ok-fg)' }} />
                          ) : (
                            <Copy aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <div className="card rev" style={orden(4)}>
          <div className="panel-head">
            <div>
              <h2 className="panel-titulo">Accesos rápidos</h2>
              <p className="seccion-sub">Acciones frecuentes del módulo.</p>
            </div>
          </div>
          <div className="gestion-lista">
            {puede('codigos:codigos:generar') && (
              <>
                <button type="button" className="gestion-item" onClick={() => ir('/generar/')}>
                  <span className="icon-badge icon-badge-sm">
                    <PlusCircle aria-hidden="true" />
                  </span>
                  <span>
                    <b>Generar código manual</b>
                    <small>Individual o en lote con previsualización atómica.</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="gestion-item" onClick={() => ir('/generar/?general=1')}>
                  <span className="icon-badge icon-badge-sm" style={{ background: 'var(--info-bg)', borderColor: '#C9DCF9', color: 'var(--info-fg)' }}>
                    <Building2 aria-hidden="true" />
                  </span>
                  <span>
                    <b>Crear código general (00)</b>
                    <small>Para documentos que no caen en ningún proyecto.</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </>
            )}
            {puede('codigos:catalogos:administrar') && (
              <button type="button" className="gestion-item" onClick={() => ir('/catalogos/')}>
                <span className="icon-badge icon-badge-sm">
                  <SlidersHorizontal aria-hidden="true" />
                </span>
                <span>
                  <b>Configurar sigla y catálogos</b>
                  <small>Define el prefijo de tu organización y sus segmentos.</small>
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
                  <b>Bandeja de anulaciones</b>
                  <small>
                    {resumen && resumen.solicitudes_pendientes > 0
                      ? `${resumen.solicitudes_pendientes} solicitud(es) pendiente(s).`
                      : 'Sin solicitudes pendientes.'}
                  </small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
