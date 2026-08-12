// src/components/ConfirmDialog.tsx
// Confirmación de acciones destructivas. Los borrados del panel pueden ser
// rechazados por la base (un semestre con cursos, una escuela con cursos), así
// que el diálogo avisa de las dependencias antes de intentarlo.
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  warning?: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message, warning, confirmLabel = 'Eliminar', busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Eliminando…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="body">{message}</p>
      {warning && <div className="alert alert-warning" style={{ marginTop: 12 }}>{warning}</div>}
    </Modal>
  )
}
