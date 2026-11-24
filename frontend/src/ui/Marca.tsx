// Marca oficial de Cereipo (docs/Cereipo_desing_system.md §2).
const LIENZO = 97.705
const GLIFO =
  'M52.67 69.87L52.75 67.59L52.98 66.50L54.17 65.32L57.47 62.42L65.72 60.13L65.87 60.14L66.60 60.64L71.73 64.60L72.33 64.98L78.70 64.06L78.07 59.93L73.42 60.46L72.26 59.62L71.18 58.67L89.92 53.38L88.91 49.38L88.79 49.30L78.85 52.03L80.29 47.33L81.11 46.69L84.90 44.24L82.90 41.02L82.76 40.82L82.61 40.82L79.89 42.42L76.79 44.46L76.32 45.65L73.88 53.39L66.39 55.49L68.37 50.38L73.20 49.05L72.16 45.07L65.38 46.80L65.16 46.95L64.85 47.60L61.17 56.90L55.37 58.68L53.11 60.53L54.32 56.49L59.52 52.57L62.15 44.68L73.55 41.32L78.99 35.79L76.00 32.78L71.28 37.49L61.91 40.19L61.32 39.06L61.04 38.16L64.30 35.08L69.18 34.46L68.74 30.37L62.51 31.01L59.19 34.02L58.75 33.09L59.75 27.47L55.61 26.76L54.29 33.70L58.24 42.84L56.99 46.56L53.00 39.96L52.20 40.31L49.30 42.07L54.50 50.91L50.74 53.93L50.38 54.81L49.02 59.16L45.82 55.27L46.45 54.31L50.02 49.72L47.97 48.00L46.74 47.13L43.00 51.68L42.87 51.63L42.75 51.42L42.53 50.45L42.05 46.64L51.08 32.91L50.70 24.96L46.50 25.12L46.75 31.67L41.07 40.12L40.78 38.83L39.59 30.93L40.11 30.17L42.88 26.76L39.75 23.98L35.12 29.48L36.47 39.21L33.57 38.21L29.44 30.40L22.04 29.67L21.57 33.87L26.75 34.38L28.19 37.19L22.99 37.31L23.01 41.49L30.45 41.53L37.21 44.12L38.72 53.40L44.66 60.84L36.49 58.03L33.59 47.51L32.19 46.67L26.25 43.70L24.45 47.39L25.89 48.24L30.02 50.36L31.50 56.29L23.22 53.47L21.06 45.14L20.66 43.93L14.69 40.06L12.45 43.52L16.99 46.58L18.27 51.70L8.60 48.45L7.30 52.45L24.54 58.49L22.20 60.27L17.64 59.50L17.12 61.95L16.89 63.55L23.21 64.78L29.62 60.20L41.34 64.25L41.95 64.54L43.83 67.28L44.21 67.97L44.53 69.05L44.74 70.87L52.66 70.87L52.67 69.91Z'

const COLORES_MARCA: Record<string, string> = {
  verde: 'var(--brand-green)',
  turquesa: 'var(--accent-500)',
  azul: 'var(--brand-blue)',
  morado: 'var(--brand-purple)',
}

type IsotipoProps = {
  color?: string
  variante?: 'lleno' | 'glifo'
  tamano?: number
  className?: string
  titulo?: string
}

export function Isotipo({ color = 'verde', variante = 'lleno', tamano = 30, className, titulo }: IsotipoProps) {
  const tinta = COLORES_MARCA[color] ?? color
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox={`0 0 ${LIENZO} ${LIENZO}`}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {variante === 'lleno' && <rect width={LIENZO} height={LIENZO} rx="22" fill={tinta} />}
      <path d={GLIFO} fill={variante === 'lleno' ? '#fff' : tinta} />
    </svg>
  )
}
