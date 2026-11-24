import { useEffect, useState } from 'react'
import { BannerSinSigla } from '../../components/BannerSinSigla'
import { FranjaEstado } from '../../components/FranjaEstado'
import { InsigniaOrganizacion } from '../../components/InsigniaOrganizacion'
import { useIdentidad } from '../../context/IdentidadContext'
import { registroApi } from '../../services/registro'
import type { ResumenRegistro } from '../../types/registro'

export function InicioPage({ ir }: { ir: (ruta: string) => void }) {
  const { puede } = useIdentidad()
  const [resumen, setResumen] = useState<ResumenRegistro | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    registroApi
      .resumen()
      .then(setResumen)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <section className="pagina">
      <header className="cabecera-pagina">
        <div>
          <h1>Códigos</h1>
          <p className="tenue">Generación y control de códigos de documentos y planos (manual y vía API).</p>
        </div>
        <InsigniaOrganizacion />
      </header>

      <BannerSinSigla alIrACatalogos={() => ir('/catalogos/')} />
      <FranjaEstado />

      {error && <p className="error">{error}</p>}

      {resumen && (
        <div className="rejilla-kpi">
          <div className="tarjeta kpi">
            <span className="tenue">Total registrados</span>
            <strong>{resumen.total}</strong>
          </div>
          <div className="tarjeta kpi">
            <span className="tenue">Confirmados</span>
            <strong>{resumen.confirmados}</strong>
          </div>
          <div className="tarjeta kpi">
            <span className="tenue">Reservados (API)</span>
            <strong>{resumen.reservados}</strong>
          </div>
          <div className="tarjeta kpi">
            <span className="tenue">Manual / Automático</span>
            <strong>
              {resumen.manuales} / {resumen.automaticos}
            </strong>
          </div>
          <div className="tarjeta kpi">
            <span className="tenue">Anulados</span>
            <strong>{resumen.anulados}</strong>
          </div>
          <div className="tarjeta kpi">
            <span className="tenue">Solicitudes pendientes</span>
            <strong>{resumen.solicitudes_pendientes}</strong>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <h2>Acciones rápidas</h2>
        <div className="fila-botones">
          {puede('codigos:codigos:generar') && (
            <button type="button" className="btn btn-primario" onClick={() => ir('/generar/')}>
              Generar códigos
            </button>
          )}
          {puede('codigos:registro:ver') && (
            <button type="button" className="btn btn-secundario" onClick={() => ir('/registro/')}>
              Consultar registro
            </button>
          )}
          {puede('codigos:codigos:anular') && (
            <button type="button" className="btn btn-secundario" onClick={() => ir('/anulaciones/')}>
              Solicitudes y anulaciones
            </button>
          )}
          {puede('codigos:catalogos:administrar') && (
            <button type="button" className="btn btn-secundario" onClick={() => ir('/catalogos/')}>
              Catálogos y sigla
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
