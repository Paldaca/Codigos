import { Building2 } from 'lucide-react'
import { useIdentidad } from '../context/IdentidadContext'
import { BotonAyuda } from './BotonAyuda'

export function InsigniaOrganizacion({ alAbrirGuia }: { alAbrirGuia?: () => void }) {
  const { identidad, configOrg } = useIdentidad()
  if (identidad.tipo !== 'listo') return null

  return (
    <div className="insignia-org">
      <Building2 className="insignia-org-icono" aria-hidden="true" />
      <span className="insignia-org-nombre">{identidad.yo.organizacion.nombre}</span>
      <span className={`insignia-org-sigla ${configOrg?.configurada ? '' : 'is-sin-sigla'}`}>
        {configOrg?.configurada ? configOrg.sigla : 'Sin sigla'}
      </span>
      <BotonAyuda
        titulo="Sigla fija de la organización"
        texto="Todos los códigos de tu organización comienzan con esta sigla. El sistema la toma automáticamente de la sesión activa para evitar errores manuales."
        destacado={
          configOrg?.bloqueada_por_codigos
            ? 'Sigla bloqueada: ya existen códigos emitidos con este prefijo.'
            : 'Puedes definir o ajustar la sigla en Catálogos antes de emitir el primer código.'
        }
        alAbrirGuiaCompleta={alAbrirGuia}
      />
    </div>
  )
}
