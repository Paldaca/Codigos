import { useIdentidad } from '../context/IdentidadContext'

export function InsigniaOrganizacion() {
  const { identidad, configOrg } = useIdentidad()
  if (identidad.tipo !== 'listo') return null
  return (
    <div className="insignia-org" title="La sigla inicial es fija por organización y no puede seleccionarse manualmente">
      <span className="insignia-org-nombre">{identidad.yo.organizacion.nombre}</span>
      <span className="insignia-org-sigla">
        {configOrg?.configurada ? configOrg.sigla : 'Sin sigla'}
      </span>
    </div>
  )
}
