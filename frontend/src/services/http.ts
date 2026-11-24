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

export async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
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
  })
  const esJson = (resp.headers.get('content-type') || '').includes('json')
  const datos = esJson ? ((await resp.json()) as Record<string, unknown>) : {}
  if (!resp.ok) {
    const mensaje =
      typeof datos.mensaje === 'string'
        ? datos.mensaje
        : typeof datos.error === 'string'
          ? datos.error
          : `Error HTTP ${resp.status}`
    throw new ErrorApi(mensaje, resp.status, String(datos.error || 'error'), datos)
  }
  return datos as T
}
