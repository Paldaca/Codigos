import type { PrevisualizacionItem } from '../types/registro'
import { Etiqueta } from '../ui/componentes'
import { esValorGeneral } from './motorCodigosInfo'

export function VistaPreviaCodigo({ item, indice = 0 }: { item: PrevisualizacionItem; indice?: number }) {
  const esGeneral = esValorGeneral(item.numero_proyecto) && esValorGeneral(item.subproyecto)
  const partes = [
    { etiqueta: 'Org', valor: item.sigla, general: false },
    { etiqueta: 'Año', valor: item.anio.slice(-2), general: false },
    { etiqueta: 'Proy', valor: item.numero_proyecto, general: esValorGeneral(item.numero_proyecto) },
    { etiqueta: 'Sub', valor: item.subproyecto, general: esValorGeneral(item.subproyecto) },
    { etiqueta: 'Depto', valor: item.departamento, general: false },
    { etiqueta: 'Disc', valor: item.disciplina, general: false },
    { etiqueta: 'Tipo', valor: item.tipo_documento, general: false },
    { etiqueta: 'Cons', valor: String(item.consecutivo_tentativo).padStart(3, '0'), general: false, consecutivo: true },
  ]

  return (
    <div className="preview-codigo rev" style={{ '--i': indice } as React.CSSProperties}>
      <div className="preview-codigo-top">
        <div className="preview-valor">{item.codigo_tentativo}</div>
        <div className="preview-badges">
          {esGeneral && (
            <Etiqueta tono="info" punto>
              Código general (00)
            </Etiqueta>
          )}
          <Etiqueta tono="module">Consecutivo estimado #{String(item.consecutivo_tentativo).padStart(3, '0')}</Etiqueta>
        </div>
      </div>

      <div className="preview-segmentos">
        {partes.map((p) => (
          <span
            key={p.etiqueta}
            className={`segmento-chip ${p.general ? 'is-general' : ''} ${p.consecutivo ? 'is-consecutivo' : ''}`}
          >
            <small>{p.etiqueta}</small>
            <b>{p.valor}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
