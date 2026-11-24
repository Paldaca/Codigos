export type ConfiguracionOrg = {
  configurada: boolean
  sigla: string
  correo_notificacion: string
  notificar_por_correo: boolean
  bloqueada_por_codigos: boolean
}

export type TipoSegmento =
  | 'proyecto'
  | 'subproyecto'
  | 'departamento'
  | 'disciplina'
  | 'tipo_documento'

export type Segmento = {
  id: number
  tipo: TipoSegmento
  codigo: string
  nombre: string
  codigo_shell: string
  orden: number
  activo: boolean
}

export type CatalogosAgrupados = Record<TipoSegmento, Segmento[]>

export type InstantaneaCatalogoItem = {
  id: number
  descripcion: string
  tipo_alcance: string
  total_segmentos: number
  actor_nombre: string
  creado_en: string
}
