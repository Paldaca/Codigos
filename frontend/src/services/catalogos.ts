import type { RegistroHistorial } from '@cereipo/ui'
import type {
  CatalogosAgrupados,
  ConfiguracionOrg,
  InstantaneaCatalogoItem,
  Segmento,
  TipoSegmento,
} from '../types/catalogos'
import { pedir } from './http'

export type HistorialSegmentoItem = RegistroHistorial & {
  reversible: boolean
  instantanea_id: number | null
}

export const catalogosApi = {
  obtenerConfigOrg: () => pedir<ConfiguracionOrg>('GET', '/api/catalogos/organizacion/'),
  guardarConfigOrg: (datos: {
    sigla: string
    correo_notificacion: string
    notificar_por_correo: boolean
    motivo?: string
  }) => pedir<ConfiguracionOrg>('PUT', '/api/catalogos/organizacion/', datos),
  listarSegmentos: (incluirInactivos = false, signal?: AbortSignal) =>
    pedir<{ segmentos: CatalogosAgrupados }>(
      'GET',
      `/api/catalogos/segmentos/${incluirInactivos ? '?incluir_inactivos=1' : ''}`,
      undefined,
      { signal },
    ),
  crearSegmento: (datos: {
    tipo: TipoSegmento
    codigo: string
    nombre: string
    codigo_shell?: string
    orden?: number
    activo?: boolean
    motivo?: string
  }) => pedir<Segmento>('POST', '/api/catalogos/segmentos/', datos),
  actualizarSegmento: (
    id: number,
    datos: Partial<Pick<Segmento, 'nombre' | 'codigo_shell' | 'orden' | 'activo'>> & { motivo?: string },
  ) => pedir<Segmento>('PATCH', `/api/catalogos/segmentos/${id}/`, datos),
  sembrarEstandar: () => pedir<{ creados: number; total: number }>('POST', '/api/catalogos/sembrar-estandar/', {}),
  restablecerPlantilla: (datos: {
    tipo?: TipoSegmento | ''
    desactivar_personalizados?: boolean
    motivo?: string
  }) =>
    pedir<{
      creados: number
      restaurados: number
      desactivados: number
      total: number
      instantanea_id: number
    }>('POST', '/api/catalogos/restablecer-plantilla/', datos),
  loteSegmentos: (datos: {
    tipo: TipoSegmento
    accion: 'activar_todos' | 'desactivar_todos' | 'solo_general'
    motivo?: string
  }) => pedir<{ actualizados: number; instantanea_id: number }>('POST', '/api/catalogos/segmentos/lote/', datos),
  listarHistorial: (tipo: TipoSegmento | '' = '', signal?: AbortSignal) =>
    pedir<{ resultados: HistorialSegmentoItem[] }>(
      'GET',
      `/api/catalogos/segmentos/historial/${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''}`,
      undefined,
      { signal },
    ),
  revertirCambio: (historialId: string | number) =>
    pedir<{ segmento: Segmento; revertido_de: number }>(
      'POST',
      `/api/catalogos/segmentos/revertir/${encodeURIComponent(String(historialId))}/`,
      {},
    ),
  listarInstantaneas: (signal?: AbortSignal) =>
    pedir<{ resultados: InstantaneaCatalogoItem[] }>('GET', '/api/catalogos/instantaneas/', undefined, { signal }),
  restaurarInstantanea: (instantaneaId: number) =>
    pedir<{ restaurados: number; respaldo_id: number }>(
      'POST',
      `/api/catalogos/instantaneas/${instantaneaId}/restaurar/`,
      {},
    ),
}
