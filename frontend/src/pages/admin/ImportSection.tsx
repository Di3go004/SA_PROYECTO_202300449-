// src/pages/admin/ImportSection.tsx
// Carga masiva de grabaciones desde CSV.
import { useEffect, useRef, useState } from 'react'
import { importApi, ImportBatch, ImportSummary } from '../../services/api'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'

const COLUMNS = [
  ['school_code', 'sí', 'Código de la escuela. Si no existe, se crea con school_name.'],
  ['school_name', 'no', 'Nombre de la escuela, obligatorio solo si hay que crearla.'],
  ['course_code', 'sí', 'Código del curso. Si no existe, se crea con course_name.'],
  ['course_name', 'no', 'Nombre del curso, obligatorio solo si hay que crearlo.'],
  ['semester_name', 'sí', '"Primer Semestre", "Segundo Semestre"… Se crea si no existe.'],
  ['year', 'sí', 'Año del periodo, entre 2000 y 2100.'],
  ['teacher_email', 'sí', 'Correo de un catedrático o auxiliar ya registrado.'],
  ['title', 'sí', 'Título de la grabación.'],
  ['description', 'no', 'Descripción. Puede llevar comas si va entre comillas.'],
  ['duration_seconds', 'no', 'Duración en segundos. Vacío = 0.'],
  ['video_url', 'sí', 'URL del video. Es la clave que evita duplicados.'],
  ['thumbnail_url', 'no', 'URL de la miniatura.'],
  ['tags', 'no', 'Etiquetas separadas por |  (ej. teoria|examen).'],
  ['is_published', 'no', 'true/false. Vacío = true.'],
]

const STATUS_BADGE: Record<string, string> = {
  COMPLETADO: 'badge-success',
  COMPLETADO_CON_ERRORES: 'badge-warning',
  FALLIDO: 'badge-danger',
  EN_PROCESO: 'badge-info',
}

export default function ImportSection() {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile]         = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary]   = useState<ImportSummary | null>(null)
  const [batches, setBatches]   = useState<ImportBatch[]>([])
  const [detail, setDetail]     = useState<any>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const loadBatches = async () => {
    try {
      setBatches((await importApi.listBatches()).data)
    } catch {
      toast.error('No se pudo cargar el historial de cargas')
    }
  }
  useEffect(() => { loadBatches() }, [])

  const pick = (selected: File | null) => {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      toast.error('El archivo debe tener extensión .csv')
      return
    }
    setFile(selected)
    setSummary(null)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setSummary(null)
    try {
      const { data } = await importApi.upload(file)
      setSummary(data)
      if (data.failed > 0) {
        toast.info(`${data.inserted} insertada(s), ${data.failed} con error`)
      } else {
        toast.success(`${data.inserted} grabación(es) insertada(s), ${data.skipped} omitida(s)`)
      }
      await loadBatches()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo procesar el archivo')
    } finally {
      setUploading(false)
    }
  }

  const openDetail = async (id: number) => {
    try {
      setDetail((await importApi.getBatch(id)).data)
    } catch {
      toast.error('No se pudo cargar el detalle de la carga')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="card-title">Carga masiva de clases</div>
          <div className="subtitle">Importa grabaciones de semestres anteriores desde un archivo .csv</div>
        </div>
        <div className="toolbar-spacer" />
        <button className="btn btn-ghost" onClick={() => setHelpOpen(true)}>Ver formato requerido</button>
      </div>

      {/* Zona de carga */}
      <div className="card">
        <div
          className={`dropzone${dragOver ? ' is-over' : ''}${file ? ' has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            pick(e.dataTransfer.files?.[0] || null)
          }}
        >
          <span className="dropzone-icon">{file ? '📄' : '📥'}</span>
          <div className="dropzone-title">
            {file ? file.name : 'Arrastra el archivo .csv o haz clic para seleccionarlo'}
          </div>
          <div className="dropzone-hint">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB · listo para procesar`
              : 'Tamaño máximo 10 MB'}
          </div>
          <input
            ref={inputRef} type="file" accept=".csv,text/csv" hidden
            onChange={e => pick(e.target.files?.[0] || null)}
          />
        </div>

        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          {file && (
            <button className="btn btn-secondary" disabled={uploading}
              onClick={() => { setFile(null); setSummary(null); if (inputRef.current) inputRef.current.value = '' }}>
              Quitar archivo
            </button>
          )}
          <button className="btn btn-primary" onClick={upload} disabled={!file || uploading}>
            {uploading ? <><span className="spinner" /> Procesando…</> : 'Procesar archivo'}
          </button>
        </div>
      </div>

      {/* Resultado de la última carga */}
      {summary && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Resultado de la carga</h2>
            <span className={`badge ${STATUS_BADGE[summary.status] || 'badge-neutral'}`}>
              {summary.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="stat-grid" style={{ marginBottom: summary.errors.length ? 16 : 0 }}>
            {[
              { label: 'Filas leídas', value: summary.total_rows, color: 'var(--secondary)' },
              { label: 'Insertadas',   value: summary.inserted,   color: '#1b4d1f' },
              { label: 'Omitidas (ya existían)', value: summary.skipped, color: '#5c3d05' },
              { label: 'Con error',    value: summary.failed,     color: 'var(--error)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-accent" style={{ background: s.color }} />
                <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {summary.errors.length > 0 && (
            <>
              <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                Las filas con error se descartaron individualmente; el resto del archivo sí se importó.
              </div>
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data">
                    <thead><tr><th>Fila</th><th>Columna</th><th>Motivo</th></tr></thead>
                    <tbody>
                      {summary.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="cell-mono">{e.row}</td>
                          <td>{e.column ? <span className="badge badge-neutral">{e.column}</span> : '—'}</td>
                          <td>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="table-wrap">
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--outline-variant)' }}>
          <h2 className="card-title">Historial de cargas</h2>
        </div>
        {batches.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">🗂️</span>Todavía no se ha procesado ningún archivo</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th><th>Archivo</th><th>Fecha</th><th>Leídas</th>
                  <th>Insertadas</th><th>Omitidas</th><th>Errores</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id}>
                    <td className="cell-mono">{b.id}</td>
                    <td className="cell-strong">{b.filename}</td>
                    <td className="muted">{new Date(b.started_at).toLocaleString('es-GT')}</td>
                    <td>{b.total_rows}</td>
                    <td>{b.inserted_rows}</td>
                    <td>{b.skipped_rows}</td>
                    <td>{b.failed_rows > 0 ? <span className="badge badge-danger">{b.failed_rows}</span> : '0'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[b.status] || 'badge-neutral'}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(b.id)}>Detalle</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle de un lote */}
      <Modal open={!!detail} title={`Carga #${detail?.id} — ${detail?.filename || ''}`}
        onClose={() => setDetail(null)} width={640}
        footer={<button className="btn btn-secondary" onClick={() => setDetail(null)}>Cerrar</button>}>
        <div className="row wrap" style={{ marginBottom: 14 }}>
          <span className="badge badge-info">Leídas {detail?.total_rows}</span>
          <span className="badge badge-success">Insertadas {detail?.inserted_rows}</span>
          <span className="badge badge-warning">Omitidas {detail?.skipped_rows}</span>
          <span className="badge badge-danger">Errores {detail?.failed_rows}</span>
        </div>
        {detail?.errors?.length === 0 ? (
          <div className="alert alert-success">Todas las filas se procesaron sin errores.</div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead><tr><th>Fila</th><th>Columna</th><th>Motivo</th></tr></thead>
                <tbody>
                  {detail?.errors?.map((e: any, i: number) => (
                    <tr key={i}>
                      <td className="cell-mono">{e.row_number}</td>
                      <td>{e.column_name || '—'}</td>
                      <td>{e.error_message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Formato esperado */}
      <Modal open={helpOpen} title="Formato del archivo CSV" onClose={() => setHelpOpen(false)} width={680}
        footer={<button className="btn btn-secondary" onClick={() => setHelpOpen(false)}>Entendido</button>}>
        <p className="body" style={{ marginBottom: 12 }}>
          La primera línea debe traer los encabezados. Las escuelas, cursos y semestres que no
          existan se crean automáticamente; el docente, en cambio, debe estar registrado previamente.
        </p>
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          Volver a cargar el mismo archivo no duplica nada: las grabaciones cuya <code>video_url</code> ya
          exista se cuentan como omitidas.
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Columna</th><th>Obligatoria</th><th>Detalle</th></tr></thead>
              <tbody>
                {COLUMNS.map(([name, required, detail]) => (
                  <tr key={name}>
                    <td className="cell-mono">{name}</td>
                    <td>
                      <span className={`badge ${required === 'sí' ? 'badge-danger' : 'badge-neutral'}`}>
                        {required}
                      </span>
                    </td>
                    <td>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </>
  )
}
