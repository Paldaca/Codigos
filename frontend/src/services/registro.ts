import type { RegistroHistorial } from '@cereipo/ui'
import type { CodigoItem, PrevisualizacionItem, ResumenRegistro, SolicitudAnulacionItem } from '../types/registro'
import { pedir } from './http'

export type FiltroRegistro = {
  codigo?: string
  estado?: string
  origen?: string
  numero_proyecto?: string
  disciplina?: string
  tipo_documento?: string
  creado_por?: string
  fecha_inicio?: string
  fecha_fin?: string
  incluir_anulados?: boolean
  pagina?: number
  tamano?: number
}

export type ItemGenerar = {
  anio: string
  numero_proyecto: string
  subproyecto: string
  departamento: string
  disciplina: string
  tipo_documento: string
  motivo?: string
  clave_idempotencia?: string
}

export const registroApi = {
  resumen: () => pedir<ResumenRegistro>('GET', '/api/registro/resumen/'),
  previsualizar: (items: ItemGenerar[]) =>
    pedir<{ sigla: string; previsualizaciones: PrevisualizacionItem[] }>('POST', '/api/registro/previsualizar/', { items }),
  generar: (items: ItemGenerar[]) =>
    pedir<{ resultados: CodigoItem[]; advertencia_correo: string | null }>('POST', '/api/registro/generar/', { items }),
  listar: (filtros: FiltroRegistro = {}) => {
    const q = new URLSearchParams()
    Object.entries(filtros).forEach(([k, v]) => {
      if (v === undefined || v === '') return
      if (k === 'incluir_anulados') q.set(k, v ? '1' : '0')
      else q.set(k, String(v))
    })
    const qs = q.toString()
    return pedir<{ total: number; pagina: number; paginas: number; resultados: CodigoItem[] }>(
      'GET',
      `/api/registro/codigos/${qs ? `?${qs}` : ''}`,
    )
  },
  detalle: (id: string) => pedir<{ codigo: CodigoItem; historial: RegistroHistorial[] }>('GET', `/api/registro/codigos/${id}/`),
  anular: (id: string, motivo: string) => pedir<{ codigo: CodigoItem }>('POST', `/api/registro/codigos/${id}/anular/`, { motivo }),
  solicitarAnulacion: (id: string, motivo: string) =>
    pedir<{ id: number; estado: string }>('POST', `/api/registro/codigos/${id}/solicitar-anulacion/`, { motivo }),
  listarSolicitudes: (estado = '') =>
    pedir<{ resultados: SolicitudAnulacionItem[] }>(
      'GET',
      `/api/registro/solicitudes-anulacion/${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`,
    ),
  resolverSolicitud: (id: number, accion: 'aprobar' | 'rechazar', motivo_resolucion = '') =>
    pedir<{ id: number; estado: string }>('POST', `/api/registro/solicitudes-anulacion/${id}/resolver/`, {
      accion,
      motivo_resolucion,
    }),
}
