import type { CatalogosAgrupados, ConfiguracionOrg, Segmento, TipoSegmento } from '../types/catalogos'
import { pedir } from './http'

export const catalogosApi = {
  obtenerConfigOrg: () => pedir<ConfiguracionOrg>('GET', '/api/catalogos/organizacion/'),
  guardarConfigOrg: (datos: { sigla: string; correo_notificacion: string; notificar_por_correo: boolean; motivo?: string }) =>
    pedir<ConfiguracionOrg>('PUT', '/api/catalogos/organizacion/', datos),
  listarSegmentos: (incluirInactivos = false) =>
    pedir<{ segmentos: CatalogosAgrupados }>('GET', `/api/catalogos/segmentos/${incluirInactivos ? '?incluir_inactivos=1' : ''}`),
  crearSegmento: (datos: {
    tipo: TipoSegmento
    codigo: string
    nombre: string
    codigo_shell?: string
    orden?: number
    activo?: boolean
  }) => pedir<Segmento>('POST', '/api/catalogos/segmentos/', datos),
  actualizarSegmento: (id: number, datos: Partial<Pick<Segmento, 'nombre' | 'codigo_shell' | 'orden' | 'activo'>>) =>
    pedir<Segmento>('PATCH', `/api/catalogos/segmentos/${id}/`, datos),
  sembrarEstandar: () => pedir<{ creados: number; total: number }>('POST', '/api/catalogos/sembrar-estandar/', {}),
}
