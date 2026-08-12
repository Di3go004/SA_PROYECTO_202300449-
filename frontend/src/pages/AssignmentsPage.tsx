// src/pages/AssignmentsPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

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
  const navigate        = useNavigate()
  const { user, logout } = useAuth()

  const [courses,   setCourses]   = useState<Course[]>([])
  const [progress,  setProgress]  = useState<Record<number, Progress>>({})
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/enrollments/my-courses')
        setCourses(res.data)

        // Cargar progreso por curso desde analítica
        const progressMap: Record<number, Progress> = {}
        const userId = localStorage.getItem('userId') || '1'
        await Promise.all(
          res.data.map(async (c: Course) => {
            try {
              const pRes = await api.get(
                `/api/analytics/metrics/student/${userId}/course/${c.course_id}`
              )
              if (pRes.data) progressMap[c.course_id] = pRes.data
            } catch {}
          })
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
    try { await api.post('/api/auth/logout') } catch {}
    logout()
    navigate('/login')
  }

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return '#22c55e'
    if (pct >= 40) return '#f59e0b'
    return '#3b82f6'
  }

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🎓 YoUSAC</div>
        <div style={styles.navLinks}>
          <button className="btn btn-secondary" onClick={() => navigate('/catalog')} style={{ padding: '6px 14px' }}>
            Catálogo
          </button>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navUser}>{user?.email}</span>
          <span className="badge badge-blue">{user?.role}</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 14px' }}>
            Salir
          </button>
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>Mis Cursos Inscritos</h1>
          <p style={styles.pageSubtitle}>
            {courses.length} curso{courses.length !== 1 ? 's' : ''} inscrito{courses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div style={styles.loading}>Cargando tus cursos...</div>
        ) : courses.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No tenés cursos inscritos</p>
            <p style={{ fontSize: 13, color: '#64748b' }}>Contactá al administrador para gestionar tus inscripciones</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {courses.map(course => {
              const prog = progress[course.course_id]
              const pct  = Number(prog?.overall_progress ?? 0)

              return (
                <div key={course.course_id} style={styles.card}>
                  {/* Header */}
                  <div style={styles.cardHeader}>
                    <span className="badge badge-blue">{course.school_name}</span>
                    <span style={styles.semester}>{course.semester} {course.year}</span>
                  </div>

                  {/* Nombre del curso */}
                  <h2 style={styles.courseName}>{course.course_name}</h2>
                  <p style={styles.courseCode}>{course.course_code}</p>

                  {/* Barra de progreso */}
                  <div style={styles.progressSection}>
                    <div style={styles.progressHeader}>
                      <span style={styles.progressLabel}>Progreso global</span>
                      <span style={{ ...styles.progressPct, color: getProgressColor(pct) }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${pct}%`,
                        background: getProgressColor(pct),
                      }} />
                    </div>
                    {prog && (
                      <p style={styles.progressDetail}>
                        {prog.videos_completed} / {prog.videos_watched} clases completadas
                      </p>
                    )}
                  </div>

                  {/* Botón */}
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 16 }}
                    onClick={() => navigate(`/catalog?course_id=${course.course_id}`)}
                  >
                    Ver grabaciones →
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0f172a' },
  navbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
  },
  navBrand: { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  navLinks: { display: 'flex', gap: 8 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser: { fontSize: 13, color: '#94a3b8' },
  content: { padding: '24px', maxWidth: 1280, margin: '0 auto' },
  pageHeader: { marginBottom: 28 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: '#64748b' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, padding: 20,
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  semester: { fontSize: 12, color: '#64748b' },
  courseName: { fontSize: 17, fontWeight: 600, color: '#f1f5f9', marginBottom: 4, lineHeight: 1.3 },
  courseCode: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  progressSection: {},
  progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: '#94a3b8' },
  progressPct: { fontSize: 13, fontWeight: 700 },
  progressBar: { height: 6, background: '#334155', borderRadius: 99 },
  progressFill: { height: '100%', borderRadius: 99, transition: 'width 0.3s' },
  progressDetail: { fontSize: 12, color: '#64748b', marginTop: 6 },
  loading: { textAlign: 'center', color: '#64748b', padding: 60 },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 60 },
}
