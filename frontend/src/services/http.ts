export class ErrorApi extends Error {
  status: number
  codigo: string
  datos: Record<string, unknown>

  constructor(mensaje: string, status: number, codigo = 'error', datos: Record<string, unknown> = {}) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.datos = datos
  }
}

type ManejadorAuth = (status: number, codigo: string) => void
let manejadorAuth: ManejadorAuth | null = null

export function configurarManejadorAuth(cb: ManejadorAuth | null) {
  manejadorAuth = cb
}

function leerCookie(nombre: string): string {
  const prefijo = `${nombre}=`
  for (const parte of document.cookie.split(';')) {
    const limpia = parte.trim()
    if (limpia.startsWith(prefijo)) {
      return decodeURIComponent(limpia.slice(prefijo.length))
    }
  }
  return ''
}

export async function pedir<T>(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  opciones?: { signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const upper = metodo.toUpperCase()
  if (upper !== 'GET' && upper !== 'HEAD') {
    const csrf = leerCookie('cereipo_codigos_csrf')
    if (csrf) headers['X-CSRFToken'] = csrf
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  }
  const resp = await fetch(ruta, {
    method: upper,
    credentials: 'same-origin',
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    signal: opciones?.signal,
  })
  const esJson = (resp.headers.get('content-type') || '').includes('json')
  let datos: Record<string, unknown> = {}
  if (esJson) {
    try {
      datos = (await resp.json()) as Record<string, unknown>
    } catch {
      datos = {}
    }
  }
  if (!resp.ok) {
    const mensaje =
      typeof datos.mensaje === 'string'
        ? datos.mensaje
        : typeof datos.error === 'string'
          ? datos.error
          : typeof datos.detail === 'string'
            ? datos.detail
            : `Error HTTP ${resp.status}`
    const codigoDefecto = resp.status === 401 ? 'sesion-vencida' : resp.status === 403 ? 'sin-acceso' : 'error'
    const codigo = typeof datos.error === 'string' && datos.error ? datos.error : codigoDefecto
    if (resp.status === 401 || (resp.status === 403 && codigo === 'sin-acceso')) {
      manejadorAuth?.(resp.status, codigo)
    }
    throw new ErrorApi(mensaje, resp.status, codigo, datos)
  }
  return datos as T
}
