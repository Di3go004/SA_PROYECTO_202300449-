// src/pages/admin/SchoolsSection.tsx
import { useEffect, useState } from 'react'
import { adminApi, School } from '../../services/api'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

const emptyForm = { name: '', code: '' }

export default function SchoolsSection() {
  const toast = useToast()
  const [items, setItems]       = useState<School[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [editing, setEditing]   = useState<School | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [target, setTarget]     = useState<School | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setItems((await adminApi.listSchools()).data)
    } catch {
      toast.error('No se pudo cargar las escuelas')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true) }
  const openEdit = (s: School) => { setEditing(s); setForm({ name: s.name, code: s.code }); setFormOpen(true) }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateSchool(editing.id, form)
        toast.success('Escuela actualizada')
      } else {
        await adminApi.createSchool(form)
        toast.success('Escuela creada')
      }
      setFormOpen(false)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la escuela')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!target) return
    setSaving(true)
    try {
      await adminApi.deleteSchool(target.id)
      toast.success('Escuela eliminada')
      setTarget(null)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la escuela')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="card-title">Escuelas y Áreas</div>
          <div className="subtitle">Unidades académicas a las que pertenecen los cursos</div>
        </div>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary" onClick={openCreate}>+ Nueva escuela</button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando escuelas…</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">🏛️</span>No hay escuelas registradas</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>Escuela</th><th>Código</th><th>Cursos</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
              </thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id}>
                    <td className="cell-strong">{s.name}</td>
                    <td><span className="badge badge-info">{s.code}</span></td>
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
        title={editing ? 'Editar escuela' : 'Nueva escuela'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.name || !form.code}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">Nombre</label>
          <input value={form.name} placeholder="Escuela de Ciencias y Sistemas"
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">Código</label>
          <input value={form.code} placeholder="ECYS"
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!target}
        title="Eliminar escuela"
        message={`¿Eliminar "${target?.name}"? Esta acción no se puede deshacer.`}
        warning={Number(target?.total_courses) > 0
          ? `Esta escuela tiene ${target?.total_courses} curso(s) asociado(s); la base rechazará el borrado.`
          : undefined}
        busy={saving}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
