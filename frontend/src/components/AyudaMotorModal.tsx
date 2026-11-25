import { useEffect, useState } from 'react'
import { Building2, Check, FolderKanban, HelpCircle, Layers, Lock, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Boton, Etiqueta } from '../ui/componentes'
import { SEGMENTOS_GUIA } from './motorCodigosInfo'

type AyudaMotorModalProps = {
  abierto: boolean
  alCerrar: () => void
  siglaOrg?: string
}

export function AyudaMotorModal({ abierto, alCerrar, siglaOrg = 'CER' }: AyudaMotorModalProps) {
  const [modoEjemplo, setModoEjemplo] = useState<'proyecto' | 'general'>('general')
  const [segmentoActivo, setSegmentoActivo] = useState<string>('proyecto')

  useEffect(() => {
    if (!abierto) return
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [abierto, alCerrar])

  if (!abierto) return null

  const seg = SEGMENTOS_GUIA.find((s) => s.clave === segmentoActivo) ?? SEGMENTOS_GUIA[2]

  const valorDe = (clave: string, fallback: string) => {
    if (clave === 'sigla') return siglaOrg || 'CER'
    return fallback
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={alCerrar} aria-hidden="true" />
      <aside
        className="drawer-panel is-amplio"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-motor-titulo"
      >
        <div className="drawer-head">
          <div>
            <span className="kicker">Guía del motor</span>
            <h2 id="guia-motor-titulo" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              ¿Cómo funciona el motor de códigos?
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 4 }}>
              Explora la estructura de 8 segmentos, los contadores atómicos y cuándo usar 00.
            </p>
          </div>
          <button
            type="button"
            className="btn-icono"
            onClick={alCerrar}
            aria-label="Cerrar guía del motor"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="guia-motor">
        {/* Comparador interactivo: Proyecto específico vs Código General (00) */}
        <div className="guia-comparador">
          <div className="guia-comparador-top">
            <div>
              <span className="kicker">Ejemplo interactivo</span>
              <h3 className="guia-subtitulo">Haz clic en cualquier segmento para inspeccionarlo</h3>
            </div>
            <div className="tabs" role="tablist" aria-label="Tipo de código de ejemplo">
              <button
                type="button"
                role="tab"
                aria-selected={modoEjemplo === 'general'}
                className="tab"
                onClick={() => {
                  setModoEjemplo('general')
                  setSegmentoActivo('proyecto')
                }}
              >
                <Building2 aria-hidden="true" />
                Código general (00)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modoEjemplo === 'proyecto'}
                className="tab"
                onClick={() => {
                  setModoEjemplo('proyecto')
                  setSegmentoActivo('proyecto')
                }}
              >
                <FolderKanban aria-hidden="true" />
                De proyecto (04)
              </button>
            </div>
          </div>

          <div className="guia-segmentos-fila" role="list">
            {SEGMENTOS_GUIA.map((item, idx) => {
              const val = valorDe(
                item.clave,
                modoEjemplo === 'general' ? item.ejemploGeneral : item.ejemploProyecto,
              )
              const es00 = modoEjemplo === 'general' && (item.clave === 'proyecto' || item.clave === 'subproyecto')
              const seleccionado = segmentoActivo === item.clave
              return (
                <button
                  key={item.clave}
                  type="button"
                  onClick={() => setSegmentoActivo(item.clave)}
                  className={`guia-seg-btn ${seleccionado ? 'is-activo' : ''} ${es00 ? 'is-general' : ''}`}
                  style={{ '--i': idx } as React.CSSProperties}
                >
                  <span className="guia-seg-val">{val}</span>
                  <small className="guia-seg-lbl">{item.sigla}</small>
                </button>
              )
            })}
          </div>

          <div key={`${segmentoActivo}-${modoEjemplo}`} className="guia-detalle-seg">
            <div className="guia-detalle-head">
              <div className="guia-detalle-titulo">
                <span className="selector-codigo-pill">{seg.sigla}</span>
                <strong>{seg.titulo}</strong>
              </div>
              {seg.regla00 && <Etiqueta tono="info" punto>Regla del 00</Etiqueta>}
            </div>
            <p className="guia-detalle-resumen">{seg.resumen}</p>
            <p className="guia-detalle-texto">{seg.detalle}</p>
            {seg.regla00 && (
              <div className="form-status is-info" style={{ marginTop: 8 }}>
                <HelpCircle aria-hidden="true" />
                <div className="form-status-texto">
                  <b>Importante:</b> {seg.regla00}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Regla clave del 00 destacada */}
        <div className="guia-regla00">
          <div className="icon-badge">
            <Layers aria-hidden="true" />
          </div>
          <div>
            <h4>¿Qué significa «00» en Proyecto y Subproyecto?</h4>
            <p>
              Cuando un documento es transversal a toda la organización y <b>no cae en ningún proyecto específico</b>{' '}
              (por ejemplo: políticas de calidad, procedimientos corporativos, manuales internos o actas generales), se
              selecciona <b>00 (General)</b> en <b>Proyecto</b> y <b>0 / 00 (General / Sin subproyecto)</b> en{' '}
              <b>Subproyecto</b>. Así el registro mantiene separados los documentos corporativos de los entregables de
              obra.
            </p>
          </div>
        </div>

        {/* Tres pilares del motor */}
        <div className="guia-pilares">
          <div className="guia-pilar">
            <span className="icon-badge icon-badge-sm">
              <Sparkles aria-hidden="true" />
            </span>
            <h5>Consecutivo por combinación</h5>
            <p>
              Cada combinación de los 7 segmentos iniciales tiene su propio contador (<code>001, 002, 003…</code>). Si
              cambias el año, proyecto, disciplina o tipo, inicia un contador independiente.
            </p>
          </div>
          <div className="guia-pilar">
            <span className="icon-badge icon-badge-sm">
              <Lock aria-hidden="true" />
            </span>
            <h5>Reserva atómica sin colisiones</h5>
            <p>
              La vista previa estima el siguiente número sin bloquearlo. Al confirmar, el motor bloquea el contador en
              base de datos para que jamás existan dos códigos repetidos.
            </p>
          </div>
          <div className="guia-pilar">
            <span className="icon-badge icon-badge-sm">
              <ShieldAlert aria-hidden="true" />
            </span>
            <h5>Anulación irreversible</h5>
            <p>
              Un código anulado conserva su registro histórico y motivo, pero <b>nunca devuelve ni reutiliza su consecutivo</b>{' '}
              para evitar ambigüedad en auditorías.
            </p>
          </div>
        </div>
        </div>
        </div>

        <div className="drawer-foot">
          <Boton variante="primary" onClick={alCerrar}>
            <Check aria-hidden="true" />
            Entendido
          </Boton>
        </div>
      </aside>
    </>
  )
}
