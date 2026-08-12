// src/pages/AssignmentsPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api, { authApi } from '../services/api'

interface Course {
  course_id: number
  course_name: string
  course_code: string
  school_name: string
  semester: string
  year: number
}

interface Progress {
  course_id: number
  overall_progress: number
  videos_watched: number
  videos_completed: number
}

export default function AssignmentsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [courses, setCourses]   = useState<Course[]>([])
  const [progress, setProgress] = useState<Record<number, Progress>>({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/enrollments/my-courses')
        setCourses(res.data)

        // El progreso viene del servicio de analítica; si no responde, la
        // tarjeta del curso se muestra igual sin la barra.
        const progressMap: Record<number, Progress> = {}
        const userId = localStorage.getItem('userId') || '1'
        await Promise.all(
          res.data.map(async (c: Course) => {
            try {
              const pRes = await api.get(
                `/api/analytics/metrics/student/${userId}/course/${c.course_id}`,
              )
              if (pRes.data) progressMap[c.course_id] = pRes.data
            } catch { /* curso sin métricas todavía */ }
          }),
        )
        setProgress(progressMap)
      } catch (err) {
        console.error('Error cargando cursos:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* la sesión local se limpia igual */ }
    logout()
    navigate('/login')
  }

  const progressColor = (pct: number) =>
    pct >= 80 ? '#1b4d1f' : pct >= 40 ? '#a97a12' : 'var(--secondary)'

  return (
    <div className="public-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="sidebar-logo">Yo</span>
          <span>YoUSAC</span>
        </div>
        <div className="navbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/catalog')}>Catálogo</button>
          <span className="badge badge-info">{user?.role}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </nav>

      <div className="page-wrap">
        <div>
          <h1>Mis cursos</h1>
          <p className="subtitle">Cursos en los que estás inscrito y tu avance en cada uno</p>
        </div>

        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando cursos…</div>
        ) : courses.length === 0 ? (
          <div className="table-wrap">
            <div className="empty-state">
              <span className="empty-icon">📘</span>
              Todavía no estás inscrito en ningún curso
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {courses.map(c => {
              const p = progress[c.course_id]
              const pct = Math.round(p?.overall_progress ?? 0)
              return (
                <div key={c.course_id} className="card">
                  <div className="card-header">
                    <h2 className="card-title">{c.course_name}</h2>
                    <span className="badge badge-info">{c.course_code}</span>
                  </div>
                  <p className="subtitle" style={{ marginBottom: 4 }}>{c.school_name}</p>
                  <p className="muted" style={{ marginBottom: 14 }}>{c.semester} · {c.year}</p>

                  {p && (
                    <>
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="status-label muted">Progreso</span>
                        <span className="cell-strong">{pct}%</span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 'var(--radius-pill)',
                        background: 'var(--surface-container-high)', overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: progressColor(pct), transition: 'width .3s',
                        }} />
                      </div>
                      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                        {p.videos_completed} de {p.videos_watched} clases completadas
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
