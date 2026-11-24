export type RutaApp = 'inicio' | 'generar' | 'registro' | 'anulaciones' | 'catalogos' | 'administracion'

export function resolverRuta(rutaCompleta: string): RutaApp {
  const soloRuta = rutaCompleta.split('?')[0].split('#')[0]
  const limpia = soloRuta.replace(/\/+$/, '') || '/'
  if (limpia === '/generar') return 'generar'
  if (limpia === '/registro') return 'registro'
  if (limpia === '/anulaciones') return 'anulaciones'
  if (limpia === '/catalogos') return 'catalogos'
  if (limpia === '/administracion' || /^\/proyectos\/[^/]+\/administracion$/.test(limpia)) return 'administracion'
  return 'inicio'
}
