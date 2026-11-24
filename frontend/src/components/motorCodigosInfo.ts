export type SegmentoGuia = {
  clave: string
  sigla: string
  titulo: string
  ejemploProyecto: string
  ejemploGeneral: string
  resumen: string
  detalle: string
  regla00?: string
}

export const SEGMENTOS_GUIA: SegmentoGuia[] = [
  {
    clave: 'sigla',
    sigla: 'ORG',
    titulo: 'Sigla de organización',
    ejemploProyecto: 'CER',
    ejemploGeneral: 'CER',
    resumen: 'Identificador fijo e inmutable de tu empresa u organización.',
    detalle:
      'Se configura una sola vez en Catálogos (2–10 caracteres). En cuanto se emite el primer código, queda bloqueada automáticamente para garantizar la trazabilidad histórica.',
  },
  {
    clave: 'anio',
    sigla: 'AA',
    titulo: 'Año (2 dígitos)',
    ejemploProyecto: '26',
    ejemploGeneral: '26',
    resumen: 'Últimos dos dígitos del año documental (ej. 2026 → 26).',
    detalle:
      'Agrupa los consecutivos por año calendario. Al cambiar de año, las combinaciones reinician su numeración desde 001 sin colisionar con años anteriores.',
  },
  {
    clave: 'proyecto',
    sigla: 'NN',
    titulo: 'Número de proyecto',
    ejemploProyecto: '04',
    ejemploGeneral: '00',
    resumen: 'Código del proyecto (01–99) o «00» si es un código general.',
    detalle:
      'Cuando un documento pertenece a una obra o proyecto específico se elige su número (ej. 04). Si es un documento corporativo que no pertenece a ningún proyecto, se usa «00».',
    regla00: '00 = Código general de la organización (no cae en ningún proyecto).',
  },
  {
    clave: 'subproyecto',
    sigla: 'S',
    titulo: 'Subproyecto',
    ejemploProyecto: 'A',
    ejemploGeneral: '0',
    resumen: 'Subdivisión (A–Z) o «00 / 0» cuando es general o sin subproyecto.',
    detalle:
      'Permite separar frentes o áreas dentro de un proyecto (A, B, C…). Si el código es general (Proyecto 00) o el proyecto no tiene subdivisiones, se utiliza el valor general (0 / 00).',
    regla00: '00 / 0 = Sin subproyecto / código general.',
  },
  {
    clave: 'departamento',
    sigla: 'DEPT',
    titulo: 'Departamento',
    ejemploProyecto: 'IN',
    ejemploGeneral: 'GG',
    resumen: 'Área responsable de emitir o custodiar el documento.',
    detalle:
      'Por ejemplo: IN (Ingeniería), GG (Gerencia General), CD (Control de Documentos), CA (Calidad), SH (Seguridad).',
  },
  {
    clave: 'disciplina',
    sigla: 'DISC',
    titulo: 'Disciplina técnica',
    ejemploProyecto: 'M',
    ejemploGeneral: 'G',
    resumen: 'Especialidad técnica (M, C, E, I, P, T, A) o «G» General.',
    detalle:
      'Identifica la disciplina del entregable: Mecánica (M), Civil (C), Electricidad (E), Instrumentación (I), Procesos (P) o General (G) para documentos administrativos o transversales.',
  },
  {
    clave: 'tipo_documento',
    sigla: 'TIPO',
    titulo: 'Tipo de documento o plano',
    ejemploProyecto: 'PLA',
    ejemploGeneral: 'PRO',
    resumen: 'Naturaleza del entregable (PLA, DOC, INF, PRO, FOR, TRN…).',
    detalle:
      'Define qué clase de documento es: Plano (PLA), Procedimiento (PRO), Informe (INF), Formulario (FOR), Especificación Técnica (ESP), Transmittal (TRN), etc.',
  },
  {
    clave: 'consecutivo',
    sigla: 'CCC',
    titulo: 'Consecutivo atómico',
    ejemploProyecto: '012',
    ejemploGeneral: '003',
    resumen: 'Secuencial único de 3 dígitos calculado automáticamente por el motor.',
    detalle:
      'Cada combinación única de los primeros 7 segmentos tiene su propio contador bloqueado en base de datos. Dos personas jamás obtienen el mismo número, aunque generen al mismo milisegundo.',
  },
]

export function esValorGeneral(valor: string | undefined | null): boolean {
  if (!valor) return false
  return /^0+$/.test(valor.trim())
}
