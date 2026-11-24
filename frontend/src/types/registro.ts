export type EstadoCodigo = 'reservado' | 'confirmado' | 'anulado'
export type OrigenCodigo = 'manual' | 'api'

export type CodigoItem = {
  id: string
  codigo: string
  sigla: string
  anio: string
  numero_proyecto: string
  subproyecto: string
  departamento: string
  disciplina: string
  tipo_documento: string
  consecutivo: number
  estado: EstadoCodigo
  origen: OrigenCodigo
  app_origen: string
  referencia_externa: string
  proyecto_shell_codigo: string
  disciplina_shell_codigo: string
  motivo: string
  motivo_anulacion: string
  creado_por_persona_id: string
  creado_por_nombre: string
  anulado_por_persona_id: string
  anulado_por_nombre: string
  fecha_creacion: string
  fecha_confirmacion: string | null
  fecha_anulacion: string | null
  tiene_solicitud_pendiente?: boolean
}

export type PrevisualizacionItem = {
  codigo_tentativo: string
  consecutivo_tentativo: number
  sigla: string
  anio: string
  numero_proyecto: string
  subproyecto: string
  departamento: string
  disciplina: string
  tipo_documento: string
}

export type SolicitudAnulacionItem = {
  id: number
  codigo_id: string
  codigo: string
  motivo_codigo: string
  solicitante_persona_id: string
  solicitante_nombre: string
  motivo: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  resuelto_por_nombre: string
  motivo_resolucion: string
  fecha_solicitud: string
  fecha_resolucion: string | null
}

export type ResumenRegistro = {
  total: number
  confirmados: number
  reservados: number
  anulados: number
  manuales: number
  automaticos: number
  solicitudes_pendientes: number
}
