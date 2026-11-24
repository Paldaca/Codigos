import { useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Aviso, Boton, Dialogo } from '../ui/componentes'

export function ModalAnulacion({
  codigo,
  modo,
  alCerrar,
  alConfirmar,
}: {
  codigo: string
  modo: 'anular' | 'solicitar'
  alCerrar: () => void
  alConfirmar: (motivo: string) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) {
      setError('El motivo es obligatorio.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await alConfirmar(motivo.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo={modo === 'anular' ? `Anular ${codigo}` : `Solicitar anulación de ${codigo}`}
      descripcion={
        modo === 'anular'
          ? 'Un código anulado no se puede reutilizar ni reactivar; el consecutivo nunca retrocede.'
          : 'Un aprobador revisará tu solicitud y recibirá un aviso inmediato en su bandeja.'
      }
      acciones={
        <>
          <Boton variante="secondary" onClick={alCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="form-anulacion"
            variante={modo === 'anular' ? 'danger' : 'primary'}
            cargando={enviando}
            disabled={enviando || !motivo.trim()}
          >
            {enviando ? 'Procesando…' : modo === 'anular' ? `Anular ${codigo}` : 'Enviar solicitud'}
          </Boton>
        </>
      }
    >
      <form id="form-anulacion" onSubmit={enviar} className="form-col">
        {modo === 'anular' && (
          <Aviso tono="warn">
            <strong>Acción irreversible:</strong> el consecutivo de <code>{codigo}</code> quedará bloqueado en auditoría.
          </Aviso>
        )}

        <label className="field">
          <span className="field-label">Motivo obligatorio</span>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              if (error) setError('')
            }}
            aria-invalid={error ? true : undefined}
            placeholder="Indica la razón técnica o documental…"
            required
          />
        </label>

        {error && (
          <Aviso tono="error">
            <AlertTriangle style={{ display: 'none' }} aria-hidden="true" />
            {error}
          </Aviso>
        )}
      </form>
    </Dialogo>
  )
}
