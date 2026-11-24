import type { PrevisualizacionItem } from '../types/registro'

export function VistaPreviaCodigo({ item }: { item: PrevisualizacionItem }) {
  const partes = [
    { etiqueta: 'Org', valor: item.sigla },
    { etiqueta: 'Año', valor: item.anio.slice(-2) },
    { etiqueta: 'Proy', valor: item.numero_proyecto },
    { etiqueta: 'Sub', valor: item.subproyecto },
    { etiqueta: 'Depto', valor: item.departamento },
    { etiqueta: 'Disc', valor: item.disciplina },
    { etiqueta: 'Tipo', valor: item.tipo_documento },
    { etiqueta: 'Cons', valor: String(item.consecutivo_tentativo).padStart(3, '0') },
  ]
  return (
    <div className="preview-codigo">
      <div className="preview-valor">{item.codigo_tentativo}</div>
      <div className="preview-segmentos">
        {partes.map((p) => (
          <span key={p.etiqueta} className="segmento-chip">
            <small>{p.etiqueta}</small>
            <b>{p.valor}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
