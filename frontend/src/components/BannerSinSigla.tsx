import { useIdentidad } from '../context/IdentidadContext'

export function BannerSinSigla({ alIrACatalogos }: { alIrACatalogos: () => void }) {
  const { configOrg, puede } = useIdentidad()
  if (!configOrg || configOrg.configurada) return null

  return (
    <div className="aviso aviso-warn" role="alert">
      <div>
        <strong>Falta configurar la sigla inicial de esta organización.</strong>
        <p className="tenue" style={{ margin: '0.25rem 0 0' }}>
          Todos los códigos de documentos y planos inician con la sigla fija de la organización activa.
        </p>
      </div>
      {puede('codigos:catalogos:administrar') && (
        <button type="button" className="btn btn-primario" onClick={alIrACatalogos}>
          Configurar sigla y catálogos
        </button>
      )}
    </div>
  )
}
