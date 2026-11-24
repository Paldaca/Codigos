import { useIdentidad } from '../context/IdentidadContext'

export function FranjaEstado() {
  const { salud, identidad } = useIdentidad()
  return (
    <div className="franja-estado">
      <span>
        Backend: <b>{salud ? (salud.estado === 'ok' ? 'Conectado' : 'Con fallos') : 'Verificando…'}</b>
      </span>
      <span>
        Sesión:{' '}
        <b>
          {identidad.tipo === 'listo'
            ? `${identidad.yo.persona.nombre} (${identidad.yo.rol ?? 'sin rol'})`
            : identidad.tipo === 'cargando'
              ? 'Verificando…'
              : 'Sin acceso'}
        </b>
      </span>
    </div>
  )
}
