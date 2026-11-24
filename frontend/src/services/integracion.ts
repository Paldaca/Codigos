import type { IdentidadYo, SaludEstado } from '../types/identidad'
import { pedir } from './http'

export const integracionApi = {
  salud: () => pedir<SaludEstado>('GET', '/salud/'),
  yo: () => pedir<IdentidadYo>('GET', '/api/yo/'),
  ambitos: () => pedir<{ ambitos: Array<{ proyecto: string; codigo: string; nombre: string; activo: boolean }> }>('GET', '/api/administracion/ambitos/'),
}
