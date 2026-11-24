import type { CatalogosAgrupados, Segmento } from '../types/catalogos'

/** Catálogo original de CodigoForm (orden y códigos exactos). */
export function obtenerAniosOriginales(): string[] {
  const actual = new Date().getFullYear()
  return Array.from({ length: 4 }, (_, i) => String(actual - 2 + i))
}

const PROYECTOS_ORIG: Array<[string, string]> = [
  ['00', 'General (sin proyecto)'],
  ...Array.from({ length: 99 }, (_, i): [string, string] => {
    const cod = String(i + 1).padStart(2, '0')
    return [cod, `Proyecto ${cod}`]
  }),
]

const SUBPROYECTOS_ORIG: Array<[string, string]> = [
  ['0', 'General / Sin subproyecto'],
  ...Array.from({ length: 26 }, (_, i): [string, string] => {
    const letra = String.fromCharCode(65 + i)
    return [letra, `Subproyecto ${letra}`]
  }),
]

const DEPARTAMENTOS_ORIG: Array<[string, string]> = [
  ['GG', 'Gerencia General'],
  ['GO', 'Gerencia de Operaciones'],
  ['MN', 'Mantenimiento'],
  ['CO', 'Construcción'],
  ['IN', 'Ingeniería'],
  ['CA', 'Calidad'],
  ['RH', 'Recursos Humanos'],
  ['SH', 'Seguridad'],
  ['AM', 'Ambiente'],
  ['PR', 'Procura'],
  ['CT', 'Contratos'],
  ['AF', 'Administración y Finanzas'],
  ['PL', 'Planificación'],
  ['EC', 'Estimación de Costos'],
  ['CD', 'Control de Documentos'],
  ['GN', 'General'],
  ['GP', 'Gerencia de Proyectos'],
  ['OF', 'Ofertas'],
  ['IT', 'Informática y Tecnología'],
]

const DISCIPLINAS_ORIG: Array<[string, string]> = [
  ['M', 'Mecánica'],
  ['A', 'Arquitectura'],
  ['C', 'Civil'],
  ['I', 'Instrumentación'],
  ['E', 'Electricidad'],
  ['P', 'Procesos'],
  ['T', 'Telecomunicaciones'],
  ['G', 'General'],
]

const TIPOS_DOCUMENTO_ORIG: Array<[string, string]> = [
  ['ACC', 'Acción Correctiva'],
  ['CAR', 'Carta'],
  ['CEN', 'Centro de Costos'],
  ['CON', 'Contrato'],
  ['CRO', 'Cronograma'],
  ['DPT', 'Descripción de Puesto de Trabajo'],
  ['GEN', 'Documentos Generales'],
  ['DOC', 'Documentos de Ingeniería'],
  ['ESC', 'Estimado de Costos'],
  ['ESP', 'Especificación Técnica'],
  ['EST', 'Estudio'],
  ['FPR', 'Ficha de Proceso'],
  ['FLU', 'Flujograma'],
  ['FOR', 'Formulario'],
  ['HDC', 'Hoja de Control'],
  ['HDD', 'Hoja de Datos'],
  ['INF', 'Informe'],
  ['INS', 'Instrucción de Sitio'],
  ['LIS', 'Lista'],
  ['MDC', 'Manejo del Cambio'],
  ['MAN', 'Manual'],
  ['MAC', 'Manual de la Calidad'],
  ['MDP', 'Mapa de Procesos'],
  ['MAT', 'Matriz de Riesgo'],
  ['MRO', 'Matriz de Riesgo y Oportunidades'],
  ['MNT', 'Minuta'],
  ['MVV', 'Misión y Visión y Valores'],
  ['NCN', 'No Conformidad'],
  ['ODC', 'Objetivos de la Calidad'],
  ['OFE', 'Oferta'],
  ['ODM', 'Oportunidad de Mejora'],
  ['PLN', 'Plan'],
  ['PIE', 'Plan de Inspección y Ensayo'],
  ['PQC', 'Plan de la Calidad'],
  ['PLA', 'Plano'],
  ['PDC', 'Política de la Calidad'],
  ['PRE', 'Presentación'],
  ['PRO', 'Procedimiento'],
  ['PNC', 'Producto No Conforme'],
  ['PGM', 'Programa'],
  ['RGA', 'Relación de Gastos'],
  ['REQ', 'Requisición de Materiales'],
  ['SVI', 'Solicitud de Viáticos'],
  ['TRN', 'Transmittal'],
]

function construirLista(tipo: Segmento['tipo'], pares: Array<[string, string]>): Segmento[] {
  return pares.map(([codigo, nombre], idx) => ({
    id: -(idx + 1),
    tipo,
    codigo,
    nombre,
    codigo_shell: '',
    orden: idx + 1,
    activo: true,
  }))
}

export const CATALOGO_ORIGINAL: CatalogosAgrupados = {
  proyecto: construirLista('proyecto', PROYECTOS_ORIG),
  subproyecto: construirLista('subproyecto', SUBPROYECTOS_ORIG),
  departamento: construirLista('departamento', DEPARTAMENTOS_ORIG),
  disciplina: construirLista('disciplina', DISCIPLINAS_ORIG),
  tipo_documento: construirLista('tipo_documento', TIPOS_DOCUMENTO_ORIG),
}

export function catalogoEstaVacio(cat: CatalogosAgrupados | null): boolean {
  if (!cat) return true
  return (
    cat.proyecto.length === 0 &&
    cat.subproyecto.length === 0 &&
    cat.departamento.length === 0 &&
    cat.disciplina.length === 0 &&
    cat.tipo_documento.length === 0
  )
}

/**
 * Devuelve los segmentos del backend si existen; si algún tipo está vacío,
 * recurre al catálogo original para garantizar disponibilidad inmediata.
 */
export function resolverCatalogoConOriginal(remoto: CatalogosAgrupados | null): CatalogosAgrupados {
  if (!remoto) return CATALOGO_ORIGINAL
  return {
    proyecto: remoto.proyecto.length > 0 ? remoto.proyecto : CATALOGO_ORIGINAL.proyecto,
    subproyecto: remoto.subproyecto.length > 0 ? remoto.subproyecto : CATALOGO_ORIGINAL.subproyecto,
    departamento: remoto.departamento.length > 0 ? remoto.departamento : CATALOGO_ORIGINAL.departamento,
    disciplina: remoto.disciplina.length > 0 ? remoto.disciplina : CATALOGO_ORIGINAL.disciplina,
    tipo_documento: remoto.tipo_documento.length > 0 ? remoto.tipo_documento : CATALOGO_ORIGINAL.tipo_documento,
  }
}
