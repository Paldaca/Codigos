import { ArrowRight } from 'lucide-react'
import { useIdentidad } from '../context/IdentidadContext'
import { Aviso, Boton } from '../ui/componentes'

export function BannerSinSigla({ alIrACatalogos }: { alIrACatalogos: () => void }) {
  const { configOrg, puede } = useIdentidad()
  if (!configOrg || configOrg.configurada) return null

  return (
    <Aviso
      tono="warn"
      className="rev"
      accion={
        puede('codigos:catalogos:administrar') ? (
          <Boton variante="primary" tamano="sm" onClick={alIrACatalogos}>
            Configurar sigla
            <ArrowRight className="btn-flecha" aria-hidden="true" />
          </Boton>
        ) : undefined
      }
    >
      <strong>Falta configurar la sigla inicial de esta organización.</strong>
      <div style={{ marginTop: 2 }}>
        Todos los códigos de documentos y planos inician con la sigla fija de tu organización activa.
      </div>
    </Aviso>
  )
}
