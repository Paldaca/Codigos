import { useState, type FormEvent } from 'react'

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
    <div className="modal-fondo" role="dialog" aria-modal="true">
      <div className="modal-caja tarjeta">
        <h3>{modo === 'anular' ? `Anular ${codigo}` : `Solicitar anulación de ${codigo}`}</h3>
        <p className="tenue">
          {modo === 'anular'
            ? 'Un código anulado no se puede reutilizar ni reactivar; el consecutivo no retrocede.'
            : 'Un aprobador revisará tu solicitud y recibirá un aviso en su bandeja.'}
        </p>
        <form onSubmit={enviar} className="form-col">
          <label className="campo">
            <span>Motivo obligatorio</span>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Indica la razón técnica o documental..."
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="fila-botones">
            <button type="button" className="btn btn-secundario" onClick={alCerrar} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-peligro" disabled={enviando || !motivo.trim()}>
              {enviando ? 'Procesando…' : modo === 'anular' ? 'Confirmar anulación' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
