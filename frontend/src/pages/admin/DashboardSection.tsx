// src/pages/admin/DashboardSection.tsx
import { useEffect, useState } from 'react'
import api, { adminApi, usersApi, importApi } from '../../services/api'

interface Counts {
  semesters: number; schools: number; courses: number
  teachers: number; students: number; imports: number
  coursesWithoutTeacher: number
}

export default function DashboardSection({ onGo }: { onGo: (section: string) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // allSettled y no all: el servicio de analítica puede no estar arriba y eso
    // no debe dejar el panel entero sin datos.
    Promise.allSettled([
      adminApi.listSemesters(), adminApi.listSchools(), adminApi.listCourses(),
      adminApi.listTeachers(), usersApi.getAll(), importApi.listBatches(),
      api.get('/api/analytics/reports/system-stats'),
    ]).then(([sem, sch, crs, tch, usr, imp, sys]) => {
      const val = (r: any) => (r.status === 'fulfilled' ? r.value.data : [])
      const courses = val(crs)
      setCounts({
        semesters: val(sem).length,
        schools: val(sch).length,
        courses: courses.length,
        teachers: val(tch).length,
        students: val(usr).filter((u: any) => u.role_name === 'estudiante').length,
        imports: val(imp).length,
        coursesWithoutTeacher: courses.filter((c: any) => c.teacher_ids?.length === 0).length,
      })
      if (sys.status === 'fulfilled') setStats(sys.value.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading-block"><span className="spinner" /> Cargando panel…</div>

  const cards = [
    { label: 'Semestres',  value: counts?.semesters, color: 'var(--primary)',   go: 'semesters' },
    { label: 'Escuelas',   value: counts?.schools,   color: 'var(--secondary)', go: 'schools' },
    { label: 'Cursos',     value: counts?.courses,   color: '#1b4d1f',          go: 'courses' },
    { label: 'Docentes',   value: counts?.teachers,  color: '#5c3d05',          go: 'teachers' },
    { label: 'Estudiantes',value: counts?.students,  color: 'var(--on-secondary-container)', go: 'users' },
    { label: 'Cargas CSV', value: counts?.imports,   color: 'var(--error)',     go: 'import' },
  ]

  return (
    <>
      <div className="stat-grid">
        {cards.map(c => (
          <button key={c.label} className="stat-card" style={{ cursor: 'pointer', textAlign: 'left' }}
            onClick={() => onGo(c.go)}>
            <div className="stat-accent" style={{ background: c.color }} />
            <span className="stat-value" style={{ color: c.color }}>{c.value ?? 0}</span>
            <span className="stat-label">{c.label}</span>
          </button>
        ))}
      </div>

      {counts && counts.coursesWithoutTeacher > 0 && (
        <div className="alert alert-warning">
          <strong>{counts.coursesWithoutTeacher} curso(s) sin docente asignado.</strong>{' '}
          Mientras no tengan uno, la base rechazará cualquier grabación que se intente registrar
          para ellos —incluidas las de la carga masiva—.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => onGo('courses')}>Revisar cursos</button>
        </div>
      )}

      {stats && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Actividad de la plataforma</h2>
            <span className="badge badge-neutral">Servicio de analítica</span>
          </div>
          <div className="stat-grid">
            {[
              { label: 'Reproducciones', value: stats.total_platform_views ?? 0 },
              { label: 'Calificaciones', value: stats.total_platform_ratings ?? 0 },
              { label: 'Videos publicados', value: stats.total_videos ?? 0 },
              { label: '% recomendación', value: `${Number(stats.avg_recommendation ?? 0).toFixed(0)}%` },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
