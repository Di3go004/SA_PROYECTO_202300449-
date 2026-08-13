// src/pages/admin/SemestersSection.tsx
import { useEffect, useState } from 'react'
import { adminApi, Semester } from '../../services/api'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

const emptyForm = { name: 'Primer Semestre', year: new Date().getFullYear(), code: '', is_active: false }

export default function SemestersSection() {
  const toast = useToast()
  const [items, setItems]     = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editing, setEditing] = useState<Semester | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm]       = useState(emptyForm)
  const [target, setTarget]   = useState<Semester | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setItems((await adminApi.listSemesters()).data)
    } catch {
      toast.error('No se pudo cargar los semestres')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true) }
  const openEdit = (s: Semester) => {
    setEditing(s)
    setForm({ name: s.name, year: s.year, code: s.code, is_active: s.is_active })
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateSemester(editing.id, form)
        toast.success('Semestre actualizado')
      } else {
        await adminApi.createSemester(form)
        toast.success('Semestre creado')
      }
      setFormOpen(false)
      await load()
    } catch (err: any) {
      // El mensaje viene del RAISE EXCEPTION del SP; se muestra literal.
      toast.error(err.response?.data?.message || 'No se pudo guardar el semestre')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!target) return
    setSaving(true)
    try {
      await adminApi.deleteSemester(target.id)
      toast.success('Semestre eliminado')
      setTarget(null)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar el semestre')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="card-title">Semestres</div>
          <div className="subtitle">Periodos académicos disponibles para los cursos</div>
        </div>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo semestre</button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando semestres…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📅</span>
            No hay semestres registrados
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Semestre</th><th>Año</th><th>Código</th>
                  <th>Estado</th><th>Cursos</th><th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id}>
                    <td className="cell-strong">{s.name}</td>
                    <td>{s.year}</td>
                    <td className="cell-mono">{s.code}</td>
                    <td>
                      {s.is_active
                        ? <span className="badge badge-success">Activo</span>
                        : <span className="badge badge-neutral">Inactivo</span>}
                    </td>
                    <td>{s.total_courses}</td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setTarget(s)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Editar semestre' : 'Nuevo semestre'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">Nombre del periodo</label>
          <select value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}>
            <option>Primer Semestre</option>
            <option>Segundo Semestre</option>
            <option>Vacaciones Junio</option>
            <option>Vacaciones Diciembre</option>
          </select>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Año</label>
            <input type="number" value={form.year}
              onChange={e => setForm({ ...form, year: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label className="field-label">Código</label>
            <input value={form.code} placeholder="se genera solo"
              onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
        </div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_active} style={{ width: 'auto' }}
            onChange={e => setForm({ ...form, is_active: e.target.checked })} />
          <span className="body">Marcar como semestre activo</span>
        </label>
        <p className="subtitle" style={{ marginTop: 6, fontSize: 12 }}>
          Solo un semestre puede estar activo: al marcar este, el anterior se desactiva.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!target}
        title="Eliminar semestre"
        message={`¿Eliminar "${target?.name} ${target?.year}"? Esta acción no se puede deshacer.`}
        warning={Number(target?.total_courses) > 0
          ? `Este semestre tiene ${target?.total_courses} curso(s) asociado(s); la base rechazará el borrado.`
          : undefined}
        busy={saving}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
