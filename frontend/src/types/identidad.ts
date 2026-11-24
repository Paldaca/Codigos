export type SaludEstado = {
  estado: 'ok' | 'error'
  version: string
  contrato: number
  componentes: { base: string; redis: string }
}

export type IdentidadYo = {
  persona: { id: string; nombre: string; correo: string }
  organizacion: { id: string; codigo: string; nombre: string; zona_horaria: string }
  es_admin_organizacion: boolean
  rol: string | null
  permisos: string[]
  proyectos: Array<{ codigo: string; nombre?: string; rol: string }>
  gracia: boolean
}
