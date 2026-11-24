import { useIdentidad } from '../context/IdentidadContext'

export function FranjaEstado() {
  const { salud, identidad } = useIdentidad()
  const ok = salud?.estado === 'ok'

  return (
    <div className="eyebrow">
      <span className={`punto-vivo ${salud ? (ok ? '' : 'is-error') : 'is-espera'}`} aria-hidden="true" />
      <span>
        {salud ? (ok ? 'Motor activo' : 'Servicio con fallos') : 'Conectando motor…'}
        {identidad.tipo === 'listo' ? ` · ${identidad.yo.persona.nombre} (${identidad.yo.rol ?? 'sin rol'})` : ''}
      </span>
    </div>
  )
}
