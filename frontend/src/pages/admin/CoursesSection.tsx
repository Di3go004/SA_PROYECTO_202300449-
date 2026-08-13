// src/pages/admin/CoursesSection.tsx
// Cursos + asignación de docentes. Es la única sección que cruza las dos bases:
// el curso vive en el catálogo y el docente en auth, unidos por teacher_id.
import { useEffect, useState } from 'react'
import { adminApi, Course, School, Semester, Teacher } from '../../services/api'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

const emptyForm = { name: '', code: '', school_id: 0, semester_id: 0 }

export default function CoursesSection() {
  const toast = useToast()
  const [items, setItems]         = useState<Course[]>([])
  const [schools, setSchools]     = useState<School[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [teachers, setTeachers]   = useState<Teacher[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const [filterSchool, setFilterSchool]     = useState('')
  const [filterSemester, setFilterSemester] = useState('')

  const [editing, setEditing]   = useState<Course | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [target, setTarget]     = useState<Course | null>(null)

  // Asignación de docentes
  const [assignFor, setAssignFor]       = useState<Course | null>(null)
  const [selectedTeacher, setSelected]  = useState('')

  const loadCourses = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterSchool)   params.school_id = Number(filterSchool)
      if (filterSemester) params.semester_id = Number(filterSemester)
      setItems((await adminApi.listCourses(params)).data)
    } catch {
      toast.error('No se pudo cargar los cursos')
    } finally {
      setLoading(false)
    }
  }

  // Los catálogos de apoyo se piden una vez; los cursos, cada vez que cambian
  // los filtros (que resuelve el backend, no el navegador).
  useEffect(() => {
    Promise.all([adminApi.listSchools(), adminApi.listSemesters(), adminApi.listTeachers()])
      .then(([s, sem, t]) => { setSchools(s.data); setSemesters(sem.data); setTeachers(t.data) })
      .catch(() => toast.error('No se pudo cargar los catálogos de apoyo'))
  }, [])

  useEffect(() => { loadCourses() }, [filterSchool, filterSemester])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, school_id: schools[0]?.id || 0, semester_id: semesters[0]?.id || 0 })
    setFormOpen(true)
  }
  const openEdit = (c: Course) => {
    setEditing(c)
    setForm({ name: c.course_name, code: c.course_code, school_id: c.school_id, semester_id: c.semester_id })
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateCourse(editing.course_id, form)
        toast.success('Curso actualizado')
      } else {
        await adminApi.createCourse(form)
        toast.success('Curso creado')
      }
      setFormOpen(false)
      await loadCourses()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el curso')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!target) return
    setSaving(true)
    try {
      await adminApi.deleteCourse(target.course_id)
      toast.success('Curso eliminado')
      setTarget(null)
      await loadCourses()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar el curso')
    } finally {
      setSaving(false)
    }
  }

  const assign = async () => {
    if (!assignFor || !selectedTeacher) return
    setSaving(true)
    try {
      await adminApi.assignTeacher(assignFor.course_id, Number(selectedTeacher))
      toast.success('Docente asignado')
      setSelected('')
      await loadCourses()
      // Se refresca la referencia del curso abierto para que la lista del modal
      // muestre al docente recién agregado sin cerrarlo.
      const fresh = (await adminApi.listCourses({})).data.find(c => c.course_id === assignFor.course_id)
      if (fresh) setAssignFor(fresh)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo asignar el docente')
    } finally {
      setSaving(false)
    }
  }

  const unassign = async (teacherId: number) => {
    if (!assignFor) return
    setSaving(true)
    try {
      await adminApi.unassignTeacher(assignFor.course_id, teacherId)
      toast.success('Docente desasignado')
      await loadCourses()
      const fresh = (await adminApi.listCourses({})).data.find(c => c.course_id === assignFor.course_id)
      if (fresh) setAssignFor(fresh)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo desasignar el docente')
    } finally {
      setSaving(false)
    }
  }

  const teacherName = (id: number) =>
    teachers.find(t => t.id === id)?.full_name || `Docente #${id}`

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="card-title">Cursos</div>
          <div className="subtitle">{items.length} curso(s) según los filtros aplicados</div>
        </div>
        <div className="toolbar-spacer" />
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}>
          <option value="">Todas las escuelas</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)}>
          <option value="">Todos los semestres</option>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
        </select>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo curso</button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando cursos…</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">📚</span>No hay cursos con esos filtros</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Curso</th><th>Código</th><th>Escuela</th>
                  <th>Semestre</th><th>Docentes</th><th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => (
                  <tr key={c.course_id}>
                    <td className="cell-strong">{c.course_name}</td>
                    <td className="cell-mono">{c.course_code}</td>
                    <td><span className="badge badge-info">{c.school_code}</span></td>
                    <td>{c.semester} <span className="muted">{c.year}</span></td>
                    <td>
                      {c.teacher_ids.length === 0
                        ? <span className="badge badge-warning">Sin asignar</span>
                        : <span className="badge badge-primary">{c.teacher_ids.length}</span>}
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setAssignFor(c); setSelected('') }}>
                          Docentes
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setTarget(c)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alta / edición */}
      <Modal
        open={formOpen}
        title={editing ? 'Editar curso' : 'Nuevo curso'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}
              disabled={saving || !form.name || !form.code || !form.school_id || !form.semester_id}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">Nombre del curso</label>
          <input value={form.name} placeholder="Estructuras de Datos"
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">Código</label>
          <input value={form.code} placeholder="EDD-2026-2"
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </div>
        <div className="field">
          <label className="field-label">Escuela</label>
          <select value={form.school_id} onChange={e => setForm({ ...form, school_id: Number(e.target.value) })}>
            <option value={0}>Seleccione…</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Semestre</label>
          <select value={form.semester_id} onChange={e => setForm({ ...form, semester_id: Number(e.target.value) })}>
            <option value={0}>Seleccione…</option>
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
          </select>
        </div>
      </Modal>

      {/* Docentes del curso */}
      <Modal
        open={!!assignFor}
        title={`Docentes de ${assignFor?.course_name || ''}`}
        onClose={() => setAssignFor(null)}
        width={520}
        footer={<button className="btn btn-secondary" onClick={() => setAssignFor(null)}>Cerrar</button>}
      >
        <div className="row" style={{ marginBottom: 16 }}>
          <select value={selectedTeacher} onChange={e => setSelected(e.target.value)}>
            <option value="">Seleccione un docente…</option>
            {teachers
              .filter(t => !assignFor?.teacher_ids.includes(t.id))
              .map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.role_name}</option>)}
          </select>
          <button className="btn btn-primary nowrap" onClick={assign} disabled={saving || !selectedTeacher}>
            Asignar
          </button>
        </div>

        {assignFor?.teacher_ids.length === 0 ? (
          <div className="alert alert-warning">
            Este curso no tiene docentes asignados. Sin al menos uno, la base rechaza cualquier
            grabación que se intente registrar para él.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {assignFor?.teacher_ids.map(id => (
                  <tr key={id}>
                    <td className="cell-strong">{teacherName(id)}</td>
                    <td style={{ width: 1 }}>
                      <button className="btn btn-danger btn-sm nowrap" onClick={() => unassign(id)} disabled={saving}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!target}
        title="Eliminar curso"
        message={`¿Eliminar "${target?.course_name}"? Esta acción no se puede deshacer.`}
        warning="Si el curso tiene grabaciones o inscripciones activas, la base rechazará el borrado."
        busy={saving}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
